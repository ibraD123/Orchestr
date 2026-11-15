// Creator's reusable model, product try-on and runway workflows. These helpers do not
// approve assets: the workspace must persist a person's explicit approval separately.
import { ConnectorError } from "./connectors/net.mjs";
import { generateImages, routeProviders } from "./imagegen.mjs";
import { checkProduct, readBackText } from "./slidegen.mjs";
import { aiConfigured } from "./reviews.mjs";
import { rendererAvailable, videoFrames } from "./render.mjs";
import { generateVideo, falVideo, videoInput, videoGenConfigured, VIDEO_MODEL, VIDEO_SECONDS } from "./videogen.mjs";
import { fashnConfigured, fashnModelCreate, fashnModelInfo } from "./fashn.mjs";

const IMAGE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_IMAGE_LENGTH = 28_000_000;
// A white 512 x 640 canvas, not a sample model. Existing image-edit providers can create a new
// identity from it without needing another image API or inventing a demo result.
const CANVAS = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAKAAQAAAADCs/2PAAAAp0lEQVR4nO3MMQEAAAwCIPuX1hA7BwFIjyIQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFA8DsYjUFpUiwnsBEAAAAASUVORK5CYII=";
const LOOKS = { gulf: "Gulf Arab appearance", levant: "Levantine appearance", northAfrica: "North African appearance", southAsia: "South Asian appearance", any: "appearance chosen from the brief" };
const SETTINGS = { studio: "a plain seamless studio background", home: "a contemporary UAE home", outdoor: "a contemporary UAE city in soft daylight", majlis: "a majlis in warm natural light" };

const realDeps = {
  provider: () => routeProviders("people")[0],
  useFashn: () => fashnConfigured(),
  fashnCreate: fashnModelCreate,
  fashnInfo: () => fashnModelInfo(),
  generateImages,
  checkProduct,
  readBackText,
  canCheck: aiConfigured,
  videoConfigured: videoGenConfigured,
  rendererAvailable,
  frames: videoFrames,
  generateVideo: falVideo,
  videoModel: VIDEO_MODEL
};

function text(value, max = 3000) {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > max) throw new ConnectorError(`Text must be a string of at most ${max} characters`, 400);
  return value.trim();
}

function image(value, label) {
  if (typeof value !== "string" || value.length > MAX_IMAGE_LENGTH || !IMAGE.test(value)) throw new ConnectorError(`${label} must be a PNG, JPEG or WebP data URL (up to 20 MB)`, 400);
  return value;
}

function provider(deps) {
  const p = deps.provider();
  if (!p) throw new ConnectorError("Creator models need an image provider: set FAL_KEY, OPENAI_IMAGE_KEY or GEMINI_IMAGE_KEY on the server", 503);
  // Never return an API key or provider URL with credentials in response metadata.
  return { name: p.name, model: p.model, ...(p.via ? { via: p.via } : {}) };
}

function cost(generations, checks = 0) {
  // Actual charges depend on the configured model, output size and provider. Do not
  // present hardcoded prices as a quote or claim that a configured provider is free.
  return { amount: null, currency: "USD", pricing: "provider_billed", generations, checks };
}

function styling(input) {
  const gender = input.gender === "man" || input.gender === "male" ? "an adult man" : input.gender === "woman" || input.gender === "female" ? "an adult woman" : "an adult model";
  const cover = input.cover === "hijab" ? "Wear a neat hijab as requested in the brief." : input.cover === "none" ? "No head covering." : "Choose head covering only when requested in the brief or present on the identity reference.";
  return [gender, LOOKS[input.look] || LOOKS.any, cover, `Setting: ${SETTINGS[input.setting] || SETTINGS.studio}.`, ...traits(input)];
}

const BUILDS = { slim: "slim build", average: "average build", athletic: "athletic build", curvy: "curvy build", plus: "plus-size build" };
const HAIR = { black: "black hair", brown: "dark brown hair", blonde: "blonde hair", red: "auburn hair", grey: "grey hair" };

/** Optional appearance traits from the model builder. Unknown values are ignored, and an
 * age below 18 is never requested: every generated model is an adult. */
