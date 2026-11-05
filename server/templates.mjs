// Basira slide templates. Each template answers one buyer question.
// Pure functions with no imports: render.mjs uses them for PNG export, and
// scripts/build.mjs inlines them into the app for the live preview, so both match exactly.

export const SLIDE_W = 1600;
export const SLIDE_H = 2000;

export const TEMPLATE_GROUPS = [
  { id: "essentials", name: ["Essentials", "الأساسيات"] },
  { id: "conversion", name: ["Conversion", "رفع التحويل"] },
  { id: "information", name: ["Information", "معلومات المنتج"] },
  { id: "seasonal", name: ["Seasonal", "المواسم"] }
];

export const TPL_ICONS = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l7-7"/>',
  shield: '<path d="M12 3l8 4v5c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12M12 9c-2-4-6-4-6-1s4 1 6 1zm0 0c2-4 6-4 6-1s-4 1-6 1z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  sparkle: '<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  ruler: '<rect x="2" y="8" width="20" height="8" rx="1"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
  return: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'
};
export const ICON_NAMES = Object.keys(TPL_ICONS);
const STAR = "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z";

const f = (key, type, label, extra) => Object.assign({ key, type, label }, extra || {});
const HEAD = [f("headAr", "text", ["Headline (Arabic)", "العنوان (عربي)"], { dir: "rtl", lang: "ar" }), f("headEn", "text", ["Headline (English)", "العنوان (إنجليزي)"], { dir: "ltr", lang: "en" })];
const TITLE = [f("titleAr", "text", ["Title (Arabic)", "العنوان (عربي)"], { dir: "rtl", lang: "ar" }), f("titleEn", "text", ["Title (English)", "العنوان (إنجليزي)"], { dir: "ltr", lang: "en" })];
const LINES = [f("linesAr", "lines", ["Points (Arabic), one per line", "النقاط (عربي)، سطر لكل نقطة"], { dir: "rtl", lang: "ar" }), f("linesEn", "lines", ["Points (English), one per line", "النقاط (إنجليزي)، سطر لكل نقطة"], { dir: "ltr", lang: "en" })];

