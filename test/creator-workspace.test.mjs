// Execute the shipped browser controller with a tiny DOM boundary. These tests exercise
// payloads, the domain-store contract and client isolation without starting a browser or AI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createCreatorProjectStore, emptyCreatorState, emptyCreatorTemplateState } from "../server/creator-projects.mjs";

const source = readFileSync(new URL("../src/creator-workspace.js", import.meta.url), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
function productProject(id = "project-a", name = "Client A perfume") {
  return { id, name, sku: "SKU-1", channel: "noon", category: "fragrance", product: { facts: ["50 ml"], sources: [{ type: "image", url: `/assets/account/client-a/source/${id}.png` }] }, releases: [], slots: [
    { id: "slot-a", name: "Benefit", kind: "benefit", languages: ["en", "ar"], aspect: "4:5", layout: "hero", style: {}, selected: {}, revisions: [] }
  ] };
}
function browser(post) {
  const events = {}, requests = [];
  const products = [{ id: "sku-1", sku: "SKU-1", name: ["Oud perfume", "عطر عود"], category: "fragrance" }];
  const context = createContext({
    state: { ws: "client-a", lang: "en", route: "creator", pid: "sku-1", api: { store: true, imageGen: true, ai: true }, cr: {} },
    document: { addEventListener: (type, handler) => { (events[type] ||= []).push(handler); }, getElementById: () => ({ value: "" }) },
    setTimeout: () => 0,
    post: async (path, body) => { requests.push({ path, body }); return post ? post(path, body) : { projects: [], templates: [], models: [] }; },
    render: () => {}, wsInfo: () => ({ name: "Current client" }),
    esc: (value) => String(value == null ? "" : value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
    tr: (value) => Array.isArray(value) ? value[0] : value,
    WP: () => products, PM: {}, catOf: (p) => p.category,
    crMakePlan: () => [{ tpl: "cover", reasons: [] }, { tpl: "benefit", reasons: [{ source: "review" }] }, { tpl: "details", reasons: [] }],
    TEMPLATE_KIND: { cover: "main", benefit: "benefit", details: "details" },
    templateById: (id) => ({ name: [id, id] }), crReason: () => "Buyers ask about product longevity"
  });
  runInContext(source, context, { filename: "creator-workspace.js" });
  return { context, requests, click(action) {
    const el = { dataset: { cw: action }, disabled: false };
    for (const handler of events.click) handler({ target: { closest: (selector) => selector === "[data-cw]" ? el : null } });
  } };
}
function memoryStore() {
  let data = emptyCreatorState();
  return {
    getGenome: async () => ({}),
    getCreator: async () => structuredClone(data),
    updateCreator: async (_ws, fn) => { const next = structuredClone(data), result = await fn(next); data = next; return result; },
    getCreatorTemplates: async () => emptyCreatorTemplateState()
  };
}

test("the browser's recommended slot plan is accepted by the persistent project schema", async () => {
  const { context: c } = browser();
  const plan = plain(c.cwPlan(c.WP()[0]));
  const api = createCreatorProjectStore(memoryStore());
  const project = await api.createProject("client-a", { sku: "SKU-1", name: "Perfume", channel: "noon", slots: plan });
  assert.equal(project.slots.length, 3);
  assert.equal(project.slots[0].layout, "clean");
  assert.deepEqual(project.slots[0].languages, ["none"]);
  assert.equal(project.slots[1].style.tone, "minimal");
  assert.deepEqual(project.slots[1].languages, ["en", "ar"]);
  c.cw.form.languages = "ar";
  const arabicPlan = plain(c.cwPlan(c.WP()[0]));
  const arabic = await api.createProject("client-a", { sku: "SKU-2", name: "Perfume Arabic", slots: arabicPlan });
  assert.deepEqual(arabic.slots[1].languages, ["ar"]);
});

test("project templates from the API's kind schema appear in both set and single-image selectors", async () => {
  const templates = [
    { id: "builtin-pack", name: "Reusable set", kind: "pack", slots: [{ kind: "main" }] },
    { id: "builtin-single", name: "Reusable single", kind: "single", slots: [{ kind: "benefit" }] }
  ];
  const { context: c } = browser(async () => ({ projects: [], templates, models: [] }));
  await c.cwLoad();
  assert.match(c.cwNewProject(), /<option value="builtin-pack">Reusable set<\/option>/);
  assert.match(c.cwTemplates(), /Reusable set/);
  assert.doesNotMatch(c.cwTemplates(), /Reusable single/);
  c.cw.templateType = "single";
  assert.match(c.cwTemplates(), /Reusable single/);
  const p = productProject(); c.cwOpen(p);
  assert.match(c.cwWorkspace(p), /<option value="builtin-single">Reusable single<\/option>/);
});

test("switching clients clears photos and form drafts synchronously before the next load", () => {
  const { context: c } = browser();
  Object.assign(c.cw, { ws: "client-a", loaded: true, loading: true, projects: [productProject()], models: [{ id: "model-a" }], newProject: true, prompt: "Old client instruction", exact: "Old client claim", checks: "Old check" });
  c.cw.form = { name: "Secret product", image: "data:image/png;base64,OLD", facts: "Old confidential fact" };
  c.cw.modelForm = { name: "Old model", image: "data:image/png;base64,OLDMODEL", prompt: "Old model direction" };
  c.state.ws = "client-b";
  const html = c.vCreator();
  assert.equal(c.cw.ws, "client-b");
  assert.equal(c.cw.projects.length, 0);
  assert.equal(c.cw.models.length, 0);
  assert.equal(c.cw.newProject, false);
  assert.equal(c.cw.form.image, undefined);
  assert.equal(c.cw.form.facts, undefined);
  assert.equal(c.cw.modelForm.image, undefined);
  assert.equal(c.cw.prompt, "");
  assert.equal(c.cw.exact, "");
  assert.doesNotMatch(html, /Client A perfume|Secret product|OLDMODEL/);
});

test("a slow old-client response cannot replace a newer client's projects or models", async () => {
  const pending = [];
  const { context: c } = browser(() => new Promise((resolve) => pending.push(resolve)));
  const first = c.cwLoad();
  c.state.ws = "client-b";
  const second = c.cwLoad();
  assert.equal(pending.length, 2);
  pending[1]({ projects: [productProject("project-b", "Client B product")], templates: [], models: [{ id: "model-b" }] });
  await second;
  pending[0]({ projects: [productProject("project-a", "Client A perfume")], templates: [], models: [{ id: "model-a" }] });
  await first;
  assert.equal(c.cw.projects[0].id, "project-b");
  assert.equal(c.cw.models[0].id, "model-b");
  assert.equal(c.cw.ws, "client-b");
  assert.equal(c.cw.loaded, true);
  assert.equal(c.cw.loading, false);
});

test("a started mutation retains its original client and project after switching the UI", async () => {
  const { context: c, requests } = browser();
  c.cw.ws = "client-a"; c.cw.projectId = "project-a";
  const run = c.cwRun("Saving", () => c.cwAct("update", { patch: { name: "Saved for original client" } }));
  c.state.ws = "client-b"; c.cwResetWorkspace("client-b");
  await run;
  const mutation = requests.find((r) => r.path === "/api/creator/project");
  assert.equal(mutation.body.ws, "client-a");
  assert.equal(mutation.body.projectId, "project-a");
});

test("optional exact wording preserves overlay intent; shared none slots explicitly request no text", async () => {
  const { context: c, requests, click } = browser(async () => ({ checks: { reasons: [] } }));
  const p = productProject(); c.cw.projects = [p]; c.cwOpen(p);
  c.cwRun = (_label, fn) => { c.pendingAction = Promise.resolve().then(fn); };
  c.cw.prompt = "Make the background warmer";
  click("edit"); await c.pendingAction;
  assert.equal(requests[0].body.approvedTexts, undefined, "empty optional field must not erase existing text");
  p.slots[0].languages = ["none"]; c.cw.language = "none"; c.cw.prompt = "Clean white background"; c.cw.exact = "Do not draw this";
  click("edit"); await c.pendingAction;
  assert.deepEqual(plain(requests[1].body.approvedTexts), []);
  p.slots[0].languages = ["bilingual"]; c.cw.language = "bilingual"; c.cw.prompt = "Use exact copy"; c.cw.exact = "ثبات حتى ١٢ ساعة\nLasts up to 12 hours";
  click("edit"); await c.pendingAction;
  assert.deepEqual(plain(requests[2].body.approvedTexts), [{ text: "ثبات حتى ١٢ ساعة", lang: "ar" }, { text: "Lasts up to 12 hours", lang: "en" }]);
});

test("review diagnostics are attached to the selected revision rather than a stale page-level message", () => {
  const { context: c } = browser();
  const p = productProject(), s = p.slots[0];
  s.revisions = ["en", "ar"].map((language) => ({ id: language, language, createdAt: "2026-11-09T12:00:00Z", review: { status: "unreviewed" }, asset: { type: "image", url: `https://cdn.example.com/${language}.png` }, qa: { status: "needs_review", checks: { reasons: [language === "en" ? "English spelling needs review" : "Arabic shaping needs review"] } } }));
  s.selected = { en: "en", ar: "ar" }; c.cwOpen(p); c.cw.checks = "Stale previous generation error";
  const english = c.cwWorkspace(p);
  assert.match(english, /English spelling needs review/);
  assert.doesNotMatch(english, /Arabic shaping needs review|Stale previous generation error/);
  c.cw.language = "ar";
  const arabic = c.cwWorkspace(p);
  assert.match(arabic, /Arabic shaping needs review/);
  assert.doesNotMatch(arabic, /English spelling needs review|Stale previous generation error/);
});

test("choosing a new product does not reuse an imported product's name and category", () => {
  const { context: c } = browser(); c.cw.form.productId = "custom";
  assert.equal(c.cwCurrentProduct(), null);
  assert.doesNotMatch(c.cwNewProject(), /value="Oud perfume"/);
});
