// Generated slides with a text check: planning, prompts, letter-by-letter comparison, retries, fallback, providers.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { planSlide, slideTexts, slidePrompt, compareTexts, normaliseText } from "../server/textcheck.mjs";
import { generateSlide, judgeImage, MAX_ATTEMPTS } from "../server/slidegen.mjs";
import { generateImages, imageGenConfigured, imageProvider } from "../server/imagegen.mjs";
import { sceneHTML } from "../server/templates.mjs";
import { setNetwork } from "../server/connectors/net.mjs";

const PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("short headlines are generated; lists, tables, specs and the main image are typeset", () => {
  assert.equal(planSlide("benefit", { headAr: "ثبات حتى 12 ساعة", headEn: "Lasts up to 12 hours" }).mode, "generate");
  assert.equal(planSlide("ramadan", {}).mode, "generate");
  assert.equal(planSlide("details", {}).mode, "typeset");
  assert.equal(planSlide("sizechart", {}).reason, "structured");
  assert.equal(planSlide("cover", {}).reason, "mainImage");
  const long = planSlide("benefit", { headAr: "عطر شرقي فاخر يدوم طويلاً على البشرة والملابس طوال اليوم والليل", headEn: "x" });
  assert.deepEqual([long.mode, long.reason], ["typeset", "tooMuchText"]);
});

test("slide text follows the language mode and the brand's digits", () => {
  const t = slideTexts("benefit", { headAr: "ثبات حتى 12 ساعة", headEn: "Lasts 12 hours" }, { language: "both", numerals: "arabic" });
  assert.deepEqual(t.map((x) => x.text), ["ثبات حتى ١٢ ساعة", "Lasts 12 hours"]);
  assert.equal(slideTexts("benefit", { headAr: "ثبات", headEn: "Lasts" }, { language: "ar" }).length, 1);
  const p = slidePrompt({ templateId: "benefit", texts: t, product: "Oud perfume", kit: { bg: "#2A1A0E", fg: "#F2C88A", accent: "#F4E9D8" }, numerals: "arabic" });
  assert.match(p, /«ثبات حتى ١٢ ساعة»/);
  assert.match(p, /Arabic-Indic digits/);
  assert.match(p, /keep it exactly as it is/);
  assert.match(slidePrompt({ templateId: "benefit", texts: t, withText: false }), /Do NOT render any text/);
});

test("the read-back must match letter for letter, digits included, with nothing extra", () => {
  const exp = [{ text: "ثبات حتى ١٢ ساعة", lang: "ar" }, { text: "Lasts up to 12 hours", lang: "en" }];
  assert.equal(compareTexts(exp, ["ثَبَاتٌ حتّى ١٢ ساعة", "LASTS UP TO 12 HOURS"]).ok, true, "harakat and case are ignored");
  const digits = compareTexts(exp, ["ثبات حتى 12 ساعة", "Lasts up to 12 hours"]);
  assert.deepEqual(digits.issues.map((i) => i.type), ["digits"]);
  const wrong = compareTexts(exp, ["ثبات حتي ١٢ ساعة", "Lasts up to 12 hours"]);
  assert.deepEqual(wrong.issues.map((i) => i.type), ["missing", "extra"], "ى vs ي is a different spelling");
  assert.equal(wrong.extra, "ثبات حتي ١٢ ساعة", "the misspelled version is reported as drawn");
  const extra = compareTexts(exp, ["ثبات حتى ١٢ ساعة", "Lasts up to 12 hours", "PREMIUM QUALITY"]);
  assert.deepEqual(extra.issues.map((i) => i.type), ["extra"]);
  assert.equal(compareTexts([{ text: "عطر", lang: "ar" }], ["العطور"]).ok, false, "no matching inside another word");
  assert.equal(normaliseText("«عطرٌ»ـــ"), "عطر");
});

