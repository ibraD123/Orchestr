// End-to-end API checks against a real server on a temporary data folder.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readZip } from "../server/zip.mjs";

const PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
let dir, server, base, closeRenderer, rendererAvailable;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "basira-api-"));
  process.env.BASIRA_DATA_DIR = dir;
  process.env.BASIRA_AUTH = "off"; // single-tenant mode; accounts are covered in auth.test.mjs
  ({ server } = await import("../server/index.mjs"));
  ({ closeRenderer, rendererAvailable } = await import("../server/render.mjs"));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await closeRenderer(); await rm(dir, { recursive: true, force: true }); });

const api = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const type = r.headers.get("content-type") || "";
  return { status: r.status, type, headers: r.headers, body: type.startsWith("application/json") ? await r.json() : Buffer.from(await r.arrayBuffer()) };
};

test("health reports what is configured", async () => {
  const h = await api("GET", "/api/health");
  assert.equal(h.status, 200);
  for (const k of ["render", "ai", "imageGen", "billing", "amazonPublish"]) assert.equal(typeof h.body[k], "boolean", k);
  assert.equal(h.body.billing, false);
  assert.equal(h.body.imageGen, false);
});

test("with a workspace, the audit checks the copy against that brand's rules", async () => {
  const listing = { channel: "noon", category: "fragrance", titleEn: "Best Oud Perfume 100ml for Men and Women!", titleAr: "عطر عود ١٠٠ مل", bulletsEn: ["Lasts all day"], bulletsAr: ["ثبات طوال اليوم"] };
  const plain = await api("POST", "/api/audit", { listing });
  assert.equal(plain.status, 200);
  assert.equal(plain.body.brand, undefined, "no workspace, no brand check");
  const r = await api("POST", "/api/audit", { listing, ws: "layali" });
  assert.equal(r.status, 200);
  const types = r.body.brand.issues.map((i) => i.detail.type);
  assert.ok(types.includes("avoidWord"), "Layali learned to avoid «best»");
  assert.ok(types.includes("noExclamation"));
  assert.ok(r.body.brand.score < 100);
  assert.equal((await api("POST", "/api/audit", { listing, ws: "nope" })).status, 404);
});

test("approvals count as fixes against the plan", async () => {
  let a = await api("GET", "/api/account");
  assert.equal(a.body.plan, "trial"); assert.equal(a.body.used, 0); assert.equal(a.body.limit, 20);
  await api("GET", "/api/workspaces");
  await api("POST", "/api/brand/layali/events", { events: [{ type: "approve", product: "oud" }, { type: "edit", product: "oud" }, { type: "approve", product: "musk" }] });
  a = await api("GET", "/api/account");
  assert.equal(a.body.used, 2); assert.equal(a.body.left, 18);
  assert.ok(a.body.plans.some((p) => p.id === "agency" && p.amountWithVat === 171350));
});

test("agency profile for reports is validated", async () => {
  const ok = await api("PUT", "/api/account/agency", { name: "Dar Agency", colour: "#7A2E1F", logo: PX });
  assert.equal(ok.body.agency.name, "Dar Agency");
  const bad = await api("PUT", "/api/account/agency", { name: "x", logo: "javascript:alert(1)" });
  assert.equal(bad.status, 400);
});

test("payments explain what is missing; unknown invoices can't change the plan", async () => {
  const c = await api("POST", "/api/billing/checkout", { plan: "agency" });
  assert.equal(c.status, 503);
  assert.match(c.body.error, /MOYASAR_SECRET_KEY/);
  assert.equal((await api("POST", "/api/billing/checkout", { plan: "enterprise" })).status, 400);
  assert.equal((await api("GET", "/api/billing/verify?id=inv_forged123")).status, 404);
});

