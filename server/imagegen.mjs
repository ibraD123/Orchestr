// Image generation through an external model: slides generated whole (scene, product, headline)
// and on-model photos. The product photo always goes in as the reference so the model keeps the
// product; every result is checked afterwards (server/slidegen.mjs) before anyone sees it.
//
// Providers. Several can be configured at once, and each task goes to the one that does it best:
// text on the image → Gemini (Nano Banana Pro is the strongest at lettering), scenes and people →
// OpenAI (GPT Image). Whatever is configured is used when the preferred one isn't.
//   OPENAI_IMAGE_KEY (+ OPENAI_IMAGE_MODEL)   POST https://api.openai.com/v1/images/edits
//            (multipart: model, prompt, image or image[], size, n) → { data: [ { b64_json } ] }
//   GEMINI_IMAGE_KEY (+ GEMINI_IMAGE_MODEL)   POST …/v1beta/models/<model>:generateContent
//            { contents: [{ parts: [text, inlineData…] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } } }
//   FAL_KEY   one key for both through fal.ai (POST https://fal.run/<model>, Authorization: Key …,
//            { prompt, image_urls: [data URIs], num_images, output_format, sync_mode } → { images: [ { url } ] }):
//            text → FAL_TEXT_MODEL (default fal-ai/nano-banana-pro/edit, Gemini 3 Pro Image),
//            scenes and people → FAL_SCENE_MODEL (default openai/gpt-image-2.6/flare/edit).
//            A direct OPENAI_IMAGE_KEY or GEMINI_IMAGE_KEY takes that lane instead.
//   IMAGE_PROVIDER + IMAGE_API_KEY (+ IMAGE_MODEL, IMAGE_API_URL): one provider, as before;
//            "generic" posts { prompt, negative_prompt, image, reference_images, width, height, num_images }
//            to IMAGE_API_URL and reads { images: [ { url } | { b64_json } ] }.
// None of these has been called live from this code yet: check the model names when the keys arrive.
import { safeFetch, ConnectorError } from "./connectors/net.mjs";

export const MODEL_LOOKS = ["gulf", "levant", "northAfrica", "southAsia", "any"];
export const HEAD_COVER = ["hijab", "none", "any"];
export const SETTINGS = ["studio", "home", "outdoor", "majlis"];
export const PROVIDERS = ["openai", "gemini", "generic"];

const DEFAULT_MODEL = { openai: "gpt-image-1", gemini: "gemini-3-pro-image-preview" };
const FAL_MODEL = { gemini: "fal-ai/nano-banana-pro/edit", openai: "openai/gpt-image-2.6/flare/edit" };
// Which provider to try first for each kind of image.
const ROUTES = { text: ["gemini", "openai", "generic"], scene: ["openai", "gemini", "generic"], people: ["openai", "gemini", "generic"] };

/** Every image provider configured on this server. */
export function imageProviders(env = process.env) {
  const out = [];
  const legacy = String(env.IMAGE_PROVIDER || "").toLowerCase();
  const legacyName = PROVIDERS.includes(legacy) ? legacy : env.IMAGE_API_URL ? "generic" : null;
  if (env.OPENAI_IMAGE_KEY) out.push({ name: "openai", key: env.OPENAI_IMAGE_KEY, model: env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL.openai, url: null });
  if (env.GEMINI_IMAGE_KEY) out.push({ name: "gemini", key: env.GEMINI_IMAGE_KEY, model: env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL.gemini, url: null });
  if (env.FAL_KEY) {
    if (!out.some((p) => p.name === "gemini")) out.push({ name: "gemini", via: "fal", key: env.FAL_KEY, model: env.FAL_TEXT_MODEL || FAL_MODEL.gemini, url: null });
    if (!out.some((p) => p.name === "openai")) out.push({ name: "openai", via: "fal", key: env.FAL_KEY, model: env.FAL_SCENE_MODEL || FAL_MODEL.openai, url: null });
  }
  if (legacyName && env.IMAGE_API_KEY && !out.some((p) => p.name === legacyName) && (legacyName !== "generic" || env.IMAGE_API_URL)) {
    out.push({ name: legacyName, key: env.IMAGE_API_KEY, model: env.IMAGE_MODEL || DEFAULT_MODEL[legacyName], url: env.IMAGE_API_URL || null });
  }
  return out;
}
/** Providers for one kind of image, best first. task: "text" | "scene" | "people". */
export function routeProviders(task, env = process.env) {
  const all = imageProviders(env), order = ROUTES[task] || ROUTES.scene;
  return order.map((n) => all.find((p) => p.name === n)).filter(Boolean);
}
export function imageProvider(env = process.env) { const p = imageProviders(env)[0]; return p ? p.name : null; }
export function imageGenConfigured(env = process.env) { return imageProviders(env).length > 0; }

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

