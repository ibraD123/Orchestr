import { test } from "node:test";
import assert from "node:assert/strict";
import { newGenome, declare, learn, check, express, strength, kitFromPalette, extractPalette, observeEdit, setStatus, editTrend, colourDistance, contrast, LEARN } from "../server/brand-dna.mjs";

const T0 = "2026-10-01T10:00:00.000Z";
const day = (n) => new Date(Date.parse(T0) + n * 86400000).toISOString();
const ctx = { channel: "noon", category: "fragrance", lang: "ar" };

function layali() {
  const g = newGenome("layali", { name: "Layali Fragrances", nameAr: "ليالي للعطور", palette: [{ hex: "#2A1A0E", role: "background" }, { hex: "#F2C88A", role: "accent" }, { hex: "#F4E9D8", role: "text" }] });
  declare(g, { type: "palette", params: {} }, "brandbook", T0);
  declare(g, { type: "noEmoji", params: {} }, "brandbook", T0);
  return g;
}

test("removing the same word three times turns a candidate into a rule", () => {
  const g = layali();
  const edit = (i) => learn(g, { type: "edit", at: day(i), role: "title", before: "عطر عود الليل الفاخر ١٠٠ مل", after: "عطر عود الليل ١٠٠ مل", ctx });
  edit(1);
  let t = g.traits.find((x) => x.key === "avoidWord:فاخر" || x.key === "avoidWord:الفاخر");
  assert.ok(t, "candidate created");
  assert.equal(t.status, "candidate");
  edit(2);
  assert.equal(t.status, "candidate");
  const changes = edit(3);
  assert.equal(t.status, "active");
  assert.ok(changes.some((c) => c.type === "promoted"));
  assert.ok(g.log.some((l) => l.type === "promoted"));
});

test("putting a word back counts against avoiding it, and learned rules can retire", () => {
  const g = layali();
  for (let i = 1; i <= 3; i++) learn(g, { type: "edit", at: day(i), before: "Luxury oud perfume for evenings", after: "Oud perfume for evenings", ctx: { ...ctx, lang: "en" } });
  const t = g.traits.find((x) => x.key === "avoidWord:luxury");
  assert.equal(t.status, "active");
  for (let i = 4; i <= 9; i++) learn(g, { type: "edit", at: day(i), before: "Oud perfume for evenings", after: "Luxury oud perfume for evenings", ctx: { ...ctx, lang: "en" } });
  assert.equal(t.status, "retired");
});

test("a person's decision locks a trait against automatic changes", () => {
  const g = layali();
  learn(g, { type: "edit", at: day(1), before: "Amazing oud!", after: "Oud", ctx });
  const t = g.traits.find((x) => x.type === "noExclamation");
  setStatus(g, t.id, "active", day(2));
  assert.equal(t.status, "active");
  assert.ok(t.locked);
});

test("old learned evidence decays; brand book evidence does not", () => {
  const g = layali();
  learn(g, { type: "edit", at: T0, before: "Great oud!", after: "Great oud", ctx });
  const ex = g.traits.find((x) => x.type === "noExclamation");
  const later = new Date(Date.parse(T0) + LEARN.halfLifeDays * 86400000).toISOString();
  assert.equal(strength(ex, T0).pos, 1);
  assert.equal(strength(ex, later).pos, 0.5);
  const pal = g.traits.find((x) => x.type === "palette");
  assert.equal(strength(pal, later).pos, strength(pal, T0).pos);
});

test("rejection reasons become evidence", () => {
  const g = layali();
  learn(g, { type: "reject", at: day(1), reasons: ["tooMuchText"], ctx: { ...ctx, chars: 200 } });
  const t = g.traits.find((x) => x.type === "textDensity");
  assert.equal(t.params.maxChars, 150);
  learn(g, { type: "reject", at: day(2), reasons: ["tooMuchText"], ctx: { ...ctx, chars: 120 } });
  assert.equal(t.params.maxChars, 90);
});

