// Basira HTTP server: serves the site and app, plus the JSON/PNG API.
import { createServer } from "node:http";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";
import { auditListing } from "./audit.mjs";
import { auditBrand } from "./brand-dna.mjs";
import { renderSlide, renderPdf, rendererAvailable, normaliseSpec } from "./render.mjs";
import { analyseReviews, draftReply, aiConfigured } from "./reviews.mjs";
import { llmModelName, llmProvider } from "./llm.mjs";
import { keywordCoverage } from "./keywords.mjs";
import { safeFetch } from "./connectors/net.mjs";
import { importLink, importCsv, connectorStatus } from "./importer.mjs";
import { reviewPhotos } from "./photo.mjs";
import { createStore, safeName, StoreError } from "./store.mjs";
import { createAuth } from "./auth.mjs";
import { analyseBrand, writeCopy } from "./brand-ai.mjs";
import { exportFiles, exportReadme, EXPORT_CHANNELS } from "./exports.mjs";
import { makeZip } from "./zip.mjs";
import { reportHTML } from "./report.mjs";
import { PLANS, newAccount, recordUsage, usageStatus, invoiceAmount, billingConfigured, applyPayment } from "./billing.mjs";
import { createCheckout, verifyCheckout } from "./payments.mjs";
import { generateOnModel, imageGenConfigured, imageProvider, imageProviders } from "./imagegen.mjs";
import { generateSlide, slideGenConfigured } from "./slidegen.mjs";
import { labelPng } from "./ai-label.mjs";
import { analyseCompetitors } from "./gallery.mjs";
import { searchMarketplace } from "./connectors/search.mjs";
import { templateById } from "./templates.mjs";
import { amazonPublish, amazonConfig, amazonConfigured } from "./connectors/amazon.mjs";
import { AMAZON_MARKETPLACES } from "./connectors/link.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Keys from a local .env file (not committed), only when this file is the program being run, so
// tests that import the server never pick up real keys. Variables already set in the environment win.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(join(ROOT, ".env")); } catch { /* no .env: use the environment as it is */ }
}
const DATA = process.env.BASIRA_DATA_DIR || join(ROOT, "data");
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 30 * 1024 * 1024;
const STATIC = { "/": "index.html", "/index.html": "index.html", "/app": "app.html", "/app.html": "app.html" };
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".zip": "application/zip" };

const fail = (message, status = 400) => { throw new StoreError(message, status); };

function send(res, status, body, type = "application/json", headers = {}) {
  const data = type === "application/json" ? JSON.stringify(body) : body;
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
  res.end(data);
}

/** A handler can answer with a file instead of JSON. */
const file = (data, type, name) => ({ $file: { data, type, name } });

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) { const e = new Error("Request body is too large"); e.status = 413; throw e; }
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { const e = new Error("Body must be JSON"); e.status = 400; throw e; }
}

/** Public origin of this server: PUBLIC_URL when set (behind a proxy), else the request's host. */
function origin(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  return `${proto}://${req.headers.host || "localhost:" + PORT}`;
}
// Marketplaces fetch image links themselves, so they must be public https.
const isPublic = (o) => /^https:\/\//.test(o) && !/\/\/(localhost|127\.|10\.|192\.168\.)/.test(o);

/* ---------- accounts and sign-in ---------- */

// Accounts are on unless BASIRA_AUTH=off (a single-tenant server for local work: one agency, no sign-in).
export const AUTH = process.env.BASIRA_AUTH !== "off";
const auth = createAuth(DATA);
const stores = new Map();
/** Each account's data lives in its own folder; with accounts off, everything sits in DATA as before. */
function storeFor(key, type) {
  if (!stores.has(key)) stores.set(key, AUTH ? createStore(join(DATA, "accounts", key), { seed: type !== "brand" }) : createStore(DATA));
  return stores.get(key);
}

