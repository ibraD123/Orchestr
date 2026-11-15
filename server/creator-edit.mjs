// Creator's raster workflow: ask an image model to edit the selected revision or create a
// new composition from a real product photo. The caller persists every result as a new
// revision; this adapter never changes the source and never falls back to typeset layers.
import { generateImages, imageGenConfigured, routeProviders } from "./imagegen.mjs";
import { llmConfigured } from "./llm.mjs";
import { readBackText, checkProduct, TextReadback, ProductCheck } from "./slidegen.mjs";
import { compareTexts } from "./textcheck.mjs";
import { ConnectorError } from "./connectors/net.mjs";

export const CREATOR_EDIT_LIMITS = Object.freeze({ imageBytes: 20_000_000, prompt: 6000, texts: 12, text: 500 });
export const CREATOR_IMAGE_ASPECTS = Object.freeze(["1:1", "4:5", "3:4", "9:16", "16:9"]);
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const HAS_ARABIC = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/;

function fail(message, status = 400) { throw new ConnectorError(message, status); }

function text(value, label, max, required = false) {
  if (value == null && !required) return "";
  if (typeof value !== "string") fail(`${label} must be text`);
  const clean = value.trim();
  if (required && !clean) fail(`${label} is required`);
  if (clean.length > max) fail(`${label} is too long (maximum ${max} characters)`);
  return clean;
}

/** Only inline raster images are accepted: this operation does not fetch arbitrary URLs. */
function imageData(value, label, status = 400) {
  if (typeof value !== "string") fail(`${label} must be a PNG, JPEG or WebP data URL`, status);
  // Bound allocation before decoding. Base64 is canonical so a provider cannot return an
  // unchanged source image under a different encoding and have it recorded as a new result.
  if (value.length > Math.ceil(CREATOR_EDIT_LIMITS.imageBytes / 3) * 4 + 64) fail(`${label} is too large`, status);
  const match = DATA_URL.exec(value);
  if (!match) fail(`${label} must be a PNG, JPEG or WebP data URL`, status);
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > CREATOR_EDIT_LIMITS.imageBytes) fail(`${label} is too large`, status);
  if (!bytes.length || bytes.toString("base64") !== match[2]) fail(`${label} contains invalid base64`, status);
  const valid = match[1] === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : match[1] === "image/jpeg" ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) fail(`${label} does not match its image format`, status);
  return value;
}

/** Validate the request independently of model availability (also used by route handlers). */
export function normaliseCreatorEdit(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("Send a Creator image request");
  const mode = input.mode == null ? "edit" : input.mode;
  if (!["edit", "generate"].includes(mode)) fail("Creator image mode must be edit or generate");
  const language = input.language == null || input.language === "bilingual" ? "both" : input.language;
  if (!["en", "ar", "both", "none"].includes(language)) fail("Creator language must be en, ar, bilingual, both or none");
  const aspect = input.aspect == null ? "4:5" : input.aspect;
  if (!CREATOR_IMAGE_ASPECTS.includes(aspect)) fail(`Creator image aspect must be ${CREATOR_IMAGE_ASPECTS.join(", ")}`);
  let approvedTexts;
  if (input.approvedTexts !== undefined) {
    if (!Array.isArray(input.approvedTexts) || input.approvedTexts.length > CREATOR_EDIT_LIMITS.texts) fail(`Approved text must contain at most ${CREATOR_EDIT_LIMITS.texts} lines`);
    approvedTexts = input.approvedTexts.map((line) => {
      if (!line || typeof line !== "object" || !["en", "ar"].includes(line.lang)) fail("Every approved line needs text and language en or ar");
      if (language === "none") fail("A shared no-text image cannot contain approved overlay text");
      if (language !== "both" && line.lang !== language) fail("Approved text language does not match the Creator language");
      return { text: text(line.text, "Approved text", CREATOR_EDIT_LIMITS.text, true), lang: line.lang };
    });
  }
  if (language === "none") approvedTexts = [];
  return {
    mode, language, aspect, approvedTexts,
    image: imageData(input.image, mode === "edit" ? "Selected revision image" : "Product image"),
    originalImage: input.originalImage == null ? null : imageData(input.originalImage, "Original product image"),
    styleRefs: Array.isArray(input.styleRefs)&&input.styleRefs.length<=3?input.styleRefs.map(i=>imageData(i,"Direction reference image")):[],
    modelRef: input.modelRef == null ? null : imageData(input.modelRef, "Model reference image"),
    prompt: text(input.prompt, "Edit instruction", CREATOR_EDIT_LIMITS.prompt, true),
    product: text(input.product, "Product description", 500),
    category: text(input.category, "Category", 100),
    visual: text(input.visual, "Visual direction", 2000)
  };
}