test("an image is shown only when text, Arabic shaping and product colour all pass", () => {
  const expected = [{ text: "ثبات", lang: "ar" }];
  assert.equal(judgeImage({ expected, readback: { overlayTexts: ["ثبات"], arabicRendering: "correct" }, fidelity: { ok: true, score: 0.95 } }).ok, true);
  assert.match(judgeImage({ expected, readback: { overlayTexts: ["ثبات"], arabicRendering: "broken" }, fidelity: null }).reasons.join(), /arabic: broken/);
  assert.match(judgeImage({ expected, readback: { overlayTexts: ["ثبات"], arabicRendering: "correct" }, fidelity: { ok: false, score: 0.4 } }).reasons.join(), /colour/);
  assert.match(judgeImage({ expected, readback: { overlayTexts: ["ث�ات"], arabicRendering: "correct" } }).reasons.join(), /unreadable|missing/);
});

function fakeDeps(readbacks, opts = {}) {
  const calls = { generate: [], readBack: 0 };
  let i = 0;
  return {
    calls,
    deps: {
      generate: async (req) => { calls.generate.push(req); return ["data:image/png;base64,GEN" + calls.generate.length]; },
      readBack: async () => { calls.readBack++; return readbacks[Math.min(i++, readbacks.length - 1)]; },
      fidelity: async () => opts.fidelity || { ok: true, score: 0.93 },
      fit: async (img) => "fit:" + img,
      typeset: async (spec) => "typeset:" + spec.template,
      scene: async (ctx) => "scene:" + ctx.headAr
    }
  };
}
const INPUT = { template: "benefit", fields: { headAr: "ثبات حتى 12 ساعة", headEn: "Lasts up to 12 hours" }, image: PX, numerals: "arabic", language: "both" };
const GOOD = { overlayTexts: ["ثبات حتى ١٢ ساعة", "Lasts up to 12 hours"], productTexts: ["LAYALI"], arabicRendering: "correct", problems: [] };
const BROKEN = { overlayTexts: ["ث ب ا ت حتى ١٢ ساعة", "Lasts up to 12 hours"], productTexts: [], arabicRendering: "broken", problems: ["letters disconnected"] };
const EMPTY = { overlayTexts: [], productTexts: ["LAYALI"], arabicRendering: "none", problems: [] };

test("a failed image is generated again, and the first that passes is used", async () => {
  const { deps, calls } = fakeDeps([BROKEN, GOOD]);
  const r = await generateSlide(INPUT, deps);
  assert.equal(r.mode, "generated");
  assert.equal(r.image, "fit:data:image/png;base64,GEN2");
  assert.equal(r.attempts.length, 2);
  assert.equal(r.attempts[0].ok, false);
  assert.match(r.attempts[0].reasons.join(), /arabic: broken/);
  assert.equal(calls.generate[0].image, PX, "the product photo is the reference");
  assert.equal(calls.generate[0].aspect, "4:5");
});

test("after 3 failures the scene is generated without text and the headline is typeset over it", async () => {
  const { deps, calls } = fakeDeps([BROKEN, BROKEN, BROKEN, EMPTY]);
  const r = await generateSlide(INPUT, deps);
  assert.equal(r.mode, "scene");
  assert.equal(r.image, "scene:ثبات حتى ١٢ ساعة");
  assert.equal(calls.generate.length, MAX_ATTEMPTS + 1);
  assert.match(calls.generate[MAX_ATTEMPTS].prompt, /Do NOT render any text/);
  assert.equal(r.attempts.length, MAX_ATTEMPTS + 1);
});

test("if even the textless scene fails, the template is used; long text never reaches the model", async () => {
  const bad = fakeDeps([BROKEN, BROKEN, BROKEN, BROKEN]);
  assert.equal((await generateSlide(INPUT, bad.deps)).mode, "typeset");
  const lists = fakeDeps([GOOD]);
  const r = await generateSlide({ ...INPUT, template: "sizechart", fields: {} }, lists.deps);
  assert.deepEqual([r.mode, r.reason, r.image], ["typeset", "structured", "typeset:sizechart"]);
  assert.equal(lists.calls.generate.length, 0);
  const colour = fakeDeps([GOOD, GOOD, GOOD, EMPTY], { fidelity: { ok: false, score: 0.3 } });
  assert.equal((await generateSlide(INPUT, colour.deps)).mode, "typeset", "a product that changed colour never passes");
});