const COOKIE = "basira_session";
function readCookie(req) {
  const m = new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)").exec(req.headers.cookie || "");
  return m ? decodeURIComponent(m[1]) : null;
}
function sessionCookie(req, token) {
  const secure = origin(req).startsWith("https://") ? "; Secure" : "";
  return `${COOKIE}=${token ? encodeURIComponent(token) : ""}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${token ? 30 * 86400 : 0}${secure}`;
}
/** A handler that signs someone in or out answers with a cookie as well as JSON. */
const withCookie = (cookie, body) => ({ $cookie: cookie, body });
// Cross-site requests can't carry the session cookie (SameSite=Lax); a foreign Origin is refused as well.
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try {
    const u = new URL(o);
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
    return u.host === host || (process.env.PUBLIC_URL && u.origin === new URL(process.env.PUBLIC_URL).origin);
  } catch { return false; }
}
const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

/** Who is asking and which account's data they work on. */
async function context(req, url) {
  if (!AUTH) {
    const store = storeFor("local");
    const a = await store.getAccount(newAccount);
    return { req, url, key: "local", store, user: null, account: { id: "local", type: a.type === "brand" ? "brand" : "agency", name: (a.agency && a.agency.name) || "" } };
  }
  const s = await auth.session(readCookie(req));
  if (!s) return { req, url, key: null, store: null, user: null, account: null };
  return { req, url, key: s.account.id, store: storeFor(s.account.id, s.account.type), user: s.user, account: s.account };
}

/* ---------- plan and usage ---------- */

const account = (store) => store.getAccount(newAccount);
const meter = (store, kind, n = 1) => (n > 0 ? store.updateAccount(newAccount, (a) => { recordUsage(a, kind, n); }) : null);
/** AI drafting and generated photos stop at the plan limit; approvals, exports and learning never do. */
async function guardPlan(store) {
  const s = usageStatus(await account(store));
  if (s.over) fail(`All ${s.limit} fixes in this month's plan are used. Upgrade in Settings → Plan to keep drafting with AI.`, 402);
}

function accountView(a, ctx) {
  const plans = Object.entries(PLANS).map(([id, p]) => ({ id, name: p.name, priceSar: p.priceSar, fixes: p.fixes, clients: p.clients, amountWithVat: invoiceAmount(id) }));
  return {
    ...usageStatus(a), billing: billingConfigured(), plans, agency: a.agency || null, invoices: (a.invoices || []).slice(-10).reverse(),
    type: ctx.account.type, accountName: ctx.account.name, role: ctx.user ? ctx.user.role : "owner", auth: AUTH
  };
}

