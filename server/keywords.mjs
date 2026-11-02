// Search-term coverage: which common Gulf marketplace searches a listing's title and bullets cover.
// Pure functions with no imports: inlined into the app by scripts/build.mjs.
// The lists are a starting set per category; real search volumes come from marketplace data.

export const KEYWORDS = {
  fragrance: [["عطر", "perfume"], ["عطر عود", "oud perfume"], ["عطر رجالي", "men's perfume"], ["عطر نسائي", "women's perfume"], ["دهن عود", "oud oil"], ["مسك", "musk"], ["عنبر", "amber"], ["زعفران", "saffron"], ["ثبات", "long lasting"], ["فواح", "strong scent"], ["هدية", "gift"], ["أو دو بارفان", "eau de parfum"]],
  fashion: [["عباية", "abaya"], ["عباية سوداء", "black abaya"], ["عباية كتان", "linen abaya"], ["فستان", "dress"], ["جلابية", "jalabiya"], ["ثوب", "thobe"], ["حجاب", "hijab"], ["مقاس", "size"], ["قطن", "cotton"], ["صيفي", "summer"], ["محتشم", "modest"], ["عملي", "everyday"]],
  food: [["تمر", "dates"], ["تمر سكري", "sukkari dates"], ["تمر خلاص", "khalas dates"], ["قهوة سعودية", "saudi coffee"], ["قهوة عربية", "arabic coffee"], ["هيل", "cardamom"], ["عسل", "honey"], ["عسل سدر", "sidr honey"], ["هدية", "gift box"], ["طازج", "fresh"], ["عضوي", "organic"], ["رمضان", "ramadan"]],
  beauty: [["كريم", "cream"], ["مرطب", "moisturizer"], ["سيروم", "serum"], ["واقي شمس", "sunscreen"], ["بشرة جافة", "dry skin"], ["بشرة دهنية", "oily skin"], ["تفتيح", "brightening"], ["طبيعي", "natural"], ["زيت", "oil"], ["عناية بالشعر", "hair care"], ["مكياج", "makeup"], ["حلال", "halal"]],
  home: [["مبخرة", "incense burner"], ["بخور", "bakhoor"], ["معطر", "air freshener"], ["ديكور", "decor"], ["مفرش", "bedding"], ["سجادة صلاة", "prayer mat"], ["دلة", "dallah"], ["فناجين", "coffee cups"], ["هدية", "gift"], ["فاخر", "luxury"], ["كهربائي", "electric"], ["نحاس", "brass"]]
};

/** Arabic normalisation used by search engines: hamza forms, taa marbuta, alef maqsura, diacritics. */
export function normaliseArabic(s) {
  return String(s || "").toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function keywordCoverage(listing) {
  const l = listing || {};
  const cat = KEYWORDS[l.category] ? l.category : "fragrance";
  const ar = " " + normaliseArabic([l.titleAr, ...(l.bulletsAr || [])].join(" ")) + " ";
  const en = " " + normaliseArabic([l.titleEn, ...(l.bulletsEn || [])].join(" ")).replace(/['’]/g, "") + " ";
  const items = KEYWORDS[cat].map(([a, e]) => {
    const na = normaliseArabic(a), ne = normaliseArabic(e).replace(/['’]/g, "");
    return { ar: a, en: e, inAr: ar.includes(" " + na) || ar.includes(" ال" + na), inEn: en.includes(" " + ne) };
  });
  const covered = items.filter((i) => i.inAr || i.inEn).length;
  return { category: cat, items, covered, total: items.length, share: Math.round((covered / items.length) * 100) / 100 };
}
