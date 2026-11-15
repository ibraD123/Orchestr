import { projectFactFields, parseFactAnswer, replaceFactPlan } from "./fact-links.mjs";
import { randomBytes } from "node:crypto";
import { createCreatorProjectStore } from "./creator-projects.mjs";
import { creatorFeedback, sendCreatorRelease } from "./creator-portal.mjs";
import { decide } from "./portal.mjs";
import { StoreError } from "./store.mjs";
import { makeZip, readZip } from "./zip.mjs";

const fail = (m, status = 400) => { throw new StoreError(m, status); };
const uid = (prefix) => prefix + randomBytes(10).toString("hex");
const text = (v, max = 1000) => String(v || "").trim().slice(0, max);
const ps = (ctx) => createCreatorProjectStore(ctx.store, { assetPrefix: `/assets/${ctx.key}/` });
const findBatch = (portal, id) => (portal.batches || []).find((b) => b.id === id) || fail("Unknown client batch", 404);

export async function collaborationRoom(store, ws, { client = false } = {}) {
  await store.getGenome(ws);
  const portal = await store.getPortal(ws), projects = createCreatorProjectStore(store), output = [];
  for (const batch of portal.batches || []) {
    const items = [];
    for (const projectId of batch.projectIds) {
      let p; try { p = await projects.getProject(ws, projectId); } catch (e) { if (e.status === 404) { items.push({ projectId, name: "Unavailable product", status: "unavailable", frames: [], ready: false }); continue; } throw e; }
      const feedback = await creatorFeedback(store, ws, projectId), frames = [];
      for (const slot of p.slots) for (const language of slot.languages) {
        const r = slot.revisions.find((r) => r.id === slot.selected[language]), f = r && feedback.revisions[r.id];
        const review = f?.reviewId && portal.reviews.find((v) => v.id === f.reviewId);
        const index = review?.items.findIndex((it) => it.creator?.revisionId === r.id);
        const sent = index != null && index >= 0;
        let previous = r?.parentId && slot.revisions.find((v) => v.id === r.parentId);
        while (previous && !feedback.revisions[previous.id]?.reviewId) previous = slot.revisions.find((v) => v.id === previous.parentId);
        frames.push({ slotId: slot.id, name: slot.name, language, revisionId: r?.id || null,
          status: r?.factStale ? "outdated" : f?.status || "not_sent", factStale:!!r?.factStale, agencyApproved: r?.review.status === "approved",
          reviewId: sent ? review.id : null, itemIndex: sent ? index : null,
          asset: r && (!client || sent) ? r.asset : null,
          previous: previous ? { asset: previous.asset, revisionId: previous.id } : null,
          comments: (f?.comments || []).map((c) => ({ id: c.id, by: c.by, text: c.text, pins: c.pins, time: c.time, at: c.at })),
          version: r ? slot.revisions.filter((v) => v.language === language).findIndex((v) => v.id === r.id) + 1 : 0 });
      }
      const tasks = (portal.creatorTasks || []).filter((t) => t.projectId === projectId).map((t) => {
        const decision = t.candidateId && feedback.revisions[t.candidateId]?.status;
        return { ...t, status: decision === "approved" ? "resolved" : decision === "changes" ? "reopened" : t.status };
      });
      const blocked = tasks.some((t) => t.kind === "data" && t.status === "open");
      const pendingData=tasks.some((t)=>t.kind === "data" && t.status !== "resolved");
      const ready = !pendingData && frames.length > 0 && frames.every((f) => f.status === "approved");
      const status = blocked ? "needs_data" : pendingData ? "in_progress" : ready ? "approved" : frames.some((f) => f.status === "changes") ? "changes" : frames.some((f) => f.status === "pending") ? "review" : "in_progress";
      items.push({ projectId, name: p.name, sku: p.sku, channel: p.channel, status, ready, frames, tasks });
    }
    const counts = { total: items.length, approved: 0, review: 0, changes: 0, needs_data: 0, in_progress: 0, unavailable: 0 };
    items.forEach((p) => counts[p.status]++);
    output.push({ ...batch, items, counts });
  }
  return { batches: output };
}

export async function createBatch(ctx, body) {
  const ws = String(body.ws || ""), ids = body.projectIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > 200 || new Set(ids).size !== ids.length) fail("Choose 1–200 distinct Creator projects");
  for (const id of ids) await ps(ctx).getProject(ws, id);
  const name = text(body.name, 120); if (!name) fail("Name the batch");
  return ctx.store.updatePortal(ws, (portal) => {
    if ((portal.batches || []).length >= 100) fail("Client batch limit reached", 413);
    const batch = { id: uid("batch"), name, projectIds: [...ids], createdAt: new Date().toISOString() };
    (portal.batches ||= []).push(batch); return batch;
  });
}

