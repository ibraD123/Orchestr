import { test } from "node:test";
import assert from "node:assert/strict";
import { createCreatorProjectStore, emptyCreatorState, emptyCreatorTemplateState, CREATOR_LIMITS } from "../server/creator-projects.mjs";

function memoryStore() {
  const documents = new Map(), queues = new Map();
  let templates = emptyCreatorTemplateState();
  const clone = (v) => structuredClone(v);
  function transaction(key, get, set, fn) {
    const run = (queues.get(key) || Promise.resolve()).then(async () => {
      const data = clone(get()), result = await fn(data);
      set(data);
      return result;
    });
    queues.set(key, run.catch(() => {}));
    return run;
  }
  return {
    async getGenome(ws) { if (!["client-a", "client-b"].includes(ws)) throw Object.assign(new Error("Unknown workspace"), { status: 404 }); return { ws, version: 1 }; },
    async getCreator(ws) { return clone(documents.get(ws) || emptyCreatorState()); },
    updateCreator(ws, fn) { return transaction(ws, () => documents.get(ws) || emptyCreatorState(), (d) => documents.set(ws, d), fn); },
    async getCreatorTemplates() { return clone(templates); },
    updateCreatorTemplates(fn) { return transaction("templates", () => templates, (d) => { templates = d; }, fn); }
  };
}
const image = (suffix = "one") => ({ url: `https://cdn.example.com/${suffix}.png`, type: "image", width: 1080, height: 1350 });
async function fixture(slots = [{ kind: "benefit", languages: ["en", "ar"] }]) {
  const store = memoryStore(), api = createCreatorProjectStore(store, { assetPrefix: "/assets/account-a/" });
  const project = await api.createProject("client-a", { sku: "SKU-1", name: "Oud 50 ml", category: "fragrance", channel: "noon", product: { facts: ["50 ml"], sources: [image("original")] }, slots });
  return { store, api, project, slot: project.slots[0] };
}
async function addAndApprove(api, project, slot, lang) {
  const r = await api.addRevision(project.ws, project.id, slot.id, { language: lang, asset: image(lang) });
  await api.reviewRevision(project.ws, project.id, slot.id, r.id, { status: "approved" });
  return r;
}

test("projects persist by ID per workspace; SKU can be shared across creative campaigns", async () => {
  const { api, project } = await fixture();
  const second = await api.createProject("client-a", { sku: "SKU-1", name: "Ramadan campaign" });
  assert.notEqual(second.id, project.id);
  const other = await api.createProject("client-b", { sku: "SKU-1", name: "Another client's item" });
  assert.notEqual(other.id, project.id);
  await assert.rejects(api.getProject("client-b", project.id), (e) => e.status === 404);
  await assert.rejects(api.listProjects("../client-a"), (e) => e.status === 404);
  await assert.rejects(api.listProjects("missing-client"), (e) => e.status === 404);
  project.product.facts[0] = "Changed in browser";
  assert.deepEqual((await api.getProject("client-a", project.id)).product.facts, ["50 ml"]);
  assert.equal((await api.listProjects("client-a")).find((p)=>p.id===project.id).slots, 1);
});

test("a release needs exact selected approved revisions for every slot language", async () => {
  const { api, project, slot } = await fixture();
  const en = await addAndApprove(api, project, slot, "en");
  await assert.rejects(api.createRelease("client-a", project.id), (e) => e.status === 409 && /ar/.test(e.message));
  const ar = await api.addRevision("client-a", project.id, slot.id, { language: "ar", asset: image("ar") });
  await assert.rejects(api.createRelease("client-a", project.id), (e) => e.status === 409 && /Approve/.test(e.message));
  await api.reviewRevision("client-a", project.id, slot.id, ar.id, { status: "approved" });
  const selection = { [slot.id]: { en: en.id, ar: ar.id } };
  const release = await api.createRelease("client-a", project.id, { name: "Client ready", expectedSelection: selection });
  assert.equal(release.status, "approved");
  assert.equal(release.approvalScope, "agency");
  assert.deepEqual(release.slots[0].variants.map((r) => r.id), [en.id, ar.id]);

  const next = await api.addRevision("client-a", project.id, slot.id, { language: "en", asset: image("en-v2"), prompt: "Move the bottle slightly left" });
  assert.equal(next.parentId, en.id);
  assert.equal(next.review.status, "unreviewed");
  await assert.rejects(api.reviewRevision("client-a", project.id, slot.id, en.id, { status: "approved" }), (e) => e.status === 409);
  await assert.rejects(api.createRelease("client-a", project.id, { expectedSelection: selection }), (e) => e.status === 409 && /changed/.test(e.message));
  await assert.rejects(api.createRelease("client-a", project.id), (e) => e.status === 409 && /Approve/.test(e.message));
  await api.updateProject("client-a", project.id, { name: "New product title", product: { facts: ["Rechecked fact"] }, releases: [], slots: [] });
  release.slots[0].variants[0].asset.url = "https://evil.example.com/changed.png";
  const saved = await api.getProject("client-a", project.id);
  assert.equal(saved.releases.length, 1);
  assert.equal(saved.releases[0].slots[0].variants[0].asset.url, image("en").url);
  assert.equal(saved.releases[0].productName, "Oud 50 ml");
  assert.deepEqual(saved.releases[0].product.facts, ["50 ml"]);
  assert.deepEqual(saved.slots[0].revisions[0].productSnapshot.facts, ["50 ml"]);
});

