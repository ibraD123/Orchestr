// Client portal: a private link per client brand, approvals with pinned comments, requests, the brand questionnaire.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyPortal, newReview, decide, newRequest, normaliseBrief, clientView, portalSummary, normaliseSettings, monthReport, library, waitingOn } from "../server/portal.mjs";

const PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("a review: the client approves, or asks for changes with pins on the image", () => {
  const p = emptyPortal();
  const r = newReview({ title: "Week 45", items: [{ key: "q1|oud", name: "Oud", before: { image: "/assets/a/b/c/0.jpg" }, after: { images: ["/assets/a/b/c/1.png", "/assets/a/b/c/2.png"], copy: { titleEn: "Oud", bulletsEn: "a\nb" } } }, { key: "empty", name: "x", after: { images: [] } }] });
  assert.equal(r.items.length, 1, "an item without images is dropped");
  assert.deepEqual(r.items[0].after.copy.bulletsEn, ["a", "b"]);
  p.reviews.push(r);
  assert.throws(() => decide(p, r.id, 0, { decision: "changes" }), /Say what to change/);
  decide(p, r.id, 0, { decision: "changes", comment: "Logo bigger", pins: [{ image: 9, x: 1.4, y: 0.2, text: "here" }, { image: 0, x: 0.1, y: 0.1, text: "" }], name: "Huda" });
  const it = p.reviews[0].items[0];
  assert.equal(it.status, "changes");
  assert.deepEqual(it.comments[0].pins, [{ image: 1, x: 1, y: 0.2, text: "here" }], "pins are clamped to the image and need text");
  assert.equal(it.comments[0].by, "Huda");
  decide(p, r.id, 0, { decision: "approve" });
  assert.equal(it.status, "approved");
  assert.equal(it.synced, false, "a new answer waits for the agency");
  assert.throws(() => decide(p, "nope", 0, { decision: "approve" }), (e) => e.status === 404);
  assert.throws(() => newReview({ items: [] }), /Nothing to send/);
  const s = portalSummary(p);
  assert.deepEqual([s.approved, s.unsynced, s.openComments], [1, 1, 1]);
});

test("requests and the questionnaire are cleaned up before they are stored", () => {
  const q = newRequest({ kind: "season", text: "Ramadan for 20 products", links: "https://noon.com/a  javascript:alert(1) https://noon.com/b", due: "2027-02-01" });
  assert.deepEqual(q.links, ["https://noon.com/a", "https://noon.com/b"]);
  assert.equal(q.status, "new");
  assert.equal(newRequest({ kind: "weird", text: "x" }).kind, "other");
  assert.throws(() => newRequest({}), /Describe the request/);
  const b = normaliseBrief({ name: "Layali", voice: "luxury", dialect: "klingon", colours: "#2A1A0E, red, #F2C88A", avoidWords: "رخيص، cheap\nbest", logo: "data:text/html;base64,AAAA" });
  assert.deepEqual(b.colours, ["#2A1A0E", "#F2C88A"]);
  assert.deepEqual(b.avoidWords, ["رخيص", "cheap", "best"]);
  assert.equal(b.dialect, null);
  assert.equal(b.logo, null, "only images are kept as a logo");
  const v = clientView({ ...emptyPortal(), brief: { ...b, logo: "data:image/png;base64,AA" } }, { brand: { name: "L" }, agency: { name: "A" } });
  assert.equal(v.brief.logo, true, "the logo isn't sent back to the page");
});

