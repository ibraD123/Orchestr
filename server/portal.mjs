// The client portal: one private link per client brand, no sign-in. The client sees what the agency
// sent for approval (before and after), approves it or asks for changes with comments pinned to a
// spot on an image, sends requests ("a Ramadan pack for 20 products"), and fills in the brand
// questionnaire that seeds Brand DNA. Pure functions; the server stores the result per workspace.

export const REQUEST_KINDS = ["season", "newProducts", "fix", "other"];
export const REQUEST_STATUS = ["new", "inProgress", "done"];
export const ROLES = ["marketing", "legal", "owner"];
const MAX = { reviewItems: 30, images: 12, comment: 1500, pins: 20, requestText: 2000, links: 20, words: 30 };

const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const id = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e; };

export function emptyPortal() { return { reviews: [], requests: [], brief: null, events: [], settings: defaultSettings() }; }
export function defaultSettings() { return { approvers: [], remindAfterDays: 3, monthlyFixes: null, allowMinor: false }; }

/**
 * Who approves for the client, when to remind them, and how many fixes the monthly package holds.
 * approvers: [{ name, role: marketing | legal | owner }]. A product with health or other regulated
 * claims needs a "legal" approver as well when the client has one.
 */
export function normaliseSettings(b, prev) {
  const base = Object.assign(defaultSettings(), prev || {});
  const approvers = Array.isArray(b.approvers) ? b.approvers.slice(0, 10).map((a) => ({ id: str(a.id, 20) || id("a"), name: str(a.name, 80), role: ROLES.includes(a.role) ? a.role : "marketing" })).filter((a) => a.name) : base.approvers;
  const days = Number(b.remindAfterDays);
  const fixes = b.monthlyFixes === null || b.monthlyFixes === "" ? null : Number(b.monthlyFixes);
  return {
    approvers,
    remindAfterDays: Number.isFinite(days) && days >= 1 && days <= 30 ? Math.round(days) : base.remindAfterDays,
    monthlyFixes: b.monthlyFixes === undefined ? base.monthlyFixes : Number.isFinite(fixes) && fixes > 0 ? Math.round(fixes) : null,
    // The client agreed that small fixes (a typo, a digit, a word) go live without their approval.
    allowMinor: typeof b.allowMinor === "boolean" ? b.allowMinor : base.allowMinor
  };
}

/**
 * A package the agency sends for approval. Images are already stored; here they are URLs.
 * @param {{ title?, items: Array<{ key, name, before: { image?, copy? }, after: { images: string[], copy? } }> }} input
 */
