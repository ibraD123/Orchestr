import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setNetwork, assertPublicUrl } from "../server/connectors/net.mjs";
import { parseLink } from "../server/connectors/link.mjs";
import { extractProduct } from "../server/connectors/page.mjs";
import { itemFromCatalog, amazonProduct, amazonStore, amazonPublish, listingPatches } from "../server/connectors/amazon.mjs";
import { listingsFromCSV, parseCSV } from "../server/catalog-csv.mjs";
import { importLink } from "../server/importer.mjs";

// Fake network: routes map URL prefixes to responses.
let routes = {};
const calls = [];
function respond(body, { status = 200, type = "application/json", headers = {} } = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status, headers: { "content-type": type, ...headers } });
}
beforeEach(() => {
  routes = {}; calls.length = 0;
  setNetwork({
    lookup: async (host) => [{ address: host === "evil.test" ? "10.0.0.5" : "93.184.216.34" }],
    fetch: async (url, init = {}) => {
      calls.push({ url, init });
      const key = Object.keys(routes).sort((a, b) => b.length - a.length).find((k) => url.startsWith(k));
      if (!key) return respond({ error: "not found" }, { status: 404 });
      const r = routes[key];
      return typeof r === "function" ? r(url, init) : respond(r);
    }
  });
});

test("parses marketplace links", () => {
  const a = parseLink("https://www.amazon.sa/-/en/Oud-Perfume/dp/B0ABCDE123/ref=sr_1_1");
  assert.equal(a.platform, "amazon"); assert.equal(a.kind, "product"); assert.equal(a.asin, "B0ABCDE123"); assert.equal(a.marketplace.id, "A17E79C6D8DWNP");
  assert.equal(parseLink("amazon.ae/s?me=A1SELLER123").sellerId, "A1SELLER123");
  const n = parseLink("https://www.noon.com/saudi-en/oud-al-layl-100ml/N53346840A/p/?o=abc");
  assert.equal(n.platform, "noon"); assert.equal(n.sku, "N53346840A"); assert.equal(n.region, "saudi-en");
  assert.equal(parseLink("https://shop.example.com/products/oud-100ml").handle, "oud-100ml");
  assert.equal(parseLink("https://layali.salla.sa/").kind, "store");
  assert.equal(parseLink("https://layali.salla.sa/oud/p123456").kind, "product");
});

test("blocks private addresses and plain http", async () => {
  await assert.rejects(assertPublicUrl("https://evil.test/"), /Private/);
  await assert.rejects(assertPublicUrl("https://127.0.0.1/"), /Private/);
  await assert.rejects(assertPublicUrl("http://example.com/"), /https/);
});

test("reads schema.org Product data and the Arabic alternate", () => {
  const html = `<html><head><link rel="alternate" hreflang="ar-SA" href="https://x.test/ar/p1">
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList"},{"@type":"Product","name":"Oud &amp; Saffron 100ml","image":["https://x.test/1.jpg",{"url":"https://x.test/2.jpg"}],"description":"<ul><li>Lasts 8 hours</li><li>Made in KSA</li></ul>","sku":"OUD1","aggregateRating":{"ratingValue":"4.4","reviewCount":"120"}}]}</script></head></html>`;
  const p = extractProduct(html);
  assert.equal(p.name, "Oud & Saffron 100ml");
  assert.deepEqual(p.images, ["https://x.test/1.jpg", "https://x.test/2.jpg"]);
  assert.equal(p.reviews, 120);
  assert.equal(p.arabicUrl, "https://x.test/ar/p1");
});

test("imports a Noon product with its Arabic page", async () => {
  const page = (name, desc) => `<script type="application/ld+json">{"@type":"Product","name":"${name}","description":"${desc}","image":"https://f.noon.test/a.jpg","sku":"N1"}</script>`;
  routes["https://www.noon.com/saudi-en/"] = () => respond(page("Oud Al Layl EDP 100ml", "Long lasting. Smoked oud."), { type: "text/html" });
  routes["https://www.noon.com/saudi-ar/"] = () => respond(page("عطر عود الليل ١٠٠ مل", "ثبات طويل. عود مدخن."), { type: "text/html" });
  const r = await importLink("https://www.noon.com/saudi-en/oud-al-layl/N53346840A/p/", { measure: false });
  const l = r.items[0].listing;
  assert.equal(l.channel, "noon"); assert.equal(l.category, "fragrance");
  assert.equal(l.titleAr, "عطر عود الليل ١٠٠ مل");
  assert.deepEqual(l.bulletsAr, ["ثبات طويل.", "عود مدخن."]);
  assert.ok(!r.items[0].audit.issues.some((i) => i.key === "noArabicTitle"));
  assert.ok(r.items[0].audit.issues.some((i) => i.key === "onePhoto"));
});

