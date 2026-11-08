// Slides drawn whole by an image model, with a guarantee: nothing reaches a person unless the
// text on it was read back and matches the approved text letter for letter.
//
//   1. Short-text slides go to the image model (scene, product from the reference photo, headline).
//   2. Every image is checked: Claude transcribes the text blind and it is compared in code,
//      including letter joining, direction and digit style; the product's colours are compared
//      with the original photo; Claude compares the product's shape and logo with the photo; and
//      photorealistic people are noted, since Amazon wants AI-generated people labelled.
//   3. When two image models are configured, each round asks both (text goes to the one that
//      letters best) and keeps the better image that passes. A failed round runs again, up to 3.
//   4. If all fail, the same scene is generated without text and the headline is typeset over it.
//   5. Long text and exact figures (size charts, specs, lists) are always typeset.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { MODEL, aiConfigured } from "./reviews.mjs";
import { planSlide, slidePrompt, compareTexts } from "./textcheck.mjs";
import { sceneHTML } from "./templates.mjs";
import { generateImages, imageGenConfigured, routeProviders } from "./imagegen.mjs";
import { renderSlide, renderHtml, fitSlideImage, imageFidelity } from "./render.mjs";

export const MAX_ATTEMPTS = 3;
export const BEST_OF = 2;

export const TextReadback = z.object({
  overlayTexts: z.array(z.string()),
  productTexts: z.array(z.string()),
  arabicRendering: z.enum(["none", "correct", "broken"]),
  photorealPeople: z.boolean(),
  problems: z.array(z.string())
});

export const ProductCheck = z.object({
  sameProduct: z.boolean(),
  shape: z.enum(["same", "changed"]),
  logo: z.enum(["intact", "changed", "missing", "none"]),
  problems: z.array(z.string())
});

const SYSTEM = `You proofread text on e-commerce images for Amazon, Noon, Salla and Zid listings in the Gulf.

Transcribe the text you see, exactly as drawn. Do not correct spelling, grammar, missing letters or wrong letters: copy what is there. Keep the digit style as drawn: Arabic-Indic (٠١٢٣٤٥٦٧٨٩) or Western (0123456789). If a character is unreadable or malformed, write � in its place.

overlayTexts: the text added to the design (headlines, captions, badges, offers), one entry per line, in reading order.
productTexts: text printed on the product itself or its packaging (labels, brand names on the bottle). Keep these separate.

arabicRendering for the overlay text: "none" if there is no Arabic, "correct" if every Arabic word reads right to left with letters properly joined in their correct initial, medial and final forms, "broken" if any letters that should join are disconnected, shown in isolated forms inside a word, reversed, mirrored, or drawn as invented glyphs.

photorealPeople: true if the image shows a photorealistic person or part of one (face, hands holding the product), false for no people or clearly illustrated ones.

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

const PRODUCT_SYSTEM = `You check AI-generated e-commerce images against the seller's real product photo. The first image is the real product; the second is generated.

