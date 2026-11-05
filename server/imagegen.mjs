// Image generation through an external model: slides generated whole (scene, product, headline)
// and on-model photos. The product photo always goes in as the reference so the model keeps the
// product; every result is checked afterwards (server/slidegen.mjs) before anyone sees it.
//
// Providers, chosen with IMAGE_PROVIDER (the key is always IMAGE_API_KEY, the model IMAGE_MODEL):
//   openai   POST https://api.openai.com/v1/images/edits (multipart: model, prompt, image, size, n)
//            → { data: [ { b64_json } ] }
//   gemini   POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
//            { contents: [{ parts: [text, inlineData] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } } }
//            → { candidates: [ { content: { parts: [ { inlineData: { mimeType, data } } ] } } ] }
//   generic  POST IMAGE_API_URL with Bearer IMAGE_API_KEY
//            { prompt, negative_prompt, image, width, height, num_images } → { images: [ { url } | { b64_json } ] }
// IMAGE_API_URL overrides the endpoint for openai and gemini too (a proxy or a regional endpoint).
// None of these has been called live from this code yet: check the model names when the key arrives.
import { safeFetch, ConnectorError } from "./connectors/net.mjs";

export const MODEL_LOOKS = ["gulf", "levant", "northAfrica", "southAsia", "any"];
export const HEAD_COVER = ["hijab", "none", "any"];
export const SETTINGS = ["studio", "home", "outdoor", "majlis"];
export const PROVIDERS = ["openai", "gemini", "generic"];

const DEFAULT_MODEL = { openai: "gpt-image-1", gemini: "gemini-3-pro-image-preview" };

export function imageProvider(env = process.env) {
  const p = String(env.IMAGE_PROVIDER || "").toLowerCase();
  if (PROVIDERS.includes(p)) return p;
  return env.IMAGE_API_URL ? "generic" : null;
}
export function imageGenConfigured(env = process.env) {
  const p = imageProvider(env);
  if (!p || !env.IMAGE_API_KEY) return false;
  return p === "generic" ? Boolean(env.IMAGE_API_URL) : true;
}

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

/**
 * Generate images from a prompt and a reference photo.
 * @param {{ prompt, negative?, image: dataUrl, count?, aspect?: "4:5"|"1:1" }} req
 * @returns {Promise<string[]>} data URLs
 */
export async function generateImages(req, env = process.env) {
  const provider = imageProvider(env);
  if (!imageGenConfigured(env)) throw new ConnectorError("Image generation needs an image model on the server: set IMAGE_PROVIDER (openai or gemini) and IMAGE_API_KEY", 503);
  const m = DATA_URL.exec(String(req.image || ""));
  if (!m) throw new ConnectorError("Send the product photo as a PNG, JPEG or WebP", 400);
  const count = Math.min(4, Math.max(1, req.count || 1));
  const model = env.IMAGE_MODEL || DEFAULT_MODEL[provider];
  const opts = { method: "POST", timeoutMs: 180_000, maxBytes: 60_000_000, allowStatus: [400, 401, 402, 403, 404, 422, 429] };
  const failed = (status, j) => new ConnectorError("Image model: " + ((j && (j.error && (j.error.message || j.error))) || j.message || status), status === 429 ? 429 : 502);

  if (provider === "openai") {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", req.negative ? `${req.prompt}\nAvoid: ${req.negative}` : req.prompt);
    form.append("image", new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), "product." + m[1].split("/")[1]);
    form.append("size", req.aspect === "1:1" ? "1024x1024" : "1024x1536");
    form.append("n", String(count));
    form.append("quality", "high");
    const r = await safeFetch(env.IMAGE_API_URL || "https://api.openai.com/v1/images/edits", { ...opts, body: form, headers: { Authorization: "Bearer " + env.IMAGE_API_KEY, Accept: "application/json" } });
    const j = JSON.parse(r.body.toString("utf8") || "{}");
    if (r.status >= 400) throw failed(r.status, j);
    return (j.data || []).filter((d) => d.b64_json).map((d) => "data:image/png;base64," + d.b64_json);
  }

  if (provider === "gemini") {
    const url = env.IMAGE_API_URL || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const body = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: req.negative ? `${req.prompt}\nAvoid: ${req.negative}` : req.prompt }, { inlineData: { mimeType: m[1], data: m[2] } }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: req.aspect || "4:5" } }
    });
    const out = [];
    // One image per call; ask again for more.
    for (let i = 0; i < count; i++) {
      const r = await safeFetch(url, { ...opts, body, headers: { "x-goog-api-key": env.IMAGE_API_KEY, "Content-Type": "application/json", Accept: "application/json" } });
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
  const r = await safeFetch(env.IMAGE_API_URL, {
    ...opts, headers: { Authorization: "Bearer " + env.IMAGE_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ prompt: req.prompt, negative_prompt: req.negative || "", image: req.image, width: w, height: h, num_images: count })
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
export function onModelPrompt({ product, category, look, cover, setting, visual, gender }) {
  const who = gender === "man" ? "a man from the Gulf region" : LOOK_TEXT[look] || LOOK_TEXT.any;
  const modest = category === "fashion" || cover === "hijab";
  const parts = [
    `Fashion e-commerce photo of ${who} wearing ${product || "the product in the reference image"}.`,
    "Keep the product exactly as in the reference image: same cut, colour, fabric, length and details.",
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
  if (!imageGenConfigured(env)) throw new ConnectorError("On-model photos need an image model on the server: set IMAGE_PROVIDER (openai or gemini) and IMAGE_API_KEY", 503);
  if (typeof input.image !== "string" || !DATA_URL.test(input.image)) throw new ConnectorError("Send the product photo as a PNG, JPEG or WebP", 400);
  const { prompt, negative } = onModelPrompt(input);
  const images = await generateImages({ prompt, negative, image: input.image, count: Math.min(4, Math.max(1, input.count || 2)) }, env);
  if (!images.length) throw new ConnectorError("The image model returned no images", 502);
  return { images, prompt };
}