/** A free instruction is sufficient; a static template is deliberately not required. */
export function creatorEditPrompt(spec) {
  const references = [];
  if (spec.originalImage && spec.originalImage !== spec.image) references.push({ role: "product", image: spec.originalImage });
  if (spec.modelRef && spec.modelRef !== spec.image && !references.some((r) => r.image === spec.modelRef)) references.push({ role: "model", image: spec.modelRef });
  for(const ref of spec.styleRefs||[])if(!references.some(r=>r.image===ref)&&ref!==spec.image)references.push({role:"direction",image:ref});
  const parts = [
    spec.mode === "generate"
      ? `Create a finished ${spec.aspect} marketplace listing image using the real product in the FIRST reference image. Build the composition from the instruction below.`
      : "Edit the FIRST reference image, which is the selected current raster revision. Follow the requested change closely and preserve the remaining composition, lighting, styling and product details as much as possible.",
    "This is an image-to-image operation, with all text drawn inside the resulting image. Return one complete image.",
    spec.product ? `Product: ${spec.product}${spec.category ? ` (${spec.category})` : ""}.` : "",
    "Keep the actual product faithful: same variant, shape, proportions, colour, material, packaging, label, logo and printed brand spelling. Do not invent features, ingredients, certifications, prices or performance claims.",
    ...references.map((r, i) => r.role === "product"
      ? `Reference ${i + 2} is the ORIGINAL product photo, the authority for the product's appearance and printed label. It is a fidelity reference, not a second layout to copy.`
      : r.role === "direction" ? `Reference ${i + 2} is a client-approved STYLE reference: follow its lighting, composition and typography density. Do not copy its product, measurements, logos or claims onto this product.`
      : `Reference ${i + 2} is the selected brand model. If a person appears, use the same person, face, skin tone and build, while following the requested clothing and composition.`),
    spec.visual ? `Brand visual direction: ${spec.visual}` : "",
    "REQUESTED CHANGE / COMPOSITION:", spec.prompt,
    spec.language === "none" ? "This is a shared no-text image. Do not add any overlay text. Preserve authentic writing printed on the product itself."
      : `Overlay language: ${spec.language === "both" ? "Arabic and English" : spec.language === "ar" ? "Arabic" : "English"}. Arabic must read right to left with correctly joined letters and sensible line breaks. Keep numeral styles exactly as requested. Do not mirror product logos or English print.`,
    "Keep text fully inside the canvas, legible at mobile size, with generous margins. Do not add watermarks or interface elements."
  ].filter(Boolean);
  if (spec.approvedTexts !== undefined) {
    parts.push(spec.approvedTexts.length ? "APPROVED OVERLAY COPY — render only these lines, exactly as written; replace other overlay text. Preserve print on the product itself:" : "Render NO overlay text, letters or numbers. Preserve the real print on the product itself.");
    parts.push(...spec.approvedTexts.map((line) => `${line.lang === "ar" ? "Arabic RTL" : "English"}: ${JSON.stringify(line.text)}`));
    parts.push("Do not translate, rewrite, add words, change numbers or invent punctuation in the approved copy.");
  }
  return { prompt: parts.join("\n"), refs: references.map((r) => r.image) };
}

