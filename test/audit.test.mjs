import { test } from "node:test";
import assert from "node:assert/strict";
import { auditListing } from "../server/audit.mjs";

const keys = (r) => r.issues.map((i) => i.key);

test("flags the classic weak oud listing", () => {
  const r = auditListing({
    channel: "noon", category: "fragrance",
    titleEn: "Perfume Oud 100ml Men Women Long Lasting Best Gift Perfume",
    bulletsEn: ["Long lasting"], images: [{ width: 800, height: 800, whiteBackground: false, arabicTextBroken: true }],
    reviewThemes: [{ theme: "longevity", share: 0.62, negative: true }]
  });
  for (const k of ["noArabicTitle", "arabicBroken", "keywordStuffing", "onePhoto", "mainRule", "lowRes", "enBullets", "reviewGap", "attrs"]) assert.ok(keys(r).includes(k), k);
  assert.ok(r.score < 50, `score ${r.score}`);
  assert.equal(r.issues[0].sev, "high");
});

test("a complete bilingual listing scores high", () => {
  const r = auditListing({
    channel: "amazon", category: "fragrance",
    titleEn: "Oud Al Layl Eau de Parfum 100ml, Smoked Oud and Saffron",
    titleAr: "عطر عود الليل أو دو بارفان ١٠٠ مل، عود مدخن وزعفران",
    bulletsEn: ["a", "b", "c", "d", "e"], bulletsAr: ["أ", "ب", "ج", "د", "هـ"],
    images: Array.from({ length: 6 }, () => ({ width: 2000, height: 2000, whiteBackground: true })),
    attributes: { volume: "100ml", concentration: "EDP", notes: "oud" }
  });
  assert.deepEqual(r.issues, []);
  assert.ok(r.score >= 90, `score ${r.score}`);
});

test("detects presentation-form Arabic as broken shaping", () => {
  const r = auditListing({ titleEn: "Oud perfume for men and women 100ml", titleAr: "ﻋﻄﺮ ﻋﻮﺩ" });
  assert.ok(keys(r).includes("arabicBroken"));
});

test("fashion without a size chart is high severity", () => {
  const r = auditListing({ category: "fashion", titleEn: "Linen Abaya, Sand, Relaxed Fit", titleAr: "عباية كتان" });
  assert.equal(r.issues.find((i) => i.key === "noSizeChart").sev, "high");
});

test("catches regulated health claims in Arabic and English", () => {
  assert.equal(auditListing({ titleEn: "Saudi coffee that boosts immunity daily", titleAr: "قهوة" }).issues.find((i) => i.key === "claim").detail.phrase, "boosts immun");
  assert.ok(keys(auditListing({ titleEn: "Saudi coffee with cardamom 500g", titleAr: "قهوة سعودية يقوي المناعة" })).includes("claim"));
});

test("white background rule only applies on Amazon and Noon", () => {
  const base = { titleEn: "Bakhoor burner, hand hammered brass", titleAr: "مبخرة نحاسية", images: [{ whiteBackground: false }] };
  assert.ok(keys(auditListing({ ...base, channel: "amazon" })).includes("mainRule"));
  assert.ok(!keys(auditListing({ ...base, channel: "salla" })).includes("mainRule"));
});

test("does not double-report a missing title", () => {
  assert.equal(keys(auditListing({})).filter((k) => k === "noTitle").length, 1);
});

test("keyword coverage normalises Arabic spelling variants", async () => {
  const { keywordCoverage } = await import("../server/keywords.mjs");
  const r = keywordCoverage({ category: "fragrance", titleAr: "عطر العود الفاخر، ثبات طويل", titleEn: "Oud perfume, Eau de Parfum", bulletsAr: ["مسک ابيض"] });
  const by = Object.fromEntries(r.items.map((i) => [i.en, i]));
  assert.ok(by["oud perfume"].inEn);
  assert.ok(by["perfume"].inAr);
  assert.ok(by["long lasting"].inAr);
  assert.ok(by["eau de parfum"].inEn);
  assert.ok(!by["saffron"].inAr && !by["saffron"].inEn);
  assert.equal(r.total, 12);
});

test("flags a main image where the product is too small", () => {
  const base = { channel: "amazon", titleEn: "Bakhoor burner, hand hammered brass", titleAr: "مبخرة نحاسية" };
  assert.ok(keys(auditListing({ ...base, images: [{ width: 2000, height: 2000, whiteBackground: true, fill: 0.5 }] })).includes("productSmall"));
  assert.ok(!keys(auditListing({ ...base, images: [{ width: 2000, height: 2000, whiteBackground: true, fill: 0.9 }] })).includes("productSmall"));
});
