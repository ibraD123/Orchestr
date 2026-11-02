// Shopify storefronts publish their catalog as JSON at /products.json (no API key needed).
// Stores selling in the Gulf often serve an Arabic translation under /ar/.
import { fetchJson, ConnectorError } from "./net.mjs";
import { htmlToText, bulletsFromHtml, hasArabic, makeListing } from "./normalise.mjs";

async function tryJson(url) {
  try { return await fetchJson(url, { timeoutMs: 10_000 }); } catch { return null; }
}

export async function isShopify(origin) {
  const j = await tryJson(`${origin}/products.json?limit=1`);
  return Boolean(j && Array.isArray(j.products));
}

function toItem(p, ar, origin, channel) {
  const titleEn = hasArabic(p.title) ? "" : p.title || "";
  const titleAr = hasArabic(p.title) ? p.title : ar && hasArabic(ar.title) ? ar.title : "";
  const bodyEn = hasArabic(htmlToText(p.body_html)) ? "" : p.body_html;
  const bodyAr = hasArabic(htmlToText(p.body_html)) ? p.body_html : ar && hasArabic(htmlToText(ar.body_html)) ? ar.body_html : "";
  const images = (p.images || []).map((im) => ({ width: im.width || undefined, height: im.height || undefined, src: im.src }));
  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
  const optionNames = (p.options || []).map((o) => String(o.name || "").toLowerCase());
  const attributes = {};
  if (p.product_type) attributes.type = p.product_type;
  if (optionNames.some((o) => /size|مقاس/.test(o))) attributes.fit = "size options";
  if (optionNames.some((o) => /volume|ml|حجم/.test(o)) || /\d+\s?ml|\d+\s?مل/i.test(p.title)) attributes.volume = "yes";
  const listing = makeListing({
    channel, titleEn, titleAr,
    bulletsEn: bodyEn ? bulletsFromHtml(bodyEn) : [],
    bulletsAr: bodyAr ? bulletsFromHtml(bodyAr) : [],
    images, attributes,
    sizeChart: /size chart|size guide|جدول المقاسات|دليل المقاسات/i.test(htmlToText(p.body_html) + " " + tags.join(" ")) || undefined
  });
  return { ref: String(p.id), sku: p.variants && p.variants[0] && p.variants[0].sku || p.handle, url: `${origin}/products/${p.handle}`, name: titleEn || titleAr, image: images[0] && images[0].src, listing };
}

export async function shopifyStore(origin, { limit = 60, channel = "shopify" } = {}) {
  const en = await tryJson(`${origin}/products.json?limit=${Math.min(250, limit)}`);
  if (!en || !Array.isArray(en.products)) throw new ConnectorError("This store doesn't share its catalog publicly. Upload a catalog export instead.", 422);
  const ar = await tryJson(`${origin}/ar/products.json?limit=${Math.min(250, limit)}`);
  const arById = new Map(((ar && ar.products) || []).map((p) => [p.id, p]));
  return en.products.slice(0, limit).map((p) => toItem(p, arById.get(p.id), origin, channel));
}

export async function shopifyProduct(origin, handle, { channel = "shopify" } = {}) {
  const en = await tryJson(`${origin}/products/${encodeURIComponent(handle)}.json`);
  if (!en || !en.product) return null;
  const ar = await tryJson(`${origin}/ar/products/${encodeURIComponent(handle)}.json`);
  return toItem(en.product, ar && ar.product, origin, channel);
}