/** Checks are evidence for review, never a pixel-preservation or publication guarantee. */
export function judgeCreatorCandidate({ approvedTexts, readback, product, errors = [], aspect }) {
  const reasons = errors.map((e) => `${e.stage}: ${e.message}`);
  const comparison = approvedTexts === undefined || !readback ? null : compareTexts(approvedTexts, readback.overlayTexts);
  if (approvedTexts === undefined) reasons.push("Approved overlay text was not supplied; review the readback before approving this image");
  if (comparison) reasons.push(...comparison.issues.map((i) => `text ${i.type}${i.text ? ": " + i.text : ""}`));
  if (readback) {
    const needsArabic = (approvedTexts || []).some((line) => line.lang === "ar") || readback.overlayTexts.some((line) => HAS_ARABIC.test(line));
    if (needsArabic && readback.arabicRendering !== "correct") reasons.push(`arabic: ${readback.arabicRendering}`);
    if (readback.arabicRendering === "broken" && !needsArabic) reasons.push("arabic: broken");
    if (readback.overlayTexts.some((line) => line.includes("�"))) reasons.push("Unreadable overlay characters");
    reasons.push(...readback.problems.map((problem) => `text: ${problem}`));
  } else if (!errors.some((e) => e.stage === "readback")) reasons.push("Text readback is unavailable");
  if (product) {
    if (!product.sameProduct) reasons.push("Not the same product");
    if (product.shape === "changed") reasons.push("Product shape changed");
    if (["changed", "missing"].includes(product.logo)) reasons.push(`Product logo ${product.logo}`);
    reasons.push(...product.problems.map((problem) => `product: ${problem}`));
  } else if (!errors.some((e) => e.stage === "product")) reasons.push("Product check is unavailable");
  if (aspect && aspect.matches === false) reasons.push(`Image aspect ${aspect.actual} differs from requested ${aspect.requested}`);
  if (aspect && aspect.matches === null) reasons.push("Generated image dimensions could not be verified");
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)], text: comparison, textApproval: approvedTexts === undefined ? "not_supplied" : "compared" };
}

/** Read raster dimensions without launching a renderer or trusting a provider's aspect claim. */
export function creatorImageDimensions(dataUrl) {
  const match = DATA_URL.exec(String(dataUrl || ""));
  if (!match) return null;
  const b = Buffer.from(match[2], "base64");
  const size = (width, height) => width > 0 && height > 0 && width <= 100_000 && height <= 100_000 ? { width, height } : null;
  if (match[1] === "image/png") {
    return b.length >= 24 && b.toString("ascii", 12, 16) === "IHDR" ? size(b.readUInt32BE(16), b.readUInt32BE(20)) : null;
  }
  if (match[1] === "image/jpeg") {
    let pos = 2;
    while (pos < b.length) {
      if (b[pos++] !== 255) return null;
      while (b[pos] === 255) pos++;
      const marker = b[pos++];
      if (marker === 217 || marker === 218 || marker === undefined) return null;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (pos + 2 > b.length) return null;
      const length = b.readUInt16BE(pos);
      if (length < 2 || pos + length > b.length) return null;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        return length >= 8 ? size(b.readUInt16BE(pos + 5), b.readUInt16BE(pos + 3)) : null;
      }
      pos += length;
    }
  }
  if (match[1] === "image/webp") {
    let pos = 12;
    while (pos + 8 <= b.length) {
      const kind = b.toString("ascii", pos, pos + 4), length = b.readUInt32LE(pos + 4), start = pos + 8;
      if (start + length > b.length) return null;
      if (kind === "VP8X" && length >= 10) return size(b.readUIntLE(start + 4, 3) + 1, b.readUIntLE(start + 7, 3) + 1);
      if (kind === "VP8 " && length >= 10 && b.toString("hex", start + 3, start + 6) === "9d012a") return size(b.readUInt16LE(start + 6) & 16383, b.readUInt16LE(start + 8) & 16383);
      if (kind === "VP8L" && length >= 5 && b[start] === 47) return size(1 + b[start + 1] + ((b[start + 2] & 63) << 8), 1 + (b[start + 2] >> 6) + (b[start + 3] << 2) + ((b[start + 4] & 15) << 10));
      pos = start + length + length % 2;
    }
  }
  return null;
}

