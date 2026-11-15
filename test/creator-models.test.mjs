import test from "node:test";
import assert from "node:assert/strict";
import { createModel, tryOn, runwayVideo, runwayPrompt } from "../server/creator-models.mjs";

const PRODUCT = "data:image/png;base64,cHJvZHVjdA==";
const MODEL = "data:image/jpeg;base64,bW9kZWw=";
const TRYON = "data:image/webp;base64,dHJ5b24=";
const PASS = { sameProduct: true, shape: "same", logo: "intact", problems: [] };
const provider = () => ({ name: "generic", model: "test-image", key: "DO-NOT-EXPOSE", url: "https://secret.test" });
const imageDeps = { provider, useFashn: () => false, canCheck: () => true, generateImages: async () => [TRYON], checkProduct: async () => PASS };
const videoDeps = {
  videoModel: () => "fal-ai/minimax/hailuo-2.3-fast/standard/image-to-video",
  videoConfigured: () => true, canCheck: () => true, rendererAvailable: async () => true,
  generateVideo: async () => ({ video: Buffer.from("MP4"), model: "test-video" }),
  frames: async () => [MODEL, TRYON, PRODUCT],
  readBackText: async () => ({ overlayTexts: [], arabicRendering: "none", photorealPeople: true }),
  checkProduct: async () => PASS
};
const approved = { source: { kind: "tryon", approved: true, image: TRYON }, productImage: PRODUCT, product: "عباية كتان" };

test("model creation uses configured people provider, a real blank seed, and preserves Arabic brief", async () => {
  let request;
  const result = await createModel({ prompt: "مظهر عصري في دبي", gender: "woman", cover: "none" }, { ...imageDeps, generateImages: async (r) => { request = r; return [MODEL]; } });
  assert.match(request.image, /^data:image\/png;base64,/);
  assert.equal(request.count, 1);
  assert.equal(request.task, "people");
  assert.match(request.prompt, /مظهر عصري في دبي/);
  assert.match(request.prompt, /No head covering/);
  assert.match(request.prompt, /original adult person/);
  assert.equal(result.status, "review_required");
  assert.deepEqual(result.images, [MODEL]);
  assert.equal(result.identityVerified, false);
  assert.deepEqual(result.provider, { name: "generic", model: "test-image" });
  assert.equal(result.cost.amount, null);
  assert.doesNotMatch(JSON.stringify(result), /DO-NOT-EXPOSE|secret\.test/);
});

test("model reference creation guides identity and provider absence never returns sample imagery", async () => {
  let request;
  const result = await createModel({ referenceImage: MODEL }, { ...imageDeps, generateImages: async (r) => { request = r; return [TRYON]; } });
  assert.equal(request.image, MODEL);
  assert.match(request.prompt, /do not replace their identity/);
  assert.equal(result.provenance, "reference_guided");
  await assert.rejects(createModel({}, { ...imageDeps, provider: () => null }), { status: 503 });
  await assert.rejects(createModel({}, { ...imageDeps, generateImages: async () => [] }), { status: 502 });
});

test("try-on sends real product first and selected identity second without redesigning for modesty", async () => {
  const comparisons = [];
  let request;
  const result = await tryOn({ productImage: PRODUCT, modelImage: MODEL, product: "linen shirt", category: "fashion", cover: "hijab" }, { ...imageDeps,
    generateImages: async (r) => { request = r; return [TRYON]; },
    checkProduct: async (...args) => { comparisons.push(args); return PASS; }
  });
  assert.equal(request.image, PRODUCT);
  assert.deepEqual(request.refs, [MODEL]);
  assert.match(request.prompt, /Never redesign the item/);
  assert.match(request.prompt, /same|consistent/);
  assert.doesNotMatch(request.prompt, /Modest styling: long sleeves/);
  assert.deepEqual(comparisons, [[PRODUCT, TRYON]]);
  assert.equal(result.ok, true);
  assert.equal(result.status, "review_required");
  assert.equal(result.results[0].status, "passed");
  assert.equal(result.fitVerified, false);
});

test("try-on blocks changed products and fails closed when a comparison is unavailable", async () => {
  const rejected = await tryOn({ image: PRODUCT, modelRef: MODEL }, { ...imageDeps, checkProduct: async () => ({ ...PASS, shape: "changed", problems: ["Sleeves became longer"] }) });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.images, []);
  assert.equal(rejected.status, "rejected");
  assert.deepEqual(rejected.results[0].reasons, ["Sleeves became longer"]);
  const unavailable = await tryOn({ image: PRODUCT, modelRef: MODEL }, { ...imageDeps, checkProduct: async () => { throw new Error("checker is down"); } });
  assert.equal(unavailable.status, "verification_unavailable");
  assert.deepEqual(unavailable.images, []);
  let spent = false;
  await assert.rejects(tryOn({ image: PRODUCT, modelRef: MODEL }, { ...imageDeps, canCheck: () => false, generateImages: async () => { spent = true; } }), { status: 503 });
  assert.equal(spent, false);
  await assert.rejects(tryOn({ image: PRODUCT }, imageDeps), /selected model reference/);
  await assert.rejects(tryOn({ image: PRODUCT, modelRef: MODEL, count: 20 }, imageDeps), /one or two/);
});

