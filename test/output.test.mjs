// Bulk processing and product output: rule-based cleanup, marketplace files, ZIP, results, billing.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { newGenome, declare } from "../server/brand-dna.mjs";
import { sampleData } from "../server/brand-seed.mjs";
import { cleanupCopy, trimHeadline } from "../server/copy-rules.mjs";
import { exportFiles, exportReadme, EXPORT_CHANNELS } from "../server/exports.mjs";
import { makeZip, readZip, crc32 } from "../server/zip.mjs";
import { parseSalesReport, compareResults } from "../server/results.mjs";
import { PLANS, newAccount, recordUsage, usageStatus, invoiceAmount } from "../server/billing.mjs";
import { createCheckout, verifyCheckout } from "../server/payments.mjs";
import { onModelPrompt, generateOnModel } from "../server/imagegen.mjs";
import { colourFidelity, dominantColours } from "../server/photo-metrics.mjs";
import { setNetwork } from "../server/connectors/net.mjs";

const T0 = "2026-10-01T10:00:00.000Z";

/* ---------- rule-based cleanup ---------- */

test("cleanup applies the brand's active rules and leaves the rest", () => {
  const g = newGenome("t", { name: "T" });
  declare(g, { type: "avoidWord", params: { word: "luxury", lang: "en" } }, "manual", T0);
  declare(g, { type: "avoidWord", params: { word: "الفاخر", lang: "ar" } }, "manual", T0);
  declare(g, { type: "noExclamation", params: {} }, "manual", T0);
  declare(g, { type: "noEmoji", params: {} }, "manual", T0);
  declare(g, { type: "numerals", params: { style: "arabic" } }, "manual", T0);
  declare(g, { type: "maxHeadline", params: { chars: 40 } }, "manual", T0);
  const { copy, changes } = cleanupCopy({
    titleEn: "Oud Al Layl Luxury Eau de Parfum 100ml, Long Lasting, Gift Box!",
    titleAr: "عطر عود الليل فاخر 100 مل",
    bulletsEn: ["Lasts 12 hours! ✨", "Luxury smoked oud"],
    bulletsAr: ["يدوم 12 ساعة"]
  }, g, { channel: "noon", category: "fragrance" });
  assert.equal(copy.titleEn, "Oud Al Layl Eau de Parfum 100ml");
  assert.ok(copy.titleEn.length <= 40);
  assert.equal(copy.titleAr, "عطر عود الليل ١٠٠ مل", "stemmed word removed, digits converted");
  assert.deepEqual(copy.bulletsEn, ["Lasts 12 hours", "Smoked oud"]);
  assert.deepEqual(copy.bulletsAr, ["يدوم ١٢ ساعة"]);
  const rules = new Set(changes.map((c) => c.rule));
  for (const r of ["avoidWord", "noExclamation", "noEmoji", "numerals", "maxHeadline"]) assert.ok(rules.has(r), r);
});

test("cleanup does nothing without rules, and headlines never break mid-word", () => {
  const g = newGenome("t", {});
  const src = { titleEn: "Saudi Coffee with Cardamom 500g!", titleAr: "", bulletsEn: [], bulletsAr: [] };
  const r = cleanupCopy(src, g, {});
  assert.equal(r.copy.titleEn, src.titleEn);
  assert.equal(r.changes.length, 0);
  assert.equal(trimHeadline("Linen Abaya · Sand · Relaxed Fit · Side Pockets", 32), "Linen Abaya · Sand · Relaxed Fit");
  const cut = trimHeadline("Handmade bakhoor burner with engraved brass lid", 20);
  assert.ok(cut.length <= 20 && !/\s$/.test(cut));
  assert.ok("Handmade bakhoor burner with engraved brass lid".startsWith(cut));
});

test("a run-on title without separators is flagged, not cut mid-phrase", () => {
  const g = newGenome("t", {});
  declare(g, { type: "maxHeadline", params: { chars: 32 } }, "manual", T0);
  declare(g, { type: "avoidWord", params: { word: "best", lang: "en" } }, "manual", T0);
  const r = cleanupCopy({ titleEn: "Perfume Oud 100ml Men Women Long Lasting Best Gift Perfume", titleAr: "", bulletsEn: ["Best gift for men and women"], bulletsAr: [] }, g, {});
  assert.equal(r.copy.titleEn, "Perfume Oud 100ml Men Women Long Lasting Gift", "\"best\" and the repeated \"Perfume\" go; the length is left to a person");
  const flag = r.changes.find((c) => c.rule === "tooLong");
  assert.ok(flag && flag.applied === false, JSON.stringify(r.changes));
  assert.deepEqual(r.copy.bulletsEn, ["Gift for men and women"], "capitalised after removing the first word");
});

