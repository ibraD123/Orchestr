import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../server/store.mjs";
import { proposalsFrom } from "../server/brand-ai.mjs";

test("store seeds sample clients, keeps genomes and events per workspace", async () => {
  const dir = await mkdtemp(join(tmpdir(), "basira-"));
  try {
    const s = createStore(dir);
    const list = await s.listWorkspaces();
    assert.deepEqual(list.map((w) => w.id), ["layali", "noor"]);
    const g = await s.getGenome("layali");
    assert.ok(g.traits.some((t) => t.status === "active" && t.origin === "learned"));
    assert.ok((await s.listEvents("layali", { product: "oud" })).length >= 5);
    const ws = await s.createWorkspace({ name: "Sahara Coffee Co." });
    assert.equal(ws.id, "sahara-coffee-co");
    const fresh = await s.getGenome(ws.id);
    assert.equal(fresh.traits.length, 0);
    await s.putGenome(ws.id, Object.assign({}, fresh, { version: 2 }), 1);
    await assert.rejects(s.putGenome(ws.id, Object.assign({}, fresh, { version: 3 }), 1), (e) => e.status === 409);
    await s.appendEvents(ws.id, [{ type: "edit", product: "p1" }]);
    assert.equal((await s.listEvents(ws.id)).length, 1);
    await assert.rejects(s.getGenome("../etc"), (e) => e.status === 404);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("brand analysis turns into trait proposals", () => {
  const a = {
    voice: { summary: { en: "Warm Gulf Arabic.", ar: "عربية خليجية دافئة." }, formality: "friendly", dialect: "gulf", addressesBuyerAs: "you", usesEmoji: false, usesExclamation: true },
    visual: { summary: { en: "Dark, warm.", ar: "داكن ودافئ." }, lighting: "low warm light", backgrounds: "dark wood", composition: "one product", textOnImage: "minimal" },
    palette: [{ hex: "#2a1a0e", role: "background", seenIn: "logo" }, { hex: "gold", role: "accent", seenIn: "ads" }],
    logoPlacement: "top-end", numerals: "arabic",
    words: { prefer: ["عود"], avoid: ["رخيص", " "] },
    rules: [{ kind: "visual", statement: { en: "Never crop the cap", ar: "لا تقص الغطاء" }, source: "p. 7" }]
  };
  const r = proposalsFrom(a, "brand book");
  const types = r.proposals.map((p) => p.type);
  for (const t of ["voice", "visual", "noEmoji", "numerals", "logo", "textDensity", "avoidWord", "preferWord"]) assert.ok(types.includes(t), t);
  assert.ok(!types.includes("noExclamation"));
  assert.equal(r.proposals.filter((p) => p.type === "avoidWord").length, 1);
  assert.deepEqual(r.palette.map((c) => c.hex), ["#2A1A0E"]);
  assert.equal(r.logoPos, "top-end");
});
