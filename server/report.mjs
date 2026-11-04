// Before/after results report as one self-contained HTML document (A4).
// The server prints it to PDF with Chromium; the app shows the same document and can print it
// without a server. Pure: inlined into the app by scripts/build.mjs.

const RT = {
  en: {
    title: "Content results", forClient: "for", period: "Period", prepared: "Prepared by",
    uplift: "Conversion uplift against untouched products", upliftNoControl: "Conversion change of the changed products (no control group in the report)",
    pts: "pts", changedN: "Products changed", convChanged: "Conversion, changed products", units: "Units ordered, changed products", control: "Conversion, control group",
    chartTitle: "Conversion before and after", before: "Before", after: "After", changedG: "Changed products", controlG: "Untouched products (control)",
    table: "Products", sku: "SKU / ASIN", convB: "Conv. before", convA: "Conv. after", d: "Change", unitsB: "Units before", unitsA: "Units after", changedTag: "changed", controlTag: "control",
    method: "How this is measured",
    methodText: "Sessions, units and sales come from the marketplace reports uploaded to Basira. Conversion is units ordered divided by sessions. Changed products are compared with products that weren't touched over the same weeks, so a season or a sale that lifts the whole store isn't credited to the content. The uplift is the changed products' change minus the control group's change, in percentage points.",
    caveat: "Small products move a lot by chance: treat changes on fewer than 100 sessions as noise. This is a comparison, not a controlled experiment.",
    noData: "—"
  },
  ar: {
    title: "نتائج المحتوى", forClient: "لـ", period: "الفترة", prepared: "إعداد",
    uplift: "تحسن معدل التحويل مقارنة بالمنتجات التي لم تتغير", upliftNoControl: "تغير معدل التحويل للمنتجات المعدلة (لا توجد مجموعة مقارنة في التقرير)",
    pts: "نقطة", changedN: "منتجات معدلة", convChanged: "التحويل، المنتجات المعدلة", units: "الوحدات المطلوبة، المنتجات المعدلة", control: "التحويل، مجموعة المقارنة",
    chartTitle: "معدل التحويل قبل وبعد", before: "قبل", after: "بعد", changedG: "المنتجات المعدلة", controlG: "منتجات لم تتغير (مقارنة)",
    table: "المنتجات", sku: "SKU / ASIN", convB: "التحويل قبل", convA: "التحويل بعد", d: "التغير", unitsB: "الوحدات قبل", unitsA: "الوحدات بعد", changedTag: "معدل", controlTag: "مقارنة",
    method: "طريقة القياس",
    methodText: "الجلسات والوحدات والمبيعات مأخوذة من تقارير المتجر المرفوعة إلى بصيرة. معدل التحويل هو الوحدات المطلوبة مقسومة على الجلسات. تُقارن المنتجات المعدلة بمنتجات لم تتغير خلال الأسابيع نفسها، حتى لا يُنسب أثر موسم أو تخفيضات على المتجر كله إلى المحتوى. التحسن هو تغير المنتجات المعدلة ناقص تغير مجموعة المقارنة، بالنقاط المئوية.",
    caveat: "المنتجات الصغيرة تتغير كثيراً بالصدفة: اعتبر التغير على أقل من ١٠٠ جلسة ضجيجاً. هذه مقارنة وليست تجربة محكمة.",
    noData: "—"
  }
};

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const SAFE_COLOUR = /^#[0-9a-fA-F]{6}$/;
const SAFE_LOGO = /^data:image\/(?:(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+|svg\+xml(?:;utf8)?,[^"<>]+)$/;

/**
 * @param {{ result, agency?: { name, logo, colour }, client?, period?, lang?: "en"|"ar", at? }} input
 *        result is the output of compareResults() in server/results.mjs
 */
export function reportHTML(input) {
  const o = input || {};
  const lang = o.lang === "ar" ? "ar" : "en";
  const L = RT[lang];
  const r = o.result || { products: [], changed: {}, control: {}, upliftPts: null, hasControl: false };
  const ag = o.agency || {};
  const accent = SAFE_COLOUR.test(ag.colour || "") ? ag.colour : "#1f5f5b";
  const logo = SAFE_LOGO.test(ag.logo || "") ? ag.logo : "";
  const fmtPct = (v) => (v == null ? L.noData : (Math.round(v * 10000) / 100).toFixed(2) + "%");
  const sign = (v) => (v > 0 ? "+" : v < 0 ? "−" : "");
  const fmtPts = (v) => (v == null ? L.noData : sign(v) + Math.abs(v).toFixed(2) + " " + L.pts);
  const fmtChg = (v) => (v == null ? L.noData : sign(v) + Math.abs(v).toFixed(1) + "%");
  const fmtN = (v) => (v == null ? L.noData : Math.round(v).toLocaleString("en-US"));
  const ch = r.changed || {}, ct = r.control || {};
  const hero = r.upliftPts;

  // Grouped bars: two groups (changed, control) × before/after. Every bar is labelled, so colour is never the only cue.
  const groups = [[L.changedG, ch]].concat(r.hasControl ? [[L.controlG, ct]] : []);
  const vals = groups.flatMap(([, g]) => [g.before && g.before.conv, g.after && g.after.conv]).filter((v) => v != null);
  const maxV = Math.max(0.0001, ...vals) * 1.18;
  const W = 640, H = 230, base = 190, top = 24, gw = W / groups.length, bw = 64, gap = 6;
  const y = (v) => base - ((base - top) * (v || 0)) / maxV;
  const bars = groups.map(([name, g], i) => {
    const cx = gw * i + gw / 2;
    const one = (v, x, fill, label) => v == null ? "" :
      `<path d="M${x},${base} V${y(v) + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${base} Z" fill="${fill}"/>` +
      `<text x="${x + bw / 2}" y="${y(v) - 8}" class="v">${fmtPct(v)}</text><text x="${x + bw / 2}" y="${base + 16}" class="k">${label}</text>`;
    return one(g.before && g.before.conv, cx - bw - gap / 2, "var(--before)", L.before) + one(g.after && g.after.conv, cx + gap / 2, "var(--accent)", L.after) +
      `<text x="${cx}" y="${base + 36}" class="g">${esc(name)}</text>`;
  }).join("");
  const svg = `<svg viewBox="0 0 ${W} ${H + 16}" width="100%" role="img" aria-label="${esc(L.chartTitle)}"><line x1="0" x2="${W}" y1="${base}" y2="${base}" class="axis"/>${bars}</svg>`;

  const rows = (r.products || []).slice(0, 40).map((p) => `<tr><td class="sku">${esc(p.key)} <span class="tag ${p.changed ? "on" : ""}">${p.changed ? L.changedTag : L.controlTag}</span></td>` +
    `<td>${fmtPct(p.before.conv)}</td><td>${fmtPct(p.after.conv)}</td><td class="${p.delta.convPts > 0 ? "up" : p.delta.convPts < 0 ? "down" : ""}">${fmtPts(p.delta.convPts)}</td>` +
    `<td>${fmtN(p.before.units)}</td><td>${fmtN(p.after.units)}</td></tr>`).join("");

  const tile = (label, value, sub) => `<div class="tile"><div class="tl">${esc(label)}</div><div class="tv">${value}</div>${sub ? `<div class="ts">${sub}</div>` : ""}</div>`;
  const at = new Date(o.at || Date.now()).toISOString().slice(0, 10);

  return `<!doctype html><html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(L.title)} · ${esc(o.client || "")}</title><style>
@page{size:A4;margin:14mm 14mm 16mm}
:root{--accent:${accent};--before:#b9b8b3;--ink:#16181a;--ink2:#53565a;--muted:#8a8d91;--line:#e4e2dd;--paper:#ffffff}
*{box-sizing:border-box}html,body{margin:0;background:var(--paper);color:var(--ink);font:13px/1.5 "Readex Pro","Bricolage Grotesque",system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:182mm;margin:0 auto;padding:8px 0}
header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:3px solid var(--accent)}
.brand{display:flex;align-items:center;gap:12px;font-weight:600;font-size:15px}.brand img{max-height:44px;max-width:180px}
.meta{text-align:end;color:var(--ink2);font-size:12px}
h1{font-size:24px;line-height:1.25;margin:22px 0 4px;font-weight:700}
.sub{color:var(--ink2);margin:0 0 18px}
.hero{display:flex;align-items:baseline;gap:14px;padding:16px 18px;border-radius:12px;background:color-mix(in srgb,var(--accent) 9%,white);margin-bottom:16px}
.hero .n{font-size:44px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;color:var(--ink)}
.hero .l{color:var(--ink2);font-size:13px;max-width:60%}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.tile{border:1px solid var(--line);border-radius:10px;padding:10px 12px}.tl{font-size:11px;color:var(--ink2)}.tv{font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;margin-top:2px}.ts{font-size:11px;color:var(--muted)}
h2{font-size:14px;margin:18px 0 8px}
svg text{font-family:inherit}svg .v{font-size:13px;font-weight:600;fill:var(--ink);text-anchor:middle}svg .k{font-size:11px;fill:var(--ink2);text-anchor:middle}svg .g{font-size:12px;fill:var(--ink);text-anchor:middle;font-weight:600}svg .axis{stroke:var(--line);stroke-width:1}
.legend{display:flex;gap:16px;font-size:11px;color:var(--ink2);margin:4px 0 6px}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-inline-end:6px;vertical-align:-1px}
table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:end}th:first-child,td:first-child{text-align:start}th{font-weight:600;color:var(--ink2);font-size:11px}
tr{break-inside:avoid}.tag{font-size:10px;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:0 5px;margin-inline-start:4px}.tag.on{color:var(--ink);border-color:var(--accent)}
.up{color:#1d6b3a;font-weight:600}.down{color:#a1301f;font-weight:600}
.note{margin-top:18px;padding:12px 14px;border-radius:10px;background:#f6f5f2;color:var(--ink2);font-size:11.5px;break-inside:avoid}.note b{color:var(--ink)}
footer{margin-top:16px;color:var(--muted);font-size:11px;display:flex;justify-content:space-between}
</style></head><body><div class="page">
<header><div class="brand">${logo ? `<img src="${logo}" alt="">` : ""}<span>${esc(ag.name || "")}</span></div><div class="meta">${esc(L.title)}<br>${at}</div></header>
<h1>${esc(L.title)}${o.client ? " · " + esc(o.client) : ""}</h1>
${o.period ? `<p class="sub">${esc(L.period)}: ${esc(o.period)}</p>` : '<p class="sub"></p>'}
<div class="hero"><div class="n">${fmtPts(hero)}</div><div class="l">${esc(r.hasControl ? L.uplift : L.upliftNoControl)}</div></div>
<div class="tiles">
${tile(L.changedN, fmtN(ch.count), "")}
${tile(L.convChanged, fmtPct(ch.after && ch.after.conv), fmtPct(ch.before && ch.before.conv) + " → " + fmtPct(ch.after && ch.after.conv))}
${tile(L.units, fmtChg(ch.unitsPct), fmtN(ch.before && ch.before.units) + " → " + fmtN(ch.after && ch.after.units))}
${tile(L.control, r.hasControl ? fmtPts(ct.convPts) : L.noData, r.hasControl ? fmtPct(ct.before && ct.before.conv) + " → " + fmtPct(ct.after && ct.after.conv) : "")}
</div>
<h2>${esc(L.chartTitle)}</h2>
<div class="legend"><span><i style="background:var(--before)"></i>${esc(L.before)}</span><span><i style="background:var(--accent)"></i>${esc(L.after)}</span></div>
${svg}
<h2>${esc(L.table)}</h2>
<table><thead><tr><th>${esc(L.sku)}</th><th>${esc(L.convB)}</th><th>${esc(L.convA)}</th><th>${esc(L.d)}</th><th>${esc(L.unitsB)}</th><th>${esc(L.unitsA)}</th></tr></thead><tbody>${rows}</tbody></table>
<div class="note"><b>${esc(L.method)}.</b> ${esc(L.methodText)}<br><br>${esc(L.caveat)}</div>
<footer><span>${esc(L.prepared)} ${esc(ag.name || "")}</span><span>${at}</span></footer>
</div></body></html>`;
}
