import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { crc32 } from "../server/zip.mjs";
import { creatorEditConfigured, normaliseCreatorEdit, creatorEditPrompt, editCreatorImage, generateCreatorImage, judgeCreatorCandidate, creatorImageDimensions, CREATOR_EDIT_LIMITS, CREATOR_IMAGE_ASPECTS } from "../server/creator-edit.mjs";

const SOURCE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
function png(width, height) {
  const chunk = (name, data) => {
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length, 0); result.write(name, 4); data.copy(result, 8);
    result.writeUInt32BE(crc32(result.subarray(4, 8 + data.length)) >>> 0, 8 + data.length);
    return result;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels.writeUInt32BE(0x667788ff, y * (width * 4 + 1) + 1 + x * 4);
  return "data:image/png;base64," + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}
const CANDIDATE = png(4, 5);
const original = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const model = "data:image/webp;base64,UklGRgQAAABXRUJQ";
const approvedTexts = [{ text: "ثبات حتى ١٢ ساعة", lang: "ar" }, { text: "Lasts up to 12 hours", lang: "en" }];
const READBACK = { overlayTexts: approvedTexts.map((t) => t.text), productTexts: ["LAYALI"], arabicRendering: "correct", photorealPeople: false, problems: [] };
const PRODUCT = { sameProduct: true, shape: "same", logo: "intact", problems: [] };
const INPUT = { image: SOURCE, originalImage: original, prompt: "Change the Arabic phrase and preserve the bottle", approvedTexts, language: "both" };

function fake(overrides = {}) {
  const calls = { generate: [], readback: [], product: [] };
  return { calls, deps: {
    configured: () => true,
    providers: () => ["gemini", "openai"],
    generate: async (req) => { calls.generate.push(req); const [w, h] = req.aspect.split(":").map(Number); return [png(w, h)]; },
    readBack: async (image) => { calls.readback.push(image); return READBACK; },
    checkProduct: async (...args) => { calls.product.push(args); return PRODUCT; },
    ...overrides
  } };
}

test("Creator raster edits use the selected image, original product and exact approved copy", async () => {
  const { deps, calls } = fake();
  const result = await editCreatorImage({ ...INPUT, modelRef: model }, deps);
  assert.equal(result.image, CANDIDATE);
  assert.equal(result.mode, "edited");
  assert.equal(result.status, "checked");
  assert.equal(result.checks.ok, true);
  assert.equal(result.checks.reference, "original");
  assert.equal(result.checks.textApproval, "compared");
  assert.equal(result.pixelPreservation, "not_guaranteed");
  assert.equal(calls.generate.length, 1, "one explicit action is one generation, with no paid retries");
  const request = calls.generate[0];
  assert.equal(request.image, SOURCE);
  assert.deepEqual(request.refs, [original, model]);
  assert.equal(request.provider, "gemini");
  assert.equal(request.task, "text");
  assert.equal(request.count, 1);
  assert.match(request.prompt, /FIRST reference image.*selected current raster revision/);
  assert.match(request.prompt, /Reference 2 is the ORIGINAL product photo/);
  assert.match(request.prompt, /Reference 3 is the selected brand model/);
  assert.match(request.prompt, /Arabic RTL: "ثبات حتى ١٢ ساعة"/);
  assert.match(request.prompt, /right to left/);
  assert.deepEqual(calls.product, [[original, CANDIDATE]]);
  assert.deepEqual(calls.readback, [CANDIDATE]);
  assert.equal(INPUT.image, SOURCE, "the input revision is untouched");
});

test("a new composition can be generated from a source and instruction without any template", async () => {
  const { deps, calls } = fake({ readBack: async () => ({ ...READBACK, overlayTexts: [], arabicRendering: "none" }) });
  const result = await generateCreatorImage({ image: SOURCE, prompt: "Place this product on a warm marble plinth", mode: "generate", language: "en", approvedTexts: [], aspect: "1:1" }, deps);
  assert.equal(result.mode, "generated");
  assert.equal(result.status, "checked");
  assert.equal(result.checks.reference, "revision");
  assert.equal(calls.generate[0].task, "scene");
  assert.equal(calls.generate[0].aspect, "1:1");
  assert.deepEqual(calls.generate[0].refs, []);
  assert.match(calls.generate[0].prompt, /Create a finished 1:1 marketplace listing image/);
  assert.match(calls.generate[0].prompt, /Render NO overlay text/);
  assert.deepEqual(calls.product, [[SOURCE, result.image]]);
});

test("unapproved text remains a review candidate rather than claiming text approval", async () => {
  const { deps } = fake();
  const result = await editCreatorImage({ ...INPUT, approvedTexts: undefined }, deps);
  assert.equal(result.image, CANDIDATE);
  assert.equal(result.status, "needs_review");
  assert.equal(result.checks.text, null);
  assert.equal(result.checks.textApproval, "not_supplied");
  assert.deepEqual(result.checks.readback.overlayTexts, READBACK.overlayTexts);
});

