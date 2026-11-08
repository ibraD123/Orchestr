// Amazon Selling Partner API (Saudi Arabia, UAE and Egypt sit on the EU endpoint).
// Product links use the Catalog Items API, which works for any ASIN.
// Store links use the Listings Items API, which only covers the connected seller account.
import { fetchJson, ConnectorError, safeFetch } from "./net.mjs";
import { makeListing } from "./normalise.mjs";

export function amazonConfig(env = process.env) {
  return {
    clientId: env.SPAPI_CLIENT_ID, clientSecret: env.SPAPI_CLIENT_SECRET, refreshToken: env.SPAPI_REFRESH_TOKEN,
    sellerId: env.SPAPI_SELLER_ID || null,
    endpoint: env.SPAPI_ENDPOINT || "https://sellingpartnerapi-eu.amazon.com",
    tokenUrl: env.SPAPI_TOKEN_URL || "https://api.amazon.com/auth/o2/token"
  };
}
export const amazonConfigured = (c = amazonConfig()) => Boolean(c.clientId && c.clientSecret && c.refreshToken);

let cached = { token: null, expires: 0, key: "" };
async function accessToken(c) {
  const key = c.clientId + c.refreshToken;
  if (cached.token && cached.key === key && Date.now() < cached.expires - 60_000) return cached.token;
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: c.refreshToken, client_id: c.clientId, client_secret: c.clientSecret });
  const r = await safeFetch(c.tokenUrl, { method: "POST", body: body.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, allowStatus: [400, 401] });
  const j = JSON.parse(r.body.toString("utf8") || "{}");
  if (!j.access_token) throw new ConnectorError(`Amazon sign-in failed: ${j.error_description || j.error || r.status}. Reconnect the Amazon account.`, 502);
  cached = { token: j.access_token, expires: Date.now() + (j.expires_in || 3600) * 1000, key };
  return j.access_token;
}

async function spapi(c, path, params) {
  const token = await accessToken(c);
  const url = `${c.endpoint}${path}?${new URLSearchParams(params)}`;
  return fetchJson(url, { headers: { "x-amz-access-token": token }, timeoutMs: 15_000 });
}

// Attribute values are arrays of { value, language_tag, marketplace_id }.
function attrText(attributes, name, lang) {
  const vals = (attributes && attributes[name]) || [];
  return vals.filter((v) => !lang || String(v.language_tag || "").toLowerCase().startsWith(lang)).map((v) => String(v.value || "").trim()).filter(Boolean);
}
function bestImages(imagesBlock, marketplaceId) {
  const set = (imagesBlock || []).find((b) => b.marketplaceId === marketplaceId) || (imagesBlock || [])[0];
  const byVariant = new Map();
  for (const im of (set && set.images) || []) {
    const prev = byVariant.get(im.variant);
    if (!prev || (im.width || 0) > (prev.width || 0)) byVariant.set(im.variant, im);
  }
  const order = (v) => (v === "MAIN" ? 0 : /^PT\d+$/.test(v) ? parseInt(v.slice(2), 10) : 99);
  return [...byVariant.values()].sort((a, b) => order(a.variant) - order(b.variant)).map((im) => ({ src: im.link, width: im.width, height: im.height }));
}

export function itemFromCatalog(item, marketplace, ar = null) {
  const attrs = item.attributes || {};
  const arAttrs = (ar && ar.attributes) || {};
  const titleEn = attrText(attrs, "item_name", "en")[0] || (item.summaries || []).map((s) => s.itemName).find((n) => n && !/[؀-ۿ]/.test(n)) || "";
  const titleAr = attrText(attrs, "item_name", "ar")[0] || attrText(arAttrs, "item_name", "ar")[0] || (ar && (ar.summaries || []).map((s) => s.itemName).find((n) => /[؀-ۿ]/.test(n || ""))) || "";
  const attributes = {};
  for (const [k, v] of Object.entries({ volume: "item_volume", material: "material", care: "care_instructions", weight: "item_weight", origin: "country_of_origin", ingredients: "ingredients", fit: "fit_type" })) if (attrs[v]) attributes[k] = "yes";
  const images = bestImages(item.images, marketplace.id);
  return {
    ref: item.asin, sku: item.asin, url: `https://www.amazon.${marketplace.country === "SA" ? "sa" : marketplace.country === "AE" ? "ae" : "eg"}/dp/${item.asin}`,
    name: titleEn || titleAr, image: images[0] && images[0].src,
    listing: makeListing({ channel: "amazon", titleEn, titleAr, bulletsEn: attrText(attrs, "bullet_point", "en"), bulletsAr: [...attrText(attrs, "bullet_point", "ar"), ...attrText(arAttrs, "bullet_point", "ar")], images, attributes })
  };
}