test("claims need the client's legal approver; reminders, the monthly package, report and library", () => {
  const p = emptyPortal();
  p.settings = normaliseSettings({ approvers: [{ name: "Huda", role: "marketing" }, { name: "Omar", role: "legal" }, { name: "", role: "legal" }], remindAfterDays: 2, monthlyFixes: "1" });
  assert.equal(p.settings.approvers.length, 2, "an approver needs a name");
  assert.equal(p.settings.monthlyFixes, 1);
  assert.equal(normaliseSettings({ remindAfterDays: 99 }, p.settings).remindAfterDays, 2, "out-of-range days keep the old value");
  const [huda, omar] = p.settings.approvers;
  const r = newReview({ items: [{ key: "q1|cream", name: "Cream", needsLegal: true, after: { images: ["/a.png"] } }, { key: "q2|oud", name: "Oud", after: { images: ["/b.png"] } }] }, "2026-11-01T10:00:00.000Z");
  p.reviews.push(r);
  decide(p, r.id, 0, { decision: "approve", approver: huda.id }, "2026-11-02T10:00:00.000Z");
  assert.equal(r.items[0].status, "pending", "marketing alone can't approve a product with claims");
  assert.equal(waitingOn(r.items[0], p.settings), "legal");
  decide(p, r.id, 0, { decision: "approve", approver: omar.id }, "2026-11-03T10:00:00.000Z");
  assert.equal(r.items[0].status, "approved");
  assert.equal(r.items[0].comments.length, 0);
  // Without a legal approver on the client's side, anyone's approval is enough.
  const q = emptyPortal(); q.reviews.push(newReview({ items: [{ key: "x", name: "X", needsLegal: true, after: { images: ["/c.png"] } }] }));
  decide(q, q.reviews[0].id, 0, { decision: "approve" });
  assert.equal(q.reviews[0].items[0].status, "approved");

  decide(p, r.id, 1, { decision: "approve", approver: huda.id }, "2026-11-04T10:00:00.000Z");
  const rep = monthReport(p, new Date("2026-11-20T00:00:00Z"));
  assert.deepEqual([rep.sent, rep.approved, rep.package.used, rep.package.over], [2, 2, 2, 1]);
  assert.equal(monthReport(p, new Date("2026-12-05T00:00:00Z")).approved, 0, "a new month starts from zero");
  assert.deepEqual(library(p).map((x) => x.name), ["Cream", "Oud"]);
  const view = clientView(p, { brand: {}, agency: {} }, new Date("2026-11-20T00:00:00Z"));
  assert.deepEqual(view.approvers.map((a) => a.role), ["marketing", "legal"]);
  assert.equal(view.reviews[0].items[0].needs.includes("legal"), true);

  const w = emptyPortal(); w.settings = normaliseSettings({ remindAfterDays: 3 });
  w.reviews.push(newReview({ items: [{ key: "k", name: "K", after: { images: ["/d.png"] } }] }, "2026-11-01T00:00:00.000Z"));
  assert.deepEqual([portalSummary(w, new Date("2026-11-02T12:00:00Z")).remind, portalSummary(w, new Date("2026-11-05T00:00:00Z")).remind, portalSummary(w, new Date("2026-11-05T00:00:00Z")).oldestPendingDays], [false, true, 4]);
});

let dir, server, base;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "basira-portal-"));
  process.env.BASIRA_DATA_DIR = dir;
  process.env.BASIRA_AUTH = "off";
  ({ server } = await import("../server/index.mjs"));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); const { closeRenderer } = await import("../server/render.mjs"); await closeRenderer(); await rm(dir, { recursive: true, force: true }); });
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const type = r.headers.get("content-type") || "";
  return { status: r.status, headers: r.headers, body: type.startsWith("application/json") ? await r.json() : await r.text() };
};

test("end to end: link, send, the client answers through the link, the agency sees it", async () => {
  const link = await call("POST", "/api/portal/layali/link", {});
  assert.equal(link.status, 200);
  const token = link.body.url.split("/c/")[1];
  assert.match(token, /^[A-Za-z0-9_-]{20,40}$/);
  const page = await call("GET", "/c/" + token);
  assert.equal(page.status, 200);
  assert.match(page.body, /<title>Approvals<\/title>/);
  assert.equal(page.headers.get("x-robots-tag"), "noindex");

  const sent = await call("POST", "/api/portal/layali/reviews", { title: "Week 45", items: [{ key: "q1|oud", name: "Oud", before: { image: PX }, after: { images: [PX, PX] } }] });
  assert.equal(sent.status, 200);
  const img = sent.body.items[0].after.images[0];
  assert.match(img, /^\/assets\/local\/layali\/review-[a-z0-9]+\/p0-after-0\.png$/);
  assert.equal((await fetch(base + img)).status, 200, "images are served to the client");

  const view = await call("GET", "/api/c/" + token);
  assert.equal(view.body.brand.name, "Layali Fragrances");
  assert.equal(view.body.reviews[0].items[0].status, "pending");
  const rid = view.body.reviews[0].id;
  const ans = await call("POST", `/api/c/${token}/reviews/${rid}/items/0`, { decision: "changes", comment: "Gold cap looks grey", pins: [{ image: 1, x: 0.5, y: 0.2, text: "cap colour" }], name: "Huda" });
  assert.equal(ans.status, 200);
  await call("POST", `/api/c/${token}/requests`, { kind: "season", text: "Ramadan pack", links: "https://www.noon.com/saudi-en/x/N1/p/" });
  await call("PUT", `/api/c/${token}/brief`, { name: "Layali", colours: "#2A1A0E", avoidWords: "cheap" });

  const agency = await call("GET", "/api/portal/layali");
  assert.equal(agency.body.url, link.body.url, "the agency can share the current link again");
  assert.equal(agency.body.link, undefined);
  assert.deepEqual([agency.body.summary.changes, agency.body.summary.openComments, agency.body.summary.newRequests, agency.body.summary.briefWaiting], [1, 1, 1, true]);
  await call("PATCH", `/api/portal/layali/reviews/${rid}/items/0`, { synced: true, resolve: "all" });
  await call("PATCH", `/api/portal/layali/requests/${agency.body.requests[0].id}`, { status: "inProgress" });
  await call("POST", "/api/portal/layali/brief/applied", {});
  const st = await call("PUT", "/api/portal/layali/settings", { approvers: [{ name: "Omar", role: "legal" }], monthlyFixes: 20 });
  assert.equal(st.body.monthlyFixes, 20);
  assert.equal((await call("GET", "/api/c/" + token)).body.approvers[0].role, "legal", "the client sees who approves");
  const after2 = await call("GET", "/api/portal/layali");
  assert.deepEqual([after2.body.summary.unsynced, after2.body.summary.openComments, after2.body.requests[0].status, after2.body.summary.briefWaiting], [0, 0, "inProgress", false]);

  // A new link replaces the old one; unknown links say so.
  await call("POST", "/api/portal/layali/link", {});
  assert.equal((await call("GET", "/api/c/" + token)).status, 404);
  assert.equal((await call("GET", "/api/c/short")).status, 404);
  assert.equal((await call("POST", `/api/c/${token}/requests`, { text: "x" })).status, 404);
  // The client data export carries the portal too (PDPL).
  const exp = await fetch(base + "/api/workspaces/layali/export").then((r) => r.json());
  assert.equal(exp.portal.requests.length, 1);
});