test("imports a Shopify store with Arabic translations", async () => {
  const product = (title, body) => ({ id: 7, handle: "oud", title, body_html: body, product_type: "Perfume", tags: "oud, gift", options: [{ name: "Volume" }], variants: [{ sku: "OUD-100" }], images: [{ src: "https://cdn.test/1.jpg", width: 2048, height: 2048 }, { src: "https://cdn.test/2.jpg", width: 2048, height: 2048 }] });
  routes["https://store.test/products.json"] = { products: [product("Oud Al Layl 100ml Eau de Parfum", "<ul><li>Lasts 8h</li><li>Saffron</li></ul>")] };
  routes["https://store.test/ar/products.json"] = { products: [product("عطر عود الليل", "<ul><li>ثبات ٨ ساعات</li></ul>")] };
  const r = await importLink("https://store.test/", { measure: false });
  assert.equal(r.source.platform, "shopify");
  const it = r.items[0];
  assert.equal(it.sku, "OUD-100");
  assert.equal(it.listing.titleAr, "عطر عود الليل");
  assert.deepEqual(it.listing.bulletsEn, ["Lasts 8h", "Saffron"]);
  assert.equal(it.listing.images[0].width, 2048);
});

test("maps Amazon catalog data in both languages", () => {
  const mp = { id: "A17E79C6D8DWNP", country: "SA" };
  const item = itemFromCatalog({
    asin: "B0ABCDE123",
    attributes: { item_name: [{ value: "Oud Perfume 100ml", language_tag: "en_AE" }], bullet_point: [{ value: "Long lasting", language_tag: "en_AE" }], item_volume: [{ value: 100 }] },
    images: [{ marketplaceId: "A17E79C6D8DWNP", images: [{ variant: "PT01", link: "https://m.media-amazon.com/2.jpg", width: 500, height: 500 }, { variant: "MAIN", link: "https://m.media-amazon.com/1s.jpg", width: 500, height: 500 }, { variant: "MAIN", link: "https://m.media-amazon.com/1.jpg", width: 2000, height: 2000 }] }]
  }, mp, { attributes: { item_name: [{ value: "عطر عود ١٠٠ مل", language_tag: "ar_AE" }] } });
  assert.equal(item.listing.titleEn, "Oud Perfume 100ml");
  assert.equal(item.listing.titleAr, "عطر عود ١٠٠ مل");
  assert.equal(item.image, "https://m.media-amazon.com/1.jpg");
  assert.equal(item.listing.images.length, 2);
  assert.equal(item.listing.attributes.volume, "yes");
  assert.equal(item.url, "https://www.amazon.sa/dp/B0ABCDE123");
});

const amazonEnv = { clientId: "id", clientSecret: "secret", refreshToken: "rt", sellerId: "A1ME", endpoint: "https://sp.test", tokenUrl: "https://auth.test/o2/token" };

test("calls SP-API with a fresh access token", async () => {
  routes["https://auth.test/o2/token"] = { access_token: "Atza|tok", expires_in: 3600 };
  routes["https://sp.test/catalog/2022-04-01/items/B0ABCDE123"] = (url) => respond({
    asin: "B0ABCDE123",
    attributes: { item_name: [{ value: url.includes("locale=ar") ? "عطر" : "Oud perfume", language_tag: url.includes("locale=ar") ? "ar_AE" : "en_AE" }] },
    images: []
  });
  const it = await amazonProduct("B0ABCDE123", { id: "A17E79C6D8DWNP", country: "SA", locales: ["en_AE", "ar_AE"] }, amazonEnv);
  assert.equal(it.listing.titleEn, "Oud perfume"); assert.equal(it.listing.titleAr, "عطر");
  const sp = calls.filter((c) => c.url.startsWith("https://sp.test"));
  assert.ok(sp.every((c) => c.init.headers["x-amz-access-token"] === "Atza|tok"));
  assert.ok(sp[0].url.includes("marketplaceIds=A17E79C6D8DWNP"));
});

test("store import pages through the connected seller's listings only", async () => {
  routes["https://auth.test/o2/token"] = { access_token: "Atza|tok2", expires_in: 3600 };
  let page = 0;
  routes["https://sp.test/listings/2021-08-01/items/A1ME"] = () => respond(page++ === 0
    ? { items: [{ sku: "S1", summaries: [{ asin: "B01", itemName: "Abaya linen", mainImage: { link: "https://m.media-amazon.com/a.jpg", width: 1500, height: 1500 } }], issues: [{ code: "90220", message: "Missing size", severity: "ERROR" }] }], pagination: { nextToken: "n2" } }
    : { items: [{ sku: "S2", summaries: [{ asin: "B02", itemName: "Thobe" }] }] });
  const items = await amazonStore("A1ME", { id: "A2VIGQ35RCS4UG", country: "AE" }, {}, { ...amazonEnv, refreshToken: "rt2" });
  assert.deepEqual(items.map((i) => i.sku), ["S1", "S2"]);
  assert.equal(items[0].marketplaceIssues[0].code, "90220");
  await assert.rejects(amazonStore("SOMEONE_ELSE", { id: "A2VIGQ35RCS4UG", country: "AE" }, {}, amazonEnv), /connected seller/);
});

