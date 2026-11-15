import { fetchJson, ConnectorError } from "./net.mjs";

// Only the review fields needed by analysis are returned; buyer identity is discarded.
export async function fetchSallaReviews(token, productId, { limit = 200 } = {}) {
  if (!token || /[\r\n]/.test(token)) throw new ConnectorError("Connect a Salla account with reviews.read access", 503);
  const product = String(productId || "");
  if (!/^\d{1,30}$/.test(product)) throw new ConnectorError("Enter the numeric Salla product ID");
  const out = [], seen = new Set();
  for (let page = 1; page <= 20 && out.length < limit; page++) {
    const params = new URLSearchParams({ products: product, type: "product", page: String(page) });
    const r = await fetchJson(`https://api.salla.dev/admin/v2/reviews?${params}`, { forbidRedirect: true, headers: { Authorization: `Bearer ${token}` } });
    if (!Array.isArray(r.data)) throw new ConnectorError("Salla returned an invalid reviews response", 502);
    for (const row of r.data) {
      const id = String(row.id || ""), text = String(row.content || "").trim();
      const ref = row.product?.id || row.product_id || row.reference_id;
      if (!id || seen.has(id) || row.type !== "rating" || !text || (ref && String(ref) !== product)) continue;
      seen.add(id); out.push({ id, text: text.slice(0, 10000), rating: Number(row.rating) || null, createdAt: row.created_at || null });
      if (out.length >= limit) break;
    }
    const pages = Number(r.pagination?.totalPages || 0);
    if (!r.data.length || !pages || page >= pages) break;
  }
  return out;
}
