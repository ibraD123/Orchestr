// On-model and lifestyle photos through an external image model.
// The provider is configured with IMAGE_API_URL and IMAGE_API_KEY. The request and response follow
// a simple contract (below); a provider with a different API gets a small adapter here.
//
//   POST IMAGE_API_URL  Authorization: Bearer IMAGE_API_KEY
//   { prompt, negative_prompt, image: <product photo data URL>, width, height, num_images }
//   → { images: [ { url } | { b64_json } ] }
//
// The product photo goes in as a reference so the model keeps the product; the app then checks
// colour fidelity against the original before anything is approved.
import { safeFetch, ConnectorError } from "./connectors/net.mjs";

export const MODEL_LOOKS = ["gulf", "levant", "northAfrica", "southAsia", "any"];
export const HEAD_COVER = ["hijab", "none", "any"];
export const SETTINGS = ["studio", "home", "outdoor", "majlis"];

export function imageGenConfigured(env = process.env) { return Boolean(env.IMAGE_API_URL && env.IMAGE_API_KEY); }

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
  if (!imageGenConfigured(env)) throw new ConnectorError("On-model photos need an image model: set IMAGE_API_URL and IMAGE_API_KEY on the server", 503);
  if (typeof input.image !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(input.image)) throw new ConnectorError("Send the product photo as a PNG, JPEG or WebP", 400);
  const { prompt, negative } = onModelPrompt(input);
  const r = await safeFetch(env.IMAGE_API_URL, {
    method: "POST", timeoutMs: 120_000, maxBytes: 40_000_000, allowStatus: [400, 401, 402, 422, 429],
    headers: { Authorization: "Bearer " + env.IMAGE_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ prompt, negative_prompt: negative, image: input.image, width: 1600, height: 2000, num_images: Math.min(4, Math.max(1, input.count || 2)) })
  });
  const j = JSON.parse(r.body.toString("utf8") || "{}");
  if (r.status >= 400) throw new ConnectorError("Image model: " + (j.error || j.message || r.status), 502);
  const out = [];
  for (const im of (j.images || []).slice(0, 4)) {
    if (im.b64_json) out.push("data:image/png;base64," + im.b64_json);
    else if (im.url) {
      const f = await safeFetch(im.url, { maxBytes: 15_000_000, timeoutMs: 60_000 });
      const type = (f.headers.get("content-type") || "image/png").split(";")[0];
      out.push(`data:${type};base64,${f.body.toString("base64")}`);
    }
  }
  if (!out.length) throw new ConnectorError("The image model returned no images", 502);
  return { images: out, prompt };
}
