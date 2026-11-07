// Sample workspaces for the demo: two clients of one agency.
// Layali's genome is not hand-written: it is built by replaying a realistic history of edits,
// rejections and approvals through the learner, so every rule carries real evidence.
// Inlined into the app by scripts/build.mjs (the import line is dropped there).
import { newGenome, declare, learn } from "./brand-dna.mjs";

function svgUrl(svg) { return "data:image/svg+xml;utf8," + encodeURIComponent(svg); }

const LAYALI_LOGO = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 180"><path d="M92 34a62 62 0 1 0 54 98a50 50 0 1 1-54-98z" fill="#F2C88A"/><circle cx="150" cy="52" r="7" fill="#F2C88A"/><text x="182" y="116" font-family="Georgia,Times New Roman,serif" font-size="78" letter-spacing="16" fill="#F2C88A">LAYALI</text></svg>');
const NOOR_LOGO = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 180"><circle cx="80" cy="90" r="54" fill="none" stroke="#3E4A3D" stroke-width="10"/><circle cx="80" cy="90" r="18" fill="#B08D57"/><text x="160" y="116" font-family="Georgia,Times New Roman,serif" font-size="80" letter-spacing="14" fill="#3E4A3D">NOOR</text></svg>');

export const SAMPLE_WORKSPACES = [
  { id: "layali", name: "Layali Fragrances", nameAr: "ليالي للعطور", sample: true },
  { id: "noor", name: "Noor Modest Wear", nameAr: "نور للأزياء المحتشمة", sample: true }
];

const T0 = "2026-09-01T09:00:00.000Z";
const on = (d) => "2026-" + d + "T10:00:00.000Z";
const C = (category, lang) => ({ channel: "noon", category, lang: lang || "en" });
const titles = (en, ar) => ({ texts: [{ text: en, lang: "en", role: "title" }].concat(ar ? [{ text: ar, lang: "ar", role: "title" }] : []) });

const LAYALI_HISTORY = [
  { type: "edit", at: on("09-08"), product: "musk", field: "titleEn", role: "title", before: "Best Musk Tahara 50ml, Pure White Musk!", after: "Musk Tahara 50ml, Pure White Musk", ctx: C("fragrance") },
  { type: "approve", at: on("09-08"), product: "musk", edits: 6, label: "Title and 4 slides", templates: ["cover", "benefit", "details", "occasion"], content: titles("Musk Tahara 50ml, Pure White Musk", "مسك الطهارة ٥٠ مل · مسك أبيض"), exemplar: { titleEn: "Musk Tahara 50ml, Pure White Musk", titleAr: "مسك الطهارة ٥٠ مل · مسك أبيض" }, ctx: C("fragrance") },
  { type: "edit", at: on("09-14"), product: "burner", field: "titleEn", role: "title", before: "Best Bakhoor Burner in Hand-Hammered Brass!", after: "Bakhoor Burner in Hand-Hammered Brass", ctx: C("home") },
  { type: "approve", at: on("09-14"), product: "burner", edits: 5, label: "Title and 5 slides", templates: ["cover", "benefit", "details", "steps", "dimensions"], content: titles("Bakhoor Burner in Hand-Hammered Brass", "مبخرة نحاس مطروق يدوياً"), exemplar: { titleEn: "Bakhoor Burner in Hand-Hammered Brass", titleAr: "مبخرة نحاس مطروق يدوياً" }, ctx: C("home") },
  { type: "edit", at: on("09-21"), product: "thobem", field: "titleEn", role: "title", before: "Men's Linen Thobe Ivory, Saudi Collar, Breathable Summer Fabric, All Sizes", after: "Men's Linen Thobe · Ivory · Saudi Collar", ctx: C("fashion") },
  { type: "approve", at: on("09-21"), product: "thobem", edits: 5, label: "Title and size chart", templates: ["sizechart"], content: titles("Men's Linen Thobe · Ivory · Saudi Collar", "ثوب كتان رجالي · عاجي · ياقة سعودية"), exemplar: { titleEn: "Men's Linen Thobe · Ivory · Saudi Collar", titleAr: "ثوب كتان رجالي · عاجي · ياقة سعودية" }, ctx: C("fashion") },
  { type: "edit", at: on("09-29"), product: "dates", field: "titleEn", role: "title", before: "Best Sukkari Dates Gift Box 1kg!", after: "Sukkari Dates Gift Box 1kg", ctx: C("food") },
  { type: "approve", at: on("09-29"), product: "dates", edits: 4, label: "Title and Ramadan slide", templates: ["ramadan"], content: titles("Sukkari Dates Gift Box 1kg", "علبة تمر سكري هدية ١ كجم"), exemplar: { titleEn: "Sukkari Dates Gift Box 1kg", titleAr: "علبة تمر سكري هدية ١ كجم" }, ctx: C("food") },
  { type: "edit", at: on("10-06"), product: "coffee", field: "titleEn", role: "title", before: "Saudi Coffee with Cardamom 500g, Light Roast, Khawlani Beans, Fresh Ground Daily", after: "Saudi Coffee with Cardamom 500g", ctx: C("food") },
  { type: "approve", at: on("10-06"), product: "coffee", edits: 3, label: "Title and bullets", content: titles("Saudi Coffee with Cardamom 500g", "قهوة سعودية بالهيل ٥٠٠ جم"), exemplar: { titleEn: "Saudi Coffee with Cardamom 500g", titleAr: "قهوة سعودية بالهيل ٥٠٠ جم" }, ctx: C("food") },
  { type: "edit", at: on("10-13"), product: "oud", field: "titleAr", role: "title", before: "عطر عود الليل الفاخر ١٠٠ مل", after: "عطر عود الليل ١٠٠ مل", ctx: C("fragrance", "ar") },
  { type: "edit", at: on("10-13"), product: "oud", field: "titleEn", role: "title", before: "Oud Al Layl Luxury Eau de Parfum 100ml", after: "Oud Al Layl Eau de Parfum 100ml", ctx: C("fragrance") },
  { type: "reject", at: on("10-13"), product: "oud", reasons: ["tooMuchText"], label: "Details slide", ctx: Object.assign(C("fragrance"), { chars: 180 }) },
  { type: "approve", at: on("10-15"), product: "oud", edits: 3, label: "Title and 4 slides", templates: ["cover", "benefit", "notes", "occasion"], content: titles("Oud Al Layl Eau de Parfum 100ml", "عطر عود الليل ١٠٠ مل"), exemplar: { titleEn: "Oud Al Layl Eau de Parfum 100ml", titleAr: "عطر عود الليل ١٠٠ مل" }, ctx: C("fragrance") },
  { type: "edit", at: on("10-20"), product: "abaya", field: "titleEn", role: "title", before: "Linen Abaya Sand Colour, Relaxed Fit, Side Pockets, Breathable Summer Fabric", after: "Linen Abaya · Sand · Relaxed Fit", ctx: C("fashion") },
  { type: "approve", at: on("10-20"), product: "abaya", edits: 2, label: "Title and size chart", templates: ["sizechart"], content: titles("Linen Abaya · Sand · Relaxed Fit", "عباية كتان · رملي · قصة واسعة"), exemplar: { titleEn: "Linen Abaya · Sand · Relaxed Fit", titleAr: "عباية كتان · رملي · قصة واسعة" }, ctx: C("fashion") },
  { type: "removeSlide", at: on("10-22"), product: "oud", template: "compare", label: "Us vs ordinary", ctx: C("fragrance") },
  { type: "edit", at: on("10-27"), product: "musk", field: "titleAr", role: "title", before: "مسك الطهارة ٥٠ مل، مسك أبيض نقي بدون كحول للاستخدام اليومي", after: "مسك الطهارة ٥٠ مل · مسك أبيض", ctx: C("fragrance", "ar") },
  { type: "edit", at: on("10-28"), product: "oud", field: "bulletsAr", role: "body", before: "زعفران فاخر وعنبر", after: "زعفران وعنبر", ctx: C("fragrance", "ar") },
  { type: "edit", at: on("10-28"), product: "oud", field: "bulletsEn", role: "body", before: "Luxury gift box", after: "Gift box", ctx: C("fragrance") },
  { type: "approve", at: on("10-28"), product: "oud", edits: 2, label: "Bullets", content: { texts: [{ text: "زعفران وعنبر", lang: "ar" }, { text: "Gift box", lang: "en" }] }, exemplar: { bulletsEn: ["Gift box"], bulletsAr: ["زعفران وعنبر"] }, ctx: C("fragrance") }
];