test("publishes approved copy and hosted images with the listing's product type", async () => {
  routes["https://auth.test/o2/token"] = { access_token: "Atza|tok3", expires_in: 3600 };
  routes["https://sp.test/listings/2021-08-01/items/A1ME/OUD-100"] = (url, init) => init.method === "PATCH"
    ? respond({ sku: "OUD-100", status: "ACCEPTED", submissionId: "sub-1", issues: [] })
    : respond({ sku: "OUD-100", summaries: [{ marketplaceId: "A17E79C6D8DWNP", productType: "PERFUME" }] });
  routes["https://sp.test/listings/2021-08-01/items/A1ME/GONE"] = () => respond({ errors: [{ code: "NOT_FOUND" }] }, { status: 404 });
  const SA = { id: "A17E79C6D8DWNP", country: "SA", locales: ["en_AE", "ar_AE"] };
  const item = { sku: "OUD-100", copy: { titleEn: "Oud Al Layl EDP 100ml", titleAr: "عطر عود الليل", bulletsEn: ["Lasts 12 hours"], bulletsAr: ["يدوم ١٢ ساعة"] }, images: ["https://basira.test/assets/a/1.png", "https://basira.test/assets/a/2.png", "/local/not-public.png"] };
  const r = await amazonPublish(item, SA, { ...amazonEnv, refreshToken: "rt3" });
  assert.equal(r.status, "ACCEPTED"); assert.equal(r.submissionId, "sub-1");
  const patch = calls.find((c) => c.init.method === "PATCH");
  assert.ok(patch.url.includes("marketplaceIds=A17E79C6D8DWNP"));
  const body = JSON.parse(patch.init.body);
  assert.equal(body.productType, "PERFUME");
  const byPath = Object.fromEntries(body.patches.map((p) => [p.path, p.value]));
  assert.deepEqual(byPath["/attributes/item_name"].map((v) => v.language_tag), ["en_AE", "ar_AE"]);
  assert.equal(byPath["/attributes/bullet_point"].length, 2);
  assert.equal(byPath["/attributes/main_product_image_locator"][0].media_location, "https://basira.test/assets/a/1.png");
  assert.ok(byPath["/attributes/other_product_image_locator_1"]);
  assert.ok(!byPath["/attributes/other_product_image_locator_2"], "non-public image links are left out");
  const gone = await amazonPublish({ sku: "GONE", copy: { titleEn: "x" } }, SA, { ...amazonEnv, refreshToken: "rt3" });
  assert.equal(gone.status, "NOT_FOUND");
  await assert.rejects(amazonPublish(item, SA, { ...amazonEnv, sellerId: null }), (e) => e.status === 503);
  assert.equal(listingPatches({ copy: {} }, SA).length, 0);
});

test("explains what to do when Amazon isn't connected", async () => {
  await assert.rejects(amazonProduct("B0ABCDE123", { id: "x", country: "SA", locales: [] }, {}), (e) => e.status === 503 && /SPAPI_CLIENT_ID/.test(e.message));
});

test("parses catalog exports with quoted cells and Arabic columns", () => {
  const csv = '﻿partner_sku,title_en,title_ar,bullet_1,bullet_2,bullet_1_ar,main_image,category\n' +
    'OUD-1,"Oud Perfume, 100ml",عطر عود,Lasts 8h,"Has ""saffron""",ثبات طويل,https://x.test/1.jpg|https://x.test/2.jpg,Fragrance\n' +
    'ABY-2,Linen Abaya,,,,,,Clothing\n';
  assert.equal(parseCSV(csv)[1][1], "Oud Perfume, 100ml");
  const r = listingsFromCSV(csv, { channel: "noon" });
  assert.equal(r.items.length, 2);
  const [oud, abaya] = r.items;
  assert.equal(oud.sku, "OUD-1"); assert.equal(oud.listing.titleAr, "عطر عود");
  assert.deepEqual(oud.listing.bulletsEn, ["Lasts 8h", 'Has "saffron"']); assert.deepEqual(oud.listing.bulletsAr, ["ثبات طويل"]);
  assert.equal(oud.listing.images.length, 2); assert.equal(oud.listing.category, "fragrance");
  assert.equal(abaya.listing.category, "fashion");
  assert.match(listingsFromCSV("foo,bar\n1,2").error, /title column/);
});
