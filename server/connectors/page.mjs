// Read a public product page through the structured data it publishes for search
// engines (schema.org Product in JSON-LD), with Open Graph tags as a fallback.
// Works for Noon, Salla, Zid, Shopify and most storefronts.
import { safeFetch, ConnectorError } from "./net.mjs";
import { decodeEntities, htmlToText, bulletsFromHtml, hasArabic, makeListing } from "./normalise.mjs";

function* walk(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const n of node) yield* walk(n); return; }
  yield node;
  if (node["@graph"]) yield* walk(node["@graph"]);
  if (node.mainEntity) yield* walk(node.mainEntity);
}
const isProduct = (n) => [].concat(n["@type"] || []).some((t) => /^(Product|ProductGroup|IndividualProduct)$/i.test(String(t)));

export function extractProduct(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let product = null;
  for (const b of blocks) {
    let data;
    try { data = JSON.parse(b[1].trim()); } catch { continue; }
    for (const n of walk(data)) if (isProduct(n)) { product = n; break; }
    if (product) break;
  }
  const meta = (prop) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i")) ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i"));
    return m ? decodeEntities(m[1]) : "";
  };
  const imgs = (v) => [].concat(v || []).map((i) => (typeof i === "string" ? i : i && (i.url || i.contentUrl))).filter(Boolean);
  const arAlt = (html.match(/<link[^>]+hreflang=["']ar[^"']*["'][^>]*href=["']([^"']+)["']/i) || html.match(/<link[^>]+href=["']([^"']+)["'][^>]*hreflang=["']ar[^"']*["']/i) || [])[1];
  if (product) {
    const rating = product.aggregateRating || {};
    return {
      name: decodeEntities(product.name || ""), description: product.description || "", images: imgs(product.image),
      sku: product.sku || product.mpn || "", brand: product.brand && (product.brand.name || product.brand) || "",
      rating: Number(rating.ratingValue) || null, reviews: Number(rating.reviewCount || rating.ratingCount) || null,
      arabicUrl: arAlt ? decodeEntities(arAlt) : null, source: "json-ld"
    };
  }
  const title = meta("og:title") || decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").trim();
  if (!title) return null;
  return { name: title, description: meta("og:description") || meta("description"), images: [meta("og:image")].filter(Boolean), sku: "", brand: "", rating: null, reviews: null, arabicUrl: arAlt || null, source: "open-graph" };
}

async function readPage(url) {
  const r = await safeFetch(url, { headers: { Accept: "text/html,application/xhtml+xml" } });
  return extractProduct(r.body.toString("utf8"));
}

/** Arabic version of a page: the hreflang link if the page has one, otherwise the Noon -en/-ar swap. */
function arabicUrlFor(url, found) {
  if (found) return new URL(found, url).href;
  const u = new URL(url);
  if (/noon\.com$/.test(u.hostname) && /^\/[a-z]+-en\//.test(u.pathname)) { u.pathname = u.pathname.replace(/^\/([a-z]+)-en\//, "/$1-ar/"); return u.href; }
  return null;
}

export async function productPage(url, { channel }) {
  const main = await readPage(url);
  if (!main) throw new ConnectorError("Couldn't find product details on that page. Try the product's own page, or upload a catalog export.", 422);
  let ar = null;
  const arUrl = !hasArabic(main.name) ? arabicUrlFor(url, main.arabicUrl) : null;
  if (arUrl && arUrl !== url) ar = await readPage(arUrl).catch(() => null);
  const descEn = hasArabic(htmlToText(main.description)) ? "" : main.description;
  const descAr = hasArabic(htmlToText(main.description)) ? main.description : ar && hasArabic(htmlToText(ar.description)) ? ar.description : "";
  const titleEn = hasArabic(main.name) ? "" : main.name;
  const titleAr = hasArabic(main.name) ? main.name : ar && hasArabic(ar.name) ? ar.name : "";
  const images = main.images.map((src) => ({ src }));
  return {
    ref: main.sku || url, sku: main.sku, url, name: titleEn || titleAr, image: main.images[0] || null,
    rating: main.rating, reviews: main.reviews, source: main.source,
    listing: makeListing({ channel, titleEn, titleAr, bulletsEn: descEn ? bulletsFromHtml(descEn) : [], bulletsAr: descAr ? bulletsFromHtml(descAr) : [], images })
  };
}