const SAFE_COLOUR = /^#[0-9a-fA-F]{6}$/;
const SAFE_LOGO = /^data:image\/(?:(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+|svg\+xml(?:;utf8)?,[^"<>]+)$/;

/* ---------- export: render slides, host them, pack upload files ---------- */

const EXTRA_IMAGE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;

async function buildExport(body, ctx) {
  const { req, store, key } = ctx;
  const ws = String(body.ws || "");
  const channel = EXPORT_CHANNELS.includes(body.channel) ? body.channel : fail(`channel must be one of ${EXPORT_CHANNELS.join(", ")}`);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) fail("Pick at least one approved product to export");
  if (items.length > 50) fail("Export up to 50 products at a time");
  await store.getGenome(ws); // the workspace must exist
  const slidesTotal = items.reduce((s, it) => s + (Array.isArray(it.slides) ? it.slides.length : 0), 0);
  if (slidesTotal && !(await rendererAvailable())) fail("Slide rendering needs Chromium on the server", 503);
  const style = body.style || {};
  // Batch style, then the product's (its colour kit), then the slide's own (seasonal templates bring their kit).
  const specOf = (it, sl) => ({ ...style, ...(it.style || {}), ...("kit" in sl ? { kit: sl.kit } : {}), template: sl.template, fields: sl.fields, image: sl.image || it.image });
  // Check every slide first, so a typo in product 40 doesn't leave a half-rendered batch.
  for (const it of items) for (const sl of (Array.isArray(it.slides) ? it.slides : []).slice(0, 9)) {
    try { normaliseSpec(specOf(it, sl)); } catch (e) { fail(`${it.sku || it.name || "A product"}: ${e.message}`); }
  }
  const now = new Date();
  const batch = now.toISOString().slice(0, 10) + "-" + randomBytes(8).toString("hex");
  const base = `${origin(req)}/assets/${key}/${ws}/${batch}/images/`;
  const hosted = isPublic(origin(req));
  const zipFiles = [];
  const manifest = { batch, channel, client: String(body.client || "").slice(0, 80), createdAt: now.toISOString(), imageBase: base, hosted, items: [] };
  const used = new Set();
  let rendered = 0;
  for (const it of items) {
    let folder = safeName(it.sku || it.name);
    while (used.has(folder)) folder += "-2";
    used.add(folder);
    const images = [];
    for (const [i, sl] of (Array.isArray(it.slides) ? it.slides : []).slice(0, 9).entries()) {
      const png = await renderSlide(specOf(it, sl));
      const rel = `${folder}/${String(i + 1).padStart(2, "0")}.png`;
      await store.saveAsset(ws, batch, "images/" + rel, png);
      zipFiles.push({ name: "images/" + rel, data: png });
      images.push(rel); rendered++;
    }
    const aiPeople = [];
    for (const x of (Array.isArray(it.extraImages) ? it.extraImages : []).slice(0, 9 - images.length)) {
      // An extra image is a data URL, or { src, aiPeople } for a generated image that shows people.
      const src = x && typeof x === "object" ? x.src : x;
      const m = EXTRA_IMAGE.exec(String(src || ""));
      if (!m) continue;
      let data = Buffer.from(m[2], "base64");
      if (x && x.aiPeople && m[1] === "png") data = labelPng(data);
      const rel = `${folder}/${String(images.length + 1).padStart(2, "0")}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
      await store.saveAsset(ws, batch, "images/" + rel, data);
      zipFiles.push({ name: "images/" + rel, data });
      images.push(rel);
      if (x && x.aiPeople) aiPeople.push(rel);
    }
    const copy = it.copy || {};
    manifest.items.push({ sku: String(it.sku || folder), name: String(it.name || ""), asin: it.asin || null, handle: it.handle || null, copy: { titleEn: copy.titleEn || "", titleAr: copy.titleAr || "", bulletsEn: copy.bulletsEn || [], bulletsAr: copy.bulletsAr || [] }, images, aiPeople });
  }
  const files = exportFiles(channel, manifest.items, { imageBase: hosted ? base : "" });
  for (const f of files) zipFiles.push({ name: f.name, data: f.content });
  const labelled = manifest.items.flatMap((x) => (x.aiPeople || []).map((r) => "images/" + r));
  zipFiles.push({ name: "README.txt", data: exportReadme(channel, manifest.items.length, { client: manifest.client, at: now, imageBase: hosted ? base : "", aiPeople: labelled }) });
  const zipName = `basira-${channel}-${safeName(manifest.client || ws)}-${now.toISOString().slice(0, 10)}.zip`;
  await store.saveAsset(ws, batch, zipName, Buffer.from(makeZip(zipFiles, now)));
  manifest.zip = zipName;
  await store.saveAsset(ws, batch, "manifest.json", JSON.stringify(manifest));
  await meter(store, "renders", rendered);
  return {
    batch, hosted, zipUrl: `/assets/${key}/${ws}/${batch}/${zipName}`, files: files.map((f) => f.name).concat(["README.txt"]),
    items: manifest.items.map((x) => ({ sku: x.sku, images: x.images.map((r) => base + r) })), rendered
  };
}

async function publishAmazon(body, { store }) {
  const mk = AMAZON_MARKETPLACES[String(body.marketplace || "amazon.sa").replace(/^www\./, "")] || fail("marketplace must be amazon.sa, amazon.ae or amazon.eg");
  const c = amazonConfig();
  if (!amazonConfigured(c) || !c.sellerId) fail("Publishing to Amazon needs a connected seller account (SPAPI_CLIENT_ID, SPAPI_CLIENT_SECRET, SPAPI_REFRESH_TOKEN and SPAPI_SELLER_ID).", 503);
  let items, imagesIncluded = false;
  if (body.batch) {
    const m = await store.getManifest(String(body.ws || ""), String(body.batch));
    imagesIncluded = m.hosted;
    items = m.items.map((x) => ({ sku: x.sku, copy: x.copy, images: m.hosted ? x.images.map((r) => m.imageBase + r) : [] }));
  } else {
    items = (Array.isArray(body.items) ? body.items : []).map((x) => ({ sku: x.sku, copy: x.copy || {}, images: [] }));
  }
  if (!items.length) fail("Nothing to publish");
  const results = [];
  for (const it of items.slice(0, 50)) {
    try { results.push(await amazonPublish(it, mk, c)); }
    catch (e) { results.push({ sku: it.sku, status: "ERROR", issues: [{ code: "ERROR", message: e.message, severity: "ERROR" }] }); }
  }
  return { marketplace: mk.country, imagesIncluded, results };
}

/* ---------- routes ---------- */

// Routes with ids in the path.
// [method, pattern, handler(match, body, ctx), public?]
const paramRoutes = [
  ["GET", /^\/api\/brand\/([a-z0-9-]+)$/, (m, body, { store }) => store.getGenome(m[1])],
  ["PUT", /^\/api\/brand\/([a-z0-9-]+)$/, (m, body, { store }) => store.putGenome(m[1], body.genome, body.baseVersion)],
  ["GET", /^\/api\/brand\/([a-z0-9-]+)\/events$/, (m, body, { store, url }) => store.listEvents(m[1], { product: url.searchParams.get("product") || undefined })],
  ["POST", /^\/api\/brand\/([a-z0-9-]+)\/events$/, async (m, body, { store }) => {
    const r = await store.appendEvents(m[1], body.events);
    // A "fix" is a product whose copy or slides were approved.
    const fixes = (Array.isArray(body.events) ? body.events : [body.events]).filter((e) => e && e.type === "approve").length;
    await meter(store, "fixes", fixes);
    return r;
  }],
  ["PATCH", /^\/api\/workspaces\/([a-z0-9-]+)$/, (m, body, { store }) => store.updateWorkspace(m[1], body)],
  ["DELETE", /^\/api\/workspaces\/([a-z0-9-]+)$/, (m, body, { store }) => store.deleteWorkspace(m[1])],
  ["GET", /^\/api\/workspaces\/([a-z0-9-]+)\/export$/, async (m, body, { store }) => file(JSON.stringify(await store.exportWorkspace(m[1]), null, 2), "application/json", `basira-${m[1]}-data.json`)],
  ["DELETE", /^\/api\/team\/([a-z0-9]+)$/, (m, body, ctx) => { if (!AUTH) fail("Teams need accounts on this server", 404); return auth.removeMember(ctx.account.id, ctx.user, m[1]); }],
  // Hosted export files: images marketplaces fetch by link, and the ZIP. Public on purpose: account and batch ids are long and random.
  ["GET", /^\/assets\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]{8,64})\/((?:images\/[A-Za-z0-9._-]+\/)?[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpg|webp|zip))$/, async (m) => {
    const known = AUTH ? await auth.accountExists(m[1]) : m[1] === "local";
    if (!known) fail("Not found", 404);
    const ext = extname(m[4]);
    return file(await storeFor(m[1]).readAsset(m[2], m[3], m[4]), TYPES[ext], ext === ".zip" ? m[4] : null);
  }, true]
];

// Routes anyone can call; everything else needs a signed-in user when accounts are on.
const PUBLIC = new Set(["GET /api/health", "POST /api/leads", "POST /api/auth/signup", "POST /api/auth/login", "POST /api/auth/logout", "GET /api/auth/me", "GET /api/auth/invite", "POST /api/auth/join"]);

const routes = {
  "GET /api/workspaces": async (body, { store }) => store.listWorkspaces(),
  "POST /api/workspaces": async (body, { store }) => store.createWorkspace(body),
  "POST /api/brand/analyze": async (body, { store }) => { await guardPlan(store); const r = await analyseBrand(body); await meter(store, "ai"); return r; },
  "POST /api/copy": async (body, { store }) => { await guardPlan(store); const r = await writeCopy(body); await meter(store, "ai"); return r; },
  "GET /api/health": async () => {
    const c = amazonConfig();
    return {
      ok: true, render: await rendererAvailable(), ai: aiConfigured(), model: llmModelName(), llm: llmProvider(),
      imageGen: imageGenConfigured(), imageProvider: imageGenConfigured() ? imageProvider() : null, imageProviders: imageProviders().map((p) => p.name), slideGen: slideGenConfigured(),
      billing: billingConfigured(), amazonPublish: amazonConfigured(c) && Boolean(c.sellerId), amazonSearch: amazonConfigured(c),
      publicUrl: Boolean(process.env.PUBLIC_URL), auth: AUTH
    };
  },
  // With a workspace, the audit also checks the listing's copy against that brand's rules.
  "POST /api/audit": async (body, { store }) => {
    const listing = body.listing || body, r = auditListing(listing);
    if (body.ws) r.brand = auditBrand(await store.getGenome(String(body.ws)), listing);
    return r;
  },
  "POST /api/reviews/analyze": async (body, { store }) => { const r = await analyseReviews(body); if (aiConfigured()) await meter(store, "ai"); return r; },
  "POST /api/reviews/reply": async (body, { store }) => { const r = await draftReply(body); await meter(store, "ai"); return r; },
  "POST /api/keywords": async (body) => keywordCoverage(body.listing || body),
  "POST /api/fetch-image": async (body) => {
    const r = await safeFetch(String(body.url || ""), { maxBytes: 8_000_000, headers: { Accept: "image/png,image/jpeg,image/webp" } });
    const type = (r.headers.get("content-type") || "").split(";")[0];
    if (!/^image\/(png|jpeg|webp)$/.test(type)) fail("That link isn't a PNG, JPEG or WebP image");
    return { dataUrl: `data:${type};base64,${r.body.toString("base64")}` };
  },
  "POST /api/photos/review": async (body) => reviewPhotos(body),
  "GET /api/connectors": async () => connectorStatus(),
  "POST /api/import": async (body) => importLink(String(body.url || ""), { limit: Math.min(Number(body.limit) || 60, 200) }),
  "POST /api/import/csv": async (body) => importCsv(String(body.csv || ""), { channel: body.channel, category: body.category, measure: Boolean(body.measure) }),
  "POST /api/leads": async (body) => {
    const lead = {
      name: String(body.name || "").slice(0, 120), whatsapp: String(body.whatsapp || "").slice(0, 40),
      store: String(body.store || "").slice(0, 300), lang: body.lang === "ar" ? "ar" : "en", at: new Date().toISOString()
    };
    if (!lead.name || !lead.whatsapp || !lead.store) fail("name, whatsapp and store are required");
    await mkdir(DATA, { recursive: true });
    await appendFile(join(DATA, "leads.jsonl"), JSON.stringify(lead) + "\n");
    return { ok: true };
  },

  "POST /api/export": async (body, ctx) => buildExport(body, ctx),
  "POST /api/publish/amazon": async (body, ctx) => publishAmazon(body, ctx),
  "POST /api/report/pdf": async (body) => {
    if (!body.result || !Array.isArray(body.result.products)) fail("Send the compared results");
    if (!(await rendererAvailable())) fail("PDF reports need Chromium on the server", 503);
    const pdf = await renderPdf(reportHTML(body));
    return file(pdf, "application/pdf", `results-${safeName(body.client || "report")}.pdf`);
  },

  "GET /api/account": async (body, ctx) => accountView(await account(ctx.store), ctx),
  // Agency or single brand, and the account's name. With accounts on, only the owner may change them.
  "PATCH /api/account": async (body, ctx) => {
    if (AUTH) ctx.account = await auth.updateAccount(ctx.account.id, ctx.user, { type: body.type, name: body.name });
    else if (body.type != null) {
      if (!["agency", "brand"].includes(body.type)) fail("Choose agency or brand");
      await ctx.store.updateAccount(newAccount, (a) => { a.type = body.type; });
      ctx.account = { ...ctx.account, type: body.type };
    }
    return accountView(await account(ctx.store), ctx);
  },
  "PUT /api/account/agency": async (body, ctx) => {
    const agency = { name: String(body.name || "").trim().slice(0, 80), colour: SAFE_COLOUR.test(body.colour || "") ? body.colour : null, logo: null };
    if (body.logo) {
      if (!SAFE_LOGO.test(String(body.logo)) || String(body.logo).length > 1_500_000) fail("The logo must be a PNG, JPEG, WebP or SVG under 1 MB");
      agency.logo = body.logo;
    }
    return accountView(await ctx.store.updateAccount(newAccount, (a) => { a.agency = agency; }), ctx);
  },
  "POST /api/billing/checkout": async (body, { req, store, key }) => {
    const plan = String(body.plan || "");
    if (!PLANS[plan] || !invoiceAmount(plan)) fail("That plan is arranged with sales, not paid online");
    const inv = await createCheckout(plan, { callbackUrl: `${origin(req)}/app?billing=return`, account: key });
    await store.updateAccount(newAccount, (a) => { (a.invoices = a.invoices || []).push({ id: inv.id, plan, amount: inv.amount, status: inv.status || "initiated", at: new Date().toISOString(), applied: false }); });
    return inv;
  },
  "GET /api/billing/verify": async (body, ctx) => {
    const { url, store } = ctx;
    const id = String(url.searchParams.get("id") || "");
    const a = await account(store);
    // Only invoices this server created can change the plan, and each one only once.
    if (!(a.invoices || []).some((x) => x.id === id)) fail("Unknown invoice", 404);
    const v = await verifyCheckout(id);
    const after = await store.updateAccount(newAccount, (acc) => {
      const rec = acc.invoices.find((x) => x.id === id);
      rec.status = v.status;
      if (v.paid && !rec.applied && v.amount === rec.amount) { applyPayment(acc, rec.plan); rec.applied = true; rec.paidAt = new Date().toISOString(); }
    });
    return { ...v, account: accountView(after, ctx) };
  },

  // A slide drawn whole by the image model, shown only after its text is read back and matches (server/slidegen.mjs).
  "POST /api/slides/generate": async (body, { store }) => {
    if (!templateById(body.template)) fail("Unknown slide template");
    if (!slideGenConfigured()) fail("Generated slides need an image model (IMAGE_PROVIDER, IMAGE_API_KEY) and ANTHROPIC_API_KEY for the text check", 503);
    await guardPlan(store);
    const r = await generateSlide(body);
    await meter(store, "ai", r.attempts.length);
    await meter(store, "renders", 1);
    return r;
  },
  // Creator: the listings a buyer sees for a query, and what competitors' galleries show.
  "POST /api/creator/search": async (body) => searchMarketplace(body),
  "POST /api/creator/gallery": async (body, { store }) => {
    if (!aiConfigured()) fail("Reading competitor galleries needs FAL_KEY or ANTHROPIC_API_KEY on the server", 503);
    await guardPlan(store);
    const r = await analyseCompetitors(body);
    await meter(store, "ai", r.competitors.filter((c) => c.kinds.length).length);
    return r;
  },
  "POST /api/imagegen/onmodel": async (body, { store }) => {
    await guardPlan(store);
    const r = await generateOnModel(body);
    await meter(store, "ai"); await meter(store, "renders", r.images.length);
    return r;
  },

  /* sign-in, accounts, teams */
  "GET /api/auth/me": async (body, ctx) => {
    if (!AUTH) return { auth: false, user: null, account: ctx.account };
    if (!ctx.user) fail("Not signed in", 401);
    return { auth: true, user: ctx.user, account: ctx.account };
  },
  "POST /api/auth/signup": async (body, { req }) => {
    if (!AUTH) fail("Accounts are off on this server (BASIRA_AUTH=off)", 404);
    const r = await auth.signup(body);
    const store = storeFor(r.account.id, r.account.type);
    // A brand starts with its own brand as the one workspace; an agency gets two sample clients to try things on.
    if (r.account.type === "brand") await store.createWorkspace({ name: r.account.name });
    await store.updateAccount(newAccount, (a) => { a.type = r.account.type; a.agency = { name: r.account.name, colour: null, logo: null }; });
    return withCookie(sessionCookie(req, r.token), { auth: true, user: r.user, account: r.account });
  },
  "POST /api/auth/login": async (body, { req }) => {
    if (!AUTH) fail("Accounts are off on this server (BASIRA_AUTH=off)", 404);
    const r = await auth.login(body, clientIp(req));
    return withCookie(sessionCookie(req, r.token), { auth: true, user: r.user, account: r.account });
  },
  "POST /api/auth/logout": async (body, { req }) => withCookie(sessionCookie(req, null), await auth.logout(readCookie(req))),
  "GET /api/auth/invite": async (body, { url }) => (AUTH ? auth.inviteInfo(url.searchParams.get("code")) : { valid: false }),
  "POST /api/auth/join": async (body, { req }) => {
    if (!AUTH) fail("Accounts are off on this server (BASIRA_AUTH=off)", 404);
    const r = await auth.join(body);
    return withCookie(sessionCookie(req, r.token), { auth: true, user: r.user, account: r.account });
  },
  "GET /api/team": async (body, ctx) => (AUTH ? { members: await auth.members(ctx.account.id), canInvite: ctx.user.role === "owner" } : { members: [], canInvite: false, off: true }),
  "POST /api/team/invite": async (body, ctx) => {
    if (!AUTH) fail("Teams need accounts on this server", 404);
    const inv = await auth.createInvite(ctx.account.id, ctx.user);
    return { ...inv, url: `${origin(ctx.req)}/app?invite=${encodeURIComponent(inv.code)}` };
  }
};

export const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) fail("Cross-site request refused", 403);
    const signedIn = (ctx) => { if (!ctx.store) fail("Sign in to continue", 401); };
    if (req.method === "POST" && url.pathname === "/api/render") {
      const ctx = await context(req, url);
      signedIn(ctx);
      const png = await renderSlide(await readJson(req));
      await meter(ctx.store, "renders");
      return send(res, 200, png, "image/png");
    }
    let out, matched = false;
    for (const [method, re, fn, isPublic] of paramRoutes) {
      const m = req.method === method && re.exec(url.pathname);
      if (m) {
        matched = true;
        const ctx = isPublic ? { req, url } : await context(req, url);
        if (!isPublic) signedIn(ctx);
        out = await fn(m, method === "GET" || method === "DELETE" ? {} : await readJson(req), ctx);
        break;
      }
    }
    if (!matched) {
      const key = `${req.method} ${url.pathname}`;
      const handler = routes[key];
      if (handler) {
        matched = true;
        const ctx = await context(req, url);
        if (!PUBLIC.has(key)) signedIn(ctx);
        out = await handler(req.method === "GET" ? {} : await readJson(req), ctx);
      }
    }
    if (matched) {
      if (out && out.$cookie) return send(res, 200, out.body, "application/json", { "Set-Cookie": out.$cookie });
      if (out && out.$file) {
        const f = out.$file;
        const headers = f.name ? { "Content-Disposition": `attachment; filename="${f.name.replace(/[^\w.-]/g, "_")}"` } : { "Cache-Control": "public, max-age=31536000, immutable" };
        return send(res, 200, f.data, f.type, headers);
      }
      return send(res, 200, out);
    }
    if (req.method === "GET" && STATIC[url.pathname]) {
      const f = normalize(join(ROOT, STATIC[url.pathname]));
      return send(res, 200, await readFile(f), TYPES[extname(f)] || "application/octet-stream");
    }
    send(res, 404, { error: "Not found" });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    send(res, status, { error: status >= 500 && !err.status ? "Something went wrong on the server" : err.message });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`Basira running at http://localhost:${PORT}  (app: /app)`));
}
