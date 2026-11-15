// FASHN (fashn.ai) model-create: photo-real fashion models for Creator → Models.
// Needs FASHN_API_KEY. Optional: FASHN_MODEL_MODE (fast | balanced | quality, default balanced)
// and FASHN_MODEL_RESOLUTION (1k | 2k | 4k, default 2k). Credits per image: balanced 2k = 3,
// plus 3 when a face reference is used. Docs: https://docs.fashn.ai/api-reference/model-create
import { ConnectorError } from "./connectors/net.mjs";

const API = "https://api.fashn.ai/v1";
const MODES = ["fast", "balanced", "quality"], SIZES = ["1k", "2k", "4k"];

export function fashnConfigured(env = process.env) { return Boolean(env.FASHN_API_KEY); }

function settings(env) {
  return {
    mode: MODES.includes(env.FASHN_MODEL_MODE) ? env.FASHN_MODEL_MODE : "balanced",
    resolution: SIZES.includes(env.FASHN_MODEL_RESOLUTION) ? env.FASHN_MODEL_RESOLUTION : "2k"
  };
}

export function fashnModelInfo(env = process.env) { const s = settings(env); return { name: "fashn", model: "model-create", mode: s.mode, resolution: s.resolution }; }

/** Generate one model image. Returns a JPEG data URL.
 * input: { prompt, faceReference?, aspect? }. deps: { fetch, sleep, env, timeoutMs } for tests. */
export async function fashnModelCreate(input, deps = {}) {
  const env = deps.env || process.env, doFetch = deps.fetch || fetch;
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const key = env.FASHN_API_KEY;
  if (!key) throw new ConnectorError("FASHN_API_KEY is not set on the server", 503);
  const s = settings(env);
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const inputs = { prompt: input.prompt, aspect_ratio: input.aspect || "4:5", resolution: s.resolution, generation_mode: s.mode, num_images: 1, output_format: "jpeg", return_base64: true };
  if (input.faceReference) Object.assign(inputs, { face_reference: input.faceReference, face_reference_mode: "match_base" });
  const call = async (url, init) => {
    let res;
    try { res = await doFetch(url, init); } catch (e) { throw new ConnectorError(`FASHN is unreachable: ${e.message}`, 502); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ConnectorError(`FASHN refused the request (${res.status}): ${body.message || body.error || "unknown error"}`, res.status === 401 ? 502 : res.status >= 500 ? 502 : 422);
    return body;
  };
  const started = await call(`${API}/run`, { method: "POST", headers, body: JSON.stringify({ model_name: "model-create", inputs }) });
  if (!started.id) throw new ConnectorError(`FASHN did not start the job: ${started.error?.message || started.error || "no id"}`, 502);
  const deadline = Date.now() + (deps.timeoutMs || 180_000);
  for (let wait = 3000; ; wait = Math.min(wait + 1000, 6000)) {
    await sleep(wait);
    const st = await call(`${API}/status/${encodeURIComponent(started.id)}`, { headers: { Authorization: headers.Authorization } });
    if (st.status === "completed") {
      const out = Array.isArray(st.output) ? st.output[0] : null;
      if (typeof out !== "string") throw new ConnectorError("FASHN returned no image", 502);
      if (out.startsWith("data:")) return out.replace(/^data:image\/jpg;/, "data:image/jpeg;");
      return `data:image/jpeg;base64,${out}`;
    }
    if (st.status === "failed") throw new ConnectorError(`FASHN could not create the model: ${st.error?.message || st.error?.name || "failed"}`, 422);
    if (Date.now() > deadline) throw new ConnectorError("FASHN took too long to create the model", 504);
  }
}