/**
 * Generate images from a prompt and a reference photo.
 * @param {{ prompt, negative?, image: dataUrl, count?, aspect?: "4:5"|"1:1" }} req
 * @returns {Promise<string[]>} data URLs
 */
export async function generateImages(req, env = process.env) {
  if (!imageGenConfigured(env)) throw new ConnectorError("Image generation needs an image model on the server: set FAL_KEY, OPENAI_IMAGE_KEY or GEMINI_IMAGE_KEY", 503);
  const routed = routeProviders(req.task || "scene", env);
  const p = (req.provider && imageProviders(env).find((x) => x.name === req.provider)) || routed[0];
  const provider = p.name, key = p.key, model = p.model;
  const m = DATA_URL.exec(String(req.image || ""));
  if (!m) throw new ConnectorError("Send the product photo as a PNG, JPEG or WebP", 400);
  // Extra references after the product: the brand's model, for the same person across the catalog.
  const refs = (req.refs || []).map((r) => DATA_URL.exec(String(r || ""))).filter(Boolean).slice(0, 3);
  const count = Math.min(4, Math.max(1, req.count || 1));
  const opts = { method: "POST", timeoutMs: 180_000, maxBytes: 60_000_000, allowStatus: [400, 401, 402, 403, 404, 422, 429] };
  const failed = (status, j) => new ConnectorError("Image model: " + ((j && (j.error && (j.error.message || j.error))) || j.message || status), status === 429 ? 429 : 502);

  if (p.via === "fal") {
    // Data URIs go straight in; sync_mode asks for the result inline instead of a hosted link.
    const input = {
      prompt: req.negative ? `${req.prompt}\nAvoid: ${req.negative}` : req.prompt,
      image_urls: [req.image].concat(refs.map((x) => x[0])),
      num_images: count, output_format: "png", sync_mode: true
    };
    if (/nano-banana/.test(model)) Object.assign(input, { aspect_ratio: req.aspect || "4:5", resolution: "2K" });
    const r = await safeFetch(p.url || `https://fal.run/${model}`, { ...opts, body: JSON.stringify(input), headers: { Authorization: "Key " + key, "Content-Type": "application/json", Accept: "application/json" } });
    const j = JSON.parse(r.body.toString("utf8") || "{}");
    if (r.status >= 400) throw failed(r.status, { message: typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d) => d.msg || d).join("; ") : j.error || j.message });
    const out = [];
    for (const im of (j.images || []).slice(0, 4)) {
      if (/^data:image\//.test(im.url || "")) out.push(im.url);
      else if (im.url) {
        const f = await safeFetch(im.url, { maxBytes: 20_000_000, timeoutMs: 60_000 });
        out.push(`data:${(f.headers.get("content-type") || im.content_type || "image/png").split(";")[0]};base64,${f.body.toString("base64")}`);
      }
    }
    return out;
  }

  if (provider === "openai") {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", req.negative ? `${req.prompt}\nAvoid: ${req.negative}` : req.prompt);
    const field = refs.length ? "image[]" : "image";
    form.append(field, new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), "product." + m[1].split("/")[1]);
    refs.forEach((x, i) => form.append(field, new Blob([Buffer.from(x[2], "base64")], { type: x[1] }), `ref${i + 1}.` + x[1].split("/")[1]));
    form.append("size", req.aspect === "1:1" ? "1024x1024" : "1024x1536");
    form.append("n", String(count));
    form.append("quality", "high");
    const r = await safeFetch(p.url || "https://api.openai.com/v1/images/edits", { ...opts, body: form, headers: { Authorization: "Bearer " + key, Accept: "application/json" } });
    const j = JSON.parse(r.body.toString("utf8") || "{}");
    if (r.status >= 400) throw failed(r.status, j);
    return (j.data || []).filter((d) => d.b64_json).map((d) => "data:image/png;base64," + d.b64_json);
  }

  if (provider === "gemini") {
    const url = p.url || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const body = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: req.negative ? `${req.prompt}\nAvoid: ${req.negative}` : req.prompt }, { inlineData: { mimeType: m[1], data: m[2] } }].concat(refs.map((x) => ({ inlineData: { mimeType: x[1], data: x[2] } }))) }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: req.aspect || "4:5" } }
    });
    const out = [];
    // One image per call; ask again for more.
    for (let i = 0; i < count; i++) {
      const r = await safeFetch(url, { ...opts, body, headers: { "x-goog-api-key": key, "Content-Type": "application/json", Accept: "application/json" } });
      const j = JSON.parse(r.body.toString("utf8") || "{}");
      if (r.status >= 400) throw failed(r.status, j);
      for (const c of j.candidates || []) for (const p of (c.content && c.content.parts) || []) {
        const d = p.inlineData || p.inline_data;
        if (d && d.data) out.push(`data:${d.mimeType || d.mime_type || "image/png"};base64,${d.data}`);
      }
    }
    return out;
  }

  const [w, h] = req.aspect === "1:1" ? [2000, 2000] : [1600, 2000];
  const r = await safeFetch(p.url, {
    ...opts, headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ prompt: req.prompt, negative_prompt: req.negative || "", image: req.image, reference_images: (req.refs || []).slice(0, 3), width: w, height: h, num_images: count })
  });
  const j = JSON.parse(r.body.toString("utf8") || "{}");
  if (r.status >= 400) throw failed(r.status, j);
  const out = [];
  for (const im of (j.images || []).slice(0, 4)) {
    if (im.b64_json) out.push("data:image/png;base64," + im.b64_json);
    else if (im.url) {
      const f = await safeFetch(im.url, { maxBytes: 15_000_000, timeoutMs: 60_000 });
      const type = (f.headers.get("content-type") || "image/png").split(";")[0];
      out.push(`data:${type};base64,${f.body.toString("base64")}`);
    }
  }
  return out;
}