sameProduct: is the generated product the same item a buyer would receive (same type, model, variant)?
shape: "changed" if its shape, proportions, cut, cap, handle or other parts differ from the real one, or parts were added or removed. Ignore angle, lighting and background.
logo: "intact" if the logo and brand marks on the product match the real one, "changed" if they are misspelled, distorted or replaced, "missing" if the real product shows one and the generated does not, "none" if the real product has no visible logo.
problems: short plain English notes on anything that would mislead a buyer. Empty if none.`;

/** Claude compares the generated product with the real photo: shape, parts and logo. */
export async function checkProduct(reference, image) {
  if (!aiConfigured()) { const e = new Error("Checking products on images needs ANTHROPIC_API_KEY on the server"); e.status = 503; throw e; }
  const img = (src) => { const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(src || "")); return m && { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } }; };
  const a = img(reference), b = img(image);
  if (!a || !b) { const e = new Error("Both images must be PNG, JPEG or WebP data URLs"); e.status = 400; throw e; }
  client ||= new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ProductCheck) },
    system: PRODUCT_SYSTEM,
    messages: [{ role: "user", content: [{ type: "text", text: "Real product:" }, a, { type: "text", text: "Generated image:" }, b, { type: "text", text: "Compare the product." }] }]
  });
  if (!response.parsed_output) { const e = new Error("The model returned an unreadable product check"); e.status = 502; throw e; }
  return response.parsed_output;
}

/** Decide whether one generated image may be shown. Pure. */
export function judgeImage({ expected, readback, fidelity, product, minFidelity = 0.8 }) {
  const text = compareTexts(expected, readback.overlayTexts);
  const reasons = text.issues.map((i) => i.type + (i.text ? ": " + i.text : ""));
  const needsArabic = expected.some((t) => t.lang === "ar");
  if (needsArabic && readback.arabicRendering !== "correct") reasons.push("arabic: " + readback.arabicRendering);
  if (readback.overlayTexts.some((t) => t.includes("�"))) reasons.push("unreadable characters");
  if (fidelity && (!fidelity.ok || fidelity.score < minFidelity)) reasons.push("product colour differs (" + Math.round((fidelity.score || 0) * 100) + "%)");
  if (product) {
    if (!product.sameProduct) reasons.push("not the same product");
    if (product.shape === "changed") reasons.push("product shape changed");
    if (product.logo === "changed" || product.logo === "missing") reasons.push("logo " + product.logo);
  }
  // Among images that pass, prefer the closest colours; a product check that passed adds confidence.
  const score = (fidelity && fidelity.score != null ? fidelity.score : 0.85) + (product && product.sameProduct ? 0.05 : 0);
  return { ok: reasons.length === 0, reasons, text, score, people: Boolean(readback.photorealPeople) };
}

const realDeps = {
  generate: (req) => generateImages(req),
  readBack: (image) => readBackText(image),
  fidelity: (a, b) => imageFidelity(a, b),
  checkProduct: (a, b) => checkProduct(a, b),
  providers: (task) => routeProviders(task).map((p) => p.name),
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
  const refs = typeof input.modelRef === "string" && /^data:image\//.test(input.modelRef) ? [input.modelRef] : [];
  const withModel = (prompt) => refs.length ? prompt + "\nIf a person appears, it is the brand's model from the second reference image: the same face, skin tone and build." : prompt;
  // Best of several: one image per configured model each round (text goes to the best letterer first).
  const routed = deps.providers ? deps.providers("text") : [];
  const lanes = (input.bestOf ? Array.from({ length: Math.min(3, input.bestOf) }, (_, i) => routed[i % Math.max(1, routed.length)] || null) : routed.slice(0, BEST_OF));
  if (!lanes.length) lanes.push(null);
  const judge = async (img) => {
    const [readback, fidelity, product] = await Promise.all([
      deps.readBack(img),
      deps.fidelity(input.image, img).catch(() => null),
      deps.checkProduct ? deps.checkProduct(input.image, img).catch(() => null) : null
    ]);
    return { readback, fidelity, product, verdict: judgeImage({ expected: plan.texts, readback, fidelity, product }) };
  };
  const attempts = [];
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    const round = await Promise.all(lanes.map(async (provider) => {
      const req = { prompt: withModel(slidePrompt(base)), image: input.image, refs, count: 1, aspect: "4:5", task: "text" };
      if (provider) req.provider = provider;
      const [img] = await deps.generate(req).catch(() => []);
      if (!img) return { img: null, provider };
      return { img, provider, ...(await judge(img)) };
    }));
    let best = null;
    for (const r of round) {
      if (!r.img) { attempts.push({ ok: false, reasons: ["no image returned"], provider: r.provider }); continue; }
      attempts.push({ ok: r.verdict.ok, reasons: r.verdict.reasons, readback: r.readback.overlayTexts, fidelity: r.fidelity && r.fidelity.score, product: r.product, provider: r.provider });
      if (r.verdict.ok && (!best || r.verdict.score > best.verdict.score)) best = r;
    }
    if (best) return { mode: "generated", reason: "checked", image: await deps.fit(best.img), attempts, provider: best.provider, aiPeople: best.verdict.people };
  }

  // Fallback: the scene without text, with the headline typeset in its empty top third.
  const [bg] = await deps.generate({ prompt: withModel(slidePrompt({ ...base, withText: false })), image: input.image, refs, count: 1, aspect: "4:5", task: "scene" }).catch(() => []);
  if (bg) {
    const { readback, fidelity, product } = await judge(bg);
    const clean = readback.overlayTexts.join("").replace(/\s/g, "").length === 0;
    const colourOk = !fidelity || (fidelity.ok && fidelity.score >= 0.8);
    const productOk = !product || (product.sameProduct && product.shape !== "changed" && product.logo !== "changed" && product.logo !== "missing");
    attempts.push({ ok: clean && colourOk && productOk, reasons: [clean ? "" : "scene has text", colourOk ? "" : "product colour differs", productOk ? "" : "product changed"].filter(Boolean), scene: true });
    if (clean && colourOk && productOk) {
      const v = Object.fromEntries(plan.texts.map((t) => [t.key, t.text]));
      const head = { headAr: v.headAr || v.quoteAr || v.titleAr || "", headEn: v.headEn || v.quoteEn || v.titleEn || "" };
      return { mode: "scene", reason: "textFailed", aiPeople: Boolean(readback.photorealPeople), image: await deps.scene({ background: bg, ...head, kit: input.kit, language: opts.language, numerals: opts.numerals, fonts: input.fonts, logo: input.logo, brand: input.brand }), attempts };
    }
  }
  // Nothing generated passed: the template, which is always correct.
  return { mode: "typeset", reason: "generationFailed", image: await deps.typeset(spec), attempts };
}