test("small fixes need the client's consent, library files, shared results", async () => {
  const { minorReview, newFile, normaliseResults } = await import("../server/portal.mjs");
  const p = emptyPortal();
  const items = [{ key: "q9|oud", name: "Oud", after: { images: ["/x.png"] } }];
  assert.throws(() => minorReview(p, { items }), (e) => e.status === 403);
  p.settings = normaliseSettings({ allowMinor: true });
  const r = minorReview(p, { items, note: "typo in the Arabic title" }, "2026-11-10T00:00:00.000Z");
  assert.deepEqual([r.minor, r.items[0].status, r.items[0].synced, r.items[0].approvals.any.by], [true, "approved", true, "agency"]);
  p.reviews.push(r);
  assert.equal(monthReport(p, new Date("2026-11-20T00:00:00Z")).minor, 1, "the client sees small fixes in their report");
  assert.equal(clientView(p, { brand: {}, agency: {} }).reviews[0].items[0].minor, true);
  assert.throws(() => newFile({ name: "x.svg", ext: "svg", size: 10 }), /PNG, JPEG, WebP or PDF/);
  assert.throws(() => newFile({ ext: "pdf", size: 11 * 1024 * 1024 }), /10 MB/);
  const res = normaliseResults({ period: "Oct → Nov", changed: { count: 5, convPts: 1.234, unitsPct: 12, salesPct: 15 }, control: { count: 3, convPts: 0.1 }, upliftPts: 1.13, products: [{ name: "Oud", convPts: 1.4, salesPct: "x" }] });
  assert.deepEqual([res.changed.convPts, res.products[0].salesPct, res.upliftPts], [1.23, null, 1.13]);
  assert.throws(() => normaliseResults({}), /compared results/);
});

test("end to end: files from both sides, results in the client's report", async () => {
  const link = await call("POST", "/api/portal/noor/link", {});
  const token = link.body.url.split("/c/")[1];
  const up = await call("POST", `/api/c/${token}/files`, { name: "brand-book.png", data: PX, by: "Huda" });
  assert.equal(up.status, 200);
  assert.match(up.body.url, /^\/assets\/local\/noor\/library-files\/f[a-z0-9]+\.png$/);
  assert.equal((await fetch(base + up.body.url)).status, 200);
  assert.equal((await call("POST", `/api/c/${token}/files`, { name: "x.html", data: "data:text/html;base64,AAAA" })).status, 400);
  await call("POST", "/api/portal/noor/files", { name: "logo.png", data: PX });
  await call("PUT", "/api/portal/noor/results", { changed: { count: 2, convPts: 0.9 }, control: { count: 2, convPts: 0.1 }, upliftPts: 0.8 });
  const view = await call("GET", "/api/c/" + token);
  assert.deepEqual(view.body.files.map((f) => f.by), ["agency", "Huda"]);
  assert.equal(view.body.results.upliftPts, 0.8);
  await call("DELETE", "/api/portal/noor/results");
  assert.equal((await call("GET", "/api/c/" + token)).body.results, null, "the agency can take results back");
  const minor = await call("POST", "/api/portal/noor/minor", { items: [{ key: "q1|x", name: "X", after: { images: [PX] } }] });
  assert.equal(minor.status, 403, "small fixes stay off until the client allows them");
  const del = await call("DELETE", `/api/portal/noor/files/${view.body.files[0].id}`);
  assert.equal(del.status, 200);
});
