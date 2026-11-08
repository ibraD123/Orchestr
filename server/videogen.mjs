// Short product videos for the marketplace gallery (Noon's "Additional Media", Amazon's video slot).
//
// The video model animates one approved image: the product photo or a checked slide. Nothing new
// is written on screen and there is no audio, so the video can't break Noon's video rules on
// prices, shipping, reviews, contacts or languages. Before anyone sees it, frames are taken from
// the start, middle and end and checked like slides: Claude reads them for text the model added,
// and compares the product with the photo. A failed video is generated once more.
//
// Model: fal.ai queue (POST https://queue.fal.run/<model> → status_url / response_url).
//   FAL_VIDEO_MODEL, default fal-ai/minimax/hailuo-2.3-fast/standard/image-to-video (MiniMax
//   Hailuo 2.3 Fast, 768p, $0.19 for 6 s, $0.32 for 10 s): { image_url, prompt, duration: "6"|"10",
//   prompt_optimizer } → { video: { url } }. Other MiniMax models take the same input, e.g.
//   fal-ai/minimax/hailuo-02/pro/image-to-video for 1080p ($0.08 a second).
//   Kling (fal-ai/kling-video/o3/standard/image-to-video, $0.084 a second): duration "3".."15".
//   Veo 3.1 (fal-ai/veo3.1/image-to-video) also works: { image_url, prompt, duration: "4s"|"6s"|"8s",
//   resolution, aspect_ratio: "9:16"|"16:9", generate_audio, negative_prompt }.
import { safeFetch, ConnectorError } from "./connectors/net.mjs";

export const VIDEO_MODEL = () => process.env.FAL_VIDEO_MODEL || "fal-ai/minimax/hailuo-2.3-fast/standard/image-to-video";
export const VIDEO_SECONDS = 6;
export const MAX_VIDEO_ATTEMPTS = 2;
export function videoGenConfigured(env = process.env) { return Boolean(env.FAL_KEY); }

/** Prompt: slow, product-first motion, nothing added. Pure, so it is tested. */
export function videoPrompt({ product, category, visual, scene }) {
  return [
    `Short product video for an online marketplace gallery: ${product || "the product in the image"}${category ? ` (${category})` : ""}.`,
    scene ? "Animate this scene gently: slow camera push-in or a slight orbit, soft light shifting across the product." : "Slow, smooth camera push-in or a slight orbit around the product, soft studio light, a gentle reflection moving across it.",
    "Keep the product exactly as in the image: same shape, colours, label, logo and proportions. It stays in frame and in focus the whole time.",
    "Do not add any text, letters, numbers, logos, prices, badges, watermarks or people. Keep any text already in the image unchanged and still.",
    visual ? `Brand visual style: ${visual}` : "",
    "No cuts, no fast motion, no camera shake."
  ].filter(Boolean).join(" ");
}

