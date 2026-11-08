// One way to ask the language model for a structured answer, whichever key the server has:
//   ANTHROPIC_API_KEY  the Anthropic API directly, with schema-enforced output (preferred);
//   FAL_KEY            the same Claude model through fal.ai's OpenRouter gateway
//                      (POST https://fal.run/openrouter/router/vision, Authorization: Key …,
//                      { model, system_prompt, prompt, image_urls[], max_tokens, reasoning } → { output }).
//                      The gateway has no schema mode, so the JSON Schema goes in the instructions,
//                      the answer is validated with zod here, and a bad answer is asked for once more.
// Callers pass the same parameters as client.beta.messages.parse plus `schema`, and get back
// { parsed_output, stop_reason, model }.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { safeFetch } from "./connectors/net.mjs";

export const MODEL = process.env.BASIRA_MODEL || "claude-opus-5-5";
// fal / OpenRouter name for the same model.
const FAL_LLM_MODEL = () => process.env.FAL_LLM_MODEL || "anthropic/claude-opus-5.5";
const FAL_URL = () => process.env.FAL_LLM_URL || "https://fal.run/openrouter/router/vision";

export function llmProvider(env = process.env) {
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) return "anthropic";
  if (env.FAL_KEY) return "fal";
  return null;
}
export function llmConfigured(env = process.env) { return llmProvider(env) !== null; }
export function llmModelName(env = process.env) { const p = llmProvider(env); return p === "anthropic" ? MODEL : p === "fal" ? "fal:" + FAL_LLM_MODEL() : null; }

let client = null;

/** Every top-level {...} JSON object in a model's text answer, in order (fences and prose are ignored). */
export function jsonObjects(text) {
  const s = String(text || "").replace(/```(?:json)?/gi, "");
  const out = [];
  let depth = 0, inStr = false, esc = false, start = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"' && depth > 0) inStr = true;
    else if (c === "{") { if (depth++ === 0) start = i; }
    else if (c === "}" && depth > 0 && --depth === 0) { try { out.push(JSON.parse(s.slice(start, i + 1))); } catch { /* not JSON */ } }
  }
  return out;
}
/** The first JSON object in a text answer, or null. */
export function extractJson(text) { return jsonObjects(text)[0] || null; }

/** Anthropic-style content → the gateway's prompt text and image list, keeping their order. */
export function toGateway(messages) {
  const parts = [], images = [];
  for (const m of messages || []) {
    const content = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content || [];
    for (const b of content) {
      if (b.type === "text") parts.push(b.text);
      else if (b.type === "image" && b.source) {
        images.push(b.source.type === "base64" ? `data:${b.source.media_type};base64,${b.source.data}` : b.source.url);
        parts.push(`[attached image ${images.length}]`);
      }
    }
  }
  return { prompt: parts.join("\n"), images };
}

async function viaFal(params, schema, net) {
  const { prompt, images } = toGateway(params.messages);
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
  const system = `${params.system || ""}\n\nAnswer with one JSON object only, no prose and no code fences, matching this JSON Schema exactly (every required field, enum values as written):\n${jsonSchema}` +
    (images.length ? `\n\nThe images are attached in the order they are referenced: [attached image 1] is the first attached image, and so on.` : "");
  const model = FAL_LLM_MODEL();
  let note = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    // Reasoning can't be turned off on this gateway; its text may come before the answer.
    const body = { model, system_prompt: system, prompt: prompt + note, max_tokens: Math.max(4000, params.max_tokens || 4000), reasoning: true };
    if (images.length) body.image_urls = images;
    const r = await net(FAL_URL(), { method: "POST", timeoutMs: 180_000, maxBytes: 5_000_000, allowStatus: [400, 401, 402, 403, 404, 422, 429, 500, 502, 503], body: JSON.stringify(body), headers: { Authorization: "Key " + process.env.FAL_KEY, "Content-Type": "application/json", Accept: "application/json" } });
    const j = JSON.parse(r.body.toString("utf8") || "{}");
    if (r.status >= 400) {
      const msg = typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d) => d.msg || d).join("; ") : j.error || j.message || r.status;
      const e = new Error("Language model (fal): " + msg); e.status = r.status === 429 ? 429 : 502; throw e;
    }
    // The answer is the last JSON object that fits the schema (reasoning may quote other JSON).
    const tries = jsonObjects(j.output).reverse().map((c) => schema.safeParse(c));
    const parsed = tries.find((t) => t.success) || tries[0] || null;
    if (parsed && parsed.success) return { parsed_output: parsed.data, stop_reason: "end_turn", model: "fal:" + model, usage: j.usage || null };
    note = `\n\nYour previous answer was not valid JSON for the schema${parsed && parsed.error ? ` (${parsed.error.issues.slice(0, 3).map((i) => i.path.join(".") + ": " + i.message).join("; ")})` : ""}. Answer again with the JSON object only.`;
  }
  return { parsed_output: null, stop_reason: "invalid_output", model: "fal:" + model };
}

/**
 * client.beta.messages.parse, or the same request through fal.
 * @param {object} params Anthropic parameters plus `schema` (the zod schema of the answer)
 * @param {{ net? }} deps injectable for tests
 */
export async function messagesParse(params, deps = {}) {
  const { schema, ...rest } = params;
  const provider = llmProvider();
  if (provider === "anthropic") {
    client ||= new Anthropic();
    return client.beta.messages.parse(rest);
  }
  if (provider === "fal") return viaFal(rest, schema, deps.net || safeFetch);
  const e = new Error("This needs a language model on the server: set FAL_KEY or ANTHROPIC_API_KEY"); e.status = 503; throw e;
}