export async function takeComment(ctx, body) {
  const ws = String(body.ws || ""), p = await ps(ctx).getProject(ws, body.projectId);
  return ctx.store.updatePortal(ws, (portal) => {
    const review = portal.reviews.find((r) => r.id === body.reviewId);
    const item = review?.items.find((it) => it.creator?.revisionId === body.revisionId && it.creator.projectId === p.id);
    const comment = item?.comments.find((c) => c.id === body.commentId);
    if (!comment) fail("Unknown comment on this project revision", 404);
    const old = (portal.creatorTasks || []).find((t) => t.commentId === comment.id && t.sourceRevisionId === item.creator.revisionId);
    if (old) return old;
    if ((portal.creatorTasks || []).length >= 2000) fail("Task limit reached", 413);
    const task = { id: uid("task"), kind: "edit", projectId: p.id, slotId: item.creator.slotId, language: item.creator.language,
      sourceRevisionId: item.creator.revisionId, reviewId: review.id, commentId: comment.id,
      original: { text: comment.text, pins: structuredClone(comment.pins), by: comment.by, ...(comment.time !== undefined ? { time: comment.time } : {}) },
      status: "open", assignee: text(body.assignee, 80), due: "", candidateId: null, reply: "", createdAt: new Date().toISOString() };
    (portal.creatorTasks ||= []).push(task); return task;
  });
}

export async function updateTask(ctx, body) {
  const ws = String(body.ws || ""); await ctx.store.getGenome(ws);
  if (body.due && !/^\d{4}-\d{2}-\d{2}$/.test(body.due)) fail("Invalid due date");
  const portal = await ctx.store.getPortal(ws), task = (portal.creatorTasks || []).find((t) => t.id === body.taskId);
  if (!task) fail("Unknown task", 404);
  const p = await ps(ctx).getProject(ws, task.projectId);
  let candidate;
  if (body.action === "submit") {
    const slot = p.slots.find((s) => s.id === task.slotId);
    candidate = slot?.revisions.find((r) => r.id === slot.selected[task.language]);
    if (!candidate || candidate.id === task.sourceRevisionId || candidate.review.status !== "approved") fail("Select and agency-approve a new revision for this task first", 409);
    let ancestor = candidate, found = false;
    while (ancestor?.parentId) { if (ancestor.parentId === task.sourceRevisionId) { found = true; break; } ancestor = slot.revisions.find((r) => r.id === ancestor.parentId); }
    if (!found) fail("The new revision must descend from the commented image", 409);
    if (task.candidateId !== candidate.id || task.status !== "submitted") {
      const release = await ps(ctx).createRelease(ws, p.id, { expectedSelection: Object.fromEntries(p.slots.map((s) => [s.id, s.selected])) });
      await sendCreatorRelease(ctx, { ws, projectId: p.id, releaseId: release.id });
    }
  }
  return ctx.store.updatePortal(ws, (saved) => {
    const t = saved.creatorTasks.find((t) => t.id === task.id);
    if (body.assignee !== undefined) t.assignee = text(body.assignee, 80);
    if (body.due !== undefined) { if (body.due && !/^\d{4}-\d{2}-\d{2}$/.test(body.due)) fail("Invalid due date"); t.due = body.due || ""; }
    if (body.reply !== undefined) t.reply = text(body.reply);
    if (body.action === "start") t.status = "working";
    if (body.action === "submit") { t.status = "submitted"; t.candidateId = candidate.id; }
    if (body.action === "close" && t.kind === "data" && t.answer) {if(t.field)fail("Review and apply this field answer before closing it",409);t.status = "resolved";}
    t.updatedAt = new Date().toISOString(); return t;
  });
}

export async function requestData(ctx, body) {
  const ws = String(body.ws || ""); await ps(ctx).getProject(ws, body.projectId);
  const question = text(body.question); if (!question) fail("Describe the information you need");
  return ctx.store.updatePortal(ws, async (p) => {
    if ((p.creatorTasks || []).length >= 2000) fail("Task limit reached", 413);
    const project=await ps(ctx).getProject(ws,body.projectId),field=body.fieldKey?projectFactFields(project).find(f=>f.key===body.fieldKey&&f.slotId===body.slotId):null;if(body.fieldKey&&!field)fail("Choose a field from this project");
    const t = { id: uid("task"), kind: "data", projectId: body.projectId, ...(field?{field}:{}), question, status: "open", answer: "", createdAt: new Date().toISOString() };
    (p.creatorTasks ||= []).push(t);if(!(p.batches||[]).some(b=>b.projectIds.includes(body.projectId)))(p.batches||=[]).push({id:uid("batch"),name:project.name+" · product information",projectIds:[project.id],createdAt:t.createdAt});return t;
  });
}

