import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createCreatorProjectStore } from "../server/creator-projects.mjs";
import { sendCreatorRelease, creatorFeedback } from "../server/creator-portal.mjs";
import { emptyPortal, decide } from "../server/portal.mjs";

const clone = (value) => structuredClone(value);
const image = (name = "old") => ({ type: "image", url: `/assets/account-a/client-a/batch/${name}.png` });
const video = { type: "video", url: "/assets/account-a/client-a/batch/runway.mp4", seconds: 6 };

async function fixture({ withVideo = false } = {}) {
  const documents = new Map(), portals = new Map(), queues = new Map();
  const store = {
    async getGenome(ws) { if (!["client-a", "client-b"].includes(ws)) throw Object.assign(new Error("Unknown workspace"), { status: 404 }); return {}; },
    async getCreator(ws) { await this.getGenome(ws); return clone(documents.get(ws) || { schemaVersion: 1, projects: [], models: [] }); },
    async updateCreator(ws, fn) { const state = await this.getCreator(ws), out = await fn(state); documents.set(ws, state); return clone(out); },
    async getPortal(ws) { await this.getGenome(ws); return clone(portals.get(ws) || emptyPortal()); },
    updatePortal(ws, fn) {
      const run = (queues.get(ws) || Promise.resolve()).then(async () => { const state = await this.getPortal(ws), out = await fn(state); portals.set(ws, state); return clone(out); });
      queues.set(ws, run.catch(() => {})); return run;
    },
    async readAsset(ws, batch, name) { if (ws !== "client-a" || batch !== "batch" || !/\.(png|mp4)$/.test(name)) throw new Error("Missing asset"); return Buffer.from("stored exact file"); }
  };
  const ps = createCreatorProjectStore(store, { assetPrefix: "/assets/account-a/" });
  const project = await ps.createProject("client-a", { name: "Linen Abaya", sku: "AB-1", slots: [{ kind: "tryon", name: "On model", languages: ["none"] }, ...(withVideo ? [{ kind: "runway", name: "Runway", languages: ["none"] }] : [])] });
  const revision = await ps.addRevision("client-a", project.id, project.slots[0].id, { language: "none", asset: image(), aiPeople: true });
  await ps.reviewRevision("client-a", project.id, project.slots[0].id, revision.id, { status: "approved" });
  if (withVideo) {
    const clip = await ps.addRevision("client-a", project.id, project.slots[1].id, { language: "none", asset: video, aiPeople: true });
    await ps.reviewRevision("client-a", project.id, project.slots[1].id, clip.id, { status: "approved" });
  }
  const release = await ps.createRelease("client-a", project.id, { name: "Approved set" });
  const send = () => sendCreatorRelease({ store, key: "account-a" }, { ws: "client-a", projectId: project.id, releaseId: release.id });
  return { store, ps, project, revision, release, send };
}

test("Creator sends exact frozen approved revisions, preserving metadata after portal normalisation", async () => {
  const { store, ps, project, revision, release, send } = await fixture();
  const candidate = await ps.addRevision("client-a", project.id, project.slots[0].id, { language: "none", asset: image("new") });
  const review = await send();
  assert.equal(review.items.length, 1);
  const item = review.items[0];
  assert.equal(item.key, `creator:${revision.id}`);
  assert.deepEqual(item.after.images, [image().url]);
  assert.deepEqual(item.creator, { projectId: project.id, releaseId: release.id, slotId: project.slots[0].id, revisionId: revision.id, language: "none", assetType: "image", parentId: null, version: 1 });
  assert.equal(item.status, "pending");
  assert.equal(item.name, "Linen Abaya · On model · NONE");
  const feedback = await creatorFeedback(store, "client-a", project.id);
  assert.equal(feedback.revisions[revision.id].status, "pending");
  assert.equal(feedback.revisions[candidate.id].status, "not_sent");
  assert.deepEqual(feedback.revisions[candidate.id].comments, []);
  assert.equal((await ps.getProject("client-a", project.id)).slots[0].revisions.at(-1).review.status, "unreviewed");
  assert.equal((await send()).id, review.id);
  assert.equal((await store.getPortal("client-a")).reviews.length, 1, "sending the same frozen release is idempotent");
});

