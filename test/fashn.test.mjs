import test from "node:test";
import assert from "node:assert/strict";
import { fashnModelCreate } from "../server/fashn.mjs";
import { createModel } from "../server/creator-models.mjs";

const env = { FASHN_API_KEY: "fa-test" };
const JPEG = "data:image/jpeg;base64,/9j/AAAA";

test("FASHN model-create: submits, polls and returns a JPEG data URL", async () => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith("/run")) return { ok: true, json: async () => ({ id: "job-1", error: null }) };
    const n = calls.filter((c) => c.url.includes("/status/")).length;
    return { ok: true, json: async () => (n < 2 ? { id: "job-1", status: "processing" } : { id: "job-1", status: "completed", output: [JPEG] }) };
  };
  const out = await fashnModelCreate({ prompt: "Adult woman", faceReference: JPEG }, { env, fetch, sleep: async () => {} });
  assert.equal(out, JPEG);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(calls[0].url, "https://api.fashn.ai/v1/run");
  assert.equal(calls[0].init.headers.Authorization, "Bearer fa-test");
  assert.equal(body.model_name, "model-create");
  assert.equal(body.inputs.aspect_ratio, "4:5");
  assert.equal(body.inputs.return_base64, true);
  assert.equal(body.inputs.face_reference, JPEG);
  assert.match(calls[1].url, /\/v1\/status\/job-1$/);
});

test("FASHN failures become clear errors; no key means 503", async () => {
  await assert.rejects(fashnModelCreate({ prompt: "x" }, { env: {} }), { status: 503 });
  const fetch = async (url) => url.endsWith("/run") ? { ok: true, json: async () => ({ id: "j" }) } : { ok: true, json: async () => ({ status: "failed", error: { name: "ContentModerationError", message: "blocked" } }) };
  await assert.rejects(fashnModelCreate({ prompt: "x" }, { env, fetch, sleep: async () => {} }), /blocked/);
  const refused = async () => ({ ok: false, status: 401, json: async () => ({ message: "bad key" }) });
  await assert.rejects(fashnModelCreate({ prompt: "x" }, { env, fetch: refused, sleep: async () => {} }), /bad key/);
});

test("createModel uses FASHN when configured and passes the face reference", async () => {
  let got;
  const r = await createModel({ gender: "woman", look: "gulf", cover: "hijab", age: 28, referenceImage: JPEG }, { useFashn: () => true, fashnCreate: async (i) => { got = i; return JPEG; }, fashnInfo: () => ({ name: "fashn", model: "model-create" }) });
  assert.equal(r.provider.name, "fashn");
  assert.equal(got.faceReference, JPEG);
  assert.match(got.prompt, /adult woman/);
  assert.match(got.prompt, /hijab/);
  assert.equal(r.status, "review_required");
});
