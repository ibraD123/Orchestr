// The learning loop from sales: per-product results against a control group, what Brand DNA learns
// from them, and the brand rules checked in the listing audit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGenome, declare, learn, strength, express, performanceOf, fixBoost, auditBrand, listingContent } from "../server/brand-dna.mjs";
import { compareResults, productOutcomes, OUTCOME } from "../server/results.mjs";

const T0 = "2026-10-01T10:00:00.000Z";
const day = (n) => new Date(Date.parse(T0) + n * 86400000).toISOString();
const ctx = { channel: "noon", category: "fragrance", lang: "en" };

function brand() {
  const g = newGenome("layali", { name: "Layali" });
  declare(g, { type: "noEmoji", params: {} }, "brandbook", T0);
  // A learned rule: «best» removed from three titles.
  for (let i = 1; i <= 3; i++) learn(g, { type: "edit", at: day(i), role: "title", before: "Best Oud Perfume 100ml", after: "Oud Perfume 100ml", ctx });
  return g;
}
const approved = { texts: [{ text: "Oud Al Layl Eau de Parfum 100ml", lang: "en", role: "title" }] };
const outcome = (result, upliftPts, at) => ({ type: "outcome", at, product: "oud", result, upliftPts, contents: [approved], templates: ["sizechart", "benefit"], fixes: ["noSizeChart"], ctx });

test("each changed product gets its own result against the control group", () => {
  const before = [{ key: "A", sessions: 2000, units: 40 }, { key: "B", sessions: 1500, units: 30 }, { key: "C", sessions: 3000, units: 60 }, { key: "D", sessions: 100, units: 2 }, { key: "E", units: 9 }];
  const after = [{ key: "A", sessions: 2100, units: 70 }, { key: "B", sessions: 1600, units: 33 }, { key: "C", sessions: 3100, units: 66 }, { key: "D", sessions: 120, units: 5 }, { key: "E", units: 12 }];
  const res = compareResults({ before, after, changed: ["A", "B", "D", "E"] });
  const o = Object.fromEntries(productOutcomes(res).map((x) => [x.key, x]));
  assert.equal(o.A.verdict, "win");
  assert.equal(o.A.upliftPts, Math.round(((70 / 2100 - 0.02) * 100 - res.control.convPts) * 100) / 100, "minus the control group's change");
  assert.ok(o.A.z >= OUTCOME.z);
  assert.equal(o.B.verdict, "flat", "a small change on this traffic is not a signal");
  assert.equal(o.D.verdict, "lowTraffic");
  assert.equal(o.E.verdict, "noData", "no sessions, no conversion");
  assert.equal(o.C, undefined, "control products have no result of their own");
  const drop = productOutcomes(compareResults({ before, after: after.map((r) => (r.key === "A" ? { ...r, units: 10 } : r)), changed: ["A"] }));
  assert.equal(drop[0].verdict, "loss");
});

test("a win strengthens the rules the approved content followed and records what worked", () => {
  const g = brand();
  const t = g.traits.find((x) => x.key === "avoidWord:best");
  assert.equal(t.status, "active");
  const s0 = strength(t, day(10)).s;
  const changes = learn(g, outcome("win", 1.2, day(10)));
  assert.ok(strength(t, day(10)).s > s0, "confidence went up");
  assert.ok(t.evidence.some((e) => e.kind === "outcome" && e.sign > 0));
  assert.ok(changes.some((c) => c.type === "strengthened" && c.trait === t.id));
  const pf = performanceOf(g);
  assert.deepEqual(pf.templates.map((x) => [x.id, x.wins, x.verdict]).sort(), [["benefit", 1, "works"], ["sizechart", 1, "works"]]);
  assert.equal(pf.fixes[0].id, "noSizeChart");
  assert.ok(fixBoost(g, "noSizeChart") > 0);
  assert.equal(fixBoost(g, "onePhoto"), 0);
  const e = express(g, ctx, day(10));
  assert.match(e.brief, /raised conversion for this brand/);
  assert.deepEqual(e.provenTemplates.sort(), ["benefit", "sizechart"]);
  assert.match(e.brief, /sales wins/);
  assert.ok(g.log.some((l) => l.type === "outcome" && l.result === "win"));
});

test("a loss weakens only learned rules; the brand book stands; flat moves no rule", () => {
  const g = brand();
  const learned = g.traits.find((x) => x.key === "avoidWord:best");
  const book = g.traits.find((x) => x.type === "noEmoji");
  const n0 = book.evidence.length;
  learn(g, outcome("loss", -0.9, day(10)));
  assert.ok(learned.evidence.some((e) => e.kind === "outcome" && e.sign < 0));
  assert.equal(book.evidence.length, n0, "brand book rules are not overruled by one product's sales");
  const before = learned.evidence.length;
  learn(g, outcome("flat", 0.1, day(11)));
  assert.equal(learned.evidence.length, before);
  const tpl = performanceOf(g).templates.find((x) => x.id === "sizechart");
  assert.deepEqual([tpl.n, tpl.losses, tpl.flat, tpl.verdict], [2, 1, 1, "hurts"]);
  assert.equal(fixBoost(g, "noSizeChart"), 0);
});

test("old genomes without a sales record still work", () => {
  const g = brand();
  delete g.performance;
  assert.deepEqual(performanceOf(g), { templates: [], fixes: [] });
  learn(g, outcome("win", 0.8, day(10)));
  assert.equal(performanceOf(g).templates.length, 2);
});

test("the audit checks a live listing's copy against the brand", () => {
  const g = brand();
  const listing = { channel: "noon", category: "fragrance", titleEn: "Best Oud Perfume 100ml 🔥", titleAr: "", bulletsEn: ["Lasts all day"], bulletsAr: [] };
  assert.equal(listingContent(listing).texts.length, 2, "empty fields are skipped");
  const r = auditBrand(g, listing);
  assert.ok(r.checked >= 2);
  assert.ok(r.score < 100);
  const byType = Object.fromEntries(r.issues.map((i) => [i.detail.type, i]));
  assert.equal(byType.avoidWord.detail.found, "Best");
  assert.equal(byType.avoidWord.area, "brand");
  assert.equal(byType.noEmoji.sev, "med", "brand book rules weigh more");
  assert.equal(auditBrand(g, { ...listing, titleEn: "Oud Perfume 100ml" }).issues.length, 0);
  assert.equal(auditBrand(newGenome("x", {}), listing).checked, 0, "no rules, nothing to check");
});
