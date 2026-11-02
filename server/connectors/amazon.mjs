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
