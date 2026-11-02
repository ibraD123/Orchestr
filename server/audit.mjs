// Basira listing audit engine.
// Pure functions with no imports: the server uses this module directly, and
// scripts/build.mjs inlines it into the app so audits also run in the browser.

export const AUDIT_CHANNELS = ["amazon", "noon", "salla", "zid", "shopify"];
export const AUDIT_CATEGORIES = ["fragrance", "fashion", "food", "beauty", "home"];

// Marketplace rules that differ per channel.
export const CHANNEL_RULES = {
  amazon:  { titleMax: 200, whiteMain: true,  minImages: 6, minBullets: 5 },
  noon:    { titleMax: 150, whiteMain: true,  minImages: 4, minBullets: 4 },
  salla:   { titleMax: 120, whiteMain: false, minImages: 4, minBullets: 3 },
  zid:     { titleMax: 120, whiteMain: false, minImages: 4, minBullets: 3 },
  shopify: { titleMax: 150, whiteMain: false, minImages: 4, minBullets: 3 }
};

// Attributes buyers filter on, per category.
export const REQUIRED_ATTRIBUTES = {
  fragrance: ["volume", "concentration", "notes"],
  fashion: ["material", "care", "fit"],
  food: ["weight", "origin", "shelfLife"],
  beauty: ["volume", "skinType", "ingredients"],
  home: ["material", "dimensions"]
};

// Claims that need regulator approval (SFDA in Saudi Arabia) or get listings removed.
const CLAIM_PATTERNS = [
  /\bcures?\b/i, /\btreats?\b/i, /\bheals?\b/i, /boosts? (the )?immun/i, /\bprevents? (disease|cancer|covid)/i,
  /\bmedical[- ]grade\b/i, /\bclinically proven\b/i, /\banti[- ]?bacterial\b/i,
  /يعالج/, /علاج/, /يشفي/, /يقوي المناعة/, /يقضي على/, /مضاد للبكتيريا/
];

const ARABIC = /[؀-ۿ]/;
// Presentation-form code points show up when Arabic was shaped by a tool that
// does not understand Arabic, then copied as text: a reliable sign of broken shaping.
const PRESENTATION_FORMS = /[ﭐ-﷿ﹰ-﻿]/;

const SEVERITY_WEIGHT = { high: 40, med: 20, low: 8 };
// Generic filler that marks a keyword-stuffed title when a word also repeats.
const FILLER = ["best", "top", "hot", "cheap", "new", "men", "women", "unisex", "gift", "original", "luxury", "quality", "lasting"];

