import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../server/store.mjs";
import { creatorRoutes } from "../server/creator-api.mjs";

const PRODUCT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=";
const MODEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/mT8AAAAASUVORK5CYII=";
const FIRST_TRYON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=";
const SELECTED_TRYON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAKAAQAAAADCs/2PAAAAp0lEQVR4nO3MMQEAAAwCIPuX1hA7BwFIjyIQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFA8DsYjUFpUiwnsBEAAAAASUVORK5CYII=";
const PRODUCT_CHECK = { sameProduct: true, shape: "same", logo: "none", problems: [] };

test("Creator model API persists real references and animates only the exact approved selected try-on", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "basira-creator-model-api-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = createStore(dir, { seed: false });
  const firstClient = await store.createWorkspace({ name: "Fashion client" });
  const secondClient = await store.createWorkspace({ name: "Other client" });
  const ws = firstClient.id;
  const calls = { models: [], tryons: [], runway: [], meter: [] };
  const routes = creatorRoutes({
    guardPlan: async () => {},
    meter: async (_store, ...args) => { calls.meter.push(args); },
    makeModel: async (input) => { calls.models.push(input); return { ok: true, images: [MODEL], prompt: "Reusable adult model", status: "review_required" }; },
    tryOnProduct: async (input) => {
      calls.tryons.push(input);
      return { ok: true, images: [calls.tryons.length === 1 ? FIRST_TRYON : SELECTED_TRYON], prompt: "The exact product on the selected model", results: [{ status: "passed", productCheck: PRODUCT_CHECK, reasons: [] }] };
    },
    makeRunway: async (input) => { calls.runway.push(input); return { ok: true, video: Buffer.from("exact generated MP4 bytes"), prompt: "Slow runway steps", model: "mock-runway-model", attempts: [{ ok: true, frames: 3, reasons: [] }] }; },
    editImage: async () => { throw new Error("Model shortcuts must not use the generic edit route"); }
  });
  const ctx = { store, key: "account-a" };
  const invoke = (name, body) => routes[`POST /api/creator/${name}`]({ ws, ...body }, ctx);
  const readSaved = async (asset) => {
    const prefix = `/assets/account-a/${ws}/`;
    assert.ok(asset.url.startsWith(prefix));
    const [batch, ...name] = asset.url.slice(prefix.length).split("/");
    return store.readAsset(ws, batch, name.join("/"));
  };

  const project = await invoke("project", { action: "create", image: PRODUCT, input: { sku: "LINEN-AB-01", name: "Linen abaya", category: "fashion", channel: "noon", product: { facts: ["Linen"] }, slots: [{ kind: "runway", name: "Runway from approved try-on", languages: ["none"], aspect: "4:5" }] } });
  const existingRunwayId = project.slots[0].id;
  await invoke("upload", { projectId: project.id, kind: "source", image: MODEL });
  const model = await invoke("models", { action: "create", input: { name: "Brand model", prompt: "Adult model with natural styling" }, image: MODEL });
  assert.equal(calls.models[0].referenceImage, MODEL);
  assert.equal(model.aiPeople, true);
  assert.deepEqual(await readSaved(model.asset), Buffer.from(MODEL.split(",")[1], "base64"));
  assert.equal((await invoke("workspace", { ws: secondClient.id })).models.length, 0, "model identities stay in their client workspace");

  const tryOnV1 = await invoke("models", { action: "tryon", projectId: project.id, modelId: model.id });
  assert.ok(Array.isArray(tryOnV1.slots), "the API returns a full project, not the appended revision");
  const trySlot = tryOnV1.slots.find((slot) => slot.kind === "tryon");
  assert.ok(trySlot, "the API creates a try-on slot when the project has none");
  assert.equal(calls.tryons[0].productImage, PRODUCT, "the authority remains the original first product source, not the second source or model photo");
  assert.equal(calls.tryons[0].modelImage, MODEL);
  assert.equal(trySlot.revisions[0].model, model.id);
  assert.equal(trySlot.revisions[0].review.status, "unreviewed");
  await assert.rejects(invoke("models", { action: "runway", projectId: project.id, slotId: trySlot.id, language: "none" }), { status: 409 });
  assert.equal(calls.runway.length, 0, "no billable video invocation before exact agency approval");

  const tryOnV2 = await invoke("models", { action: "tryon", projectId: project.id, modelId: model.id });
  const updatedTrySlot = tryOnV2.slots.find((slot) => slot.kind === "tryon");
  const selectedRevision = updatedTrySlot.revisions.find((revision) => revision.id === updatedTrySlot.selected.none);
  assert.equal(updatedTrySlot.revisions.length, 2);
  assert.equal(tryOnV2.slots.filter((slot) => slot.kind === "tryon").length, 1);
  assert.notEqual(selectedRevision.id, trySlot.revisions[0].id);
  await assert.rejects(invoke("project", { action: "review", projectId: project.id, slotId: trySlot.id, revisionId: trySlot.revisions[0].id, status: "approved" }), { status: 409 });
  await invoke("project", { action: "review", projectId: project.id, slotId: trySlot.id, revisionId: selectedRevision.id, status: "approved" });
  const withVideo = await invoke("models", { action: "runway", projectId: project.id, slotId: trySlot.id, language: "none" });
  assert.equal(calls.runway.length, 1);
  assert.deepEqual(calls.runway[0].source, { kind: "tryon", approved: true, image: SELECTED_TRYON });
  assert.equal(calls.runway[0].productImage, PRODUCT);
  assert.equal(withVideo.slots.filter((slot) => ["runway", "video"].includes(slot.kind)).length, 1, "the existing runway template slot is reused");
  const runwaySlot = withVideo.slots.find((slot) => slot.id === existingRunwayId);
  assert.equal(runwaySlot.revisions.length, 1);
  assert.equal(runwaySlot.revisions[0].asset.type, "video");
  assert.equal(runwaySlot.revisions[0].asset.seconds, 6);
  assert.equal(runwaySlot.revisions[0].review.status, "unreviewed", "video approval cannot inherit from its source frame");
  assert.deepEqual(await readSaved(runwaySlot.revisions[0].asset), Buffer.from("exact generated MP4 bytes"));
  assert.equal((await createStore(dir, { seed: false }).getCreator(ws)).projects[0].slots.find((slot) => slot.id === existingRunwayId).revisions[0].id, runwaySlot.revisions[0].id);
});
