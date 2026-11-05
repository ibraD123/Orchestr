// Slides drawn whole by an image model, with a guarantee: nothing reaches a person unless the
// text on it was read back and matches the approved text letter for letter.
//
//   1. Short-text slides go to the image model (scene, product from the reference photo, headline).
//   2. Every image is checked: Claude transcribes the text blind and it is compared in code,
//      including letter joining, direction and digit style; the product's colours are compared
//      with the original photo.
//   3. A failed image is generated again, up to 3 attempts.
//   4. If all fail, the same scene is generated without text and the headline is typeset over it.
//   5. Long text and exact figures (size charts, specs, lists) are always typeset.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { MODEL, aiConfigured } from "./reviews.mjs";
import { planSlide, slidePrompt, compareTexts } from "./textcheck.mjs";
import { sceneHTML } from "./templates.mjs";
import { generateImages, imageGenConfigured } from "./imagegen.mjs";
import { renderSlide, renderHtml, fitSlideImage, imageFidelity } from "./render.mjs";

export const MAX_ATTEMPTS = 3;

export const TextReadback = z.object({
  overlayTexts: z.array(z.string()),
  productTexts: z.array(z.string()),
  arabicRendering: z.enum(["none", "correct", "broken"]),
  problems: z.array(z.string())
});

const SYSTEM = `You proofread text on e-commerce images for Amazon, Noon, Salla and Zid listings in the Gulf.

Transcribe the text you see, exactly as drawn. Do not correct spelling, grammar, missing letters or wrong letters: copy what is there. Keep the digit style as drawn: Arabic-Indic (٠١٢٣٤٥٦٧٨٩) or Western (0123456789). If a character is unreadable or malformed, write � in its place.

overlayTexts: the text added to the design (headlines, captions, badges, offers), one entry per line, in reading order.
productTexts: text printed on the product itself or its packaging (labels, brand names on the bottle). Keep these separate.

arabicRendering for the overlay text: "none" if there is no Arabic, "correct" if every Arabic word reads right to left with letters properly joined in their correct initial, medial and final forms, "broken" if any letters that should join are disconnected, shown in isolated forms inside a word, reversed, mirrored, or drawn as invented glyphs.

problems: anything else wrong with the text as a design element, in short plain English ("second line cut off at the right edge", "English word misspelled as 'Parfum'"). Empty if none.`;

let client = null;

/** Blind transcription by Claude; the comparison happens in code (compareTexts). */
export async function readBackText(image) {
  if (!aiConfigured()) { const e = new Error("Checking text on images needs ANTHROPIC_API_KEY on the server"); e.status = 503; throw e; }
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(image || ""));
  if (!m) { const e = new Error("The image to check must be a PNG, JPEG or WebP data URL"); e.status = 400; throw e; }
  client ||= new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(TextReadback) },
    system: SYSTEM,
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } }, { type: "text", text: "Transcribe and check the text on this image." }] }]
  });
  if (response.stop_reason === "refusal") { const e = new Error("The model declined to read this image"); e.status = 422; throw e; }
  if (!response.parsed_output) { const e = new Error("The model returned an unreadable check"); e.status = 502; throw e; }
  return response.parsed_output;
}

/** Decide whether one generated image may be shown. Pure. */
export function judgeImage({ expected, readback, fidelity, minFidelity = 0.8 }) {
  const text = compareTexts(expected, readback.overlayTexts);
  const reasons = text.issues.map((i) => i.type + (i.text ? ": " + i.text : ""));
  const needsArabic = expected.some((t) => t.lang === "ar");
  if (needsArabic && readback.arabicRendering !== "correct") reasons.push("arabic: " + readback.arabicRendering);
  if (readback.overlayTexts.some((t) => t.includes("�"))) reasons.push("unreadable characters");
  if (fidelity && (!fidelity.ok || fidelity.score < minFidelity)) reasons.push("product colour differs (" + Math.round((fidelity.score || 0) * 100) + "%)");
  return { ok: reasons.length === 0, reasons, text };
}

const realDeps = {
  generate: (req) => generateImages(req),
  readBack: (image) => readBackText(image),
  fidelity: (a, b) => imageFidelity(a, b),
  fit: async (image) => "data:image/png;base64," + (await fitSlideImage(image)).toString("base64"),
  typeset: async (spec) => "data:image/png;base64," + (await renderSlide(spec)).toString("base64"),
  scene: async (ctx) => "data:image/png;base64," + (await renderHtml(sceneHTML(ctx))).toString("base64")
};

export function slideGenConfigured() { return imageGenConfigured() && aiConfigured(); }

/**
 * @param {{ template, fields, image, kit?, language?, numerals?, fonts?, logo?, brand?, product?, category?, visual? }} input
 * @returns {{ mode: "generated"|"scene"|"typeset", reason, image, attempts: Array<{ ok, reasons, readback? }> }}
 */
export async function generateSlide(input, deps = realDeps) {
  const opts = { language: input.language || "both", numerals: input.numerals === "western" ? "western" : "arabic" };
  const plan = planSlide(input.template, input.fields, opts);
  const spec = { template: input.template, fields: input.fields, image: input.image, kit: input.kit, language: opts.language, numerals: opts.numerals, fonts: input.fonts, logo: input.logo, brand: input.brand };
  if (plan.mode === "typeset") return { mode: "typeset", reason: plan.reason, image: await deps.typeset(spec), attempts: [] };

  const base = { templateId: input.template, texts: plan.texts, product: input.product, category: input.category, kit: input.kit, visual: input.visual, numerals: opts.numerals };
  const attempts = [];
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    const [img] = await deps.generate({ prompt: slidePrompt(base), image: input.image, count: 1, aspect: "4:5" });
    if (!img) { attempts.push({ ok: false, reasons: ["no image returned"] }); continue; }
    const [readback, fidelity] = await Promise.all([deps.readBack(img), deps.fidelity(input.image, img).catch(() => null)]);
    const verdict = judgeImage({ expected: plan.texts, readback, fidelity });
    attempts.push({ ok: verdict.ok, reasons: verdict.reasons, readback: readback.overlayTexts, fidelity: fidelity && fidelity.score });
    if (verdict.ok) return { mode: "generated", reason: "checked", image: await deps.fit(img), attempts };
  }

  // Fallback: the scene without text, with the headline typeset in its empty top third.
  const [bg] = await deps.generate({ prompt: slidePrompt({ ...base, withText: false }), image: input.image, count: 1, aspect: "4:5" });
  if (bg) {
    const [readback, fidelity] = await Promise.all([deps.readBack(bg), deps.fidelity(input.image, bg).catch(() => null)]);
    const clean = readback.overlayTexts.join("").replace(/\s/g, "").length === 0;
    const colourOk = !fidelity || (fidelity.ok && fidelity.score >= 0.8);
    attempts.push({ ok: clean && colourOk, reasons: [clean ? "" : "scene has text", colourOk ? "" : "product colour differs"].filter(Boolean), scene: true });
    if (clean && colourOk) {
      const v = Object.fromEntries(plan.texts.map((t) => [t.key, t.text]));
      const head = { headAr: v.headAr || v.quoteAr || v.titleAr || "", headEn: v.headEn || v.quoteEn || v.titleEn || "" };
      return { mode: "scene", reason: "textFailed", image: await deps.scene({ background: bg, ...head, kit: input.kit, language: opts.language, numerals: opts.numerals, fonts: input.fonts, logo: input.logo, brand: input.brand }), attempts };
    }
  }
  // Nothing generated passed: the template, which is always correct.
  return { mode: "typeset", reason: "generationFailed", image: await deps.typeset(spec), attempts };
}