test("revision parents and selection stay within their slot and project", async () => {
  const { api, project, slot } = await fixture([{ kind: "benefit", languages: ["en"] }, { kind: "details", languages: ["en"] }]);
  const rev = await api.addRevision("client-a", project.id, slot.id, { language: "en", asset: image() });
  const details = project.slots[1];
  await assert.rejects(api.addRevision("client-a", project.id, details.id, { language: "en", parentId: rev.id, asset: image() }), (e) => e.status === 404);
  await assert.rejects(api.selectRevision("client-a", project.id, details.id, { revisionId: rev.id }), (e) => e.status === 404);
  await assert.rejects(api.addRevision("client-a", project.id, slot.id, { language: "ar", asset: image() }), /language/);
  const background = await api.addRevision("client-a", project.id, slot.id, { language: "en", asset: image("background"), select: false });
  assert.notEqual(background.id, rev.id);
  assert.equal((await api.getProject("client-a", project.id)).slots[0].selected.en, rev.id);
});

test("agency templates share structure without copying client facts, photos, claims or prompts", async () => {
  const { api, project, slot } = await fixture([{ kind: "benefit", languages: ["en", "ar"], name: "Secret customer claim", style: { background: "#AABBCC", tone: "premium", productName: "Secret product", prompt: "50 ml, lasts 24 hours", photo: image().url } }]);
  await addAndApprove(api, project, slot, "en");
  const template = await api.createTemplate("client-a", { projectId: project.id, slotId: slot.id, name: "Premium benefit" });
  assert.equal(template.kind, "single");
  assert.equal(template.scope, "agency");
  assert.deepEqual(template.slots[0].style, { background: "#aabbcc", tone: "premium" });
  const serialised = JSON.stringify(template);
  for (const privateValue of ["Secret", "Oud", "50 ml", "24 hours", "cdn.example.com", project.id, "client-a", "revisions", "prompt"]) assert.ok(!serialised.includes(privateValue), privateValue);
  const other = await api.createProject("client-b", { sku: "NEXT", name: "Dates", product: { facts: ["500 g"] } });
  const applied = await api.applyTemplate("client-b", other.id, { templateId: template.id });
  assert.deepEqual(applied.product.facts, ["500 g"]);
  assert.equal(applied.slots.length, 1);
  assert.deepEqual(applied.slots[0].revisions, []);
  assert.deepEqual(applied.slots[0].selected, {});
});

test("applying a single template preserves revisions and their original structure", async () => {
  const { api, project, slot } = await fixture();
  const en = await addAndApprove(api, project, slot, "en");
  const source = await api.createProject("client-b", { sku: "STYLE", name: "Reusable structure", slots: [{ kind: "benefit", languages: ["en", "ar"], layout: "split", style: { tone: "bold" } }] });
  const template = await api.createTemplate("client-b", { projectId: source.id, slotId: source.slots[0].id, name: "Bold split" });
  const changed = await api.applyTemplate("client-a", project.id, { templateId: template.id, slotId: slot.id });
  assert.equal(changed.slots[0].layout, "split");
  assert.equal(changed.slots[0].selected.en, en.id);
  assert.equal(changed.slots[0].revisions[0].structure.layout, "hero");
  assert.equal(changed.slots[0].revisions[0].review.status, "approved");
  const next = await api.addRevision("client-a", project.id, slot.id, { language: "en", asset: image("new-structure") });
  assert.equal(next.structure.layout, "split");
  assert.equal(next.review.status, "unreviewed");
});

