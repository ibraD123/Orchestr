// Claude for Brand DNA: read a brand's materials into proposed traits, and write listing copy
// with the brand's compiled genome as binding instructions.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { MODEL, aiConfigured } from "./reviews.mjs";
import { safeFetch } from "./connectors/net.mjs";
import { htmlToText, decodeEntities } from "./connectors/normalise.mjs";

let client = null;
const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e; };
function ai() {
  if (!aiConfigured()) fail("This needs ANTHROPIC_API_KEY on the server", 503);
  return (client ||= new Anthropic());
}
async function ask({ system, content, schema, effort, maxTokens }) {
  const response = await ai().beta.messages.parse({
    model: MODEL,
    max_tokens: maxTokens || 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: effort || "low", format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content }]
  });
  if (response.stop_reason === "refusal") fail("The model declined this request", 422);
  if (response.stop_reason === "max_tokens") fail("The materials are too long for one pass; send fewer", 413);
  if (!response.parsed_output) fail("The model returned an unreadable answer", 502);
  return { model: response.model, out: response.parsed_output };
}

const Bi = z.object({ en: z.string(), ar: z.string() });

export const BrandAnalysis = z.object({
  voice: z.object({
    summary: Bi,
    formality: z.enum(["formal", "neutral", "friendly"]),
    dialect: z.enum(["gulf", "msa", "egyptian", "levantine", "mixed", "english_only"]),
    addressesBuyerAs: z.enum(["you", "we", "neutral"]),
    usesEmoji: z.boolean(),
    usesExclamation: z.boolean()
  }),
  visual: z.object({
    summary: Bi,
    lighting: z.string(), backgrounds: z.string(), composition: z.string(),
    textOnImage: z.enum(["none", "minimal", "moderate", "heavy"])
  }),
  palette: z.array(z.object({ hex: z.string(), role: z.enum(["background", "primary", "accent", "text"]), seenIn: z.string() })),
  logoPlacement: z.enum(["top-end", "top-start", "bottom", "unknown"]),
  numerals: z.enum(["arabic", "western", "mixed", "unknown"]),
  words: z.object({ prefer: z.array(z.string()), avoid: z.array(z.string()) }),
  rules: z.array(z.object({ kind: z.enum(["voice", "visual"]), statement: Bi, source: z.string() }))
});

const ANALYSE_SYSTEM = `You build the Brand DNA profile for a brand that sells on Amazon, Noon, Salla, Zid and Shopify in the Gulf and Egypt. You get some of: its brand book, its website text, its logo, product photos, ads, and examples of copy the brand liked.

Describe only what the materials show; when something isn't shown, say so plainly in the summary instead of guessing, and use "unknown" where the schema allows it.
- voice: how the brand writes in Arabic and English; summary in one or two sentences per language, written as an instruction a copywriter can follow ("Warm, hospitable Gulf Arabic...").
- visual: lighting, backgrounds, composition and how much text goes on images, again as instructions.
- palette: up to 5 brand colours as #RRGGBB, each with its role and where you saw it. Leave out colours that only belong to one product.
- logoPlacement: where the logo sits on the brand's own visuals, if visible.
- numerals: which digits the Arabic copy uses.
- words: words and phrases the brand clearly prefers, and ones its brand book forbids or that clash with its positioning. Short lists, no generic words.
- rules: explicit do's and don'ts from the brand book (with page or section in source), plus at most three you infer with high confidence (source "inferred").`;

/**
 * @param {{ name?: string, texts?: string[], images?: string[], pdf?: string, url?: string }} input
 * @returns {{ model, analysis, proposals: Array<{ type, params, note }>, palette, logoPos }}
 */
