import { test, after } from "node:test";
import assert from "node:assert/strict";
import { normaliseSpec, slideDocument, toNumerals, renderSlide, closeRenderer, rendererAvailable } from "../server/render.mjs";

const PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
after(() => closeRenderer());

test("numerals convert both ways", () => {
  assert.equal(toNumerals("ثبات 12 ساعة", "arabic"), "ثبات ١٢ ساعة");
  assert.equal(toNumerals("١٢ hours", "western"), "12 hours");
});

test("rejects remote image URLs and bad colours", () => {
  assert.throws(() => normaliseSpec({ kind: "cover", image: "https://example.com/a.png" }), /data URL/);
  assert.throws(() => normaliseSpec({ kind: "cover", image: PX, kit: { bg: "red;}" } }), /hex/);
  assert.throws(() => normaliseSpec({ kind: "poster", image: PX }), /kind/);
});

test("escapes text and keeps Arabic right to left", () => {
  const html = slideDocument(normaliseSpec({ kind: "benefit", image: PX, headlineAr: "ثبات <b>12</b> ساعة", headlineEn: "Lasts 12h" }));
  assert.ok(html.includes('dir="rtl">ثبات &lt;b&gt;١٢&lt;/b&gt; ساعة'));
  assert.ok(html.includes("Lasts 12h"));
});

test("renders a 1600x2000 PNG", { timeout: 60000 }, async (t) => {
  if (!(await rendererAvailable())) return t.skip("Chromium not available");
  const png = await renderSlide({ kind: "benefit", image: PX, headlineAr: "ثبات حتى 12 ساعة", headlineEn: "Lasts up to 12 hours", brand: "LAYALI" });
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1600);
  assert.equal(png.readUInt32BE(20), 2000);
});