function traits(input) {
  const out = [];
  const age = Number.parseInt(input.age, 10);
  if (Number.isFinite(age)) out.push(`Apparent age about ${Math.min(70, Math.max(18, age))}.`);
  if (BUILDS[input.build]) out.push(`Body: ${BUILDS[input.build]}.`);
  if (HAIR[input.hair] && input.cover !== "hijab") out.push(`Hair: ${HAIR[input.hair]}.`);
  return out;
}

/** New model from a brief (EN/AR supported), optionally guided by an uploaded reference.
 * Input: { prompt?, description?, referenceImage?, gender?, look?, cover?, setting?, visual? }.
 * Returns one real generated image awaiting human approval; identity consistency is a
 * reference-guided objective, not an identity verification or fit guarantee.
 */
export async function createModel(input = {}, overrides = {}) {
  const deps = { ...realDeps, ...overrides };
  const brief = text(input.prompt || input.description);
  const visual = text(input.visual);
  const reference = input.referenceImage || input.image;
  const source = reference ? image(reference, "The model reference") : CANVAS;
  if (deps.useFashn()) {
    // FASHN model-create is built for fashion models: text in, photo out; the reference locks the face.
    const prompt = [
      `Full-body e-commerce model photo of ${styling(input).join(" ")}`,
      "One person only, natural standing pose facing the camera, realistic anatomy, clear unobstructed face, calm neutral expression, even studio-quality lighting.",
      "Simple neutral wardrobe suitable for later virtual try-on, with no brand marks.",
      brief ? `Brief (may be Arabic or English): ${brief}` : "",
      visual ? `Brand visual direction: ${visual}` : "",
      "No text, captions or watermarks."
    ].filter(Boolean).join("\n");
    const result = await deps.fashnCreate({ prompt, faceReference: reference ? source : undefined, aspect: "4:5" });
    return { ok: true, kind: "model", status: "review_required", images: [image(result, "The generated model")], prompt, provider: deps.fashnInfo(), cost: cost(1), aiPeople: true, provenance: reference ? "reference_guided" : "generated_identity", identityVerified: false };
  }
  const p = provider(deps);
  const prompt = [
    `Create a reusable e-commerce identity reference for ${styling(input).join(" ")}`,
    reference ? "Use the reference person's face, skin tone, body build and hair or head-covering consistently; do not replace their identity." : "Create one original adult person. The reference is only a blank canvas, not a person to reproduce.",
    "One person only, full body visible, natural standing pose, realistic anatomy, clear unobstructed face, neutral expression, even studio-quality lighting.",
    "Simple neutral wardrobe suitable for later virtual try-on, with no brand marks. Appearance and styling follow the brief; do not assume every UAE customer wears a hijab or traditional clothing.",
    brief ? `Creative brief (may be Arabic or English): ${brief}` : "",
    visual ? `Brand visual direction: ${visual}` : "",
    "No captions, lettering, watermarks, promotional text, identity documents or contact details. 4:5 portrait composition."
  ].filter(Boolean).join("\n");
  const images = await deps.generateImages({ image: source, prompt, negative: "children, multiple people, text, watermark, distorted face, extra limbs", task: "people", provider: p.name, count: 1, aspect: "4:5" });
  if (!Array.isArray(images) || !images.length) throw new ConnectorError("The image provider returned no model image", 502);
  return { ok: true, kind: "model", status: "review_required", images: [image(images[0], "The generated model")], prompt, provider: p, cost: cost(1), aiPeople: true, provenance: reference ? "reference_guided" : "generated_identity", identityVerified: false };
}

function productPassed(result) {
  return result && result.sameProduct === true && result.shape === "same" && ["intact", "none"].includes(result.logo) && Array.isArray(result.problems) && result.problems.length === 0;
}

/** Place the real product (first reference) on the selected saved model (second).
 * Input: { productImage|image, modelImage|modelRef, product?, category?, visual?,
 *          prompt?, look?, gender?, cover?, setting?, count?:1|2 }.
 * Only images passing the product check are returned in images. Even a passed image
 * remains review_required: automated comparison does not verify fit or identity.
 */