async function catalogItem(c, asin, marketplace, locale) {
  const params = { marketplaceIds: marketplace.id, includedData: "attributes,images,summaries" };
  if (locale) params.locale = locale;
  try { return await spapi(c, `/catalog/2022-04-01/items/${encodeURIComponent(asin)}`, params); }
  catch (e) { if (locale) return null; throw e; } // an unsupported locale shouldn't sink the whole import
}

export async function amazonProduct(asin, marketplace, c = amazonConfig()) {
  if (!amazonConfigured(c)) throw new ConnectorError("Connect an Amazon seller account to read Amazon listings (set SPAPI_CLIENT_ID, SPAPI_CLIENT_SECRET and SPAPI_REFRESH_TOKEN).", 503);
  const [en, ar] = await Promise.all([catalogItem(c, asin, marketplace, marketplace.locales[0]), catalogItem(c, asin, marketplace, marketplace.locales[1])]);
  const base = en || ar || (await catalogItem(c, asin, marketplace, null));
  return itemFromCatalog(base, marketplace, ar);
}

export async function amazonStore(sellerId, marketplace, { limit = 60 } = {}, c = amazonConfig()) {
  if (!amazonConfigured(c)) throw new ConnectorError("Connect an Amazon seller account to import a store (set SPAPI_CLIENT_ID, SPAPI_CLIENT_SECRET, SPAPI_REFRESH_TOKEN and SPAPI_SELLER_ID).", 503);
  const own = sellerId === c.sellerId || (!sellerId && c.sellerId);
  if (!own) throw new ConnectorError("Amazon only shares the full catalog of the connected seller account. For other stores, paste product links one by one.", 422);
  const items = [];
  let pageToken = null;
  do {
    const params = { marketplaceIds: marketplace.id, includedData: "summaries,attributes,issues", pageSize: "20" };
    if (pageToken) params.pageToken = pageToken;
    const page = await spapi(c, `/listings/2021-08-01/items/${encodeURIComponent(c.sellerId)}`, params);
    for (const it of page.items || []) {
      const s = (it.summaries || [])[0] || {};
      const fake = { asin: s.asin || it.sku, attributes: it.attributes, summaries: it.summaries, images: s.mainImage ? [{ marketplaceId: marketplace.id, images: [{ variant: "MAIN", link: s.mainImage.link, width: s.mainImage.width, height: s.mainImage.height }] }] : [] };
      const item = itemFromCatalog(fake, marketplace);
      item.ref = it.sku; item.sku = it.sku;
      item.marketplaceIssues = (it.issues || []).map((i) => ({ code: i.code, message: i.message, severity: i.severity }));
      items.push(item);
    }
    pageToken = page.pagination && page.pagination.nextToken;
  } while (pageToken && items.length < limit);
  return items.slice(0, limit);
}

/** Catalog search by keywords: the listings a buyer sees for a query (Catalog Items API). */
export async function amazonSearch(query, marketplace, { limit = 12 } = {}, c = amazonConfig()) {
  if (!amazonConfigured(c)) throw new ConnectorError("Connect an Amazon seller account to search Amazon", 503);
  const host = Object.keys(AMAZON_HOSTS).find((h) => AMAZON_HOSTS[h] === marketplace.id) || "amazon.sa";
  const j = await spapi(c, "/catalog/2022-04-01/items", { keywords: query, marketplaceIds: marketplace.id, includedData: "summaries,images", pageSize: String(Math.min(20, limit)), locale: marketplace.locales[0] });
  return (j.items || []).map((it) => {
    const s = (it.summaries || [])[0] || {};
    const imgs = bestImages(it.images, marketplace.id);
    return { sku: it.asin, title: s.itemName || it.asin, image: imgs[0] ? imgs[0].src : null, price: null, url: `https://www.${host}/dp/${it.asin}` };
  }).filter((x) => x.image).slice(0, limit);
}
const AMAZON_HOSTS = { "amazon.sa": "A17E79C6D8DWNP", "amazon.ae": "A2VIGQ35RCS4UG", "amazon.eg": "ARBP9OOSHTCHU" };

