import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore } from "../server/store.mjs";
import { createCreatorProjectStore } from "../server/creator-projects.mjs";
import { sendCreatorRelease } from "../server/creator-portal.mjs";
import { decide } from "../server/portal.mjs";
import { createBatch, collaborationRoom, takeComment, updateTask, requestData, clientBatchAction, exportBatch } from "../server/collaboration.mjs";
import { creatorRoutes } from "../server/creator-api.mjs";
import { readZip } from "../server/zip.mjs";

async function fixture(fn) {
  const dir = await mkdtemp(join(tmpdir(), "basira-room-"));
  try {
    const ctx = { store: createStore(dir), key: "local" }, ps = createCreatorProjectStore(ctx.store, { assetPrefix: "/assets/local/" });
    const p = await ps.createProject("layali", { sku: "A", name: "Amber", slots: [{ kind: "benefit", languages: ["en", "ar"] }] });
    const revisions = [];
    for (const language of ["en", "ar"]) {
      await ctx.store.saveAsset("layali", "room-test", language + ".png", Buffer.from(language));
      const r = await ps.addRevision("layali", p.id, p.slots[0].id, { language, asset: { url: `/assets/local/layali/room-test/${language}.png`, type: "image" } });
      await ps.reviewRevision("layali", p.id, p.slots[0].id, r.id, { status: "approved" }); revisions.push(r);
    }
    const release = await ps.createRelease("layali", p.id, {}), review = await sendCreatorRelease(ctx, { ws: "layali", projectId: p.id, releaseId: release.id });
    const batch = await createBatch(ctx, { ws: "layali", name: "November", projectIds: [p.id] });
    await fn({ ctx, ps, p, revisions, release, review, batch });
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test("a comment becomes an idempotent task; changed AR is re-reviewed while exact EN approval survives", () => fixture(async ({ ctx, ps, p, revisions, review, batch }) => {
  await ctx.store.updatePortal("layali", (portal) => {
    decide(portal, review.id, 0, { decision: "approve", name: "Client" });
    decide(portal, review.id, 1, { decision: "changes", comment: "اجعل الخلفية أفتح", pins: [{ image: 0, x: .2, y: .3, text: "العنوان" }] });
  });
  const comment = (await ctx.store.getPortal("layali")).reviews[0].items[1].comments[0];
  const input = { ws: "layali", projectId: p.id, reviewId: review.id, revisionId: revisions[1].id, commentId: comment.id };
  const task = await takeComment(ctx, input);
  assert.equal((await takeComment(ctx, input)).id, task.id);
  assert.equal(task.original.text, "اجعل الخلفية أفتح");
  await updateTask(ctx, { ws: "layali", taskId: task.id, action: "start", assignee: "Designer" });
  await ctx.store.saveAsset("layali", "room-test", "private.png", Buffer.from("internal draft"));
  await ps.addRevision("layali", p.id, p.slots[0].id, { language: "ar", asset: { url: "/assets/local/layali/room-test/private.png", type: "image" } });
  const candidate = await ps.addRevision("layali", p.id, p.slots[0].id, { language: "ar", asset: { url: "/assets/local/layali/room-test/ar.png", type: "image" } });
  const hidden = (await collaborationRoom(ctx.store, "layali", { client: true })).batches[0].items[0].frames.find((f) => f.language === "ar");
  assert.equal(hidden.asset, null, "unsubmitted draft bytes are not exposed");
  await assert.rejects(updateTask(ctx, { ws: "layali", taskId: task.id, action: "submit" }), /agency-approve/);
  await ps.reviewRevision("layali", p.id, p.slots[0].id, candidate.id, { status: "approved" });
  await updateTask(ctx, { ws: "layali", taskId: task.id, action: "submit", reply: "Background lightened; title checked." });
  const latest = (await ctx.store.getPortal("layali")).reviews.at(-1);
  assert.equal(latest.items[0].status, "approved"); assert.equal(latest.items[1].status, "pending");
  assert.equal(latest.items[1].before.image, revisions[1].asset.url);
  assert.equal(latest.items[1].creator.version, 3);
  assert.equal((await collaborationRoom(ctx.store, "layali")).batches[0].counts.review, 1);
  await assert.rejects(clientBatchAction(ctx.store, "layali", { action: "approve", batchId: batch.id, selections: [{ projectId: p.id, revisionIds: revisions.map((r) => r.id) }] }), /changed/);
  await clientBatchAction(ctx.store, "layali", { action: "approve", batchId: batch.id, selections: [{ projectId: p.id, revisionIds: [revisions[0].id, candidate.id] }] });
  const room = await collaborationRoom(ctx.store, "layali");
  assert.equal(room.batches[0].counts.approved, 1); assert.equal(room.batches[0].items[0].tasks[0].status, "resolved");
}));

test("missing information blocks a product until answered; answers and batches stay client scoped", () => fixture(async ({ ctx, p, batch }) => {
  const task = await requestData(ctx, { ws: "layali", projectId: p.id, question: "Confirm material" });
  assert.equal((await collaborationRoom(ctx.store, "layali")).batches[0].counts.needs_data, 1);
  await assert.rejects(clientBatchAction(ctx.store, "noor", { action: "answer", batchId: batch.id, taskId: task.id, answer: "glass" }), /Unknown batch/);
  await clientBatchAction(ctx.store, "layali", { action: "answer", batchId: batch.id, taskId: task.id, answer: "زجاج" });
  await updateTask(ctx, { ws: "layali", taskId: task.id, action: "close" });
  assert.equal((await collaborationRoom(ctx.store, "layali")).batches[0].items[0].tasks[0].status, "resolved");
}));

test("ready batch export uses exact approved bytes; stale versions cannot enter delivery", () => fixture(async ({ ctx, ps, p, revisions, batch }) => {
  const exportRelease = creatorRoutes({ guardPlan: async () => {}, meter: async () => {} })["POST /api/creator/release/export"];
  const body = { ws: "layali", batchId: batch.id, projectIds: [p.id] };
  await assert.rejects(exportBatch(ctx, body, exportRelease), /client-approved/);
  await clientBatchAction(ctx.store, "layali", { action: "approve", batchId: batch.id, selections: [{ projectId: p.id, revisionIds: revisions.map((r) => r.id) }] });
  const result = await exportBatch(ctx, body, exportRelease);
  assert.deepEqual(readZip(result.$file.data).filter((e) => e.name.endsWith(".png")).map((e) => Buffer.from(e.data).toString()).sort(), ["ar", "en"]);
  await ps.addRevision("layali", p.id, p.slots[0].id, { language: "ar", asset: revisions[1].asset });
  await assert.rejects(exportBatch(ctx, body, exportRelease), /client-approved/);
}));
