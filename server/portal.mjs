// The client portal: one private link per client brand, no sign-in. The client sees what the agency
// sent for approval (before and after), approves it or asks for changes with comments pinned to a
// spot on an image, sends requests ("a Ramadan pack for 20 products"), and fills in the brand
// questionnaire that seeds Brand DNA. Pure functions; the server stores the result per workspace.

export const REQUEST_KINDS = ["season", "newProducts", "fix", "other"];
export const REQUEST_STATUS = ["new", "inProgress", "done"];
const MAX = { reviewItems: 30, images: 12, comment: 1500, pins: 20, requestText: 2000, links: 20, words: 30 };

const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const id = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e; };

export function emptyPortal() { return { reviews: [], requests: [], brief: null, events: [] }; }

/**
 * A package the agency sends for approval. Images are already stored; here they are URLs.
 * @param {{ title?, items: Array<{ key, name, before: { image?, copy? }, after: { images: string[], copy? } }> }} input
 */
export function newReview(input, at = new Date().toISOString()) {
  const items = (input && Array.isArray(input.items) ? input.items : []).slice(0, MAX.reviewItems).map((it) => ({
    key: str(it.key, 80), name: str(it.name, 200),
    before: { image: it.before && it.before.image ? str(it.before.image, 500) : null, copy: copyOf(it.before && it.before.copy) },
    after: { images: (it.after && Array.isArray(it.after.images) ? it.after.images : []).slice(0, MAX.images).map((u) => str(u, 500)), copy: copyOf(it.after && it.after.copy) },
    status: "pending", comments: [], decidedAt: null, synced: false
  })).filter((it) => it.key && it.after.images.length);
  if (!items.length) fail("Nothing to send: add products with images first");
  return { id: id("r"), title: str(input.title, 120) || "For approval", sentAt: at, items };
}
function copyOf(c) {
  if (!c || typeof c !== "object") return null;
  const lines = (v) => (Array.isArray(v) ? v : String(v || "").split("\n")).map((x) => str(x, 300)).filter(Boolean).slice(0, 8);
  return { titleEn: str(c.titleEn, 300), titleAr: str(c.titleAr, 300), bulletsEn: lines(c.bulletsEn), bulletsAr: lines(c.bulletsAr) };
}

/**
 * The client's answer on one item: approve, or ask for changes with a comment and pins.
 * A pin is { image: index, x, y } in 0..1 of the image, with its own text.
 */
export function decide(portal, reviewId, index, body, at = new Date().toISOString()) {
  const r = portal.reviews.find((x) => x.id === reviewId);
  if (!r) fail("That review no longer exists", 404);
  const it = r.items[Number(index)];
  if (!it) fail("Unknown item", 404);
  const decision = body.decision === "approve" ? "approved" : body.decision === "changes" ? "changes" : body.decision === "comment" ? null : fail("Choose approve or changes");
  const pins = (Array.isArray(body.pins) ? body.pins : []).slice(0, MAX.pins).map((p) => ({
    image: Math.max(0, Math.min(it.after.images.length - 1, Math.floor(Number(p.image) || 0))),
    x: clamp01(p.x), y: clamp01(p.y), text: str(p.text, 300)
  })).filter((p) => p.text);
  const text = str(body.comment, MAX.comment);
  if (decision === "changes" && !text && !pins.length) fail("Say what to change, or pin a comment on the image");
  if (text || pins.length) it.comments.push({ id: id("c"), by: str(body.name, 80) || "Client", text, pins, at, resolved: false });
  if (decision) { it.status = decision; it.decidedAt = at; it.synced = false; }
  portal.events.push({ type: decision || "comment", review: r.id, item: it.key, at });
  return it;
}
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

/** A request from the client: a season pack, new products, a fix, anything. */
export function newRequest(body, at = new Date().toISOString()) {
  const kind = REQUEST_KINDS.includes(body.kind) ? body.kind : "other";
  const text = str(body.text, MAX.requestText);
  const links = (Array.isArray(body.links) ? body.links : String(body.links || "").split(/\s+/)).map((l) => str(l, 500)).filter((l) => /^https?:\/\//.test(l)).slice(0, MAX.links);
  if (!text && !links.length) fail("Describe the request or add product links");
  const due = /^\d{4}-\d{2}-\d{2}$/.test(String(body.due || "")) ? body.due : null;
  return { id: id("q"), kind, text, links, due, by: str(body.name, 80) || "Client", at, status: "new" };
}

const HEX = /^#[0-9a-f]{6}$/i;
const DATA_IMG = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
/** The brand questionnaire the client fills in once; the agency turns it into Brand DNA. */
export function normaliseBrief(b, at = new Date().toISOString()) {
  const words = (v) => (Array.isArray(v) ? v : String(v || "").split(/[,\n،]+/)).map((w) => str(w, 40)).filter(Boolean).slice(0, MAX.words);
  const logo = b && typeof b.logo === "string" && DATA_IMG.test(b.logo) && b.logo.length <= 1_500_000 ? b.logo : null;
  return {
    name: str(b.name, 80), nameAr: str(b.nameAr, 80),
    about: str(b.about, 1500), audience: str(b.audience, 600),
    voice: ["formal", "friendly", "playful", "luxury"].includes(b.voice) ? b.voice : null,
    dialect: ["gulf", "msa", "egyptian", "levantine"].includes(b.dialect) ? b.dialect : null,
    languages: ["both", "ar", "en"].includes(b.languages) ? b.languages : "both",
    numerals: ["arabic", "western"].includes(b.numerals) ? b.numerals : null,
    colours: (Array.isArray(b.colours) ? b.colours : String(b.colours || "").split(/[\s,]+/)).filter((c) => HEX.test(c)).slice(0, 6),
    useWords: words(b.useWords), avoidWords: words(b.avoidWords),
    claims: str(b.claims, 800), examples: str(b.examples, 1500),
    logo, at, appliedAt: null
  };
}

/** What the client sees: no internal notes, no other clients, comments marked resolved when the agency fixed them. */
export function clientView(portal, { brand, agency }) {
  return {
    brand, agency,
    reviews: portal.reviews.slice(-20).reverse().map((r) => ({ id: r.id, title: r.title, sentAt: r.sentAt, items: r.items.map((it) => ({ key: it.key, name: it.name, before: it.before, after: it.after, status: it.status, decidedAt: it.decidedAt, comments: it.comments })) })),
    requests: portal.requests.slice(-30).reverse(),
    brief: portal.brief ? { ...portal.brief, logo: portal.brief.logo ? true : null } : null
  };
}

/** Counts for the agency: what waits on the client, what the client answered and hasn't been handled. */
export function portalSummary(portal) {
  const items = portal.reviews.flatMap((r) => r.items);
  return {
    waiting: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    changes: items.filter((i) => i.status === "changes").length,
    unsynced: items.filter((i) => i.status !== "pending" && !i.synced).length,
    openComments: items.reduce((n, i) => n + i.comments.filter((c) => !c.resolved).length, 0),
    newRequests: portal.requests.filter((q) => q.status === "new").length,
    briefWaiting: Boolean(portal.brief && !portal.brief.appliedAt)
  };
}