test("wrong Arabic spelling, digit style, extra text and changed bottles fail checks", async () => {
  const { deps, calls } = fake({
    readBack: async () => ({ ...READBACK, overlayTexts: ["ثبات حتى 12 ساعة", "Lasts up to 12 hours", "BEST"], arabicRendering: "broken", problems: ["headline clipped at the edge"] }),
    checkProduct: async () => ({ sameProduct: false, shape: "changed", logo: "changed", problems: ["cap missing"] })
  });
  const result = await editCreatorImage(INPUT, deps);
  assert.equal(result.image, CANDIDATE, "keep the new candidate available for review");
  assert.equal(result.status, "needs_review");
  const reasons = result.checks.reasons.join("; ");
  assert.match(reasons, /text digits/);
  assert.match(reasons, /text extra/);
  assert.match(reasons, /arabic: broken/);
  assert.match(reasons, /Product shape changed/);
  assert.match(reasons, /Product logo changed/);
  assert.match(reasons, /cap missing/);
  assert.match(reasons, /clipped/);
  assert.equal(calls.generate.length, 1, "no automatic rerender or typeset fallback");
});

test("post-generation check outages preserve the paid candidate with explicit failures", async () => {
  const { deps } = fake({ readBack: async () => { throw new Error("Text check timed out"); }, checkProduct: async () => ({ invalid: true }) });
  const result = await editCreatorImage(INPUT, deps);
  assert.equal(result.image, CANDIDATE);
  assert.equal(result.status, "needs_review");
  assert.equal(result.checks.readback, null);
  assert.equal(result.checks.product, null);
  assert.equal(result.checks.errors.length, 2);
  assert.match(result.checks.reasons.join(), /readback: Text check timed out/);
  assert.match(result.checks.reasons.join(), /product: The model returned an unreadable check/);
});

test("missing configuration or a missing checker is rejected before a generation", async () => {
  const { deps, calls } = fake({ configured: () => false });
  await assert.rejects(editCreatorImage(INPUT, deps), (e) => e.status === 503);
  assert.equal(calls.generate.length, 0);
  await assert.rejects(editCreatorImage(INPUT, { ...deps, configured: () => true, checkProduct: null }), (e) => e.status === 503);
  assert.equal(calls.generate.length, 0);
  assert.equal(creatorEditConfigured({}), false);
  assert.equal(creatorEditConfigured({ FAL_KEY: "fake-test-key" }), true);
  assert.equal(creatorEditConfigured({ OPENAI_IMAGE_KEY: "fake-test-key" }), false, "image generation alone cannot check text and the product");
});

test("model failures, unchanged images and malformed outputs never become new revisions", async () => {
  for (const output of [[], [SOURCE], [original], ["https://example.com/generated.png"], ["data:image/png;base64,bm90IGFuIGltYWdl"]]) {
    const { deps, calls } = fake({ generate: async () => output });
    await assert.rejects(editCreatorImage(INPUT, deps), (e) => e.status === 502);
    assert.equal(calls.readback.length, 0);
  }
  const { deps } = fake({ generate: async () => { const e = new Error("Image provider rate limited"); e.status = 429; throw e; } });
  await assert.rejects(editCreatorImage(INPUT, deps), (e) => e.status === 429 && /rate limited/.test(e.message));
});

test("inputs are bounded, inline and validated before calling an image model", async () => {
  const invalid = [null, [], { ...INPUT, image: "https://example.com/source.png" }, { ...INPUT, originalImage: "file:///private/photo.png" },
    { ...INPUT, modelRef: "data:image/svg+xml;base64,PHN2Zz4=" }, { ...INPUT, prompt: " " }, { ...INPUT, prompt: "x".repeat(CREATOR_EDIT_LIMITS.prompt + 1) },
    { ...INPUT, mode: "layers" }, { ...INPUT, language: "ru" }, { ...INPUT, aspect: "2:1" }, { ...INPUT, approvedTexts: "headline" },
    { ...INPUT, approvedTexts: [{ text: "hello", lang: "ru" }] }, { ...INPUT, language: "en" },
    { ...INPUT, approvedTexts: [{ text: "", lang: "ar" }] }, { ...INPUT, image: "data:image/png;base64,AAAA" }];
  const { deps, calls } = fake();
  for (const value of invalid) await assert.rejects(editCreatorImage(value, deps), (e) => e.status === 400);
  assert.equal(calls.generate.length, 0);
});

test("repeated references are not added twice and exact approved numerals are not rewritten", () => {
  const spec = normaliseCreatorEdit({ ...INPUT, originalImage: SOURCE, modelRef: SOURCE, language: "ar", approvedTexts: [{ text: "حتى 12 ساعة", lang: "ar" }] });
  const built = creatorEditPrompt(spec);
  assert.deepEqual(built.refs, []);
  assert.match(built.prompt, /Arabic RTL: "حتى 12 ساعة"/);
  assert.doesNotMatch(built.prompt, /١٢/);
});

