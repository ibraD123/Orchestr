import { createHash } from "node:crypto";
import { auditListing } from "./audit.mjs";
import { StoreError, safeName } from "./store.mjs";
import { createCreatorProjectStore } from "./creator-projects.mjs";
import { creatorFeedback, sendCreatorRelease } from "./creator-portal.mjs";
import { makeZip, readZip } from "./zip.mjs";

const fail = (message, status = 400) => { throw new StoreError(message, status); };
const str = (v, max = 500) => String(v ?? "").trim().slice(0, max);
const csvCell = (v) => '"' + String(v ?? "").replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"';
export function normaliseCatalogProduct(input, ws) {
  if (!input?.listing || typeof input.listing !== "object") fail("Each product needs listing data");
  if (Buffer.byteLength(JSON.stringify(input)) > 100_000) fail("Product data is too large", 413);
  const raw = input.listing;
  const channel = ["noon", "amazon", "salla", "zid"].includes(raw.channel) ? raw.channel : "noon";
  const sku = str(input.sku || input.ref, 120);
  if (!sku) fail("Each imported product needs a SKU");
  const listing = { channel, category: str(raw.category, 80), titleEn: str(raw.titleEn, 1000), titleAr: str(raw.titleAr, 1000),
    bulletsEn: (Array.isArray(raw.bulletsEn) ? raw.bulletsEn : []).slice(0, 12).map((x) => str(x, 1000)),
    bulletsAr: (Array.isArray(raw.bulletsAr) ? raw.bulletsAr : []).slice(0, 12).map((x) => str(x, 1000)),
    images: (Array.isArray(raw.images) ? raw.images : []).slice(0, 12).filter((x) => /^https:\/\//.test(x.src || "")).map((x) => ({ src: str(x.src, 2048) })),
    attributes: raw.attributes && typeof raw.attributes === "object" && !Array.isArray(raw.attributes) ? structuredClone(raw.attributes) : {}, sizeChart: Boolean(raw.sizeChart) };
  if (!listing.titleEn && !listing.titleAr) fail(`Add a title for ${sku}`);
  const audit = auditListing(listing);
  const id = "cat" + createHash("sha256").update(`${ws}\0${channel}\0${sku}`).digest("hex").slice(0, 20);
  const image = /^https:\/\//.test(input.image || "") ? str(input.image, 2048) : listing.images[0]?.src || null;
  return { id, ws, sku, name: [listing.titleEn || listing.titleAr, listing.titleAr || listing.titleEn], ch: [channel], category: listing.category,
    imported: true, listing, image, url: /^https:\/\//.test(input.url || "") ? str(input.url, 2048) : null,
    score: audit.score, target: Math.min(95, audit.score + 30), br: audit.breakdown, issues: audit.issues.map((i) => i.key), issueDetails: audit.issues,
    imgs: listing.images.length, rating: Number(input.rating) || 0, rev: Number(input.reviews) || 0, themes: [], quotes: [], sym: "box", color: "#8C6A3F",
    st: { headEn: listing.titleEn, headAr: listing.titleAr, bEn: listing.bulletsEn.join("\n"), bAr: listing.bulletsAr.join("\n"), kit: 0 }, updatedAt: new Date().toISOString() };
}

export function catalogRoutes({ exportRelease }) {
  return {
    "POST /api/catalog": async (body, ctx) => {
      const ws = String(body.ws || ""); await ctx.store.getGenome(ws);
      if (body.action === "upsert") {
        if (!Array.isArray(body.items) || !body.items.length || body.items.length > 500) fail("Import 1–500 products per batch");
        const incoming = body.items.map((p) => normaliseCatalogProduct(p, ws));
        if (new Set(incoming.map((p) => p.id)).size !== incoming.length) fail("The file contains duplicate SKUs for the same channel");
        return ctx.store.updateCatalog(ws, (c) => {
          const map = new Map(c.products.map((p) => [p.id, p]));
          incoming.forEach((p) => map.set(p.id, p));
          if (map.size > 5000) fail("Client catalog limit is 5000 products", 413);
          c.products = [...map.values()]; c.version++; return c;
        });
      }
      const catalog = await ctx.store.getCatalog(ws);
      if (body.action === "list") return catalog;
      if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 200 || new Set(body.ids).size !== body.ids.length) fail("Select 1–200 distinct products");
      const products = body.ids.map((id) => catalog.products.find((p) => p.id === id) || fail("Product does not belong to this client", 404));
      if (body.action === "export") {
        const columns = ["partner_sku", "channel", "title_en", "title_ar", "category", "attributes_json", "size_chart", ...Array.from({length:12}, (_,i) => `bullet_${i+1}`), ...Array.from({length:12}, (_,i) => `bullet_${i+1}_ar`), ...Array.from({length:12}, (_,i) => `image_${i+1}`)];
        const rows = [columns];
        products.forEach((p) => rows.push([p.sku, p.ch[0], p.listing.titleEn, p.listing.titleAr, p.category, JSON.stringify(p.listing.attributes), p.listing.sizeChart ? "true" : "", ...Array.from({length:12},(_,i)=>p.listing.bulletsEn[i]||""), ...Array.from({length:12},(_,i)=>p.listing.bulletsAr[i]||""), ...Array.from({length:12},(_,i)=>p.listing.images[i]?.src||(i===0?p.image:"")||"")]));
        return { $file: { data: "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"), type: "text/csv; charset=utf-8", name: "basira-catalog.csv" } };
      }
      const ps = createCreatorProjectStore(ctx.store, { assetPrefix: `/assets/${ctx.key}/` });
      if (body.action === "projects") {
        const results = [];
        for (const p of products) {
          try {
            const matches = (await ps.listProjects(ws)).filter((x) => x.sku === p.sku);
            const existing = matches.length === 1 ? matches[0] : null;
            if (matches.length > 1) fail("Several creative projects use this SKU. Choose the project in Creator before creating a batch.",409);
            if (existing && existing.channel !== p.ch[0]) fail("This SKU already has a project for another channel; open it in Creator to review the destination", 409);
            if (existing) { results.push({ sku: p.sku, projectId: existing.id, status: "existing" }); continue; }
            const created = await ps.createProject(ws, { sku: p.sku, catalogProductId: p.id, name: p.name[0], category: p.category, channel: p.ch[0], placement: "gallery",
              product: { facts: [], sources: p.image ? [{ url: p.image, type: "image" }] : [] },
              slots: [{ kind: "main", languages: ["none"], aspect: "1:1", layout: "clean", style: { background: "#ffffff", textDensity: "none" } },
                ...["benefit", "details"].map((kind) => ({ kind, languages: ["en", "ar"], aspect: "4:5", layout: "hero", style: { tone: "minimal" } }))] });
            results.push({ sku: p.sku, projectId: created.id, status: "created" });
          } catch (e) { results.push({ sku: p.sku, status: "failed", error: e.message }); }
        }
        return { results };
      }
      if (!["review", "assets"].includes(body.action)) fail("Unknown catalog operation");
      const releases = [];
      for (const p of products) {
        const candidates = (await ps.listProjects(ws)).filter((x) => x.sku === p.sku);
        if(candidates.length>1) fail(`Several projects use ${p.sku}; use a named client batch to select exact projects`,409);
        const summary = candidates[0];
        if (!summary) fail(`Create a Creator project for ${p.sku}`, 409);
        const project = await ps.getProject(ws, summary.id), release = project.releases.at(-1);
        if (!release) fail(`Create an approved release for ${p.sku}`, 409);
        releases.push({ project, release });
      }
      if (body.action === "review") {
        const results = [];
        for (const { project, release } of releases) {
          try { const r = await sendCreatorRelease(ctx, { ws, projectId: project.id, releaseId: release.id }); results.push({ sku: project.sku, reviewId: r.id, status: "prepared" }); }
          catch (e) { results.push({ sku: project.sku, status: "failed", error: e.message }); }
        }
        return { results };
      }
      const files = []; let totalBytes=0;
      for (const { project, release } of releases) {
        if (project.slots.some((s) => s.languages.some((lang) => !release.slots.find((old) => old.id === s.id)?.variants.some((r) => r.id === s.selected[lang])))) fail(`The current versions in ${project.sku} have changed; prepare a new release`, 409);
        const feedback = await creatorFeedback(ctx.store, ws, project.id);
        if (release.slots.some((s) => s.variants.some((r) => feedback.revisions[r.id]?.status !== "approved"))) fail(`Client approval is required for every file in ${project.sku}`, 409);
        const out = await exportRelease({ ws, projectId: project.id, releaseId: release.id }, ctx);
        for (const entry of readZip(out.$file.data)) { totalBytes+=entry.data.length; if(totalBytes>100_000_000) fail("Select a smaller batch: ZIP source files exceed 100 MB",413); files.push({ name: `${safeName(project.sku)}-${project.id}/${entry.name}`, data: entry.data }); }
      }
      return { $file: { data: Buffer.from(makeZip(files)), type: "application/zip", name: "basira-client-approved.zip" } };
    }
  };
}
