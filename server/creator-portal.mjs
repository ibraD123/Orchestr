// A portal review references an immutable Creator release, never the currently
// selected image. Client decisions remain separate from the agency's approval.
import { createCreatorProjectStore } from "./creator-projects.mjs";
import { newReview } from "./portal.mjs";
import { StoreError } from "./store.mjs";

const MAX_REVIEW_ITEMS = 30;
const copy = (value) => structuredClone(value);
const fail = (message, status = 400) => { throw new StoreError(message, status); };

function frozenVariants(project, release) {
  if (!release || release.status !== "approved" || release.approvalScope !== "agency" || release.projectId !== project.id || release.ws !== project.ws) fail("Choose a frozen, agency-approved release from this project", 409);
  if (!Array.isArray(release.slots) || !release.slots.length) fail("This approved release has no saved revisions", 409);
  const variants = [];
  for (const slot of release.slots) {
    if (!Array.isArray(slot.variants) || !slot.variants.length) fail("This release contains an empty slot", 409);
    for (const revision of slot.variants) {
      if (!revision?.id || revision.review?.status !== "approved" || !revision.asset?.url || !["image", "video"].includes(revision.asset.type)) fail("Every frozen revision must be agency-approved and have a saved image or video", 409);
      variants.push({ slot, revision });
    }
  }
  if (new Set(variants.map(({ revision }) => revision.id)).size !== variants.length) fail("The release contains duplicate revision IDs", 409);
  return variants;
}