const LOOK_TEXT = { gulf: "a woman from the Gulf region", levant: "a woman from the Levant", northAfrica: "a woman from North Africa", southAsia: "a South Asian woman", any: "a woman" };
const SETTING_TEXT = { studio: "plain seamless studio backdrop", home: "calm, elegant home interior", outdoor: "soft outdoor daylight in a city street", majlis: "a traditional majlis with warm light" };

/** Prompt from the request plus the brand's visual rules. Pure, so it is tested. */
export function onModelPrompt({ product, category, look, cover, setting, visual, gender, sameModel }) {
  const who = gender === "man" ? "a man from the Gulf region" : LOOK_TEXT[look] || LOOK_TEXT.any;
  const modest = category === "fashion" || cover === "hijab";
  const parts = [
    `Fashion e-commerce photo of ${who} wearing ${product || "the product in the reference image"}.`,
    "Keep the product exactly as in the reference image: same cut, colour, fabric, length and details.",
    sameModel ? "The second reference image is the brand's model: show this same person (face, skin tone, build, hair or hijab style), so every product in the catalog is worn by the same model." : "",
    cover === "hijab" ? "She wears a neat hijab that complements the outfit." : "",
    modest ? "Modest styling: long sleeves, loose fit, nothing revealing." : "",
    `Setting: ${SETTING_TEXT[setting] || SETTING_TEXT.studio}.`,
    "Full-length, natural pose, the product clearly visible and in focus, 4:5 portrait framing.",
    visual ? `Brand visual style: ${visual}` : "",
    "No text, no logos, no watermarks."
  ].filter(Boolean);
  const negative = "text, letters, watermark, logo, extra limbs, distorted hands, changed garment colour, changed garment cut, revealing clothing, cleavage, short sleeves";
  return { prompt: parts.join(" "), negative };
}

export async function generateOnModel(input, env = process.env) {
  if (!imageGenConfigured(env)) throw new ConnectorError("On-model photos need an image model on the server: set FAL_KEY, OPENAI_IMAGE_KEY or GEMINI_IMAGE_KEY", 503);
  if (typeof input.image !== "string" || !DATA_URL.test(input.image)) throw new ConnectorError("Send the product photo as a PNG, JPEG or WebP", 400);
  const modelRef = typeof input.modelRef === "string" && DATA_URL.test(input.modelRef) ? input.modelRef : null;
  const { prompt, negative } = onModelPrompt({ ...input, sameModel: Boolean(modelRef) });
  const images = await generateImages({ prompt, negative, image: input.image, refs: modelRef ? [modelRef] : [], task: "people", count: Math.min(4, Math.max(1, input.count || 2)) }, env);
  if (!images.length) throw new ConnectorError("The image model returned no images", 502);
  return { images, prompt };
}
