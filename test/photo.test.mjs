import { test } from "node:test";
import assert from "node:assert/strict";
import { measurePixels, removeBackground, fitBox, mainImageChecks } from "../server/photo-metrics.mjs";
import { PhotoReview } from "../server/photo.mjs";

// 100x100 white image with a dark 40x60 product in the middle.
function sample(bg = [255, 255, 255]) {
  const w = 100, h = 100, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, inside = x >= 30 && x < 70 && y >= 20 && y < 80;
    const c = inside ? [60, 30, 10] : bg;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return { d, w, h };
}

test("measures white background and product fill", () => {
  const { d, w, h } = sample();
  const m = measurePixels(d, w, h);
  assert.equal(m.whiteShare, 1);
  assert.equal(m.fill, 0.6);
  assert.deepEqual(m.box, { x: 30, y: 20, w: 40, h: 60 });
  const grey = sample([200, 200, 200]);
  assert.equal(measurePixels(grey.d, grey.w, grey.h).whiteShare, 0);
});

test("removes a plain background and keeps the product", () => {
  const { d, w, h } = sample([210, 215, 220]);
  const share = removeBackground(d, w, h, 30);
  assert.ok(share > 0.7 && share < 0.8, String(share));
  assert.equal(d[(50 * w + 50) * 4 + 3], 255);
  assert.equal(d[3], 0);
  const m = measurePixels(d, w, h);
  assert.ok(m.transparent);
  assert.equal(m.fill, 0.6);
});

test("fits the product to 85% of a square", () => {
  const f = fitBox({ x: 30, y: 20, w: 40, h: 60 }, 2000);
  assert.equal(Math.round(f.h), 1700);
  assert.equal(Math.round(f.y), 150);
});

test("main-image rules differ by channel", () => {
  const m = { width: 2000, height: 2000, whiteShare: 0.5, fill: 0.75, transparent: false };
  const amazon = Object.fromEntries(mainImageChecks(m, "amazon").map((c) => [c.key, c.ok]));
  const salla = Object.fromEntries(mainImageChecks(m, "salla").map((c) => [c.key, c.ok]));
  assert.deepEqual(amazon, { size: true, white: false, fill: false, square: true });
  assert.equal(salla.white, undefined);
  assert.equal(salla.fill, true);
});

test("photo review schema", () => {
  const ok = { photos: [{ index: 0, scores: { clarity: 8, lighting: 7, focus: 6, thumbnail: 7, trust: 8 }, arabicText: "broken", strengths: [], problems: [{ en: "Crop tighter", ar: "قصّ الصورة أكثر" }] }], winner: 0, why: { en: "Only photo", ar: "الصورة الوحيدة" } };
  assert.ok(PhotoReview.safeParse(ok).success);
  assert.ok(!PhotoReview.safeParse({ ...ok, photos: [{ ...ok.photos[0], scores: { ...ok.photos[0].scores, clarity: 11 } }] }).success);
});