/* ---------- publishing approved content (Listings Items API, PATCH) ---------- */

/** JSON Patch for one listing: title and bullets in both languages, plus image links when hosted. */
export function listingPatches({ copy, images }, marketplace) {
  const c = copy || {};
  const [enTag, arTag] = marketplace.locales;
  const mk = (value, tag) => ({ value, language_tag: tag, marketplace_id: marketplace.id });
  const patches = [];
  const names = [c.titleEn && mk(c.titleEn, enTag), c.titleAr && mk(c.titleAr, arTag)].filter(Boolean);
  if (names.length) patches.push({ op: "replace", path: "/attributes/item_name", value: names });
  const bullets = (c.bulletsEn || []).slice(0, 5).map((b) => mk(b, enTag)).concat((c.bulletsAr || []).slice(0, 5).map((b) => mk(b, arTag))).filter((b) => b.value);
  if (bullets.length) patches.push({ op: "replace", path: "/attributes/bullet_point", value: bullets });
  const hosted = (images || []).filter((u) => /^https:\/\//.test(u)).slice(0, 9);
  hosted.forEach((u, i) => patches.push({
    op: "replace", path: "/attributes/" + (i === 0 ? "main_product_image_locator" : "other_product_image_locator_" + i),
    value: [{ media_location: u, marketplace_id: marketplace.id }]
  }));
  return patches;
}

async function spapiSend(c, method, path, params, body) {
  const token = await accessToken(c);
  const r = await safeFetch(`${c.endpoint}${path}?${new URLSearchParams(params)}`, {
    method, body: body ? JSON.stringify(body) : undefined, timeoutMs: 20_000, allowStatus: [400, 404],
    headers: { "x-amz-access-token": token, "Content-Type": "application/json", Accept: "application/json" }
  });
  let j = {};
  try { j = JSON.parse(r.body.toString("utf8") || "{}"); } catch { /* keep empty */ }
  return { status: r.status, body: j };
}

/**
 * Update one of the connected seller's listings. The product type is read from the live listing,
 * so the patch is validated against the right schema. Amazon answers ACCEPTED (queued) or INVALID with issues.
 * @returns {{ sku, status, submissionId?, issues: Array<{ code, message, severity }> }}
 */
export async function amazonPublish(item, marketplace, c = amazonConfig()) {
  if (!amazonConfigured(c) || !c.sellerId) throw new ConnectorError("Publishing to Amazon needs a connected seller account (SPAPI_CLIENT_ID, SPAPI_CLIENT_SECRET, SPAPI_REFRESH_TOKEN and SPAPI_SELLER_ID).", 503);
  const sku = String(item.sku || "").trim();
  if (!sku) throw new ConnectorError("Each product needs its seller SKU to publish to Amazon");
  const base = `/listings/2021-08-01/items/${encodeURIComponent(c.sellerId)}/${encodeURIComponent(sku)}`;
  const cur = await spapiSend(c, "GET", base, { marketplaceIds: marketplace.id, includedData: "summaries" });
  if (cur.status === 404) return { sku, status: "NOT_FOUND", issues: [{ code: "NOT_FOUND", message: "This SKU isn't in the connected seller account for this marketplace", severity: "ERROR" }] };
  const productType = cur.body.summaries && cur.body.summaries[0] && cur.body.summaries[0].productType;
  if (!productType) return { sku, status: "NOT_FOUND", issues: [{ code: "NO_PRODUCT_TYPE", message: "Amazon didn't return the product type for this SKU", severity: "ERROR" }] };
  const patches = listingPatches(item, marketplace);
  if (!patches.length) return { sku, status: "SKIPPED", issues: [] };
  const r = await spapiSend(c, "PATCH", base, { marketplaceIds: marketplace.id, issueLocale: "en_US" }, { productType, patches });
  const issues = (r.body.issues || (r.body.errors || []).map((e) => ({ code: e.code, message: e.message, severity: "ERROR" }))).map((i) => ({ code: i.code, message: i.message, severity: i.severity }));
  return { sku, status: r.body.status || (r.status >= 400 ? "INVALID" : "ACCEPTED"), submissionId: r.body.submissionId, issues };
}
