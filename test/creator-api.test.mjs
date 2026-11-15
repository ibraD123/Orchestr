import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../server/store.mjs";
import { creatorRoutes } from "../server/creator-api.mjs";
import { readZip } from "../server/zip.mjs";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=";
const PHOTO = `data:image/png;base64,${PNG}`;
const OTHER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/mT8AAAAASUVORK5CYII=";

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "basira-creator-api-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = createStore(dir, { seed: false });
  const first = await store.createWorkspace({ name: "Client A" });
  const second = await store.createWorkspace({ name: "Client B" });
  const calls = [];
  const routes = creatorRoutes({ guardPlan: async () => { calls.push("guard"); }, meter: async (...args) => { calls.push(args.slice(1)); } });
  const ctx = { store, key: "account-a" };
  const invoke = (name, body) => routes[`POST /api/creator/${name}`](body, ctx);
  const create = (ws = first.id, extra = {}) => invoke("project", { ws, action: "create", image: PHOTO, input: { sku: "SKU-1", name: "Original product", category: "fragrance", channel: "amazon", placement: "gallery", product: { facts: ["50 ml"] }, slots: [{ kind: "benefit", languages: ["en", "ar"], rationale: "Address the buyer's size question" }], ...extra } });
  return { dir, store, first, second, calls, invoke, create };
}

test("Creator API persists uploads, selects exact revisions and exports frozen release bytes", async (t) => {
  const { dir, store, first, calls, invoke, create } = await fixture(t);
  const project = await create(), slot = project.slots[0], ws = first.id;
  const en = await invoke("upload", { ws, projectId: project.id, slotId: slot.id, language: "en", image: PHOTO });
  const enV2 = await invoke("upload", { ws, projectId: project.id, slotId: slot.id, language: "en", image: OTHER });
  const ar = await invoke("upload", { ws, projectId: project.id, slotId: slot.id, language: "ar", image: OTHER });
  assert.equal(enV2.parentId, en.id);
  assert.equal(en.qa.status, "not_checked");
  assert.equal(en.asset.width, 1);
  assert.equal(en.asset.height, 1, "asset dimensions describe actual pixels, not the requested 4:5 slot");
  await assert.rejects(invoke("project", { ws, action: "review", projectId: project.id, slotId: slot.id, revisionId: en.id, status: "approved" }), (e) => e.status === 409);
  await invoke("project", { ws, action: "select", projectId: project.id, slotId: slot.id, revisionId: en.id });
  for (const revision of [en, ar]) await invoke("project", { ws, action: "review", projectId: project.id, slotId: slot.id, revisionId: revision.id, status: "approved" });
  await assert.rejects(invoke("project", { ws, action: "release", projectId: project.id, expectedSelection: { [slot.id]: { en: enV2.id, ar: ar.id } } }), (e) => e.status === 409);
  const release = await invoke("project", { ws, action: "release", projectId: project.id, name: "Approved v1", expectedSelection: { [slot.id]: { en: en.id, ar: ar.id } } });
  assert.equal(release.placement, "gallery");
  assert.equal(release.region, "uae");
  await invoke("project", { ws, action: "update", projectId: project.id, patch: { sku: "NEW-SKU", name: "Renamed afterwards", placement: "social" } });
  await invoke("project", { ws, action: "select", projectId: project.id, slotId: slot.id, revisionId: enV2.id });
  const result = await invoke("release/export", { ws, projectId: project.id, releaseId: release.id });
  assert.equal(result.$file.type, "application/zip");
  assert.ok(result.$file.name.startsWith("SKU-1-"));
  const files = readZip(result.$file.data);
  assert.equal(files.length, 3);
  assert.ok(files.every((f) => f.crcOk));
  assert.deepEqual(Buffer.from(files.find((f) => f.name === "01-en.png").data), Buffer.from(PNG, "base64"));
  assert.deepEqual(Buffer.from(files.find((f) => f.name === "02-ar.png").data), Buffer.from(OTHER.split(",")[1], "base64"));
  const manifest = JSON.parse(Buffer.from(files.find((f) => f.name === "manifest.json").data).toString());
  assert.equal(manifest.project, "Original product");
  assert.equal(manifest.sku, "SKU-1");
  assert.equal(manifest.release.slots[0].variants[0].id, en.id);
  assert.equal(manifest.release.placement, "gallery");
  const workspace = await invoke("workspace", { ws });
  assert.ok(Array.isArray(workspace.projects[0].slots));
  assert.equal(workspace.projects[0].product.facts[0], "50 ml");
  const reloaded = createStore(dir, { seed: false });
  assert.equal((await reloaded.getCreator(ws)).projects[0].releases[0].id, release.id);
  assert.deepEqual(calls, [], "upload, manual review and snapshot export must not invoke AI or meter generations");
  assert.equal((await store.getCreator(ws)).projects[0].slots[0].selected.en, enV2.id);
});