test("the learned sample brand cleans the oud title the way the team edited it", () => {
  const { genomes } = sampleData();
  const g = genomes.layali;
  // Learned rules: "best" removed three times, no "!", Arabic-Indic digits. "Luxury" is still only a candidate.
  const r = cleanupCopy({ titleEn: "Best Oud Al Layl Luxury Perfume 100ml!", titleAr: "عطر عود الليل الفاخر 100 مل", bulletsEn: [], bulletsAr: [] }, g, { channel: "noon", category: "fragrance" });
  assert.equal(r.copy.titleEn, "Oud Al Layl Luxury Perfume 100ml");
  assert.equal(r.copy.titleAr, "عطر عود الليل الفاخر ١٠٠ مل");
});

/* ---------- marketplace files and ZIP ---------- */

const ITEMS = [
  { sku: "OUD-100", name: "Oud", copy: { titleEn: "Oud Al Layl EDP 100ml", titleAr: "عطر عود الليل ١٠٠ مل", bulletsEn: ["Lasts 12 hours", "Smoked oud, \"dark\" amber"], bulletsAr: ["يدوم ١٢ ساعة"] }, images: ["OUD-100/1.png", "OUD-100/2.png"] },
  { sku: "MUSK-50", copy: { titleEn: "Musk Tahara 50ml", titleAr: "مسك الطهارة", bulletsEn: [], bulletsAr: [] }, images: [] }
];

test("Amazon flat files: partial update, English and Arabic, hosted image links", () => {
  const files = exportFiles("amazon", ITEMS, { imageBase: "https://basira.test/assets/b1/" });
  assert.deepEqual(files.map((f) => f.name), ["amazon-flat-file-en.txt", "amazon-flat-file-ar.txt"]);
  const en = files[0].content.replace(/^﻿/, "").trim().split("\r\n").map((l) => l.split("\t"));
  assert.equal(en[0][0], "item_sku"); assert.equal(en[0][1], "update_delete");
  assert.equal(en[0].length, 9 + 8);
  assert.equal(en[1][1], "PartialUpdate");
  assert.equal(en[1][2], "Oud Al Layl EDP 100ml");
  assert.equal(en[1][8], "https://basira.test/assets/b1/OUD-100/1.png");
  assert.equal(en[1][9], "https://basira.test/assets/b1/OUD-100/2.png");
  assert.ok(files[1].content.includes("عطر عود الليل ١٠٠ مل"));
  assert.ok(files[0].content.startsWith("﻿"), "BOM for Excel");
});

test("every channel gets a file, CSV quoting holds, readme explains the upload", () => {
  for (const ch of EXPORT_CHANNELS) {
    const files = exportFiles(ch, ITEMS, {});
    assert.ok(files.length >= 1, ch);
    for (const f of files) assert.ok(f.content.length > 20, ch);
  }
  const noon = exportFiles("noon", ITEMS, {})[0].content;
  assert.ok(noon.includes('"Smoked oud, ""dark"" amber"'));
  assert.match(exportReadme("amazon", 2, { client: "Layali" }), /PartialUpdate/);
});

test("ZIP round-trips with UTF-8 names and valid CRCs", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  const zip = Buffer.from(makeZip([{ name: "README.txt", data: "hello" }, { name: "images/عود/1.png", data: Buffer.from([137, 80, 78, 71]) }]));
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 22 + 10), 2);
  const back = readZip(zip);
  assert.deepEqual(back.map((f) => f.name), ["README.txt", "images/عود/1.png"]);
  assert.ok(back.every((f) => f.crcOk));
  assert.equal(Buffer.from(back[0].data).toString(), "hello");
});

/* ---------- before/after results ---------- */

const AMAZON_REPORT = (rows) => '"(Parent) ASIN","(Child) ASIN","Title","Sessions - Total","Page Views - Total","Unit Session Percentage","Units Ordered","Ordered Product Sales","Total Order Items"\n' +
  rows.map((r) => `"P","${r[0]}","Item","${r[1]}","${r[1] * 2}","${((r[2] / r[1]) * 100).toFixed(2)}%","${r[2]}","SAR ${(r[2] * 100).toLocaleString("en-US")}.00","${r[2]}"`).join("\n");