export async function clientBatchAction(store, ws, body) {
  await store.getGenome(ws);
  const room = await collaborationRoom(store, ws, { client: true });
  const batch = room.batches.find((b) => b.id === body.batchId) || fail("Unknown batch", 404);
  if (body.action === "answer") return store.updatePortal(ws, async (p) => {
    const task = (p.creatorTasks || []).find((t) => t.id === body.taskId && batch.projectIds.includes(t.projectId) && t.kind === "data");
    if (!task) fail("Unknown information request", 404);
    const answer = text(body.answer, 2000); if (!answer) fail("Add the requested information");
    if(task.status!=="open"){if(task.answer===answer)return task;fail("This answer has already been submitted. Ask the agency for a new request to change it.",409);}
    if(task.field){const project=await createCreatorProjectStore(store).getProject(ws,task.projectId);replaceFactPlan(structuredClone(project),task.field.key,parseFactAnswer(task.field,answer));}
    task.answer = answer;task.answeredBy=String(body.name||"Client").slice(0,120); task.status = "answered"; task.answeredAt = new Date().toISOString(); return task;
  });
  if (body.action !== "approve" || !Array.isArray(body.selections) || !body.selections.length || body.selections.length > 200) fail("Choose exact product versions to approve");
  if (new Set(body.selections.map((s) => s.projectId)).size !== body.selections.length) fail("Duplicate product selection");
  return store.updatePortal(ws, async (p) => {
    const work = [];
    for (const selection of body.selections) {
      const item = batch.items.find((i) => i.projectId === selection.projectId);
      if (!item || !item.frames.length || !Array.isArray(selection.revisionIds)) fail("Choose a product in this batch");
      if (!["review", "approved"].includes(item.status)) fail("Product versions changed or are not ready; refresh before approving", 409);
      const current = await createCreatorProjectStore(store).getProject(ws, selection.projectId);
      const actual = current.slots.flatMap((slot) => slot.languages.map((lang) => slot.selected[lang] || null)).sort();
      if (JSON.stringify([...selection.revisionIds].sort()) !== JSON.stringify(actual)) fail("Product versions changed; refresh before approving", 409);
      for (const f of item.frames) {
        if (!f.reviewId || !["approved", "pending"].includes(f.status)) fail("Only submitted versions without requested changes can be batch-approved", 409);
        const review = p.reviews.find((r) => r.id === f.reviewId), it = review?.items[f.itemIndex];
        if (!it || it.creator?.revisionId !== f.revisionId || !["pending", "approved"].includes(it.status)) fail("Review changed; refresh before approving", 409);
        if (it.status === "pending") work.push({ reviewId: review.id, index: f.itemIndex });
      }
    }
    work.forEach((x) => decide(p, x.reviewId, x.index, { decision: "approve", approver: body.approver, name: body.name }));
    return { reviewed: work.length };
  });
}

export async function exportBatch(ctx, body, exportRelease) {
  const ws = String(body.ws || ""), room = await collaborationRoom(ctx.store, ws);
  const batch = room.batches.find((b) => b.id === body.batchId) || fail("Unknown batch", 404);
  if (!Array.isArray(body.projectIds) || !body.projectIds.length || body.projectIds.length > 200 || new Set(body.projectIds).size !== body.projectIds.length) fail("Select ready products to download");
  const files = []; let bytes = 0;
  for (const id of body.projectIds) {
    const item = batch.items.find((p) => p.projectId === id);
    if (!item?.ready || item.status !== "approved") fail("Every selected product must have current client-approved versions", 409);
    const p = await ps(ctx).getProject(ws, id), release = p.releases.at(-1);
    if (!release || p.slots.some((s) => s.languages.some((lang) => !release.slots.find((old) => old.id === s.id)?.variants.some((r) => r.id === s.selected[lang])))) fail("Versions changed; prepare the current release first", 409);
    const result = await exportRelease({ ws, projectId: id, releaseId: release.id }, ctx);
    for (const entry of readZip(result.$file.data)) {
      bytes += entry.data.length; if (bytes > 100_000_000) fail("Download a smaller batch (100 MB limit)", 413);
      files.push({ name: `${p.id}/${entry.name}`, data: entry.data });
    }
  }
  return { $file: { data: Buffer.from(makeZip(files)), type: "application/zip", name: `${batch.id}-approved.zip` } };
}

export function collaborationRoutes({ exportRelease } = {}) {
  return { "POST /api/collaboration": async (body, ctx) => {
    const ws = String(body.ws || ""); await ctx.store.getGenome(ws);
    if (body.action === "room") return collaborationRoom(ctx.store, ws);
    if (body.action === "create") return createBatch(ctx, body);
    if (body.action === "take") return takeComment(ctx, body);
    if (["start", "submit", "close", "update"].includes(body.action)) return updateTask(ctx, body);
    if (body.action === "request_data") return requestData(ctx, body);
    if (body.action === "export") return exportBatch(ctx, body, exportRelease);
    fail("Unknown collaboration action");
  } };
}