test("readback can flag photoreal people and no-text intent rejects invented overlays", async () => {
  const { deps } = fake({ readBack: async () => ({ ...READBACK, photorealPeople: true }) });
  const result = await editCreatorImage({ ...INPUT, approvedTexts: [] }, deps);
  assert.equal(result.aiPeople, true);
  assert.equal(result.status, "needs_review");
  assert.equal(result.checks.text.ok, false);
  assert.match(result.checks.reasons.join(), /text extra/);
  const verdict = judgeCreatorCandidate({ approvedTexts: [], readback: { ...READBACK, overlayTexts: [], arabicRendering: "none" }, product: null });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reasons.join(), /Product check is unavailable/);
});

test("shared no-text slots accept none and force empty overlay copy", async () => {
  const { deps, calls } = fake({ readBack: async () => ({ ...READBACK, overlayTexts: [], arabicRendering: "none" }) });
  const result = await editCreatorImage({ image: SOURCE, prompt: "Clean product shot", language: "none", aspect: "1:1" }, deps);
  assert.equal(result.status, "checked");
  assert.equal(result.checks.textApproval, "compared");
  assert.deepEqual(result.checks.text.items, []);
  assert.equal(calls.generate[0].task, "scene");
  assert.match(calls.generate[0].prompt, /shared no-text image/);
  assert.match(calls.generate[0].prompt, /Render NO overlay text/);
  assert.doesNotMatch(calls.generate[0].prompt, /Overlay language: English/);
  await assert.rejects(editCreatorImage({ ...INPUT, language: "none" }, deps), (e) => e.status === 400);
});

test("bilingual is the project's alias for both languages, without rewriting copy", async () => {
  const { deps, calls } = fake();
  const result = await editCreatorImage({ ...INPUT, language: "bilingual" }, deps);
  assert.equal(result.status, "checked");
  assert.equal(normaliseCreatorEdit({ ...INPUT, language: "bilingual" }).language, "both");
  assert.match(calls.generate[0].prompt, /Overlay language: Arabic and English/);
  assert.match(calls.generate[0].prompt, /Arabic RTL: "ثبات حتى ١٢ ساعة"/);
});

test("all project aspects are passed through and verified from generated dimensions", async () => {
  for (const aspect of CREATOR_IMAGE_ASPECTS) {
    const { deps, calls } = fake();
    const result = await editCreatorImage({ ...INPUT, aspect }, deps);
    assert.equal(calls.generate[0].aspect, aspect);
    assert.equal(result.requestedAspect, aspect);
    assert.equal(result.actualAspect, aspect);
    assert.deepEqual(result.dimensions, { width: Number(aspect.split(":")[0]), height: Number(aspect.split(":")[1]) });
    assert.equal(result.checks.aspect.matches, true);
    assert.equal(result.status, "checked");
  }
});

test("a provider returning its own aspect is a review candidate with honest metadata", async () => {
  const { deps } = fake({ generate: async () => [png(2, 3)] });
  const result = await editCreatorImage({ ...INPUT, aspect: "9:16" }, deps);
  assert.equal(result.status, "needs_review");
  assert.equal(result.requestedAspect, "9:16");
  assert.equal(result.actualAspect, "2:3");
  assert.equal(result.checks.aspect.matches, false);
  assert.match(result.checks.reasons.join(), /Image aspect 2:3 differs from requested 9:16/);
});

test("PNG, JPEG and three WebP header variants report dimensions without a renderer", () => {
  assert.deepEqual(creatorImageDimensions(SOURCE), { width: 1, height: 1 });
  const jpeg = Buffer.from([255, 216, 255, 192, 0, 11, 8, 0, 5, 0, 4, 1, 1, 17, 0, 255, 217]);
  assert.deepEqual(creatorImageDimensions("data:image/jpeg;base64," + jpeg.toString("base64")), { width: 4, height: 5 });
  for (const kind of ["VP8X", "VP8L", "VP8 "]) {
    const data = Buffer.alloc(kind === "VP8L" ? 26 : 30); data.write("RIFF"); data.writeUInt32LE(data.length - 8, 4); data.write("WEBP", 8); data.write(kind, 12); data.writeUInt32LE(kind === "VP8L" ? 5 : 10, 16);
    if (kind === "VP8X") { data.writeUIntLE(3, 24, 3); data.writeUIntLE(4, 27, 3); }
    else if (kind === "VP8L") { data[20] = 47; data.writeUInt32LE(3 | (4 << 14), 21); }
    else { data[23] = 157; data[24] = 1; data[25] = 42; data.writeUInt16LE(4, 26); data.writeUInt16LE(5, 28); }
    assert.deepEqual(creatorImageDimensions("data:image/webp;base64," + data.toString("base64")), { width: 4, height: 5 }, kind);
  }
  assert.equal(creatorImageDimensions("data:image/jpeg;base64,/9j/4AAQSkZJRg=="), null, "truncated segments never read outside the buffer");
  assert.equal(creatorImageDimensions("https://example.com/image.png"), null);
});
