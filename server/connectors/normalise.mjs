// Helpers that turn marketplace data into Basira's listing shape.
const ARABIC = /[؀-ۿ]/;
export const hasArabic = (s) => ARABIC.test(String(s || ""));

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
export function decodeEntities(s) {
  return String(s || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html) {
  return decodeEntities(String(html || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|li|div|h\d)>/gi, "\n").replace(/<[^>]+>/g, " "))
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

/** Bullet points: <li> items if the description has a list, otherwise short lines. */
export function bulletsFromHtml(html) {
  const lis = [...String(html || "").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => htmlToText(m[1])).filter(Boolean);
  if (lis.length) return lis.slice(0, 10);
  const text = htmlToText(html);
  const lines = text.split("\n").filter((l) => l.length >= 3 && l.length <= 220);
  if (lines.length > 1) return lines.slice(0, 6);
  return text.split(/\n|•|\u2022|(?<=[.!؟?])\s+/).map((x) => x.trim()).filter((l) => l.length >= 3 && l.length <= 220).slice(0, 6);
}

/** Put text in the right language slot. */
export function byLanguage(values) {
  const out = { en: [], ar: [] };
  for (const v of values.flat().filter(Boolean)) (hasArabic(v) ? out.ar : out.en).push(String(v).trim());
  return out;
}

const CATEGORY_WORDS = {
  fragrance: ["perfume", "parfum", "fragrance", "oud", "musk", "bakhoor", "bukhoor", "attar", "cologne", "عطر", "عود", "مسك", "بخور", "دهن"],
  fashion: ["abaya", "dress", "thobe", "shirt", "hijab", "jalabiya", "kaftan", "trouser", "jacket", "sneaker", "shoe", "عباية", "فستان", "ثوب", "قميص", "حجاب", "جلابية", "حذاء"],
  food: ["dates", "coffee", "honey", "tea", "saffron", "chocolate", "nuts", "تمر", "قهوة", "عسل", "شاي", "زعفران", "شوكولاتة"],
  beauty: ["cream", "serum", "lotion", "shampoo", "skin", "lipstick", "mask", "oil", "كريم", "سيروم", "شامبو", "بشرة", "زيت"]
};
export function guessCategory(...texts) {
  const t = texts.join(" ").toLowerCase();
  let best = "home", hits = 0;
  for (const [cat, words] of Object.entries(CATEGORY_WORDS)) {
    const n = words.filter((w) => t.includes(w)).length;
    if (n > hits) { best = cat; hits = n; }
  }
  return best;
}

/** Build a listing for the audit engine. */
export function makeListing({ channel, titleEn = "", titleAr = "", bulletsEn = [], bulletsAr = [], images = [], attributes = null, category, sizeChart }) {
  const cat = category || guessCategory(titleEn, titleAr, bulletsEn.join(" "));
  return { channel, category: cat, titleEn, titleAr, bulletsEn, bulletsAr, images, attributes, sizeChart: sizeChart ?? undefined };
}