export async function tryOn(input = {}, overrides = {}) {
  const deps = { ...realDeps, ...overrides };
  const productImage = image(input.productImage || input.image, "The real product photo");
  const modelImage = image(input.modelImage || input.modelRef, "The selected model reference");
  const product = text(input.product, 500), category = text(input.category, 100), visual = text(input.visual), brief = text(input.prompt);
  const count = input.count == null ? 1 : Number(input.count);
  if (!Number.isInteger(count) || count < 1 || count > 2) throw new ConnectorError("Generate one or two try-on images at a time", 400);
  const p = provider(deps);
  if (!deps.canCheck()) throw new ConnectorError("Try-on product verification needs FAL_KEY or ANTHROPIC_API_KEY on the server", 503);
  const prompt = [
    `Create a realistic e-commerce try-on image of ${product || "the exact product from the first reference"}${category ? ` (${category})` : ""}.`,
    "REFERENCE 1 is the seller's REAL PRODUCT. REFERENCE 2 is the SELECTED MODEL. Keep the second reference person's face, skin tone, body build, hair and head covering consistent.",
    "Put only the product from reference 1 on that person in a natural, clearly visible position. Preserve the actual variant, colour, material, pattern, stitching, shape, proportions, cut, sleeve length, hem length, every part and all existing product labels and logos.",
    "Never redesign the item, invent features or alter its cut for modesty. Do not remove, replace, redraw or add a product logo. Do not cover the product's distinguishing details with styling.",
    `${styling(input).slice(2).join(" ")} Full-body 4:5 portrait, a relaxed standing pose, product in focus, no collage.`,
    brief ? `Creative brief (may be Arabic or English): ${brief}` : "",
    visual ? `Brand visual direction: ${visual}` : "",
    "No added text, promotional badges, captions, watermarks or other people. This is a visual try-on, not proof of garment fit or sizing."
  ].filter(Boolean).join("\n");
  const generated = await deps.generateImages({ image: productImage, refs: [modelImage], prompt, negative: "identity change, changed product, distorted hands, extra limbs, captions, text overlays, watermark", task: "people", provider: p.name, count, aspect: "4:5" });
  if (!Array.isArray(generated) || !generated.length) throw new ConnectorError("The image provider returned no try-on image", 502);
  const images = [], results = [];
  for (const [index, value] of generated.slice(0, count).entries()) {
    const candidate = image(value, "The generated try-on");
    let checked;
    try { checked = await deps.checkProduct(productImage, candidate); }
    catch { results.push({ index, status: "verification_unavailable", reasons: ["The product comparison could not be completed. Try again before approving this image."] }); continue; }
    const passed = productPassed(checked);
    results.push({ index, status: passed ? "passed" : "rejected", productCheck: checked, reasons: passed ? [] : (checked?.problems?.length ? checked.problems : ["The generated product did not pass the shape, variant and logo comparison."]) });
    if (passed) images.push(candidate);
  }
  const ok = images.length > 0;
  return { ok, kind: "tryon", status: ok ? "review_required" : results.some((r) => r.status === "verification_unavailable") ? "verification_unavailable" : "rejected", images, results, prompt, provider: p, cost: cost(Math.min(generated.length, count), results.length), aiPeople: true, identityVerified: false, fitVerified: false };
}

export function runwayPrompt(input = {}) {
  const product = text(input.product, 500), visual = text(input.visual);
  return [
    `A short e-commerce runway presentation of ${product || "the exact product worn by the model in the approved try-on image"}.`,
    "Animate ONLY the approved try-on image. The same single adult model makes one or two small, slow natural runway steps and a gentle quarter turn, keeping the whole product visible. Keep the face, skin tone, body build, hair, hijab if present, background and outfit consistent with the image.",
    "Preserve the real product's shape, cut, proportions, colour, fabric, pattern, length, parts and existing printed logo or label exactly. No garment transformation, exaggerated cloth motion, new accessories or additional people.",
    "Stable full-body framing, gentle natural motion, no cuts, fast spin, camera shake or zoom that crops the item. No audio, music or speech.",
    "Do not add any letters, captions, prices, claims, badges, watermarks or logos. Keep existing product print unchanged.",
    visual ? `Brand visual direction: ${visual}` : ""
  ].filter(Boolean).join("\n");
}