test("export renders slides, hosts them and packs upload files into a ZIP", { timeout: 120000 }, async (t) => {
  if (!(await rendererAvailable())) return t.skip("Chromium not available");
  const r = await api("POST", "/api/export", {
    ws: "layali", channel: "amazon", client: "Layali Fragrances",
    style: { language: "both", numerals: "arabic", brand: "LAYALI", kit: { bg: "#2A1A0E", fg: "#F4E9D8", accent: "#F2C88A" } },
    items: [
      { sku: "OUD-100", name: "Oud", image: PX, copy: { titleEn: "Oud Al Layl EDP 100ml", titleAr: "عطر عود الليل ١٠٠ مل", bulletsEn: ["Lasts 12 hours"], bulletsAr: ["يدوم ١٢ ساعة"] }, slides: [{ template: "benefit", fields: { headEn: "Oud Al Layl", headAr: "عود الليل" } }], extraImages: [PX] },
      { sku: "MUSK/50 ml", name: "Musk", image: PX, copy: { titleEn: "Musk Tahara 50ml" }, slides: [] }
    ]
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.rendered, 1);
  assert.equal(r.body.hosted, false, "localhost isn't a public image host");
  assert.deepEqual(r.body.items[0].images.map((u) => u.split("/").slice(-2).join("/")), ["OUD-100/01.png", "OUD-100/02.png"]);
  const img = await fetch(r.body.items[0].images[0].replace(/^https?:\/\/[^/]+/, base));
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/png");
  const z = await api("GET", r.body.zipUrl);
  assert.equal(z.status, 200);
  assert.match(z.headers.get("content-disposition"), /attachment/);
  const names = readZip(new Uint8Array(z.body)).map((f) => f.name);
  for (const n of ["images/OUD-100/01.png", "images/OUD-100/02.png", "amazon-flat-file-en.txt", "amazon-flat-file-ar.txt", "README.txt"]) assert.ok(names.includes(n), n);
  const flat = Buffer.from(readZip(new Uint8Array(z.body)).find((f) => f.name === "amazon-flat-file-en.txt").data).toString();
  assert.match(flat, /OUD-100\tPartialUpdate\tOud Al Layl EDP 100ml\tLasts 12 hours/);
  assert.match(flat, /MUSK\/50 ml\tPartialUpdate\tMusk Tahara 50ml/);
  assert.equal((await api("GET", r.body.zipUrl.replace(/\/[^/]+$/, "/manifest.json"))).status, 404, "manifest isn't served");
  assert.equal((await api("GET", "/assets/layali/../../account.json")).status, 404);
  const pub = await api("POST", "/api/publish/amazon", { ws: "layali", batch: r.body.batch, marketplace: "amazon.sa" });
  assert.equal(pub.status, 503);
  assert.match(pub.body.error, /SPAPI_SELLER_ID/);
  const a = await api("GET", "/api/account");
  assert.ok(a.body.renders >= 1);
});

test("a bad slide in the batch is refused before anything is rendered", async () => {
  const r = await api("POST", "/api/export", { ws: "layali", channel: "noon", items: [{ sku: "X1", image: PX, slides: [{ template: "nope" }] }] });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /X1/);
});

test("PDF report under the agency's logo", { timeout: 60000 }, async (t) => {
  if (!(await rendererAvailable())) return t.skip("Chromium not available");
  const { compareResults } = await import("../server/results.mjs");
  const row = (key, sessions, units) => ({ key, sessions, units, sales: units * 100, views: null, orders: null, conversion: null, returns: null, date: null });
  const result = compareResults({ before: [row("A", 1000, 20), row("B", 1000, 30)], after: [row("A", 1000, 35), row("B", 1000, 31)], changed: ["A"] });
  const r = await api("POST", "/api/report/pdf", { result, client: "Layali", agency: { name: "Dar Agency", colour: "#7A2E1F", logo: PX }, lang: "ar", period: "Oct 2026" });
  assert.equal(r.status, 200);
  assert.equal(r.type, "application/pdf");
  assert.equal(r.body.subarray(0, 5).toString(), "%PDF-");
});

test("a client's data can be exported, consent recorded, and everything deleted", async () => {
  const ws = (await api("POST", "/api/workspaces", { name: "Temp Client" })).body;
  await api("POST", `/api/brand/${ws.id}/events`, { events: [{ type: "edit", product: "p1", before: "a", after: "b" }] });
  const p = await api("PATCH", `/api/workspaces/${ws.id}`, { consentTraining: true });
  assert.equal(p.body.consentTraining, true);
  const ex = await api("GET", `/api/workspaces/${ws.id}/export`);
  assert.equal(ex.status, 200);
  assert.match(ex.headers.get("content-disposition"), /attachment/);
  const data = JSON.parse(ex.body.toString());
  assert.equal(data.workspace.id, ws.id); assert.equal(data.events.length, 1); assert.ok(data.genome);
  const d = await api("DELETE", `/api/workspaces/${ws.id}`);
  assert.equal(d.body.deleted, ws.id);
  assert.equal((await api("GET", `/api/brand/${ws.id}`)).status, 404);
  assert.ok(!(await api("GET", "/api/workspaces")).body.some((w) => w.id === ws.id));
});

test("AI drafting stops at the plan limit; approvals keep working", async () => {
  await api("POST", "/api/brand/layali/events", { events: Array.from({ length: 20 }, (_, i) => ({ type: "approve", product: "p" + i })) });
  const a = await api("GET", "/api/account");
  assert.equal(a.body.over, true);
  const c = await api("POST", "/api/copy", { ws: "layali" });
  assert.equal(c.status, 402);
  const g = await api("POST", "/api/imagegen/onmodel", { image: PX });
  assert.equal(g.status, 402);
});