test("built-in UAE packs and single-image templates keep a clean shared main image", async () => {
  const { api } = await fixture();
  const templates = await api.listTemplates();
  assert.ok(templates.filter((t) => t.scope === "builtin" && t.kind === "pack").length >= 4);
  assert.ok(templates.some((t) => t.kind === "single" && t.slots[0].kind === "tryon"));
  assert.ok(templates.some((t) => t.kind === "single" && t.slots[0].kind === "runway"));
  for (const main of templates.flatMap((t) => t.slots).filter((s) => s.kind === "main")) {
    assert.deepEqual(main.languages, ["none"]);
    assert.equal(main.style.background, "#ffffff");
    assert.equal(main.style.textDensity, "none");
  }
  templates[0].name = "Mutated";
  assert.notEqual((await api.listTemplates())[0].name, "Mutated");
});

test("asset references reject inline payloads and other clients/accounts; caps preserve existing state", async () => {
  const { api, project, slot } = await fixture([{ kind: "main", languages: ["none"] }]);
  for (const url of ["data:image/png;base64,AAAA", "javascript:alert(1)", "http://cdn.example.com/a.png", "/assets/account-b/client-a/batch-123/a.png", "/assets/account-a/client-b/batch-123/a.png", "/assets/account-a/client-a/batch-123/../a.png", "/assets/account-a/client-a/batch-123/%2e%2e"]) {
    await assert.rejects(api.addRevision("client-a", project.id, slot.id, { language: "none", asset: { url } }));
  }
  const r = await api.addRevision("client-a", project.id, slot.id, { language: "none", asset: { url: "/assets/account-a/client-a/batch-123/a.png" } });
  assert.equal(r.asset.type, "image");
  for (let n = 1; n < CREATOR_LIMITS.revisionsPerSlot; n++) await api.addRevision("client-a", project.id, slot.id, { language: "none", asset: image(String(n)) });
  await assert.rejects(api.addRevision("client-a", project.id, slot.id, { language: "none", asset: image("over-cap") }), (e) => e.status === 413);
  const saved = await api.getProject("client-a", project.id);
  assert.equal(saved.slots[0].revisions.length, CREATOR_LIMITS.revisionsPerSlot);
});

test("queued concurrent revisions do not overwrite each other", async () => {
  const { api, project, slot } = await fixture([{ kind: "benefit", languages: ["en"] }]);
  const revisions = await Promise.all(Array.from({ length: 6 }, (_, n) => api.addRevision("client-a", project.id, slot.id, { language: "en", asset: image(String(n)) })));
  const saved = await api.getProject("client-a", project.id);
  assert.equal(saved.slots[0].revisions.length, 6);
  assert.deepEqual(saved.slots[0].revisions.map((r) => r.id), revisions.map((r) => r.id));
  assert.equal(revisions[5].parentId, revisions[4].id);
});

test("revision copy and QA evidence persist separately from human approval and stay bounded", async () => {
  const { api, project, slot } = await fixture([{ kind: "benefit", languages: ["ar"] }]);
  const approvedTexts = [{ lang: "ar", text: "عطر فاخر" }];
  const checks = { ok: false, reasons: ["Arabic needs review"], aspect: { requested: "4:5", actual: "1:1", matches: false }, readback: { overlayTexts: ["عطر فاخر"], arabicRendering: "correct", photorealPeople: false, problems: [] }, apiKey: "DO-NOT-STORE", image: "data:image/png;base64,AA==" };
  const revision = await api.addRevision("client-a", project.id, slot.id, { language: "ar", asset: image(), approvedTexts, checks, generationStatus: "needs_review" });
  checks.reasons[0] = "Changed by caller";
  approvedTexts[0].text = "Changed by caller";
  assert.equal(revision.qa.status, "needs_review");
  assert.equal(revision.review.status, "unreviewed");
  assert.equal(revision.qa.checks.reasons[0], "Arabic needs review");
  assert.deepEqual(revision.checks.aspect, { requested: "4:5", actual: "1:1", matches: false });
  assert.deepEqual(revision.approvedTexts, [{ lang: "ar", text: "عطر فاخر" }]);
  assert.ok(!JSON.stringify(revision).includes("DO-NOT-STORE"));
  assert.ok(!JSON.stringify(revision).includes("data:image"));
  await assert.rejects(api.addRevision("client-a", project.id, slot.id, { language: "ar", asset: image(), approvedTexts: [{ lang: "en", text: "Wrong language" }] }), /must match/);
  assert.equal((await api.getProject("client-a", project.id)).slots[0].revisions.length, 1);
});
