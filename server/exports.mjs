// Marketplace upload files built from approved fixes.
// Pure functions: the server packs them into the export ZIP, and the app can build them too.
//
// Amazon uses its inventory flat file field names (item_sku, item_name, bullet_point1…,
// main_image_url, other_image_url1…) with update_delete = PartialUpdate. Shopify uses its product
// CSV columns. Noon, Salla and Zid files use clear generic columns: map them onto the channel's
// current bulk-upload template if its headers differ.

export const EXPORT_CHANNELS = ["noon", "amazon", "salla", "zid", "shopify"];

function cell(v, sep) {
  const s = String(v == null ? "" : v).replace(/\r?\n/g, " ").trim();
  if (sep === "\t") return s.replace(/\t/g, " ");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function table(rows, sep) {
  // UTF-8 BOM so Excel opens Arabic text correctly.
  return "﻿" + rows.map((r) => r.map((c) => cell(c, sep)).join(sep)).join("\r\n") + "\r\n";
}
const pad = (arr, n) => Array.from({ length: n }, (_, i) => (arr && arr[i]) || "");
const handleOf = (it) => it.handle || String(it.sku || it.name || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * @param {string} channel
 * @param {Array<{ sku, asin?, handle?, name?, copy: { titleEn, titleAr, bulletsEn[], bulletsAr[] }, images: string[] }>} items
 * @param {{ imageBase?: string }} opts  public base URL the images are served from
 * @returns {Array<{ name, mime, content }>}
 */
export function exportFiles(channel, items, opts) {
  const base = (opts && opts.imageBase) ? opts.imageBase.replace(/\/$/, "") + "/" : "";
  const url = (f) => (f ? base + f : "");
  const list = items || [];
  if (channel === "amazon") {
    const head = ["item_sku", "update_delete", "item_name", "bullet_point1", "bullet_point2", "bullet_point3", "bullet_point4", "bullet_point5", "main_image_url"].concat(pad([], 8).map((_, i) => "other_image_url" + (i + 1)));
    const rows = (lang) => [head].concat(list.map((it) => {
      const c = it.copy || {}, imgs = it.images || [];
      return [it.sku, "PartialUpdate", lang === "ar" ? c.titleAr : c.titleEn].concat(pad(lang === "ar" ? c.bulletsAr : c.bulletsEn, 5), [url(imgs[0])], pad(imgs.slice(1), 8).map(url));
    }));
    return [
      { name: "amazon-flat-file-en.txt", mime: "text/tab-separated-values", content: table(rows("en"), "\t") },
      { name: "amazon-flat-file-ar.txt", mime: "text/tab-separated-values", content: table(rows("ar"), "\t") }
    ];
  }
  if (channel === "shopify") {
    const rows = [["Handle", "Title", "Body (HTML)", "Image Src", "Image Position", "Image Alt Text"]];
    for (const it of list) {
      const c = it.copy || {}, h = handleOf(it), imgs = it.images || [];
      const body = (c.bulletsEn || []).length ? "<ul>" + c.bulletsEn.map((b) => "<li>" + String(b).replace(/</g, "&lt;") + "</li>").join("") + "</ul>" : "";
      rows.push([h, c.titleEn || c.titleAr, body, url(imgs[0]), imgs[0] ? 1 : "", c.titleEn || ""]);
      imgs.slice(1).forEach((f, i) => rows.push([h, "", "", url(f), i + 2, ""]));
    }
    return [{ name: "shopify-products.csv", mime: "text/csv", content: table(rows, ",") }];
  }
  if (channel === "salla" || channel === "zid") {
    const rows = [["sku", "name_ar", "name_en", "description_ar", "description_en"].concat(pad([], 8).map((_, i) => "image_" + (i + 1)))];
    for (const it of list) {
      const c = it.copy || {};
      rows.push([it.sku, c.titleAr, c.titleEn, (c.bulletsAr || []).join(" • "), (c.bulletsEn || []).join(" • ")].concat(pad(it.images, 8).map(url)));
    }
    return [{ name: channel + "-products.csv", mime: "text/csv", content: table(rows, ",") }];
  }
  // Noon (default)
  const rows = [["partner_sku", "title_en", "title_ar"].concat([1, 2, 3, 4, 5].map((i) => "bullet_" + i + "_en"), [1, 2, 3, 4, 5].map((i) => "bullet_" + i + "_ar"), pad([], 8).map((_, i) => "image_" + (i + 1)))];
  for (const it of list) {
    const c = it.copy || {};
    rows.push([it.sku, c.titleEn, c.titleAr].concat(pad(c.bulletsEn, 5), pad(c.bulletsAr, 5), pad(it.images, 8).map(url)));
  }
  return [{ name: "noon-content.csv", mime: "text/csv", content: table(rows, ",") }];
}

export function exportReadme(channel, count, opts) {
  const o = opts || {};
  return [
    `Basira export · ${o.client || ""} · ${new Date(o.at || Date.now()).toISOString().slice(0, 10)}`,
    `${count} products for ${channel}.`,
    "",
    "images/   1600 × 2000 PNG slides, in the order to upload (the first is the main image).",
    o.imageBase ? `Images are also hosted at ${o.imageBase} and those links are filled in the upload file.` : "Images are not hosted: upload them from images/ or host them and fill in the image columns.",
    "",
    channel === "amazon" ? "Amazon: use the flat file in Seller Central (Catalogue → Add products via upload) for the category's template; update_delete is PartialUpdate, so only these fields change. The -ar file carries the Arabic copy for Amazon.sa / Amazon.ae." :
      channel === "shopify" ? "Shopify: Products → Import, with “Overwrite products with matching handles” on." :
        "Columns use Basira's generic names. If the channel's current bulk template uses different headers, copy the columns across.",
    "",
    "Review every row before uploading. Basira does not change your listings until you upload this file or publish from the app."
  ].join("\r\n") + "\r\n";
}