test("reads an Amazon Business Report by its column names", () => {
  const p = parseSalesReport(AMAZON_REPORT([["B0OUD", 1000, 30], ["B0MUSK", 500, 10]]));
  assert.equal(p.error, null);
  assert.equal(p.rows.length, 2);
  assert.equal(p.rows[0].key, "B0OUD");
  assert.equal(p.rows[0].sessions, 1000);
  assert.equal(p.rows[0].units, 30);
  assert.equal(p.rows[0].sales, 3000);
  assert.ok(Math.abs(p.rows[0].conversion - 0.03) < 1e-9);
  assert.match(parseSalesReport("foo,bar\n1,2").error, /SKU|ASIN/);
});

test("uplift is the changed products' gain minus the control group's", () => {
  const before = parseSalesReport(AMAZON_REPORT([["A", 1000, 20], ["B", 1000, 20], ["C", 1000, 30], ["D", 1000, 30]])).rows;
  const after = parseSalesReport(AMAZON_REPORT([["A", 1000, 35], ["B", 1000, 30], ["C", 1000, 33], ["D", 1000, 31]])).rows;
  const r = compareResults({ before, after, changed: ["A", "B"] });
  assert.equal(r.changed.count, 2); assert.equal(r.control.count, 2);
  assert.equal(r.changed.convPts, 1.25); // 2.0% → 3.25%
  assert.equal(r.control.convPts, 0.2); // 3.0% → 3.2%
  assert.equal(r.upliftPts, 1.05);
  assert.ok(r.hasControl);
  assert.equal(r.products[0].key, "A");
  assert.equal(r.products.find((p) => p.key === "A").delta.unitsPct, 75);
});

test("a single dated report splits each product at its own change date", () => {
  const rows = [];
  for (const [key, change] of [["A", "2026-10-10"], ["Z", null]]) {
    for (let d = 1; d <= 20; d++) {
      const date = `2026-10-${String(d).padStart(2, "0")}`;
      const after = change && date >= change;
      rows.push({ key, date, sessions: 100, units: after ? 5 : 2, sales: 0, conversion: null, views: null, orders: null, returns: null });
    }
  }
  const r = compareResults({ rows, changedAt: { A: "2026-10-10T08:00:00Z" } });
  assert.equal(r.changed.before.conv, 0.02);
  assert.equal(r.changed.after.conv, 0.05);
  assert.equal(r.control.convPts, 0);
  assert.equal(r.upliftPts, 3);
});

/* ---------- plans, usage, payments ---------- */

test("usage is counted per month against the plan", () => {
  const a = newAccount();
  recordUsage(a, "fixes", 18, "2026-11-03T00:00:00Z");
  recordUsage(a, "renders", 40, "2026-11-03T00:00:00Z");
  let s = usageStatus(a, "2026-11-10T00:00:00Z");
  assert.equal(s.limit, PLANS.trial.fixes); assert.equal(s.used, 18); assert.equal(s.left, 2); assert.equal(s.over, false);
  recordUsage(a, "fixes", 2, "2026-11-04T00:00:00Z");
  assert.equal(usageStatus(a, "2026-11-10T00:00:00Z").over, true);
  assert.equal(usageStatus(a, "2026-12-01T00:00:00Z").used, 0, "a new month starts at zero");
  a.plan = "enterprise";
  assert.equal(usageStatus(a, "2026-11-10T00:00:00Z").left, null);
  assert.equal(invoiceAmount("agency"), 171350); // 1490 SAR + 15% VAT, in halalas
  assert.equal(invoiceAmount("enterprise"), null);
});