export const TEMPLATES = [
  { id: "cover", group: "essentials", name: ["Main image", "الصورة الرئيسية"], question: ["Rule-safe first impression", "انطباع أول مطابق للقواعد"], fields: [], sample: {} },
  { id: "benefit", group: "essentials", name: ["Key benefit", "الميزة الأهم"], question: ["Answers the top doubt", "يجيب عن أكبر شك"], fields: HEAD,
    sample: { headAr: "ثبات حتى 12 ساعة", headEn: "Lasts up to 12 hours" } },
  { id: "details", group: "essentials", name: ["Details", "التفاصيل"], question: ["What is it made of?", "مِمّ صُنع؟"], fields: TITLE.concat(LINES),
    sample: { titleAr: "المكوّنات", titleEn: "What's inside", linesAr: "عود كمبودي\nزعفران\nعنبر", linesEn: "Cambodian oud\nSaffron\nAmber" } },
  { id: "occasion", group: "essentials", name: ["Occasion", "المناسبة"], question: ["When to buy it", "متى يشتريه؟"], fields: HEAD,
    sample: { headAr: "هدية العيد", headEn: "The Eid gift" } },

  { id: "compare", group: "conversion", name: ["Us vs ordinary", "نحن مقابل العادي"], question: ["Why pay more for this one?", "لماذا هذا المنتج؟"],
    fields: TITLE.concat([f("usName", "text", ["Your column", "عمودك"]), f("themName", "text", ["Other column", "العمود الآخر"]), f("rows", "rows", ["Rows: Arabic | English | ours yes/no | theirs yes/no", "الصفوف: عربي | إنجليزي | نحن نعم/لا | هم نعم/لا"])]),
    sample: { titleAr: "لماذا ليالي؟", titleEn: "Why Layali", usName: "LAYALI", themName: "عادي · Ordinary", rows: "ثبات 12 ساعة | 12-hour wear | yes | no\nعود طبيعي | Natural oud | yes | no\nتغليف هدايا | Gift packaging | yes | no\nسعر مناسب | Fair price | yes | yes" } },
  { id: "review", group: "conversion", name: ["Buyer quote", "رأي مشترٍ"], question: ["Do people like it?", "هل أعجب الناس؟"],
    fields: [f("quoteAr", "text", ["Quote (Arabic)", "الاقتباس (عربي)"], { dir: "rtl", lang: "ar" }), f("quoteEn", "text", ["Quote (English)", "الاقتباس (إنجليزي)"], { dir: "ltr", lang: "en" }), f("author", "text", ["Who said it", "القائل"]), f("rating", "text", ["Rating, e.g. 4.8", "التقييم، مثلاً 4.8"]), f("count", "text", ["Number of reviews", "عدد التقييمات"])],
    sample: { quoteAr: "ريحته فخمة وتثبت معي طول اليوم", quoteEn: "Rich scent that lasts all day", author: "نورة · الرياض", rating: "4.8", count: "1240" } },
  { id: "icons", group: "conversion", name: ["Three reasons", "ثلاثة أسباب"], question: ["What do I get?", "ماذا أحصل؟"],
    fields: TITLE.concat([f("items", "rows", ["Items: icon | Arabic | English", "العناصر: أيقونة | عربي | إنجليزي"])]),
    sample: { titleAr: "صُنع ليدوم", titleEn: "Made to last", items: "clock | ثبات 12 ساعة | 12-hour wear\nleaf | مكوّنات طبيعية | Natural ingredients\ngift | جاهز للإهداء | Gift-ready box" } },
  { id: "trust", group: "conversion", name: ["Delivery and returns", "التوصيل والإرجاع"], question: ["Is it safe to order?", "هل الطلب آمن؟"],
    fields: TITLE.concat([f("items", "rows", ["Badges: icon | Arabic | English", "الشارات: أيقونة | عربي | إنجليزي"])]),
    sample: { titleAr: "اطلب بثقة", titleEn: "Order with confidence", items: "truck | توصيل خلال يومين | 2-day delivery\ncash | الدفع عند الاستلام | Cash on delivery\nreturn | إرجاع سهل خلال 14 يوماً | Easy 14-day returns\nshield | منتج أصلي 100% | 100% original" } },

  { id: "sizechart", group: "information", name: ["Size chart", "جدول المقاسات"], question: ["Will it fit?", "هل سيناسبني؟"], categories: ["fashion"],
    fields: TITLE.concat([f("rows", "rows", ["Table: first row is the header", "الجدول: الصف الأول للعناوين"]), f("tipAr", "text", ["Fit tip (Arabic)", "نصيحة المقاس (عربي)"], { dir: "rtl", lang: "ar" }), f("tipEn", "text", ["Fit tip (English)", "نصيحة المقاس (إنجليزي)"], { dir: "ltr", lang: "en" })]),
    sample: { titleAr: "جدول المقاسات", titleEn: "Size chart", rows: "المقاس · Size | الصدر · Bust | الطول · Length\nS | 92 | 138\nM | 98 | 140\nL | 104 | 142\nXL | 110 | 144", tipAr: "القصة واسعة: اطلبي مقاسك المعتاد", tipEn: "Relaxed cut: order your usual size" } },
  { id: "steps", group: "information", name: ["How to use", "طريقة الاستخدام"], question: ["How do I use it?", "كيف أستخدمه؟"], fields: TITLE.concat(LINES),
    sample: { titleAr: "طريقة الاستخدام", titleEn: "How to use", linesAr: "رشّي على نقاط النبض\nلا تفركي البشرة\nجدّدي بعد 8 ساعات", linesEn: "Spray on pulse points\nDon't rub the skin\nTop up after 8 hours" } },
  { id: "inbox", group: "information", name: ["What's in the box", "محتويات العلبة"], question: ["What arrives?", "ماذا يصلني؟"], fields: TITLE.concat(LINES),
    sample: { titleAr: "في العلبة", titleEn: "In the box", linesAr: "عطر 100 مل\nعينة 10 مل\nكيس هدية", linesEn: "100 ml perfume\n10 ml travel spray\nGift bag" } },
  { id: "dimensions", group: "information", name: ["Dimensions", "الأبعاد"], question: ["How big is it?", "ما حجمه؟"],
    fields: TITLE.concat([f("width", "text", ["Width", "العرض"]), f("height", "text", ["Height", "الارتفاع"]), f("unit", "text", ["Unit", "الوحدة"])]),
    sample: { titleAr: "الحجم الحقيقي", titleEn: "Actual size", width: "7.5", height: "12", unit: "cm" } },
  { id: "notes", group: "information", name: ["Fragrance notes", "هرم العطر"], question: ["What does it smell like?", "ما رائحته؟"], categories: ["fragrance"],
    fields: TITLE.concat([f("top", "text", ["Top notes: Arabic | English", "المقدمة: عربي | إنجليزي"]), f("heart", "text", ["Heart notes: Arabic | English", "القلب: عربي | إنجليزي"]), f("base", "text", ["Base notes: Arabic | English", "القاعدة: عربي | إنجليزي"])]),
    sample: { titleAr: "هرم العطر", titleEn: "Fragrance notes", top: "زعفران، برغموت | Saffron, bergamot", heart: "ورد طائفي | Taif rose", base: "عود، عنبر، مسك | Oud, amber, musk" } },

  { id: "ramadan", group: "seasonal", name: ["Ramadan", "رمضان"], question: ["Gift season", "موسم الهدايا"], fields: HEAD.concat([f("offerAr", "text", ["Offer (Arabic)", "العرض (عربي)"], { dir: "rtl", lang: "ar" }), f("offerEn", "text", ["Offer (English)", "العرض (إنجليزي)"], { dir: "ltr", lang: "en" })]),
    sample: { headAr: "رمضان كريم", headEn: "Ramadan Kareem", offerAr: "خصم 20% على هدايا رمضان", offerEn: "20% off Ramadan gifts" }, kit: { bg: "#14233F", fg: "#F2C88A", accent: "#E8EDF7" } },
  { id: "eid", group: "seasonal", name: ["Eid", "العيد"], question: ["The Eid gift", "هدية العيد"], fields: HEAD.concat([f("offerAr", "text", ["Offer (Arabic)", "العرض (عربي)"], { dir: "rtl", lang: "ar" }), f("offerEn", "text", ["Offer (English)", "العرض (إنجليزي)"], { dir: "ltr", lang: "en" })]),
    sample: { headAr: "عيدكم مبارك", headEn: "Eid Mubarak", offerAr: "تغليف هدايا مجاني", offerEn: "Free gift wrapping" }, kit: { bg: "#5C1E1E", fg: "#F3D58C", accent: "#F4E2D8" } },
  { id: "nationalday", group: "seasonal", name: ["Saudi National Day", "اليوم الوطني"], question: ["23 September", "٢٣ سبتمبر"], fields: HEAD.concat([f("offerAr", "text", ["Offer (Arabic)", "العرض (عربي)"], { dir: "rtl", lang: "ar" }), f("offerEn", "text", ["Offer (English)", "العرض (إنجليزي)"], { dir: "ltr", lang: "en" })]),
    sample: { headAr: "دام عزك يا وطن", headEn: "Saudi National Day", offerAr: "خصم 23% لمدة 3 أيام", offerEn: "23% off for 3 days" }, kit: { bg: "#0B5D3B", fg: "#FFFFFF", accent: "#CDE8D8" } },
  { id: "whitefriday", group: "seasonal", name: ["White Friday", "الجمعة البيضاء"], question: ["The biggest sale", "أكبر تخفيضات"], fields: HEAD.concat([f("discount", "text", ["Discount, e.g. 40%", "الخصم، مثلاً 40%"])]),
    sample: { headAr: "الجمعة البيضاء", headEn: "White Friday", discount: "40%" }, kit: { bg: "#0D0D0D", fg: "#FFFFFF", accent: "#BDBDBD" } }
];
export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);