test("portal decisions and pinned feedback belong only to their exact revision", async () => {
  const { store, ps, project, revision, send } = await fixture();
  const first = await send();
  await store.updatePortal("client-a", (portal) => decide(portal, first.id, 0, { decision: "changes", comment: "Make the background warmer", pins: [{ image: 0, x: 0.3, y: 0.6, text: "Warm this corner" }], name: "Huda" }));
  let feedback = await creatorFeedback(store, "client-a", project.id);
  assert.equal(feedback.revisions[revision.id].status, "changes");
  assert.equal(feedback.revisions[revision.id].comments[0].text, "Make the background warmer");
  assert.equal(feedback.revisions[revision.id].comments[0].pins[0].text, "Warm this corner");
  assert.equal(feedback.revisions[revision.id].comments[0].reviewId, first.id);
  assert.equal((await ps.getProject("client-a", project.id)).slots[0].revisions[0].review.status, "approved", "client feedback does not rewrite agency approval");
  await store.updatePortal("client-a", (portal) => decide(portal, first.id, 0, { decision: "approve", name: "Huda" }));
  const candidate = await ps.addRevision("client-a", project.id, project.slots[0].id, { language: "none", asset: image("edited") });
  feedback = await creatorFeedback(store, "client-a", project.id);
  assert.equal(feedback.revisions[revision.id].status, "approved");
  assert.equal(feedback.revisions[candidate.id].status, "not_sent");
  await ps.reviewRevision("client-a", project.id, project.slots[0].id, candidate.id, { status: "approved" });
  const nextRelease = await ps.createRelease("client-a", project.id);
  const nextReview = await sendCreatorRelease({ store, key: "account-a" }, { ws: "client-a", projectId: project.id, releaseId: nextRelease.id });
  assert.notEqual(nextReview.id, first.id);
  feedback = await creatorFeedback(store, "client-a", project.id);
  assert.equal(feedback.revisions[candidate.id].status, "pending");
  assert.deepEqual(feedback.revisions[candidate.id].comments, []);
  assert.equal(feedback.revisions[revision.id].comments.length, 1);
});

test("Creator portal bridge checks workspace, account assets, frozen approval and item limit", async () => {
  const { store, project, release, send } = await fixture();
  await assert.rejects(sendCreatorRelease({ store, key: "account-a" }, { ws: "client-b", projectId: project.id, releaseId: release.id }), { status: 404 });
  await assert.rejects(sendCreatorRelease({ store, key: "account-b" }, { ws: "client-a", projectId: project.id, releaseId: release.id }), /this account and client/);
  await store.updateCreator("client-a", (s) => { s.projects[0].releases[0].slots[0].variants[0].review.status = "unreviewed"; });
  await assert.rejects(send(), /Every frozen revision/);
  await store.updateCreator("client-a", (s) => {
    const r = s.projects[0].releases[0], base = r.slots[0].variants[0];
    base.review.status = "approved";
    r.slots[0].variants = Array.from({ length: 31 }, (_, i) => ({ ...clone(base), id: `revision-${i}` }));
  });
  await assert.rejects(send(), /up to 30 exact revisions/);
  assert.equal((await store.getPortal("client-a")).reviews.length, 0);
});

test("mixed releases include exact saved MP4 files without inheriting client approval", async () => {
  const { store, project, send } = await fixture({ withVideo: true });
  const review = await send();
  assert.equal(review.items.length, 2);
  assert.deepEqual(review.items[1].after.images, [video.url]);
  assert.equal(review.items[1].creator.assetType, "video");
  assert.equal(review.items[1].status, "pending");
  const feedback = await creatorFeedback(store, "client-a", project.id);
  assert.equal(feedback.revisions[review.items[1].creator.revisionId].assetType, "video");
  assert.equal(feedback.revisions[review.items[1].creator.revisionId].status, "pending");
});

test("portal presents videos with native controls in review, report and library, and no image pins", async () => {
  const { store, send } = await fixture({ withVideo: true });
  const review = await send();
  const html = await readFile(new URL("../src/portal.html", import.meta.url), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace("setLang(lang); load();", "globalThis.portalTest = { setData: function(d){ data=d; }, vReviews: vReviews, vLibrary: vLibrary, vReport: vReport };");
  const runtime = { location: { pathname: "/c/test" }, navigator: { language: "en" }, localStorage: { getItem: () => null }, document: { addEventListener() {} } };
  vm.runInNewContext(script, runtime);
  const portal = await store.getPortal("client-a");
  runtime.portalTest.setData({ reviews: portal.reviews, approvers: [], files: [], results: null, library: [{ name: "Runway", at: review.sentAt, images: [video.url] }], report: { recent: [{ name: "Runway", image: video.url }], month: "2026-11" } });
  const reviewHTML = runtime.portalTest.vReviews();
  assert.match(reviewHTML, /<video controls playsinline preload="metadata"/);
  assert.match(reviewHTML, /class="shot video"><video/);
  assert.doesNotMatch(reviewHTML, /class="shot video"[^>]*data-img/);
  assert.equal((reviewHTML.match(/data-img=/g) || []).length, 1, "only the still image supports pinned coordinates");
  assert.match(runtime.portalTest.vLibrary(), /<video controls/);
  assert.match(runtime.portalTest.vReport(), /<video controls/);
});