/** The model's input for one request, shaped for MiniMax, Kling or Veo. */
export function videoInput(model, { image, prompt, seconds = VIDEO_SECONDS, vertical = true }) {
  // MiniMax: 6 or 10 seconds; its prompt optimizer is off so our "add no text" rules reach the model as written.
  if (/minimax/.test(model)) return { image_url: image, prompt, duration: seconds > 6 ? "10" : "6", prompt_optimizer: false };
  if (/veo/.test(model)) {
    const d = seconds <= 4 ? "4s" : seconds <= 6 ? "6s" : "8s";
    return { image_url: image, prompt, duration: d, resolution: "1080p", aspect_ratio: vertical ? "9:16" : "16:9", generate_audio: false, negative_prompt: "text, letters, captions, watermark, logo change, distorted product, people" };
  }
  return { image_url: image, prompt, duration: String(Math.max(3, Math.min(15, Math.round(seconds)))), generate_audio: false };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run one video request through the fal queue and download the MP4.
 * @returns {Promise<{ video: Buffer, url: string, model: string }>}
 */
export async function falVideo(input, { net = safeFetch, wait = sleep, model = VIDEO_MODEL(), timeoutMs = 600_000 } = {}) {
  if (!process.env.FAL_KEY) throw new ConnectorError("Videos need FAL_KEY on the server", 503);
  const headers = { Authorization: "Key " + process.env.FAL_KEY, Accept: "application/json" };
  const json = (r) => { try { return JSON.parse(r.body.toString("utf8") || "{}"); } catch { return {}; } };
  const err = (j, status) => new ConnectorError("Video model: " + (typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d) => d.msg || d).join("; ") : j.error || j.message || status), status === 429 ? 429 : 502);
  const allow = [400, 401, 402, 403, 404, 422, 429, 500, 502, 503];
  const sub = await net(`https://queue.fal.run/${model}`, { method: "POST", timeoutMs: 60_000, maxBytes: 1_000_000, allowStatus: allow, body: JSON.stringify(input), headers: { ...headers, "Content-Type": "application/json" } });
  const s = json(sub);
  if (sub.status >= 400 || !s.status_url || !s.response_url) throw err(s, sub.status);
  const started = Date.now();
  for (;;) {
    await wait(4000);
    const st = json(await net(s.status_url, { timeoutMs: 30_000, maxBytes: 200_000, allowStatus: allow, headers }));
    if (st.status === "COMPLETED") { if (st.error) throw err({ error: st.error }, 502); break; }
    if (Date.now() - started > timeoutMs) throw new ConnectorError("The video took too long; try again", 504);
  }
  const res = await net(s.response_url, { timeoutMs: 60_000, maxBytes: 2_000_000, allowStatus: allow, headers });
  const out = json(res);
  if (res.status >= 400 || !out.video || !out.video.url) throw err(out, res.status);
  const file = await net(out.video.url, { timeoutMs: 120_000, maxBytes: 80_000_000 });
  return { video: file.body, url: out.video.url, model };
}

/**
 * Generate a gallery video and check it.
 * @param {{ image: dataUrl, product?, category?, visual?, seconds?, scene? }} input
 * @param {{ generate, frames, readBack, checkProduct }} deps
 * @returns {{ ok, video: Buffer|null, attempts: Array<{ ok, reasons, frames }> , model }}
 */
export async function generateVideo(input, deps) {
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(String(input.image || ""))) throw new ConnectorError("Send the image to animate as a PNG, JPEG or WebP", 400);
  const prompt = videoPrompt(input);
  const attempts = [];
  for (let n = 1; n <= MAX_VIDEO_ATTEMPTS; n++) {
    const { video, model } = await deps.generate({ image: input.image, prompt, seconds: input.seconds || VIDEO_SECONDS });
    const frames = await deps.frames(video);
    const reasons = [];
    // Text the model added, on any frame; text printed on the product itself is fine.
    const reads = await Promise.all(frames.map((f) => deps.readBack(f).catch(() => null)));
    const before = new Set((input.texts || []).map((t) => String(t).replace(/\s+/g, "")));
    reads.forEach((r, i) => {
      if (!r) return;
      const added = (r.overlayTexts || []).filter((t) => t.replace(/\s+/g, "") && !before.has(t.replace(/\s+/g, "")));
      if (added.length) reasons.push(`frame ${i + 1}: text added (${added.join(" / ").slice(0, 60)})`);
      if (r.arabicRendering === "broken") reasons.push(`frame ${i + 1}: Arabic broken`);
    });
    // The product on the middle and last frames must still be the product.
    for (const i of [Math.floor(frames.length / 2), frames.length - 1]) {
      const p = await deps.checkProduct(input.image, frames[i]).catch(() => null);
      if (p && (!p.sameProduct || p.shape === "changed" || p.logo === "changed" || p.logo === "missing")) reasons.push(`frame ${i + 1}: product changed${p.problems && p.problems[0] ? " (" + p.problems[0] + ")" : ""}`);
    }
    const people = reads.some((r) => r && r.photorealPeople);
    attempts.push({ ok: reasons.length === 0, reasons, frames: frames.length, model });
    if (!reasons.length) return { ok: true, video, attempts, model, aiPeople: people };
  }
  return { ok: false, video: null, attempts, model: attempts[0] && attempts[0].model };
}