test("the scene fallback typesets the headline over the generated background", () => {
  const html = sceneHTML({ background: PX, headAr: "ثبات 12", headEn: "Lasts", kit: { bg: "#111111", fg: "#EEEEEE", accent: "#CCCCCC" }, numerals: "arabic", language: "both", fonts: "naskh" });
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(html.includes("ثبات ١٢"));
  assert.ok(html.includes("object-fit:cover"));
  assert.ok(html.includes("'Amiri'"));
});

let calls = [];
beforeEach(() => { calls = []; });
function net(handler) {
  setNetwork({
    lookup: async () => [{ address: "93.184.216.34" }],
    fetch: async (url, init = {}) => { calls.push({ url, init }); const [status, body] = await handler(url, init); return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }
  });
}

test("providers: OpenAI image edits (multipart) and Gemini generateContent, with the product photo attached", async () => {
  assert.equal(imageGenConfigured({}), false);
  assert.equal(imageProvider({ IMAGE_PROVIDER: "gemini" }), null, "a provider without a key isn't configured");
  assert.equal(imageProvider({ IMAGE_PROVIDER: "gemini", IMAGE_API_KEY: "k" }), "gemini");
  assert.equal(imageGenConfigured({ IMAGE_PROVIDER: "openai", IMAGE_API_KEY: "k" }), true);
  net(async () => [200, { data: [{ b64_json: "AAA" }] }]);
  const o = await generateImages({ prompt: "slide", image: PX, count: 1 }, { IMAGE_PROVIDER: "openai", IMAGE_API_KEY: "sk-test" });
  assert.deepEqual(o, ["data:image/png;base64,AAA"]);
  assert.equal(calls[0].url, "https://api.openai.com/v1/images/edits");
  assert.equal(calls[0].init.headers.Authorization, "Bearer sk-test");
  const form = calls[0].init.body;
  assert.ok(form instanceof FormData);
  assert.equal(form.get("model"), "gpt-image-1");
  assert.equal(form.get("size"), "1024x1536");
  assert.ok(form.get("image") instanceof Blob);

  calls = [];
  net(async () => [200, { candidates: [{ content: { parts: [{ text: "here" }, { inlineData: { mimeType: "image/png", data: "BBB" } }] } }] }]);
  const g = await generateImages({ prompt: "slide", image: PX, count: 2 }, { IMAGE_PROVIDER: "gemini", IMAGE_API_KEY: "g-key", IMAGE_MODEL: "gemini-x" });
  assert.deepEqual(g, ["data:image/png;base64,BBB", "data:image/png;base64,BBB"]);
  assert.equal(calls.length, 2, "one image per call");
  assert.equal(calls[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent");
  assert.equal(calls[0].init.headers["x-goog-api-key"], "g-key");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.contents[0].parts[1].inlineData.data, PX.split(",")[1]);
  assert.deepEqual(body.generationConfig.responseModalities, ["IMAGE"]);
  assert.equal(body.generationConfig.imageConfig.aspectRatio, "4:5");

  net(async () => [429, { error: { message: "quota" } }]);
  await assert.rejects(generateImages({ prompt: "x", image: PX }, { IMAGE_PROVIDER: "gemini", IMAGE_API_KEY: "k" }), (e) => e.status === 429 && /quota/.test(e.message));
});

test("Chromium renders the scene fallback, fits model images to 1600 × 2000 and measures colour", { timeout: 90000 }, async (t) => {
  const { renderHtml, fitSlideImage, imageFidelity, rendererAvailable, closeRenderer } = await import("../server/render.mjs");
  if (!(await rendererAvailable())) return t.skip("Chromium not available");
  try {
    const png = await renderHtml(sceneHTML({ background: PX, headAr: "ثبات حتى 12 ساعة", headEn: "Lasts", kit: { bg: "#2A1A0E", fg: "#F2C88A", accent: "#F4E9D8" }, language: "both", numerals: "arabic", fonts: "kufi" }));
    assert.equal(png.readUInt32BE(16), 1600); assert.equal(png.readUInt32BE(20), 2000);
    const fit = await fitSlideImage(PX);
    assert.equal(fit.readUInt32BE(16), 1600);
    const f = await imageFidelity(PX, PX);
    assert.equal(typeof f.score, "number");
  } finally { await closeRenderer(); }
});