function savedAsset(key, ws, asset) {
  const prefix = `/assets/${key}/${ws}/`, url = String(asset.url || "");
  if (!url.startsWith(prefix) || /[%\\?#\s]/.test(url)) fail("Portal releases must use saved assets from this account and client workspace", 409);
  const parts = url.slice(prefix.length).split("/");
  if (parts.length < 2 || parts.some((p) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(p) || p === "." || p === "..")) fail("Invalid saved Creator asset", 409);
  const ext = parts.at(-1).split(".").pop().toLowerCase();
  if (!(asset.type === "video" ? ["mp4"] : ["png", "jpg", "jpeg", "webp"]).includes(ext)) fail("Choose a saved PNG, JPEG, WebP or MP4 asset for the client review", 409);
  // newReview bounds URLs to 500 characters. Reject rather than silently point
  // the client at a different, truncated URL.
  if (url.length > 500) fail("The saved asset URL is too long for a portal review", 409);
  return { batch: parts[0], name: parts.slice(1).join("/"), url };
}

/** Create an internal portal review from exact frozen files. No files are generated,
 * copied, translated or sent to an external service. Repeating the same release is
 * idempotent; a new release creates a new review with pending client decisions.
 * @returns {Promise<object>} The existing portal's review shape with items[].creator.
 */
export async function sendCreatorRelease({ store, key }, { ws, projectId, releaseId }) {
  const ps = createCreatorProjectStore(store, { assetPrefix: `/assets/${key}/` });
  const project = await ps.getProject(ws, projectId);
  const release = project.releases.find((r) => r.id === releaseId);
  if (!release) fail("Unknown release in this client project", 404);
  const variants = frozenVariants(project, release);
  if(variants.some(({slot,revision})=>project.slots.find(s=>s.id===slot.id)?.revisions.find(r=>r.id===revision.id)?.factStale))fail("This release uses outdated product facts. Create updated versions first.",409);
  if (variants.length > MAX_REVIEW_ITEMS) fail(`A client review supports up to ${MAX_REVIEW_ITEMS} exact revisions. Split this project before sending it to the portal.`, 409);
  const inputs = [];
  for (const { slot, revision } of variants) {
    const asset = savedAsset(key, ws, revision.asset);
    // Verify it is a stored file before offering it for approval. Keep the exact
    // original URL in the review; do not mint a replacement image or stale copy.
    await store.readAsset(ws, asset.batch, asset.name);
    inputs.push({ key: `creator:${revision.id}`, name: `${release.productName || project.name} · ${slot.name || slot.kind} · ${String(revision.language).toUpperCase()}`, after: { images: [asset.url] } });
  }
  const review = newReview({ title: `${release.productName || project.name} · ${release.name || release.id}`, items: inputs });
  review.creator = { projectId: project.id, releaseId: release.id };
  review.items.forEach((item, index) => {
    const { slot, revision } = variants[index];
    // newReview intentionally strips unknown input fields. Attach trusted metadata
    // only after normalisation, from server-owned release snapshots.
    item.creator = { projectId: project.id, releaseId: release.id, slotId: slot.id, revisionId: revision.id, language: revision.language, assetType: revision.asset.type };
    item.creator.parentId = revision.parentId;
    item.creator.version = project.slots.find((s) => s.id === slot.id)?.revisions.filter((r) => r.language === revision.language).findIndex((r) => r.id === revision.id) + 1;
  });
  return store.updatePortal(ws, (portal) => {
    const existing = portal.reviews.find((r) => r.creator?.projectId === project.id && r.creator?.releaseId === release.id);
    if (existing) return copy(existing);
    for (const item of review.items) {
      const history = portal.reviews.flatMap((r) => r.items.map((it) => ({ it, reviewId: r.id }))).filter(({ it }) => it.creator?.projectId === project.id);
      const slot = project.slots.find((s) => s.id === item.creator.slotId);
      let previous = slot.revisions.find((r) => r.id === item.creator.parentId);
      while (previous && !history.some(({ it }) => it.creator.revisionId === previous.id)) previous = slot.revisions.find((r) => r.id === previous.parentId);
      if (previous?.asset.type === "image") item.before.image = previous.asset.url;
      const same = history.filter(({ it }) => it.creator.revisionId === item.creator.revisionId).at(-1);
      if (same?.it.status === "approved") {
        item.status = "approved"; item.approvals = copy(same.it.approvals); item.decidedAt = same.it.decidedAt;
        item.needs = copy(same.it.needs); item.creator.reusedFromReviewId = same.reviewId;
      }
      for (const { it } of history) if (it.creator.slotId === item.creator.slotId && it.creator.language === item.creator.language && it.creator.revisionId !== item.creator.revisionId && ["pending", "changes"].includes(it.status)) it.superseded = true;
    }
    portal.reviews.push(review);
    (portal.events ||= []).push({ type: "sent", review: review.id, at: review.sentAt, creator: copy(review.creator) });
    return copy(review);
  });
}

/** Exact revision feedback for Creator. It never changes revision.review and never
 * transfers an older revision's approval or comments to a new candidate. Comments
 * from repeated reviews remain available; status comes from the latest review of
 * this exact revision. New, unsent candidates explicitly return status:'not_sent'.
 */
export async function creatorFeedback(store, ws, projectId) {
  const ps = createCreatorProjectStore(store);
  const project = await ps.getProject(ws, projectId);
  const portal = await store.getPortal(ws);
  const revisions = {};
  for (const slot of project.slots) {
    for (const revision of slot.revisions) revisions[revision.id] = { revisionId: revision.id, slotId: slot.id, language: revision.language, assetType: revision.asset.type, factStale:!!revision.factStale, status: "not_sent", comments: [], approvals: {}, reviewId: null, releaseId: null, sentAt: null, decidedAt: null };
  }
  const frozen = new Map();
  for (const release of project.releases) {
    if (release.status !== "approved" || release.ws !== ws || release.projectId !== project.id) continue;
    for (const slot of release.slots || []) for (const revision of slot.variants || []) frozen.set(`${release.id}:${revision.id}`, { slot, revision });
  }
  for (const review of portal.reviews || []) {
    for (const item of review.items || []) {
      const meta = item.creator;
      if (meta?.projectId !== project.id) continue;
      const snapshot = frozen.get(`${meta.releaseId}:${meta.revisionId}`), current = revisions[meta.revisionId];
      if (!snapshot || !current || meta.slotId !== snapshot.slot.id || meta.slotId !== current.slotId || meta.language !== snapshot.revision.language || meta.assetType !== snapshot.revision.asset.type || item.after?.images?.length !== 1 || item.after.images[0] !== snapshot.revision.asset.url) continue;
      if (!["pending", "approved", "changes"].includes(item.status)) continue;
      current.comments.push(...(item.comments || []).map((comment) => ({ ...copy(comment), reviewId: review.id, releaseId: meta.releaseId })));
      Object.assign(current, { status: item.status, approvals: copy(item.approvals || {}), reviewId: review.id, releaseId: meta.releaseId, sentAt: review.sentAt, decidedAt: item.decidedAt || null });
    }
  }
  return { projectId: project.id, revisions };
}