test("Creator API isolates clients, preserves source references and sanitises agency templates", async (t) => {
  const { first, second, invoke, create } = await fixture(t);
  const project = await create();
  for (const [name, body] of [
    ["project", { action: "update", patch: { name: "Wrong client" } }],
    ["upload", { slotId: project.slots[0].id, language: "en", image: PHOTO }],
    ["release/export", { releaseId: "release-missing" }]
  ]) await assert.rejects(invoke(name, { ws: second.id, projectId: project.id, ...body }), (e) => e.status === 404);
  const source = await invoke("upload", { ws: first.id, projectId: project.id, kind: "source", image: OTHER });
  assert.equal(source.product.sources.length, 2);
  const template = await invoke("project", { ws: first.id, projectId: project.id, action: "template", name: "Agency benefit", slotId: project.slots[0].id });
  assert.equal(template.kind, "single");
  for (const secret of ["Original product", "50 ml", "Address the buyer", "assets", project.id, first.id]) assert.ok(!JSON.stringify(template).includes(secret));
  const other = await create(second.id, { name: "Other client", slots: [] });
  const applied = await invoke("project", { ws: second.id, projectId: other.id, action: "apply", templateId: template.id });
  assert.equal(applied.slots.length, 1);
  assert.deepEqual(applied.slots[0].revisions, []);
  const workspace = await invoke("workspace", { ws: second.id });
  assert.ok(workspace.templates.some((t) => t.id === template.id));
  assert.equal(workspace.templates.filter((t) => t.kind === "pack" && t.scope === "builtin").length, 4);
  assert.deepEqual(workspace.models, []);
});

test("model references stay client scoped and video slots reject image editing without AI", async (t) => {
  const { first, second, calls, invoke, create } = await fixture(t);
  const model = await invoke("upload", { ws: first.id, kind: "model", name: "Client model reference", image: PHOTO });
  assert.equal(model.aiPeople, false);
  assert.equal((await invoke("workspace", { ws: first.id })).models[0].id, model.id);
  assert.deepEqual((await invoke("workspace", { ws: second.id })).models, []);
  const project = await create(first.id, { slots: [{ kind: "runway", languages: ["none"] }] });
  await assert.rejects(invoke("edit", { ws: first.id, projectId: project.id, slotId: project.slots[0].id, language: "none", prompt: "Make video" }), (e) => e.status === 422);
  assert.deepEqual(calls, []);
});

test("Creator uploads reject fake raster MIME and noncanonical base64", async (t) => {
  const { first, invoke, create } = await fixture(t);
  const project = await create();
  for (const image of ["data:image/png;base64,ZmFrZSBpbWFnZQ==", `data:image/jpeg;base64,${PNG}`, PHOTO + "="]) {
    await assert.rejects(invoke("upload", { ws: first.id, projectId: project.id, slotId: project.slots[0].id, language: "en", image }), (e) => e.status === 400);
  }
  assert.deepEqual((await invoke("workspace", { ws: first.id })).projects[0].slots[0].revisions, []);
});