function aspectCheck(requested, dimensions) {
  if (!dimensions) return { requested, actual: null, matches: null };
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const divisor = gcd(dimensions.width, dimensions.height), [w, h] = requested.split(":").map(Number);
  return { requested, actual: `${dimensions.width / divisor}:${dimensions.height / divisor}`, matches: Math.abs((dimensions.width / dimensions.height) / (w / h) - 1) <= 0.01 };
}

export function creatorEditConfigured(env = process.env) { return imageGenConfigured(env) && llmConfigured(env); }
const realDeps = {
  configured: () => creatorEditConfigured(),
  providers: (task) => routeProviders(task).map((p) => p.name),
  generate: (request) => generateImages(request),
  readBack: (image) => readBackText(image),
  checkProduct: (reference, image) => checkProduct(reference, image)
};

/**
 * Generate ONE new raster candidate. The caller owns project/slot access and revision storage.
 * A failed check keeps the new candidate available with needs_review; no source fallback,
 * automatic retries, text layers or additional billable generations are performed here.
 */
export async function editCreatorImage(input, deps = realDeps) {
  const spec = normaliseCreatorEdit(input);
  if (deps.configured && !deps.configured()) fail("Creator AI editing needs an image model and image checking on the server (FAL_KEY, or image-model and LLM credentials)", 503);
  if (typeof deps.generate !== "function" || typeof deps.readBack !== "function" || typeof deps.checkProduct !== "function") fail("Creator image generation and both image checks must be available", 503);
  const built = creatorEditPrompt(spec);
  const task = spec.language === "none" ? "scene" : spec.mode === "edit" || spec.language !== "en" || (spec.approvedTexts && spec.approvedTexts.length) ? "text" : "scene";
  const provider = deps.providers ? deps.providers(task)[0] || null : null;
  const request = { prompt: built.prompt, image: spec.image, refs: built.refs, count: 1, aspect: spec.aspect, task };
  if (provider) request.provider = provider;
  const generated = await deps.generate(request);
  if (!Array.isArray(generated) || !generated[0]) fail("The image model returned no new image; the selected revision is unchanged", 502);
  const image = imageData(generated[0], "Generated image", 502);
  if ([spec.image, spec.originalImage, spec.modelRef,...(spec.styleRefs||[])].includes(image)) fail("The image model returned a source image instead of a new candidate; the selected revision is unchanged", 502);
  const errors = [];
  const runCheck = async (stage, run, schema) => {
    try {
      const result = schema.safeParse(await run());
      if (!result.success) throw new Error("The model returned an unreadable check");
      return result.data;
    } catch (error) {
      errors.push({ stage, message: error instanceof Error ? error.message : "Image check failed" });
      return null;
    }
  };
  const reference = spec.originalImage || spec.image;
  const [readback, product] = await Promise.all([
    runCheck("readback", () => deps.readBack(image), TextReadback),
    runCheck("product", () => deps.checkProduct(reference, image), ProductCheck)
  ]);
  const dimensions = creatorImageDimensions(image), aspect = aspectCheck(spec.aspect, dimensions);
  const verdict = judgeCreatorCandidate({ approvedTexts: spec.approvedTexts, readback, product, errors, aspect });
  return {
    image, mode: spec.mode === "edit" ? "edited" : "generated", provider, aspect: spec.aspect,
    requestedAspect: spec.aspect, actualAspect: aspect.actual, dimensions,
    status: verdict.ok ? "checked" : "needs_review", prompt: built.prompt,
    aiPeople: Boolean(readback && readback.photorealPeople), pixelPreservation: "not_guaranteed",
    checks: { ...verdict, readback, product, errors, aspect, reference: spec.originalImage ? "original" : "revision" }
  };
}

export const generateCreatorImage = editCreatorImage;