let calls = [];
beforeEach(() => { calls = []; });
function fakeNet(handler) {
  setNetwork({
    lookup: async () => [{ address: "93.184.216.34" }],
    fetch: async (url, init = {}) => { calls.push({ url, init }); const [status, body, type] = await handler(url, init); return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": type || "application/json" } }); }
  });
}

test("Moyasar checkout creates an invoice with VAT and verifies payment", async () => {
  process.env.MOYASAR_SECRET_KEY = "sk_test_abc";
  try {
    fakeNet(async (url, init) => {
      if (init.method === "POST") return [201, { id: "inv_123456", url: "https://checkout.moyasar.test/inv_123456", status: "initiated", amount: JSON.parse(init.body).amount }];
      return [200, { id: "inv_123456", status: "paid", amount: 171350, metadata: { plan: "agency" } }];
    });
    const c = await createCheckout("agency", { callbackUrl: "https://basira.test/app#settings", account: "default" });
    assert.equal(c.amount, 171350);
    assert.equal(c.url, "https://checkout.moyasar.test/inv_123456");
    const sent = JSON.parse(calls[0].init.body);
    assert.equal(sent.currency, "SAR"); assert.equal(sent.metadata.plan, "agency");
    assert.equal(calls[0].init.headers.Authorization, "Basic " + Buffer.from("sk_test_abc:").toString("base64"));
    const v = await verifyCheckout("inv_123456");
    assert.equal(v.paid, true); assert.equal(v.plan, "agency");
    await assert.rejects(createCheckout("enterprise", {}), /sales/);
    await assert.rejects(verifyCheckout("../x"), /invoice id/);
  } finally { delete process.env.MOYASAR_SECRET_KEY; }
  await assert.rejects(createCheckout("agency", {}), (e) => e.status === 503);
});

/* ---------- on-model photos ---------- */

test("on-model prompt keeps the product and the modesty rules", () => {
  const p = onModelPrompt({ product: "a sand linen abaya", category: "fashion", look: "gulf", cover: "hijab", setting: "majlis", visual: "warm, quiet light" });
  assert.match(p.prompt, /woman from the Gulf/);
  assert.match(p.prompt, /hijab/);
  assert.match(p.prompt, /Modest styling/);
  assert.match(p.prompt, /majlis/);
  assert.match(p.prompt, /same cut, colour/);
  assert.match(p.negative, /revealing/);
  assert.doesNotMatch(onModelPrompt({ category: "home", cover: "none" }).prompt, /Modest/);
});

test("image provider: needs config, sends the reference photo, returns data URLs", async () => {
  const img = "data:image/png;base64,iVBORw0KGgo=";
  await assert.rejects(generateOnModel({ image: img }, {}), (e) => e.status === 503);
  const env = { IMAGE_API_URL: "https://images.provider.test/v1/generate", IMAGE_API_KEY: "k" };
  fakeNet(async (url, init) => {
    if (url.startsWith("https://images.provider.test/v1")) return [200, { images: [{ b64_json: "AAAA" }, { url: "https://cdn.provider.test/2.png" }] }];
    return [200, "PNGDATA", "image/png"];
  });
  const r = await generateOnModel({ image: img, category: "fashion", count: 2 }, env);
  assert.equal(r.images.length, 2);
  assert.equal(r.images[0], "data:image/png;base64,AAAA");
  assert.match(r.images[1], /^data:image\/png;base64,/);
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.image, img); assert.equal(sent.width, 1600); assert.equal(sent.num_images, 2);
  await assert.rejects(generateOnModel({ image: "not an image" }, env), /PNG, JPEG or WebP/);
});

function canvas(w, h, paint) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = paint(x, y); const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
  return { data: d, width: w, height: h };
}

test("colour fidelity passes when the product keeps its colour and fails when it changes", () => {
  const RED = [176, 32, 44], GOLD = [212, 170, 90];
  const orig = canvas(200, 200, (x, y) => (x > 50 && x < 150 && y > 30 && y < 170 ? (y > 150 ? GOLD : RED) : [255, 255, 255]));
  const main = dominantColours(orig.data, 200, 200, { product: true });
  assert.ok(Math.abs(main[0].rgb[0] - RED[0]) < 4 && main[0].share > 0.8, JSON.stringify(main));
  const scene = (garment) => canvas(160, 200, (x, y) => (y < 40 && x > 60 && x < 100 ? [222, 184, 160] : x > 40 && x < 120 && y >= 40 && y < 190 ? (y > 175 ? GOLD : garment) : [140, 120, 100]));
  const good = colourFidelity(orig, scene([170, 36, 48]));
  assert.ok(good.ok, JSON.stringify(good));
  assert.ok(good.score >= 0.9);
  const bad = colourFidelity(orig, scene([40, 60, 170]));
  assert.equal(bad.ok, false);
  assert.ok(bad.score < 0.5, JSON.stringify(bad));
});
