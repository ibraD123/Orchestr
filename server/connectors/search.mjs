// Marketplace search results: the listings a buyer sees next to ours for one query.
//
// Amazon: the Catalog Items search of the official Selling Partner API, for a connected seller
//   account. Basira doesn't read marketplace search pages: they refuse automated requests.
// Noon: no public search API, so Creator works from competitor links the seller pastes; each
//   link is read like any product link (server/importer.mjs).
import { ConnectorError } from "./net.mjs";
import { AMAZON_MARKETPLACES } from "./link.mjs";
import { amazonConfig, amazonConfigured, amazonSearch } from "./amazon.mjs";

/**
 * @param {{ channel: "noon"|"amazon", query: string, host?: string, limit?: number }} q
 * @returns {Promise<{ channel, query, url, items: Array<{ sku, title, image, price, url }> }>}
 */
export async function searchMarketplace(q, c = amazonConfig()) {
  const query = String(q.query || "").trim().slice(0, 120);
  if (!query) throw new ConnectorError("Type what buyers search for");
  const limit = Math.max(4, Math.min(20, Number(q.limit) || 12));
  if (q.channel === "amazon") {
    if (!amazonConfigured(c)) throw new ConnectorError("Searching Amazon needs the connected seller account (SP-API). Paste competitor links instead.", 503);
    const host = AMAZON_MARKETPLACES[q.host] ? q.host : "amazon.sa";
    const items = await amazonSearch(query, AMAZON_MARKETPLACES[host], { limit }, c);
    return { channel: "amazon", query, url: `https://www.${host}/s?k=${encodeURIComponent(query)}`, items };
  }
  if (q.channel === "noon") throw new ConnectorError("Noon has no search API for sellers. Paste the links of the competitors you see on Noon.", 422);
  throw new ConnectorError("Search works on Amazon; for Noon paste competitor links");
}