function layaliGenome(events) {
  const g = newGenome("layali", {
    name: "Layali Fragrances", nameAr: "ليالي للعطور", logo: LAYALI_LOGO, logoPos: "top-end", fonts: "kufi",
    palette: [{ hex: "#2A1A0E", role: "background" }, { hex: "#F2C88A", role: "accent" }, { hex: "#F4E9D8", role: "text" }, { hex: "#5C1E1E", role: "primary" }]
  });
  declare(g, { type: "palette", params: {} }, "brandbook", T0, "Brand book p. 4");
  declare(g, { type: "logo", params: { required: true } }, "brandbook", T0, "Brand book p. 6");
  declare(g, { type: "bilingual", params: { mode: "both" }, scope: { channel: ["noon", "amazon"] } }, "brandbook", T0, "Brand book p. 9");
  declare(g, { type: "numerals", params: { style: "arabic" } }, "brandbook", T0, "Brand book p. 9");
  declare(g, { type: "noEmoji", params: {} }, "brandbook", T0, "Brand book p. 10");
  declare(g, { type: "voice", params: { text: "Warm, hospitable Gulf Arabic. Speak to the buyer as «you». Calm confidence, no hype.", textAr: "عربية خليجية دافئة ومضيافة. خاطب المشتري بـ«أنت». ثقة هادئة بلا مبالغة." } }, "brandbook", T0, "Brand book p. 12");
  declare(g, { type: "visual", params: { text: "Low warm light, dark backgrounds with gold accents, one product in focus, no busy props.", textAr: "إضاءة دافئة خافتة، خلفيات داكنة بلمسات ذهبية، منتج واحد في التركيز، بلا إكسسوارات مزدحمة." } }, "brandbook", T0, "Brand book p. 14");
  for (const ev of events) learn(g, ev);
  return g;
}

function noorGenome() {
  const g = newGenome("noor", {
    name: "Noor Modest Wear", nameAr: "نور للأزياء المحتشمة", logo: NOOR_LOGO, logoPos: "top-start", fonts: "naskh",
    palette: [{ hex: "#F4EFE6", role: "background" }, { hex: "#3E4A3D", role: "primary" }, { hex: "#B08D57", role: "accent" }]
  });
  declare(g, { type: "palette", params: {} }, "brandbook", T0, "Style guide");
  declare(g, { type: "bilingual", params: { mode: "both" } }, "brandbook", T0, "Style guide");
  return g;
}

/** Fresh copies of the sample data: { workspaces, genomes, events }. */
export function sampleData() {
  const events = LAYALI_HISTORY.map((e, i) => Object.assign({ id: "seed" + (i + 1), ws: "layali", sample: true }, JSON.parse(JSON.stringify(e))));
  return {
    workspaces: SAMPLE_WORKSPACES.map((w) => Object.assign({}, w)),
    genomes: { layali: layaliGenome(events), noor: noorGenome() },
    events: { layali: events, noor: [] }
  };
}