function words(s) {
  return (s || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
}

function stuffedWord(s) {
  const counts = {};
  const ws = words(s);
  for (const w of ws) counts[w] = (counts[w] || 0) + 1;
  const filler = ws.filter((w) => FILLER.includes(w)).length;
  return Object.keys(counts).find((w) => counts[w] >= 3 || (counts[w] >= 2 && filler >= 2)) || null;
}

/**
 * Audit one listing.
 * @param {object} listing
 *   channel, category, titleEn, titleAr, bulletsEn[], bulletsAr[],
 *   images[{ width, height, whiteBackground, arabicTextBroken }],
 *   attributes{}, sizeChart (fashion), reviewThemes[{ theme, share, negative, coveredByContent }]
 * @returns {{ score:number, breakdown:object, issues:Array }}
 */
export function auditListing(listing) {
  const l = listing || {};
  const channel = CHANNEL_RULES[l.channel] ? l.channel : "noon";
  const rules = CHANNEL_RULES[channel];
  const category = REQUIRED_ATTRIBUTES[l.category] ? l.category : "fragrance";
  const titleEn = (l.titleEn || "").trim();
  const titleAr = (l.titleAr || "").trim();
  const bulletsEn = (l.bulletsEn || []).map((b) => String(b).trim()).filter(Boolean);
  const bulletsAr = (l.bulletsAr || []).map((b) => String(b).trim()).filter(Boolean);
  const images = Array.isArray(l.images) ? l.images : [];
  const attributes = l.attributes || {};
  const issues = [];
  const add = (key, sev, area, detail) => issues.push({ key, sev, area, detail: detail || null });

  // Title and copy
  if (!titleEn && !titleAr) add("noTitle", "high", "title");
  if (titleEn && titleEn.length > rules.titleMax) add("titleTooLong", "med", "title", { length: titleEn.length, max: rules.titleMax });
  if (titleEn && titleEn.length < 30) add("titleTooShort", "med", "title", { length: titleEn.length });
  const dup = stuffedWord(titleEn);
  if (dup) add("keywordStuffing", "med", "title", { word: dup });
  if (bulletsEn.length + bulletsAr.length === 0) add("noBullets", "high", "title");
  else if (Math.max(bulletsEn.length, bulletsAr.length) < rules.minBullets) add("fewBullets", "low", "title", { count: Math.max(bulletsEn.length, bulletsAr.length), min: rules.minBullets });

  // Arabic
  if (!titleAr && titleEn) add("noArabicTitle", "high", "arabic");
  else if (titleAr && !ARABIC.test(titleAr)) add("arabicTitleNotArabic", "high", "arabic");
  if (bulletsEn.length && !bulletsAr.length) add("enBullets", "med", "arabic");
  const allArabic = [titleAr, ...bulletsAr].join(" ");
  if (PRESENTATION_FORMS.test(allArabic) || images.some((im) => im && im.arabicTextBroken)) add("arabicBroken", "high", "arabic");

  // Images
  if (images.length === 0) add("noImages", "high", "images");
  else if (images.length === 1) add("onePhoto", "high", "images");
  else if (images.length < rules.minImages) add("fewImages", "low", "images", { count: images.length, min: rules.minImages });
  const main = images[0];
  if (main) {
    if (rules.whiteMain && main.whiteBackground === false) add("mainRule", "med", "images", { channel });
    if (main.width && main.height && Math.min(main.width, main.height) < 1000) add("lowRes", "low", "images", { width: main.width, height: main.height });
  }

  // Attributes
  if (category === "fashion" && !l.sizeChart) add("noSizeChart", "high", "attrs");
  // attributes === null means the source doesn't expose them (page or file import): don't guess.
  if (l.attributes !== null) {
    const missing = REQUIRED_ATTRIBUTES[category].filter((a) => !attributes[a]);
    if (missing.length) add("attrs", missing.length > 1 ? "med" : "low", "attrs", { missing });
  }

  // Compliance
  const allText = [titleEn, titleAr, ...bulletsEn, ...bulletsAr].join(" \n ");
  const claim = CLAIM_PATTERNS.map((re) => allText.match(re)).find(Boolean);
  if (claim) add("claim", "high", "attrs", { phrase: claim[0] });

  // Review fit: negative themes buyers raise that no content answers
  const themes = Array.isArray(l.reviewThemes) ? l.reviewThemes : [];
  for (const th of themes) {
    if (th && th.negative && th.share >= 0.2 && !th.coveredByContent) add("reviewGap", th.share >= 0.4 ? "high" : "med", "reviewFit", { theme: th.theme, share: th.share });
  }

  const areas = ["images", "title", "arabic", "attrs", "reviewFit"];
  const breakdown = {};
  for (const a of areas) {
    const penalty = issues.filter((i) => i.area === a).reduce((s, i) => s + SEVERITY_WEIGHT[i.sev], 0);
    breakdown[a] = Math.max(5, 100 - penalty);
  }
  if (!themes.length) breakdown.reviewFit = 70; // unknown until reviews are connected
  const weights = { images: 0.25, title: 0.2, arabic: 0.25, attrs: 0.15, reviewFit: 0.15 };
  const score = Math.round(areas.reduce((s, a) => s + breakdown[a] * weights[a], 0));
  const order = { high: 0, med: 1, low: 2 };
  issues.sort((a, b) => order[a.sev] - order[b.sev]);
  return { score, breakdown, issues, channel, category };
}