/** Animate a saved approved try-on, never an original packshot.
 * Input: { source:{ kind:'tryon', approved:true, image:dataUrl }, productImage?,
 *          product?, visual?, seconds?:6|10 }. The route MUST load source and its
 * approval from workspace storage, rather than trusting approval in a request body.
 * Returns video Buffer for the route to save, with existing retry/frame validation.
 */
export async function runwayVideo(input = {}, overrides = {}) {
  const deps = { ...realDeps, ...overrides };
  if (!input.source || input.source.kind !== "tryon" || input.source.approved !== true) throw new ConnectorError("Runway video requires a saved, approved try-on image. Approve a try-on result first.", 400);
  const source = image(input.source.image, "The approved try-on");
  const productImage = input.productImage ? image(input.productImage, "The real product photo") : source;
  const seconds = input.seconds == null ? VIDEO_SECONDS : Number(input.seconds);
  if (![6, 10].includes(seconds)) throw new ConnectorError("Choose a six- or ten-second runway video", 400);
  const model = deps.videoModel();
  // videoInput rounds provider-specific durations. Restrict this workflow to a
  // duration the configured model will really produce instead of mislabelling it.
  if (/veo/.test(model) && seconds === 10) throw new ConnectorError("The configured Veo model supports a six-second runway here; choose six seconds", 400);
  const prompt = runwayPrompt(input);
  if (!deps.videoConfigured()) throw new ConnectorError("Runway videos need FAL_KEY on the server", 503);
  if (!deps.canCheck()) throw new ConnectorError("Runway video verification needs FAL_KEY or ANTHROPIC_API_KEY on the server", 503);
  if (!(await deps.rendererAvailable())) throw new ConnectorError("Runway video frame checks need Chromium on the server", 503);
  const reviewErrors = [];
  const r = await generateVideo({ image: source, product: text(input.product, 500), seconds, texts: [] }, {
    generate: async ({ image: approvedImage }) => {
      const request = videoInput(model, { image: approvedImage, prompt, seconds });
      if (request.negative_prompt) request.negative_prompt = "text overlays, captions, watermarks, new people, identity change, altered garment, product logo change, distorted body";
      return deps.generateVideo(request, { model });
    },
    frames: async (video) => {
      const frames = await deps.frames(video);
      if (!Array.isArray(frames) || frames.length < 3) throw new ConnectorError("The runway video could not be checked: at least three decoded frames are required", 502);
      return frames;
    },
    readBack: async (frame) => {
      try {
        const check = await deps.readBackText(frame);
        if (!check || !Array.isArray(check.overlayTexts) || !["none", "correct", "broken"].includes(check.arabicRendering)) throw new Error("Unreadable frame check");
        return check;
      } catch { reviewErrors.push("Frame text verification was unavailable"); return null; }
    },
    // Compare to the actual SKU source too, so a faulty try-on cannot become its
    // own ground truth. Reuse the existing video retry/check pipeline.
    checkProduct: async (_approvedImage, frame) => {
      try {
        const checked = await deps.checkProduct(productImage, frame);
        if (!checked || typeof checked.sameProduct !== "boolean" || !["same", "changed"].includes(checked.shape) || !["intact", "changed", "missing", "none"].includes(checked.logo) || !Array.isArray(checked.problems)) throw new Error("Unreadable product check");
        return productPassed(checked) ? checked : { ...checked, sameProduct: false };
      } catch { reviewErrors.push("Frame product verification was unavailable"); return null; }
    }
  });
  const verified = r.ok && reviewErrors.length === 0;
  const attempts = r.attempts.map((attempt) => reviewErrors.length ? { ...attempt, ok: false, reasons: [...attempt.reasons, ...new Set(reviewErrors)] } : attempt);
  return { ...r, ok: verified, video: verified ? r.video : null, status: verified ? "review_required" : reviewErrors.length ? "verification_unavailable" : "rejected", attempts, prompt, seconds, sourceKind: "tryon", aiPeople: true, identityVerified: false, cost: cost(r.attempts.length, r.attempts.reduce((sum, attempt) => sum + attempt.frames + 2, 0)) };
}