export function newReview(input, at = new Date().toISOString()) {
  const items = (input && Array.isArray(input.items) ? input.items : []).slice(0, MAX.reviewItems).map((it) => ({
    key: str(it.key, 80), name: str(it.name, 200),
    before: { image: it.before && it.before.image ? str(it.before.image, 500) : null, copy: copyOf(it.before && it.before.copy) },
    after: { images: (it.after && Array.isArray(it.after.images) ? it.after.images : []).slice(0, MAX.images).map((u) => str(u, 500)), copy: copyOf(it.after && it.after.copy) },
    // "legal" means the product carries claims (health, certificates) that the client's legal approver must see.
    needs: it.needsLegal ? ["any", "legal"] : ["any"], approvals: {},
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
  const settings = Object.assign(defaultSettings(), portal.settings || {});
  const approver = settings.approvers.find((a) => a.id === body.approver);
  const who = approver ? approver.name : str(body.name, 80) || "Client";
  if (text || pins.length) it.comments.push({ id: id("c"), by: who, role: approver ? approver.role : null, text, pins, at, resolved: false });
  if (decision === "changes") { it.status = "changes"; it.decidedAt = at; it.synced = false; }
  if (decision === "approved") {
    // Every approval the item needs: anyone for "any"; a legal approver for "legal", when the client has one.
    it.approvals = it.approvals || {};
    it.approvals.any = { by: who, at };
    if (approver && approver.role === "legal") it.approvals.legal = { by: who, at };
    const hasLegal = settings.approvers.some((a) => a.role === "legal");
    const needs = (it.needs || ["any"]).filter((n) => n !== "legal" || hasLegal);
    if (needs.every((n) => it.approvals[n])) { it.status = "approved"; it.decidedAt = at; it.synced = false; }
  }
  portal.events.push({ type: decision || "comment", review: r.id, item: it.key, at });
  return it;
}

/**
 * Small fixes the agency made without the client's approval, when the client allowed it.
 * They are recorded as approved by the agency, so the client still sees them in the report and library.
 */
export function minorReview(portal, input, at = new Date().toISOString()) {
  const settings = Object.assign(defaultSettings(), portal.settings || {});
  if (!settings.allowMinor) fail("This client hasn't allowed small fixes without approval. Turn it on in the portal settings first.", 403);
  const r = newReview({ ...input, title: str(input.title, 120) || "Small fixes" }, at);
  r.minor = true;
  for (const it of r.items) { it.status = "approved"; it.decidedAt = at; it.synced = true; it.minor = true; it.approvals = { any: { by: "agency", at } }; it.note = str(input.note, 300); }
  return r;
}

export const FILE_TYPES = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" };
/** A file in the client's library, uploaded by the client or the agency. The bytes are stored separately. */
export function newFile({ name, ext, by, size }, at = new Date().toISOString()) {
  if (!FILE_TYPES[ext]) fail("Upload a PNG, JPEG, WebP or PDF");
  if (size > 10 * 1024 * 1024) fail("Files up to 10 MB");
  return { id: id("f"), name: str(name, 120) || "file." + ext, ext, by: str(by, 80) || "Client", at, size };
}

/** The sales result the agency shares with the client: changed products against the control group. */
export function normaliseResults(b, at = new Date().toISOString()) {
  const grp = (g) => g && typeof g === "object" ? { count: Math.max(0, Math.round(Number(g.count) || 0)), convPts: num(g.convPts), unitsPct: num(g.unitsPct), salesPct: num(g.salesPct) } : null;
  if (!b || !grp(b.changed)) fail("Send the compared results");
  return {
    period: str(b.period, 80), at,
    changed: grp(b.changed), control: grp(b.control), upliftPts: num(b.upliftPts),
    products: (Array.isArray(b.products) ? b.products : []).slice(0, 12).map((p) => ({ name: str(p.name || p.key, 120), convPts: num(p.convPts), unitsPct: num(p.unitsPct), salesPct: num(p.salesPct), verdict: str(p.verdict, 20) }))
  };
}
const num = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);

/** What still waits on someone: "legal" when only the legal approval is missing. */
export function waitingOn(it, settings) {
  if (it.status !== "pending") return null;
  const hasLegal = (settings && settings.approvers || []).some((a) => a.role === "legal");
  if (it.approvals && it.approvals.any && (it.needs || []).includes("legal") && hasLegal && !(it.approvals.legal)) return "legal";
  return "any";
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
export function clientView(portal, { brand, agency }, now = new Date()) {
  const settings = Object.assign(defaultSettings(), portal.settings || {});
  return {
    brand, agency,
    approvers: settings.approvers.map((a) => ({ id: a.id, name: a.name, role: a.role })),
    report: monthReport(portal, now),
    library: library(portal),
    files: (portal.files || []).slice().reverse().map((f) => ({ id: f.id, name: f.name, ext: f.ext, by: f.by, at: f.at, url: f.url })),
    results: portal.results || null,
    reviews: portal.reviews.slice(-20).reverse().map((r) => ({ id: r.id, title: r.title, sentAt: r.sentAt, items: r.items.map((it) => ({ key: it.key, name: it.name, before: it.before, after: it.after, status: it.status, decidedAt: it.decidedAt, comments: it.comments, needs: it.needs || ["any"], approvals: it.approvals || {}, waitingOn: waitingOn(it, settings), minor: Boolean(it.minor) })) })),
    requests: portal.requests.slice(-30).reverse(),
    brief: portal.brief ? { ...portal.brief, logo: portal.brief.logo ? true : null } : null
  };
}

/** This month for the client: what was sent, approved, waits, and how much of the package is used. */
export function monthReport(portal, now = new Date()) {
  const month = now.toISOString().slice(0, 7);
  const items = portal.reviews.flatMap((r) => r.items.map((it) => ({ ...it, sentAt: r.sentAt })));
  const inMonth = (d) => String(d || "").slice(0, 7) === month;
  const approved = items.filter((i) => i.status === "approved" && inMonth(i.decidedAt));
  const limit = (portal.settings && portal.settings.monthlyFixes) || null;
  return {
    month,
    sent: items.filter((i) => inMonth(i.sentAt)).length,
    approved: approved.length,
    waiting: items.filter((i) => i.status === "pending").length,
    changes: items.filter((i) => i.status === "changes").length,
    requestsOpen: portal.requests.filter((q) => q.status !== "done").length,
    requestsDone: portal.requests.filter((q) => q.status === "done" && inMonth(q.doneAt || q.at)).length,
    minor: approved.filter((i) => i.minor).length,
    package: limit ? { limit, used: approved.length, over: Math.max(0, approved.length - limit) } : null,
    recent: approved.slice(-8).reverse().map((i) => ({ name: i.name, image: i.after.images[0] || null, at: i.decidedAt }))
  };
}

/** Everything the client approved, newest first: the images they can reuse anywhere. */
export function library(portal) {
  return portal.reviews.slice().reverse().flatMap((r) => r.items.filter((it) => it.status === "approved").map((it) => ({ name: it.name, at: it.decidedAt, images: it.after.images }))).slice(0, 60);
}

/** Counts for the agency: what waits on the client, what the client answered and hasn't been handled. */
export function portalSummary(portal, now = new Date()) {
  const items = portal.reviews.flatMap((r) => r.items.map((it) => ({ ...it, sentAt: r.sentAt })));
  const settings = Object.assign(defaultSettings(), portal.settings || {});
  const pending = items.filter((i) => i.status === "pending");
  const oldest = pending.reduce((m, i) => Math.min(m, new Date(i.sentAt).getTime()), Infinity);
  const days = Number.isFinite(oldest) ? Math.floor((now.getTime() - oldest) / 86400000) : 0;
  return {
    oldestPendingDays: days,
    remind: pending.length > 0 && days >= settings.remindAfterDays,
    waitingLegal: pending.filter((i) => waitingOn(i, settings) === "legal").length,
    report: monthReport(portal, now),
    waiting: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    changes: items.filter((i) => i.status === "changes").length,
    unsynced: items.filter((i) => i.status !== "pending" && !i.synced).length,
    openComments: items.reduce((n, i) => n + i.comments.filter((c) => !c.resolved).length, 0),
    newRequests: portal.requests.filter((q) => q.status === "new").length,
    briefWaiting: Boolean(portal.brief && !portal.brief.appliedAt)
  };
}
