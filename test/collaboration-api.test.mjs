import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("private portal creates revision tasks automatically, rejects stale links and accepts exact batch decisions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "basira-room-api-"));
  process.env.BASIRA_AUTH = "off"; process.env.BASIRA_DATA_DIR = dir;
  const { server } = await import("../server/index.mjs");
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = async (path, body) => {
    const res = await fetch(base + path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=";
  try {
    await req("/api/workspaces");
    const p = (await req("/api/creator/project", { ws: "layali", action: "create", input: { sku: "A", name: "A", slots: [{ kind: "main", languages: ["none"] }] } })).body;
    const revision = (await req("/api/creator/upload", { ws: "layali", projectId: p.id, slotId: p.slots[0].id, language: "none", image: photo })).body;
    await req("/api/creator/project", { ws: "layali", action: "review", projectId: p.id, slotId: p.slots[0].id, revisionId: revision.id, status: "approved" });
    const release = (await req("/api/creator/project", { ws: "layali", action: "release", projectId: p.id })).body;
    const review = (await req("/api/creator/release/review", { ws: "layali", projectId: p.id, releaseId: release.id })).body;
    const batch = (await req("/api/collaboration", { ws: "layali", action: "create", name: "Batch", projectIds: [p.id] })).body;
    const url = (await req("/api/portal/layali/link", {})).body.url;
    const path = "/api/c/" + url.split("/c/")[1];
    const changed = await req(`${path}/reviews/${review.id}/items/0`, { decision: "changes", comment: "خلفية بيضاء" });
    assert.equal(changed.status, 200);
    const room = (await req("/api/collaboration", { ws: "layali", action: "room" })).body;
    assert.equal(room.batches[0].items[0].tasks.length, 1);
    const candidate = (await req("/api/creator/upload", { ws: "layali", projectId: p.id, slotId: p.slots[0].id, language: "none", image: photo })).body;
    assert.equal((await req(`${path}/reviews/${review.id}/items/0`, { decision: "approve" })).status, 409);
    assert.equal((await req(`${path}/batches`, { action: "approve", batchId: batch.id, selections: [{ projectId: p.id, revisionIds: [revision.id] }] })).status, 409);
    const publicView = (await req(path)).body;
    assert.equal(publicView.room.batches[0].items[0].frames[0].asset, null);
    assert.equal(publicView.room.batches[0].items[0].frames[0].revisionId, candidate.id);
  } finally {
    await new Promise((resolve) => server.close(resolve)); await rm(dir, { recursive: true, force: true });
  }
});