export async function analyseBrand(input) {
  const content = [];
  const sources = [];
  if (input.pdf) {
    const m = /^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/.exec(String(input.pdf));
    if (!m) fail("The brand book must be a PDF");
    if (m[1].length > 30_000_000) fail("The brand book is larger than 22 MB");
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: m[1] }, title: "Brand book" });
    sources.push("brand book");
  }
  for (const [i, img] of (input.images || []).slice(0, 6).entries()) {
    const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(img));
    if (!m) fail(`Image ${i + 1} must be a PNG, JPEG, WebP or GIF`);
    content.push({ type: "text", text: `Image ${i + 1}:` }, { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  if ((input.images || []).length) sources.push("images");
  let site = "";
  if (input.url) {
    const r = await safeFetch(String(input.url), { headers: { Accept: "text/html" } });
    const html = r.body.toString("utf8");
    const meta = (p) => (html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${p}["'][^>]*content=["']([^"']*)["']`, "i")) || [])[1] || "";
    site = [`Website ${r.url}`, "Title: " + decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").trim(), "Description: " + decodeEntities(meta("description")), "Theme colour: " + meta("theme-color"), htmlToText(html).slice(0, 8000)].join("\n");
    sources.push("website");
  }
  const texts = (input.texts || []).map((t) => String(t).trim()).filter(Boolean).slice(0, 40);
  if (texts.length) sources.push("copy examples");
  if (!content.length && !site && !texts.length) fail("Add a brand book, website, images or copy examples");
  content.push({ type: "text", text: [`Brand: ${String(input.name || "unknown").slice(0, 120)}`, site, texts.length ? "Copy the brand liked:\n" + texts.map((t) => "- " + t.slice(0, 600)).join("\n") : ""].filter(Boolean).join("\n\n") });

  const { model, out } = await ask({ system: ANALYSE_SYSTEM, content, schema: BrandAnalysis, effort: "medium", maxTokens: 12000 });
  return Object.assign({ model, sources }, proposalsFrom(out, sources.join(", ")));
}

/** Turn an analysis into trait proposals the person accepts or dismisses. Pure, so it is tested. */
export function proposalsFrom(a, source) {
  const p = [];
  const note = "AI analysis of " + (source || "materials");
  p.push({ type: "voice", params: { text: a.voice.summary.en, textAr: a.voice.summary.ar }, note });
  p.push({ type: "visual", params: { text: [a.visual.summary.en, a.visual.lighting, a.visual.backgrounds, a.visual.composition].filter(Boolean).join(" "), textAr: a.visual.summary.ar }, note });
  if (!a.voice.usesEmoji) p.push({ type: "noEmoji", params: {}, note });
  if (!a.voice.usesExclamation) p.push({ type: "noExclamation", params: {}, note });
  if (a.numerals === "arabic" || a.numerals === "western") p.push({ type: "numerals", params: { style: a.numerals }, note });
  if (a.logoPlacement !== "unknown") p.push({ type: "logo", params: { required: true }, note });
  if (a.visual.textOnImage === "none" || a.visual.textOnImage === "minimal") p.push({ type: "textDensity", params: { maxChars: a.visual.textOnImage === "none" ? 40 : 90 }, note });
  for (const w of a.words.avoid.slice(0, 10)) if (w.trim()) p.push({ type: "avoidWord", params: { word: w.trim(), lang: /[؀-ۿ]/.test(w) ? "ar" : "en" }, note });
  for (const w of a.words.prefer.slice(0, 10)) if (w.trim()) p.push({ type: "preferWord", params: { word: w.trim(), lang: /[؀-ۿ]/.test(w) ? "ar" : "en" }, note });
  for (const r of a.rules.slice(0, 12)) p.push({ type: r.kind, params: { text: r.statement.en, textAr: r.statement.ar }, note: r.source || note });
  const palette = a.palette.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c.hex)).slice(0, 5).map((c) => ({ hex: c.hex.toUpperCase(), role: c.role, seenIn: c.seenIn }));
  return { analysis: a, proposals: p, palette, logoPos: a.logoPlacement !== "unknown" ? a.logoPlacement : null };
}

export const CopyDraft = z.object({
  titleEn: z.string(), titleAr: z.string(),
  bulletsEn: z.array(z.string()), bulletsAr: z.array(z.string()),
  changes: z.array(Bi)
});

const COPY_SYSTEM = `You write marketplace listing copy (titles and bullet points) in English and Arabic for brands selling on Amazon, Noon, Salla, Zid and Shopify in the Gulf.

The Brand DNA block in the request is binding: follow its voice and every rule, stronger rules first, and match the approved examples' style. Where it is silent:
- Arabic reads as natural Gulf-market copy, not a translation; English is plain and specific.
- Titles lead with brand and product type, then the one or two facts buyers filter on (size, volume, material, colour). Respect the channel's title limit.
- 3 to 5 bullets per language, each one fact or benefit a buyer can check. Answer the doubts in "Problems to fix".
- Use the missing search terms where they are true for this product.

Never invent specifications, ingredients, certifications or durations that the listing doesn't state. Never make medical or health claims. In "changes", list what you changed and why, one short line each in English and Arabic.`;

/**
 * @param {{ product, channel, category, listing: { titleEn, titleAr, bulletsEn, bulletsAr }, issues?: string[], missingKeywords?: Array<{ar,en}>, brief?: string }} input
 */
export async function writeCopy(input) {
  const l = input.listing || {};
  if (!l.titleEn && !l.titleAr) fail("Send the current title");
  const limits = { amazon: 200, noon: 150, salla: 120, zid: 120, shopify: 150 };
  const text = [
    "Brand DNA (binding):\n" + String(input.brief || "No Brand DNA yet: write in a neutral, trustworthy marketplace voice.").slice(0, 12000),
    `Channel: ${input.channel || "noon"} (title limit ${limits[input.channel] || 150} characters). Category: ${input.category || "unknown"}.`,
    "Current listing:\n" + JSON.stringify({ titleEn: l.titleEn || "", titleAr: l.titleAr || "", bulletsEn: l.bulletsEn || [], bulletsAr: l.bulletsAr || [] }, null, 1).slice(0, 6000),
    (input.issues || []).length ? "Problems to fix:\n" + input.issues.slice(0, 15).map((x) => "- " + x).join("\n") : "",
    (input.missingKeywords || []).length ? "Missing search terms:\n" + input.missingKeywords.slice(0, 12).map((k) => `- ${k.ar} / ${k.en}`).join("\n") : ""
  ].filter(Boolean).join("\n\n");
  const { model, out } = await ask({ system: COPY_SYSTEM, content: text, schema: CopyDraft, effort: "medium", maxTokens: 8000 });
  return Object.assign({ model }, out);
}
