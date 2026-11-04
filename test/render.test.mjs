import { test, after } from "node:test";
import assert from "node:assert/strict";
import { normaliseSpec, slideDocument, toNumerals, renderSlide, closeRenderer, rendererAvailable, probeImage, browserForTests } from "../server/render.mjs";

const PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
after(() => closeRenderer());

test("numerals convert both ways", () => {
  assert.equal(toNumerals("ثبات 12 ساعة", "arabic"), "ثبات ١٢ ساعة");
  assert.equal(toNumerals("١٢ hours", "western"), "12 hours");
});

test("rejects remote image URLs and bad colours", () => {
  assert.throws(() => normaliseSpec({ kind: "cover", image: "https://example.com/a.png" }), /data URL/);
  assert.throws(() => normaliseSpec({ kind: "cover", image: PX, kit: { bg: "red;}" } }), /hex/);
  assert.throws(() => normaliseSpec({ kind: "poster", image: PX }), /template/);
});

test("escapes text and keeps Arabic right to left", () => {
  const html = slideDocument(normaliseSpec({ kind: "benefit", image: PX, headlineAr: "ثبات <b>12</b> ساعة", headlineEn: "Lasts 12h" }));
  assert.ok(html.includes('dir="rtl">ثبات &lt;b&gt;١٢&lt;/b&gt; ساعة'), html.slice(-600));
  assert.ok(html.includes("Lasts 12h"));
});

test("renders a 1600x2000 PNG", { timeout: 60000 }, async (t) => {
  if (!(await rendererAvailable())) return t.skip("Chromium not available");
  const png = await renderSlide({ kind: "benefit", image: PX, headlineAr: "ثبات حتى 12 ساعة", headlineEn: "Lasts up to 12 hours", brand: "LAYALI" });
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1600);
  assert.equal(png.readUInt32BE(20), 2000);
});

test("every template builds in every language", async () => {
  const { TEMPLATES } = await import("../server/templates.mjs");
  for (const tpl of TEMPLATES) for (const language of ["ar", "en", "both"]) {
    const html = slideDocument(normaliseSpec({ template: tpl.id, image: PX, fields: tpl.sample, language, brand: "LAYALI" }));
    assert.ok(html.includes('class="bz"'), tpl.id);
    assert.ok(!/undefined|NaN/.test(html.replace(/data:[^"]+/g, "")), `${tpl.id}/${language} leaks undefined`);
  }
});

test("measures a rendered main image", { timeout: 60000 }, async (t) => {
  if (!(await rendererAvailable())) return t.skip("Chromium not available");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><rect width="1200" height="1200" fill="#fff"/><rect x="300" y="150" width="600" height="900" fill="#4A230A"/></svg>';
  const m = await probeImage("data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"));
  assert.equal(m.width, 1200);
  assert.ok(m.whiteShare > 0.95, String(m.whiteShare));
  assert.ok(Math.abs(m.fill - 0.75) < 0.02, String(m.fill));
});

test("brand logo and font pair reach the slide", () => {
  const logo = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>');
  const spec = normaliseSpec({ template: "benefit", image: PX, fonts: "naskh", logo: { src: logo, pos: "top-start" }, brand: "LAYALI" });
  const html = slideDocument(spec);
  assert.match(html, /class="logo top-start"/);
  assert.ok(!html.includes('class="brand"'), "logo replaces the brand name");
  const style = html.match(/<div class="bz"[^>]*style="([^"]*)"/)[1];
  assert.match(style, /--fa:'Amiri'/);
  assert.match(style, /--fb:'Readex Pro'/);
  assert.throws(() => normaliseSpec({ template: "benefit", image: PX, logo: { src: "https://x.test/logo.png" } }), /logo/);
});

test("recovers when Chromium dies between requests", { timeout: 60000 }, async (t) => {
  if (!(await rendererAvailable())) return t.skip("Chromium not available");
  await (await browserForTests()).close();
  const png = await renderSlide({ template: "cover", image: PX });
  assert.equal(png.subarray(1, 4).toString(), "PNG");
});
