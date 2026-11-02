// Import a catalog from a link or a file, measure main images, and audit every listing.
import { parseLink } from "./connectors/link.mjs";
import { ConnectorError, safeFetch } from "./connectors/net.mjs";
import { isShopify, shopifyStore, shopifyProduct } from "./connectors/shopify.mjs";
import { productPage } from "./connectors/page.mjs";
import { amazonProduct, amazonStore, amazonConfigured } from "./connectors/amazon.mjs";
import { listingsFromCSV } from "./catalog-csv.mjs";
import { auditListing } from "./audit.mjs";
import { probeImage, rendererAvailable } from "./render.mjs";

const IMAGE_TYPES = /^image\/(png|jpeg|webp)/;

/** Fill in size and background of each main image. Failures leave the image unmeasured. */
async function measureMainImages(items, { max = 40, concurrency = 4 } = {}) {
  if (!(await rendererAvailable())) return 0;
  const queue = items.filter((it) => it.listing.images[0] && it.listing.images[0].src).slice(0, max);
  let done = 0;
  async function worker() {
    for (let it = queue.shift(); it; it = queue.shift()) {
      const main = it.listing.images[0];
      try {
        const r = await safeFetch(main.src, { maxBytes: 8_000_000, timeoutMs: 10_000, headers: { Accept: "image/png,image/jpeg,image/webp" } });
        const type = (r.headers.get("content-type") || "").split(";")[0];
        if (!IMAGE_TYPES.test(type)) continue;
        const m = await probeImage(`data:${type};base64,${r.body.toString("base64")}`);
        main.width = m.width; main.height = m.height; main.whiteBackground = m.whiteShare >= 0.9; main.whiteShare = Math.round(m.whiteShare * 100) / 100;
        done++;
      } catch { /* keep going: one broken image shouldn't stop the import */ }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return done;
}

function finish(source, items, warnings = []) {
  for (const it of items) it.audit = auditListing(it.listing);
  items.sort((a, b) => a.audit.score - b.audit.score);
  const avg = items.length ? Math.round(items.reduce((s, it) => s + it.audit.score, 0) / items.length) : 0;
  return { source, count: items.length, averageScore: avg, items, warnings };
}

export async function importLink(raw, { limit = 60, measure = true } = {}) {
  const link = parseLink(raw);
  if (!link) throw new ConnectorError("That doesn't look like a link");
  const warnings = [];
  let items = [];
  const source = { platform: link.platform, kind: link.kind, url: link.url.href };

  if (link.platform === "amazon") {
    if (link.kind === "product") items = [await amazonProduct(link.asin, link.marketplace)];
    else if (link.kind === "store") items = await amazonStore(link.sellerId, link.marketplace, { limit });
    else throw new ConnectorError("Paste an Amazon product link (with /dp/) or your storefront link (with ?me=).");
    source.marketplace = link.marketplace.country;
  } else if (link.platform === "noon") {
    if (link.kind !== "product") throw new ConnectorError("Noon doesn't publish store catalogs. Paste a product link, or export your catalog from Noon Seller Lab and upload the file.", 422);
    items = [await productPage(link.url.href, { channel: "noon" })];
  } else {
    const origin = link.url.origin;
    const channel = link.platform === "web" ? "shopify" : link.platform;
    const shopify = await isShopify(origin);
    if (shopify) {
      source.platform = link.platform === "web" ? "shopify" : link.platform;
      if (link.kind === "product" && link.handle) items = [(await shopifyProduct(origin, link.handle, { channel })) || (await productPage(link.url.href, { channel }))];
      else if (link.kind === "product") items = [await productPage(link.url.href, { channel })];
      else items = await shopifyStore(origin, { limit, channel });
    } else if (link.kind === "product") {
      items = [await productPage(link.url.href, { channel })];
    } else {
      throw new ConnectorError(`This store doesn't share its catalog publicly. Paste a product link, or upload a catalog export from ${link.platform === "salla" ? "Salla" : link.platform === "zid" ? "Zid" : "your store"}.`, 422);
    }
  }
  if (measure) {
    const measured = await measureMainImages(items);
    if (!measured && items.some((it) => it.listing.images.length)) warnings.push("Main images weren't measured, so image size and background weren't checked.");
  }
  return finish(source, items, warnings);
}

export async function importCsv(text, { channel = "noon", category, measure = false } = {}) {
  const r = listingsFromCSV(text, { channel, category });
  if (r.error) throw new ConnectorError(r.error);
  const warnings = r.truncated ? ["Only the first 500 rows were imported."] : [];
  if (measure) await measureMainImages(r.items, { max: 40 });
  return finish({ platform: channel, kind: "file" }, r.items, warnings);
}

export function connectorStatus() {
  return {
    amazon: { connected: amazonConfigured(), products: true, store: Boolean(process.env.SPAPI_SELLER_ID) },
    noon: { connected: true, products: true, store: false, note: "Store catalogs come from a Seller Lab export" },
    shopify: { connected: true, products: true, store: true },
    salla: { connected: true, products: true, store: false },
    zid: { connected: true, products: true, store: false },
    file: { connected: true }
  };
}