test("runway requires approved try-on source, uses that frame and checks against real SKU", async () => {
  await assert.rejects(runwayVideo({ image: PRODUCT }, videoDeps), /approved try-on/);
  await assert.rejects(runwayVideo({ source: { kind: "product", approved: true, image: PRODUCT } }, videoDeps), /approved try-on/);
  await assert.rejects(runwayVideo({ source: { kind: "tryon", approved: false, image: TRYON } }, videoDeps), /approved try-on/);
  const requests = [], checks = [];
  const result = await runwayVideo(approved, { ...videoDeps,
    generateVideo: async (request, options) => { requests.push({ request, options }); return { video: Buffer.from("MP4"), model: "test-video" }; },
    checkProduct: async (...args) => { checks.push(args); return PASS; }
  });
  assert.equal(result.ok, true);
  assert.equal(result.video.toString(), "MP4");
  assert.equal(result.status, "review_required");
  assert.equal(requests[0].request.image_url, TRYON);
  assert.equal(requests[0].request.duration, "6");
  assert.match(requests[0].request.prompt, /small, slow natural runway steps/);
  assert.doesNotMatch(requests[0].request.prompt, /Do not add.*or people/);
  assert.deepEqual(checks, [[PRODUCT, TRYON], [PRODUCT, PRODUCT]]);
  assert.equal(result.cost.generations, 1);
  assert.equal(result.aiPeople, true);
});

test("runway checks never silently pass unavailable reviewers or added overlays", async () => {
  const unavailable = await runwayVideo(approved, { ...videoDeps, readBackText: async () => { throw new Error("offline"); } });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.video, null);
  assert.equal(unavailable.status, "verification_unavailable");
  assert.match(unavailable.attempts[0].reasons.join(), /verification was unavailable/);
  const changed = await runwayVideo(approved, { ...videoDeps, checkProduct: async () => ({ ...PASS, logo: "missing", problems: ["Missing brand label"] }) });
  assert.equal(changed.ok, false);
  assert.equal(changed.video, null);
  assert.equal(changed.attempts.length, 2);
  const overlay = await runwayVideo(approved, { ...videoDeps, readBackText: async () => ({ overlayTexts: ["خصم ٥٠٪"], arabicRendering: "correct" }) });
  assert.equal(overlay.ok, false);
  assert.match(overlay.attempts[1].reasons.join(), /text added/);
  await assert.rejects(runwayVideo(approved, { ...videoDeps, frames: async () => [] }), /three decoded frames/);
});

test("runway checks availability before spending and respects configured duration", async () => {
  let spent = false;
  await assert.rejects(runwayVideo(approved, { ...videoDeps, rendererAvailable: async () => false, generateVideo: async () => { spent = true; } }), { status: 503 });
  assert.equal(spent, false);
  await assert.rejects(runwayVideo({ ...approved, seconds: 10 }, { ...videoDeps, videoModel: () => "fal-ai/veo3.1/image-to-video" }), /six-second/);
  let request;
  await runwayVideo(approved, { ...videoDeps, videoModel: () => "fal-ai/veo3.1/image-to-video", generateVideo: async (r) => { request = r; return { video: Buffer.from("MP4"), model: "veo" }; } });
  assert.equal(request.generate_audio, false);
  assert.match(request.negative_prompt, /new people/);
  assert.doesNotMatch(request.negative_prompt, /, people$/);
  assert.match(runwayPrompt({ product: "قميص" }), /قميص/);
});

test("model builder traits reach the prompt; ages stay adult and hair hides under a hijab", async () => {
  let request;
  const deps = { useFashn: () => false, provider: () => ({ name: "openai", model: "test" }), generateImages: async (r) => { request = r; return ["data:image/png;base64,AAAA"]; } };
  await createModel({ gender: "woman", look: "gulf", cover: "hijab", age: 12, build: "plus", hair: "blonde" }, deps);
  assert.match(request.prompt, /Apparent age about 18\./);
  assert.match(request.prompt, /plus-size build/);
  assert.doesNotMatch(request.prompt, /blonde/);
  await createModel({ gender: "man", look: "levant", cover: "none", age: "35", build: "unknown", hair: "grey" }, deps);
  assert.match(request.prompt, /Apparent age about 35\./);
  assert.match(request.prompt, /grey hair/);
  assert.doesNotMatch(request.prompt, /unknown/);
});
