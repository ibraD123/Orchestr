// Catalog file import (Noon, Amazon, Salla and Zid catalog exports, or any spreadsheet saved as CSV).
// Pure functions with no imports: the server uses this module directly, and
// scripts/build.mjs inlines it into the app so files can be audited in the browser.

export function parseCSV(text) {
  const s = String(text || "").replace(/^﻿/, "");
  const delim = (s.split("\n")[0].match(/;/g) || []).length > (s.split("\n")[0].match(/,/g) || []).length ? ";" : (s.split("\n")[0].includes("\t") ? "\t" : ",");
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (h) => String(h || "").toLowerCase().replace(/[()[\]]/g, " ").replace(/[^a-z0-9؀-ۿ]+/g, "_").replace(/^_|_$/g, "");

// Column names seen in marketplace exports, normalised.
const COLUMNS = {
  sku: ["sku", "partner_sku", "seller_sku", "psku", "item_sku", "asin", "product_id", "id", "رمز_المنتج"],
  titleEn: ["title_en", "name_en", "product_title_en", "product_name_en", "title_english", "item_name", "product_name", "title", "name", "product_title"],
  titleAr: ["title_ar", "name_ar", "product_title_ar", "product_name_ar", "title_arabic", "item_name_ar", "اسم_المنتج", "العنوان", "الاسم"],
  descEn: ["description_en", "long_description_en", "product_description", "description", "body_html"],
  descAr: ["description_ar", "long_description_ar", "الوصف"],
  category: ["category", "product_type", "family", "item_type", "الفئة"],
  brand: ["brand", "brand_name", "العلامة_التجارية"],
  sizeChart: ["size_chart", "size_chart_url", "size_guide"]
};
const BULLET_EN = /^(bullet|feature|bullet_point|key_feature|highlight)s?_?\d*(_en)?$/;
const BULLET_AR = /^(bullet|feature|bullet_point|key_feature|highlight)s?_?\d*_ar$/;
const IMAGE = /^(main_image|image|images|image_url|image_link|other_image|additional_image|picture|photo)s?(_url)?_?\d*$/;

export function mapColumns(header) {
  const h = header.map(norm);
  const pick = (names) => { for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; } return -1; };
  const map = {};
  for (const [k, names] of Object.entries(COLUMNS)) map[k] = pick(names);
  map.bulletsEn = h.map((x, i) => (BULLET_EN.test(x) ? i : -1)).filter((i) => i >= 0);
  map.bulletsAr = h.map((x, i) => (BULLET_AR.test(x) ? i : -1)).filter((i) => i >= 0);
  map.images = h.map((x, i) => (IMAGE.test(x) ? i : -1)).filter((i) => i >= 0);
  return map;
}

const AR = /[؀-ۿ]/;
const CAT_WORDS = { fragrance: /perfume|parfum|fragrance|oud|musk|bakhoor|عطر|عود|مسك|بخور/i, fashion: /abaya|dress|thobe|shirt|hijab|apparel|clothing|عباية|فستان|ثوب|ملابس/i, food: /dates|coffee|honey|grocery|food|تمر|قهوة|عسل/i, beauty: /beauty|cream|serum|skin|makeup|cosmetic|كريم|بشرة|تجميل/i };
function guessCat(t) { for (const k of Object.keys(CAT_WORDS)) if (CAT_WORDS[k].test(t)) return k; return "home"; }
function splitDesc(d) {
  return String(d || "").replace(/<li[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").split(/\n|•|•|(?<=\.)\s+/).map((x) => x.trim()).filter((x) => x.length >= 3 && x.length <= 220).slice(0, 6);
}

/** Turn CSV text into listings for the audit engine. */
export function listingsFromCSV(text, { channel = "noon", category, limit = 500 } = {}) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { items: [], columns: null, error: "The file needs a header row and at least one product" };
  const m = mapColumns(rows[0]);
  if (m.titleEn < 0 && m.titleAr < 0) return { items: [], columns: m, error: "Couldn't find a title column. Name it title_en, title_ar, title or product_name." };
  const cell = (r, i) => (i >= 0 && r[i] != null ? String(r[i]).trim() : "");
  const items = rows.slice(1, limit + 1).map((r, n) => {
    let titleEn = cell(r, m.titleEn), titleAr = cell(r, m.titleAr);
    if (!titleAr && AR.test(titleEn)) { titleAr = titleEn; titleEn = ""; }
    let bulletsEn = m.bulletsEn.map((i) => cell(r, i)).filter(Boolean);
    let bulletsAr = m.bulletsAr.map((i) => cell(r, i)).filter(Boolean);
    const both = bulletsEn.filter((b) => AR.test(b)); bulletsAr = bulletsAr.concat(both); bulletsEn = bulletsEn.filter((b) => !AR.test(b));
    if (!bulletsEn.length) bulletsEn = splitDesc(cell(r, m.descEn)).filter((b) => !AR.test(b));
    if (!bulletsAr.length) bulletsAr = splitDesc(cell(r, m.descAr) || cell(r, m.descEn)).filter((b) => AR.test(b));
    const images = m.images.flatMap((i) => cell(r, i).split(/[|,\s]+/)).filter((u) => /^https?:\/\//.test(u)).map((src) => ({ src }));
    const cat = category || guessCat([cell(r, m.category), titleEn, titleAr].join(" "));
    const sku = cell(r, m.sku) || `row-${n + 2}`;
    return {
      ref: sku, sku, name: titleEn || titleAr, image: images[0] ? images[0].src : null,
      listing: { channel, category: cat, titleEn, titleAr, bulletsEn, bulletsAr, images, attributes: null, sizeChart: cell(r, m.sizeChart) ? true : undefined }
    };
  }).filter((it) => it.listing.titleEn || it.listing.titleAr);
  return { items, columns: m, error: null, truncated: rows.length - 1 > limit };
}