test("the same traits drive the consistency score", () => {
  const g = layali();
  declare(g, { type: "avoidWord", params: { word: "فاخر", lang: "ar" } }, "manual", T0);
  declare(g, { type: "maxHeadline", params: { chars: 20 } }, "manual", T0);
  const good = check(g, { texts: [{ text: "عود الليل", lang: "ar", role: "headline" }], kit: { bg: "#2A1A0E", fg: "#F2C88A" }, template: "benefit" }, ctx);
  assert.equal(good.score, 100);
  const bad = check(g, { texts: [{ text: "عطر عود الليل الفاخر 😍 لكل المناسبات", lang: "ar", role: "headline" }], kit: { bg: "#FF0000", fg: "#F2C88A" }, template: "benefit" }, ctx);
  const failed = bad.violations.map((v) => v.trait.type).sort();
  assert.deepEqual(failed, ["avoidWord", "maxHeadline", "noEmoji", "palette"]);
  assert.equal(bad.dims.colors, 0);
  assert.equal(bad.dims.composition, null);
  assert.ok(bad.score < 20);
});

test("scoped traits only apply in their context", () => {
  const g = layali();
  declare(g, { type: "template", params: { id: "compare", avoid: true }, scope: { category: ["fragrance"] } }, "manual", T0);
  assert.equal(check(g, { template: "compare" }, { category: "fragrance" }).violations.length, 1);
  assert.equal(check(g, { template: "compare" }, { category: "fashion" }).violations.length, 0);
});

test("expression compiles a kit, a brief and exemplars", () => {
  const g = layali();
  declare(g, { type: "voice", params: { text: "Warm, hospitable Gulf Arabic." } }, "brandbook", T0);
  learn(g, { type: "approve", at: day(1), content: { texts: [{ text: "عود الليل", lang: "ar" }] }, exemplar: { titleAr: "عود الليل" }, ctx, edits: 2, label: "Oud title" });
  const e = express(g, ctx);
  assert.deepEqual(e.kit, { bg: "#2A1A0E", fg: "#F2C88A", accent: "#F4E9D8" });
  assert.match(e.brief, /Warm, hospitable Gulf Arabic/);
  assert.match(e.brief, /Use only the brand palette/);
  assert.match(e.brief, /عود الليل/);
  assert.deepEqual(editTrend(g).map((x) => x.edits), [2]);
});

test("kit keeps text readable whatever the palette", () => {
  const k = kitFromPalette([{ hex: "#FFFFFF", role: "background" }, { hex: "#FAFAF0" }]);
  assert.ok(contrast(k.fg, k.bg) >= 3);
  assert.ok(contrast(k.accent, k.bg) >= 3);
});

test("palette extraction finds the dominant colours", () => {
  const w = 40, h = 40, d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const left = (i % w) < 30; d.set(left ? [42, 26, 14, 255] : [242, 200, 138, 255], i * 4); }
  const p = extractPalette(d, w, h, 4);
  assert.ok(colourDistance(p[0].hex, "#2A1A0E") < 3);
  assert.ok(p.some((c) => colourDistance(c.hex, "#F2C88A") < 3));
  assert.ok(p[0].share > p[1].share);
});

test("full rewrites don't teach word choices", () => {
  const obs = observeEdit("Perfume Oud 100ml Men Women Best Gift", "عطر عود الليل ١٠٠ مل", { role: "title" });
  assert.ok(!obs.some((o) => o.spec.type === "avoidWord" && o.sign > 0));
});

test("trimming a headline teaches length, not a ban on every removed word", () => {
  const g = layali();
  for (let i = 1; i <= 4; i++) learn(g, { type: "edit", at: day(i), role: "title", before: "Oud Al Layl Eau de Parfum 100ml for Men and Women, Long Lasting Scent", after: "Oud Al Layl Eau de Parfum 100ml", ctx });
  const len = g.traits.find((x) => x.type === "maxHeadline");
  assert.equal(len.status, "active");
  assert.ok(len.params.chars >= 31 && len.params.chars <= 36, String(len.params.chars));
  assert.ok(!g.traits.some((x) => x.type === "avoidWord" && x.status === "active"));
});
