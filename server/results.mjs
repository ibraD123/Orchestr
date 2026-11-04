// Before/after results from marketplace sales reports.
// Reads Amazon Business Reports (Detail Page Sales and Traffic by Child Item), Noon and other
// exports by matching common column names, and compares products that were changed with those
// that weren't (a control group), so seasonality doesn't get credited to the content.
// Pure functions: inlined into the app by scripts/build.mjs (the import line is dropped there).
import { parseCSV } from "./catalog-csv.mjs";

const norm = (h) => String(h || "").toLowerCase().replace(/﻿/g, "").replace(/[^a-z0-9%؀-ۿ]+/g, " ").trim();
const COLS = {
  key: ["sku", "partner sku", "seller sku", "child asin", "asin", "item sku", "psku", "parent asin", "رمز المنتج"],
  sessions: ["sessions total", "sessions", "sessions mobile app", "visits"],
  views: ["page views total", "page views", "views", "product views", "impressions"],
  units: ["units ordered", "units sold", "units", "quantity", "qty", "ordered units", "الوحدات"],
  orders: ["total order items", "orders", "order items", "الطلبات"],
  sales: ["ordered product sales", "sales", "revenue", "gmv", "ordered revenue", "المبيعات"],
  conversion: ["unit session percentage", "conversion rate", "conversion", "cvr"],
  returns: ["units returned", "returns", "returned units"],
  date: ["date", "day", "order date", "التاريخ"]
};
const AR = "٠١٢٣٤٥٦٧٨٩";
function num(v) {
  const s = String(v == null ? "" : v).replace(/[٠-٩]/g, (d) => AR.indexOf(d)).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** @returns {{ rows: Array<{key, sessions, views, units, orders, sales, conversion, returns, date}>, columns, error }} */
export function parseSalesReport(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { rows: [], columns: null, error: "The report needs a header row and at least one product" };
  const h = rows[0].map(norm);
  const col = {};
  for (const [k, names] of Object.entries(COLS)) {
    col[k] = -1;
    for (const n of names) { const i = h.indexOf(n); if (i >= 0) { col[k] = i; break; } }
    if (col[k] < 0) { const i = h.findIndex((x) => names.some((n) => x.startsWith(n))); col[k] = i; }
  }
  if (col.key < 0) return { rows: [], columns: col, error: "Couldn't find a SKU or ASIN column" };
  if (col.units < 0 && col.sales < 0 && col.conversion < 0) return { rows: [], columns: col, error: "Couldn't find units, sales or conversion columns" };
  const out = rows.slice(1).map((r) => {
    const g = (k) => (col[k] >= 0 ? r[col[k]] : null);
    let conversion = num(g("conversion"));
    if (conversion != null && /%/.test(String(g("conversion"))) || (conversion != null && conversion > 1)) conversion = conversion / 100;
    return { key: String(g("key") || "").trim(), sessions: num(g("sessions")), views: num(g("views")), units: num(g("units")), orders: num(g("orders")), sales: num(g("sales")), conversion, returns: num(g("returns")), date: g("date") ? String(g("date")).trim() : null };
  }).filter((r) => r.key);
  return { rows: out, columns: col, error: null };
}

function sum(rows) {
  const s = { sessions: 0, units: 0, sales: 0, returns: 0, hasSessions: false, convSum: 0, convN: 0 };
  for (const r of rows) {
    if (r.sessions != null) { s.sessions += r.sessions; s.hasSessions = true; }
    else if (r.views != null) { s.sessions += r.views; s.hasSessions = true; }
    s.units += r.units || r.orders || 0; s.sales += r.sales || 0; s.returns += r.returns || 0;
    if (r.conversion != null) { s.convSum += r.conversion; s.convN++; }
  }
  const conv = s.hasSessions && s.sessions > 0 ? s.units / s.sessions : s.convN ? s.convSum / s.convN : null;
  return { sessions: s.hasSessions ? s.sessions : null, units: s.units, sales: Math.round(s.sales * 100) / 100, returns: s.returns, conv: conv == null ? null : Math.round(conv * 10000) / 10000 };
}
const pct = (a, b) => (a == null || b == null || !b ? null : Math.round(((a - b) / b) * 1000) / 10);
const pts = (a, b) => (a == null || b == null ? null : Math.round((a - b) * 10000) / 100);

/**
 * @param {{ before: rows[], after: rows[], changed: string[] }} input  changed = SKUs/ASINs that got Basira fixes
 * Optional: a single report with dates plus changedAt { key: ISO date } splits each product at its own change date.
 */
export function compareResults({ before, after, changed, rows, changedAt }) {
  let b = before || [], a = after || [];
  if (rows && changedAt) {
    b = rows.filter((r) => r.date && changedAt[r.key] && r.date < changedAt[r.key].slice(0, 10));
    a = rows.filter((r) => r.date && changedAt[r.key] && r.date >= changedAt[r.key].slice(0, 10));
    const untouched = rows.filter((r) => !changedAt[r.key]);
    const dates = Object.values(changedAt).sort();
    const mid = dates[Math.floor(dates.length / 2)] || "";
    b = b.concat(untouched.filter((r) => r.date && r.date < mid.slice(0, 10)));
    a = a.concat(untouched.filter((r) => r.date && r.date >= mid.slice(0, 10)));
  }
  const ch = new Set((changed || Object.keys(changedAt || {})).map(String));
  const keys = [...new Set(b.map((r) => r.key).concat(a.map((r) => r.key)))];
  const products = keys.map((k) => {
    const x = sum(b.filter((r) => r.key === k)), y = sum(a.filter((r) => r.key === k));
    return { key: k, changed: ch.has(k), before: x, after: y, delta: { convPts: pts(y.conv, x.conv), unitsPct: pct(y.units, x.units), salesPct: pct(y.sales, x.sales) } };
  }).sort((p, q) => (q.changed - p.changed) || ((q.delta.convPts || 0) - (p.delta.convPts || 0)));
  const group = (flag) => {
    const x = sum(b.filter((r) => ch.has(r.key) === flag)), y = sum(a.filter((r) => ch.has(r.key) === flag));
    return { count: products.filter((p) => p.changed === flag).length, before: x, after: y, convPts: pts(y.conv, x.conv), unitsPct: pct(y.units, x.units), salesPct: pct(y.sales, x.sales) };
  };
  const changedG = group(true), controlG = group(false);
  const uplift = changedG.convPts != null && controlG.convPts != null && controlG.count ? Math.round((changedG.convPts - controlG.convPts) * 100) / 100 : changedG.convPts;
  return { products, changed: changedG, control: controlG, upliftPts: uplift, hasControl: controlG.count > 0 };
}