// Font pairs: Arabic display, Latin display, body. Brand DNA picks one.
export const TEMPLATE_FONTS = {
  // Single quotes: these values go inside a double-quoted style attribute.
  kufi: ["'Reem Kufi'", "'Bricolage Grotesque'", "'Readex Pro'"],
  naskh: ["'Amiri'", "'Amiri'", "'Readex Pro'"],
  modern: ["'Readex Pro'", "'Readex Pro'", "'Readex Pro'"]
};
export const LOGO_POSITIONS = ["top-end", "top-start", "bottom"];
export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || null;

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function arDigits(s, numerals) { return numerals === "arabic" ? String(s).replace(/[0-9]/g, (d) => AR_DIGITS[d]) : String(s).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
const lines = (v) => String(v || "").split("\n").map((x) => x.trim()).filter(Boolean);
const cells = (row) => row.split("|").map((x) => x.trim());
const yes = (v) => /^(yes|y|1|true|نعم|✓)$/i.test(String(v || "").trim());
function icon(name, size) {
  const p = TPL_ICONS[name] || TPL_ICONS.sparkle;
  return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + p + "</svg>";
}

export const TEMPLATE_CSS = `
.bz{position:relative;width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;background:var(--bg);color:var(--fg);font-family:var(--fb),"Readex Pro",sans-serif;--soft:color-mix(in srgb,var(--fg) 12%,transparent);--line:color-mix(in srgb,var(--fg) 28%,transparent)}
.bz *{box-sizing:border-box;margin:0;padding:0}
.bz .brand{position:absolute;top:84px;inset-inline-end:96px;font-family:var(--fl),sans-serif;font-weight:700;font-size:44px;letter-spacing:.24em;color:var(--ac);opacity:.85;direction:ltr}
.bz .prod{position:absolute;display:flex;align-items:center;justify-content:center}
.bz .prod img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 40px 40px rgba(0,0,0,.28))}
.bz .stack{position:absolute;inset-inline:120px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:26px}
.bz .h1{font-family:var(--fa),"Readex Pro",sans-serif;font-weight:600;font-size:150px;line-height:1.16}
.bz .h1.en{font-family:var(--fl),sans-serif;font-weight:700;font-size:124px;line-height:1.02;letter-spacing:-.02em}
.bz .h2{font-family:var(--fa),"Readex Pro",sans-serif;font-weight:600;font-size:104px;line-height:1.2}
.bz .h2.en{font-family:var(--fl),sans-serif;font-weight:700;font-size:90px;line-height:1.05;letter-spacing:-.02em}
.bz .sub{font-size:56px;font-weight:300;color:var(--ac);line-height:1.3}
.bz .en-sub{font-size:44px;font-weight:300;color:var(--ac);opacity:.9;line-height:1.3;direction:ltr}
.bz .t{font-size:62px;line-height:1.3}
.bz ul.list{list-style:none;display:flex;flex-direction:column;gap:44px}
.bz ul.list li{display:flex;gap:30px;align-items:flex-start}
.bz ul.list li::before{content:"";flex:none;width:26px;height:26px;margin-top:28px;transform:rotate(45deg);background:var(--fg)}
.bz .pill{display:inline-flex;align-items:center;gap:20px;padding:22px 44px;border-radius:999px;background:var(--fg);color:var(--bg);font-size:58px;font-weight:400}
.bz .card{background:var(--soft);border-radius:40px}
.bz table{border-collapse:collapse;width:100%;font-size:54px;text-align:center;font-variant-numeric:tabular-nums}
.bz th{font-weight:400;font-size:40px;color:var(--ac);padding:26px 12px;border-bottom:3px solid var(--line)}
.bz td{padding:30px 12px;border-bottom:2px solid var(--line)}
.bz td:first-child{font-weight:600}
.bz .ic{display:grid;place-items:center;width:200px;height:200px;border-radius:50%;background:var(--soft);color:var(--fg);flex:none}
.bz .num{display:grid;place-items:center;width:140px;height:140px;border-radius:50%;background:var(--fg);color:var(--bg);font-family:var(--fl),sans-serif;font-weight:700;font-size:72px;flex:none}
.bz .mark{font-size:84px;font-weight:600;line-height:1}
.bz .logo{position:absolute;top:56px;height:84px;max-width:420px;object-fit:contain}
.bz .logo.top-end{inset-inline-end:96px;object-position:right center}
.bz .logo.top-start{inset-inline-start:96px;object-position:left center}
.bz .logo.bottom{top:auto;bottom:44px;left:50%;transform:translateX(-50%);object-position:center}
.bz .pattern{position:absolute;inset:0;opacity:.12;background-image:radial-gradient(circle at 50% 50%,var(--fg) 3px,transparent 4px);background-size:80px 80px}
`;

/**
 * HTML for one slide.
 * @param {string} id template id
 * @param {object} fields values for the template's fields
 * @param {{ image:string, kit:{bg,fg,accent}, language:"ar"|"en"|"both", numerals:"arabic"|"western", brand?:string }} ctx
 */
export function templateHTML(id, fields, ctx) {
  const tpl = templateById(id) || TEMPLATES[0];
  const v = Object.assign({}, tpl.sample, fields || {});
  const kit = Object.assign({ bg: "#2A1A0E", fg: "#F2C88A", accent: "#F4E9D8" }, tpl.kit || {}, ctx.kit || {});
  const lang = ctx.language || "both", ar = lang !== "en", en = lang !== "ar";
  const num = lang === "en" ? "western" : ctx.numerals || "arabic";
  const A = (s) => esc(arDigits(s, num));
  const E = (s) => esc(s);
  const img = (style) => '<div class="prod" style="' + style + '"><img src="' + ctx.image + '" alt=""></div>';
  // Headline in the active languages: Arabic leads, English follows smaller.
  const head = (a, e, size) => {
    const big = size === 2 ? "h2" : "h1";
    return (ar && a ? '<div class="' + big + '" dir="rtl">' + A(a) + "</div>" : "") +
      (en && e ? '<div class="' + (ar ? "sub" : big + " en") + '" dir="ltr">' + E(e) + "</div>" : "");
  };
  // Bilingual text item: Arabic with English under it.
  const pair = (a, e, cls) => (ar && a ? '<div class="' + (cls || "t") + '" dir="rtl">' + A(a) + "</div>" : "") + (en && e ? '<div class="' + (ar ? "en-sub" : cls || "t") + '" dir="ltr">' + E(e) + "</div>" : "");
  const zipLines = (la, le) => { const a = lines(la), e = lines(le), n = Math.max(ar ? a.length : 0, en ? e.length : 0); const out = []; for (let i = 0; i < n; i++) out.push([a[i] || "", e[i] || ""]); return out; };
  const dir = ar ? "rtl" : "ltr";
  let body = "", bg = "var(--bg)";

  switch (tpl.id) {
    case "cover":
      bg = "#FFFFFF";
      body = img("inset:120px");
      break;
    case "benefit":
      body = '<div class="stack" style="top:170px">' + head(v.headAr, v.headEn) + "</div>" + img("inset:700px 300px 120px 300px");
      break;
    case "details":
      body = img("top:280px;bottom:280px;width:700px;inset-inline-end:80px") +
        '<div style="position:absolute;top:400px;inset-inline-start:120px;width:720px;display:flex;flex-direction:column;gap:56px">' + head(v.titleAr, v.titleEn, 2) +
        '<ul class="list">' + zipLines(v.linesAr, v.linesEn).map((p) => "<li><div>" + pair(p[0], p[1]) + "</div></li>").join("") + "</ul></div>";
      break;
    case "occasion":
      body = img("inset:170px 300px 560px 300px") + '<div class="stack" style="bottom:160px">' + head(v.headAr, v.headEn) + "</div>";
      break;
    case "compare": {
      const rows = lines(v.rows).map(cells);
      const mark = (ok) => '<span class="mark" style="color:' + (ok ? "var(--fg)" : "color-mix(in srgb,var(--fg) 35%,transparent)") + '">' + (ok ? "✓" : "✕") + "</span>";
      body = '<div class="stack" style="top:150px">' + head(v.titleAr, v.titleEn, 2) + "</div>" + img("top:420px;height:420px;inset-inline:560px") +
        '<div class="card" style="position:absolute;inset-inline:100px;top:900px;padding:30px 56px"><table><thead><tr><th style="text-align:start"></th><th style="color:var(--fg);font-weight:600">' + E(v.usName) + "</th><th>" + A(v.themName) + "</th></tr></thead><tbody>" +
        rows.map((r) => '<tr><td style="text-align:start;font-weight:400;font-size:52px">' + pair(r[0], r[1], "t") + "</td><td>" + mark(yes(r[2])) + "</td><td>" + mark(yes(r[3])) + "</td></tr>").join("") + "</tbody></table></div>";
      break;
    }
    case "review": {
      const stars = Math.max(0, Math.min(5, Math.round(parseFloat(v.rating) || 5)));
      body = img("top:120px;height:760px;inset-inline:400px") +
        '<div class="card" style="position:absolute;inset-inline:110px;top:940px;padding:80px 90px;display:flex;flex-direction:column;gap:40px;align-items:center;text-align:center">' +
        '<div style="display:flex;gap:16px;color:var(--fg)">' + Array.from({ length: 5 }, (_, i) => '<svg viewBox="0 0 24 24" width="84" height="84" fill="currentColor" style="opacity:' + (i < stars ? 1 : .25) + '"><path d="' + STAR + '"/></svg>').join("") + "</div>" +
        (ar && v.quoteAr ? '<div class="h2" dir="rtl" style="font-size:88px">«' + A(v.quoteAr) + "»</div>" : "") +
        (en && v.quoteEn ? '<div class="' + (ar ? "sub" : "h2 en") + '" dir="ltr">“' + E(v.quoteEn) + "”</div>" : "") +
        '<div class="sub" style="font-size:46px">' + A(v.author) + "</div></div>" +
        '<div class="stack" style="bottom:110px"><span class="pill" dir="' + dir + '"><span>★ ' + A(v.rating || "") + "</span><span>·</span><span>" + A(v.count || "") + " " + (ar ? "تقييم" : "reviews") + "</span></span></div>";
      break;
    }
    case "icons":
    case "trust": {
      const items = lines(v.items).map(cells).slice(0, 4);
      const grid = tpl.id === "trust" ? "grid-template-columns:1fr 1fr;gap:56px 48px" : "grid-template-columns:1fr;gap:64px";
      body = '<div class="stack" style="top:150px">' + head(v.titleAr, v.titleEn, 2) + "</div>" +
        (tpl.id === "icons" ? img("top:520px;bottom:200px;width:640px;inset-inline-end:80px") : img("top:470px;height:560px;inset-inline:520px")) +
        '<div style="position:absolute;' + (tpl.id === "icons" ? "top:600px;inset-inline-start:110px;width:820px" : "top:1110px;inset-inline:110px") + ';display:grid;' + grid + '">' +
        items.map((it) => '<div style="display:flex;gap:40px;align-items:center' + (tpl.id === "trust" ? ";background:var(--soft);border-radius:36px;padding:36px 40px" : "") + '"><span class="ic"' + (tpl.id === "trust" ? ' style="width:150px;height:150px"' : "") + ">" + icon(it[0], tpl.id === "trust" ? 84 : 110) + '</span><div style="display:flex;flex-direction:column;gap:8px">' + pair(it[1], it[2], "t") + "</div></div>").join("") + "</div>";
      break;
    }
    case "sizechart": {
      const rows = lines(v.rows).map(cells);
      const head0 = rows.shift() || [];
      body = '<div class="stack" style="top:150px">' + head(v.titleAr, v.titleEn, 2) + "</div>" + img("top:460px;height:600px;inset-inline:520px") +
        '<div class="card" style="position:absolute;inset-inline:100px;top:1110px;padding:30px 56px"><table dir="' + dir + '"><thead><tr>' + head0.map((h) => "<th>" + A(h) + "</th>").join("") + "</tr></thead><tbody>" +
        rows.map((r) => "<tr>" + r.map((c) => "<td>" + A(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>" +
        '<div class="stack" style="bottom:90px"><span class="pill">' + icon("ruler", 64) + "<span>" + (ar && v.tipAr ? A(v.tipAr) : E(v.tipEn)) + "</span></span></div>";
      break;
    }
    case "steps": {
      const st = zipLines(v.linesAr, v.linesEn).slice(0, 4);
      body = '<div class="stack" style="top:150px">' + head(v.titleAr, v.titleEn, 2) + "</div>" + img("top:470px;height:560px;inset-inline:520px") +
        '<div style="position:absolute;inset-inline:130px;top:1110px;display:flex;flex-direction:column;gap:60px">' +
        st.map((p, i) => '<div style="display:flex;gap:48px;align-items:center"><span class="num">' + (ar ? A(String(i + 1)) : i + 1) + '</span><div style="display:flex;flex-direction:column;gap:6px">' + pair(p[0], p[1]) + "</div></div>").join("") + "</div>";
      break;
    }
    case "inbox": {
      const its = zipLines(v.linesAr, v.linesEn).slice(0, 4);
      body = '<div class="stack" style="top:150px">' + head(v.titleAr, v.titleEn, 2) + "</div>" + img("top:450px;height:760px;inset-inline:300px") +
        '<div style="position:absolute;inset-inline:100px;bottom:130px;display:grid;grid-template-columns:repeat(' + Math.max(1, its.length) + ',1fr);gap:32px">' +
        its.map((p) => '<div class="card" style="padding:48px 30px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px"><span style="color:var(--fg)">' + icon("box", 96) + "</span>" + pair(p[0], p[1], "t") + "</div>").join("") + "</div>";
      break;
    }
    case "dimensions": {
      const u = esc(v.unit || "cm");
      body = '<div class="stack" style="top:150px">' + head(v.titleAr, v.titleEn, 2) + "</div>" + img("top:520px;bottom:300px;inset-inline:420px") +
        '<div style="position:absolute;inset-inline:420px;bottom:200px;height:4px;background:var(--fg)"></div>' +
        '<div style="position:absolute;inset-inline:420px;bottom:120px;text-align:center;font-family:var(--fl),sans-serif;font-weight:700;font-size:72px;direction:ltr">' + A(v.width) + " " + u + "</div>" +
        '<div style="position:absolute;top:520px;bottom:300px;inset-inline-end:330px;width:4px;background:var(--fg)"></div>' +
        '<div style="position:absolute;top:50%;inset-inline-end:110px;font-family:var(--fl),sans-serif;font-weight:700;font-size:72px;direction:ltr">' + A(v.height) + " " + u + "</div>";
      break;
    }
    case "notes": {
      const tiers = [["top", "المقدمة", "Top"], ["heart", "القلب", "Heart"], ["base", "القاعدة", "Base"]];
      body = '<div class="stack" style="top:150px">' + head(v.titleAr, v.titleEn, 2) + "</div>" + img("top:460px;height:600px;inset-inline:540px") +
        '<div style="position:absolute;inset-inline:120px;top:1120px;display:flex;flex-direction:column;gap:30px;align-items:center">' +
        tiers.map((tr, i) => { const c = cells(v[tr[0]] || ""); return '<div class="card" style="width:' + (62 + i * 19) + '%;padding:34px 48px;text-align:center;display:flex;flex-direction:column;gap:8px"><div class="en-sub" style="direction:' + dir + ';letter-spacing:.08em">' + (ar ? tr[1] : "") + (ar && en ? " · " : "") + (en ? tr[2].toUpperCase() : "") + "</div>" + pair(c[0], c[1], "t") + "</div>"; }).join("") + "</div>";
      break;
    }
    case "ramadan":
    case "eid":
    case "nationalday": {
      const deco = tpl.id === "ramadan"
        ? '<svg style="position:absolute;top:110px;inset-inline-start:110px;color:var(--fg)" width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg><svg style="position:absolute;top:0;inset-inline-end:440px;color:var(--fg);opacity:.9" width="110" height="360" viewBox="0 0 40 130" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 0v40"/><path d="M8 52h24l-3 40H11z"/><path d="M12 52c0-8 16-8 16 0M10 92h20l-4 10H14z"/><path d="M20 62v20" stroke-width="3"/></svg>'
        : tpl.id === "eid" ? '<div class="pattern"></div>' : '<div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg,transparent 0 60px,color-mix(in srgb,var(--fg) 6%,transparent) 60px 120px)"></div>';
      const top = tpl.id === "ramadan" ? 400 : 200;
      body = deco + img("inset:" + (top + 360) + "px 320px 480px 320px") + '<div class="stack" style="top:' + top + 'px">' + head(v.headAr, v.headEn) + "</div>" +
        '<div class="stack" style="bottom:170px"><span class="pill">' + (ar && v.offerAr ? A(v.offerAr) : E(v.offerEn)) + "</span>" + (ar && en && v.offerEn ? '<div class="en-sub">' + E(v.offerEn) + "</div>" : "") + "</div>";
      break;
    }
    case "whitefriday":
      body = '<div style="position:absolute;inset-inline-end:-200px;top:-200px;width:860px;height:860px;border-radius:50%;background:var(--fg);box-sizing:border-box;padding-top:200px;padding-inline-end:200px;display:grid;place-items:center"><div style="color:var(--bg);font-family:var(--fl),sans-serif;font-weight:800;font-size:200px;letter-spacing:-.04em;direction:ltr">−' + E(v.discount || "") + "</div></div>" +
        img("inset:980px 300px 120px 300px") + '<div style="position:absolute;top:680px;inset-inline-start:110px;display:flex;flex-direction:column;gap:20px;max-width:1100px">' + head(v.headAr, v.headEn) + "</div>";
      break;
  }
  // The brand's logo replaces the plain brand name; the main image stays clean (marketplace rules).
  const logo = ctx.logo && ctx.logo.src && tpl.id !== "cover" ? '<img class="logo ' + (LOGO_POSITIONS.indexOf(ctx.logo.pos) > -1 ? ctx.logo.pos : "top-end") + '" src="' + esc(ctx.logo.src) + '" alt="">' : "";
  const brand = !logo && ctx.brand && tpl.id !== "cover" ? '<div class="brand">' + esc(ctx.brand) + "</div>" : "";
  const fonts = TEMPLATE_FONTS[ctx.fonts] || TEMPLATE_FONTS.kufi;
  return '<div class="bz" dir="' + dir + '" style="--bg:' + (bg === "#FFFFFF" ? "#FFFFFF" : kit.bg) + ";--fg:" + kit.fg + ";--ac:" + kit.accent + ";--fa:" + fonts[0] + ";--fl:" + fonts[1] + ";--fb:" + fonts[2] + '">' + logo + brand + body + "</div>";
}

/**
 * A generated scene as a full-bleed background with the headline typeset over it: the fallback
 * when an image model could not draw the text exactly (see server/slidegen.mjs).
 * @param {{ background: string, headAr?, headEn?, kit, language, numerals, fonts, logo?, brand? }} ctx
 */
export function sceneHTML(ctx) {
  const kit = Object.assign({ bg: "#2A1A0E", fg: "#F2C88A", accent: "#F4E9D8" }, ctx.kit || {});
  const lang = ctx.language || "both", ar = lang !== "en", en = lang !== "ar";
  const num = lang === "en" ? "western" : ctx.numerals || "arabic";
  const fonts = TEMPLATE_FONTS[ctx.fonts] || TEMPLATE_FONTS.kufi;
  // Long headlines drop a size so they fit the calm top third of the scene in two lines at most.
  const big = String(ar ? ctx.headAr || "" : ctx.headEn || "").length > 18 ? "h2" : "h1";
  const head = (ar && ctx.headAr ? '<div class="' + big + '" dir="rtl" style="line-height:1.3">' + esc(arDigits(ctx.headAr, num)) + "</div>" : "") +
    (en && ctx.headEn ? '<div class="' + (ar ? "sub" : big + " en") + '" dir="ltr">' + esc(ctx.headEn) + "</div>" : "");
  const logo = ctx.logo && ctx.logo.src ? '<img class="logo ' + (LOGO_POSITIONS.indexOf(ctx.logo.pos) > -1 ? ctx.logo.pos : "top-end") + '" src="' + esc(ctx.logo.src) + '" alt="">' : "";
  const brand = !logo && ctx.brand ? '<div class="brand">' + esc(ctx.brand) + "</div>" : "";
  return '<div class="bz" dir="' + (ar ? "rtl" : "ltr") + '" style="--bg:' + kit.bg + ";--fg:" + kit.fg + ";--ac:" + kit.accent + ";--fa:" + fonts[0] + ";--fl:" + fonts[1] + ";--fb:" + fonts[2] + '">' +
    '<img src="' + esc(ctx.background) + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">' +
    '<div style="position:absolute;inset:0 0 auto 0;height:820px;background:linear-gradient(to bottom,color-mix(in srgb,var(--bg) 82%,transparent) 55%,transparent)"></div>' +
    logo + brand + '<div class="stack" style="top:190px">' + head + "</div></div>";
}

