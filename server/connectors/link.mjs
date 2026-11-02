// Work out what a pasted link points to.
export const AMAZON_MARKETPLACES = {
  "amazon.sa": { id: "A17E79C6D8DWNP", country: "SA", locales: ["en_AE", "ar_AE"] },
  "amazon.ae": { id: "A2VIGQ35RCS4UG", country: "AE", locales: ["en_AE", "ar_AE"] },
  "amazon.eg": { id: "ARBP9OOSHTCHU", country: "EG", locales: ["en_AE", "ar_AE"] }
};

/**
 * @returns {{ platform: "amazon"|"noon"|"salla"|"zid"|"web", kind: "product"|"store", url: URL, ... }}
 */
export function parseLink(raw) {
  let url;
  try { url = new URL(String(raw || "").trim().replace(/^(?!https?:\/\/)/i, "https://")); }
  catch { return null; }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname;

  const amazonHost = Object.keys(AMAZON_MARKETPLACES).find((h) => host === h || host.endsWith("." + h));
  if (amazonHost) {
    const asin = path.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    const seller = url.searchParams.get("me") || url.searchParams.get("seller");
    const marketplace = AMAZON_MARKETPLACES[amazonHost];
    if (asin) return { platform: "amazon", kind: "product", url, asin: asin[1].toUpperCase(), marketplace };
    if (seller) return { platform: "amazon", kind: "store", url, sellerId: seller, marketplace };
    return { platform: "amazon", kind: "unknown", url, marketplace };
  }

  if (host === "noon.com" || host.endsWith(".noon.com")) {
    const region = (path.match(/^\/([a-z]+-(?:en|ar))\//) || [])[1] || "saudi-en";
    const sku = path.match(/\/([A-Z0-9]{6,})\/p\/?$/i);
    if (sku) return { platform: "noon", kind: "product", url, sku: sku[1].toUpperCase(), region };
    return { platform: "noon", kind: "store", url, region };
  }

  const isSalla = host.endsWith("salla.sa") || host.endsWith("salla.store");
  const isZid = host.endsWith("zid.store") || host.endsWith("zid.sa");
  const platform = isSalla ? "salla" : isZid ? "zid" : "web";
  const shopifyProduct = path.match(/\/products\/([^/?#]+)/);
  const sallaProduct = /\/p\d+\/?$/.test(path) || /\/products?\/[^/]+/.test(path);
  if (shopifyProduct) return { platform, kind: "product", url, handle: decodeURIComponent(shopifyProduct[1]) };
  if ((isSalla || isZid) && sallaProduct) return { platform, kind: "product", url };
  if (path === "/" || path === "" || /^\/(ar|en)\/?$/.test(path) || /^\/collections\//.test(path)) return { platform, kind: "store", url };
  return { platform, kind: "product", url };
}
