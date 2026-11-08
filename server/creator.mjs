// Creator: what goes on a listing's images, decided from data rather than from a blank canvas.
// Pure functions with no imports: the server uses this module directly, and scripts/build.mjs
// inlines it into the app.
//
//   planSet       which slides a product needs and why: buyers' reviews, the audit, what
//                 competitors show (and don't), and which slides raised this brand's sales
//   galleryGaps   what the top competitors' galleries cover, slot by slot
//   standout      how much a main image stands out among its neighbours in search results
//   seasonPack    put a seasonal slide on a product's set, keeping what to roll back to

/** What one marketplace image shows. Competitor galleries are classified into these. */
export const GALLERY_KINDS = ["main", "lifestyle", "model", "benefit", "details", "sizechart", "dimensions", "notes", "howto", "inbox", "compare", "review", "trust", "seasonal", "other"];

// The slide template that answers each kind of image.
const KIND_TEMPLATE = {
  main: "cover", lifestyle: "occasion", model: "occasion", benefit: "benefit", details: "details",
  sizechart: "sizechart", dimensions: "dimensions", notes: "notes", howto: "steps", inbox: "inbox",
  compare: "compare", review: "review", trust: "trust"
};
export const TEMPLATE_KIND = Object.fromEntries(Object.entries(KIND_TEMPLATE).filter(([k]) => k !== "model").map(([k, t]) => [t, k]));
TEMPLATE_KIND.icons = "benefit";
TEMPLATE_KIND.searchcard = "main";
TEMPLATE_KIND.ramadan = TEMPLATE_KIND.eid = TEMPLATE_KIND.nationalday = TEMPLATE_KIND.whitefriday = "seasonal";

// What buyers complain or ask about → the slide that answers it.
// Covers the review analysis aspects (server/reviews.mjs) and the app's short theme names.
const THEME_TEMPLATE = {
  size_fit: "sizechart", size: "sizechart", fit: "sizechart", sizeVsPhoto: "dimensions",
  fabric_material: "details", fabric: "details", material: "details",
  colour_accuracy: "details", colour: "details", color: "details",
  longevity: "benefit", scent_strength: "notes", scent: "notes",
  taste: "details", roast: "details", freshness: "trust",
  quality: "compare", price_value: "compare", packaging: "inbox",
  delivery: "trust", authenticity: "trust"
};
// What the audit found → the slide that fixes it.
const ISSUE_TEMPLATE = { noSizeChart: "sizechart", attrs: "details", reviewGap: "review", productSmall: "cover", mainRule: "cover", arabicBroken: "cover" };

// The base set every category starts from, before any data.
const CATEGORY_BASE = {
  fashion: ["benefit", "details", "sizechart", "occasion"],
  fragrance: ["benefit", "notes", "details", "occasion"],
  food: ["benefit", "details", "trust", "occasion"],
  beauty: ["benefit", "steps", "details", "occasion"],
  home: ["benefit", "dimensions", "details", "occasion"]
};
const SEASONAL = ["ramadan", "eid", "nationalday", "whitefriday"];

const share = (v) => { const n = Number(v) || 0; return n > 1 ? n / 100 : n; };

/** Accepts review themes as [key, pct, positive] (the app) or { key|aspect, share|pct, positive|sentiment }. */
export function normaliseThemes(themes) {
  return (themes || []).map((t) => {
    if (Array.isArray(t)) return { key: t[0], share: share(t[1]), positive: Boolean(t[2]) };
    return { key: t.key || t.aspect, share: share(t.share != null ? t.share : t.pct), positive: t.positive != null ? Boolean(t.positive) : t.sentiment === "positive" };
  }).filter((t) => t.key && t.share > 0);
}

/**
 * The slides a product needs, in order, each with the reasons it is there.
 * @param {{ category, templates: Array<{id, categories?}>, themes?, issues?: string[], gaps?: ReturnType<typeof galleryGaps>,
 *   performance?: Array<{id, verdict, wins, losses, avgPts}>, current?: string[], max?: number }} input
 * @returns {Array<{ tpl, score, reasons: Array<{ source: "main"|"review"|"audit"|"competitors"|"sales"|"category", key?, share?, of?, pts? }> }>}
 */
export function planSet(input) {
  const max = Math.max(3, Math.min(9, input.max || 7));
  const cat = input.category || "home";
  const known = new Map((input.templates || []).map((t) => [t.id, t]));
  const fits = (id) => { const t = known.get(id); return t && !SEASONAL.includes(id) && (!t.categories || t.categories.includes(cat)); };
  const pick = new Map();
  const add = (id, pts, reason) => {
    if (!fits(id)) return;
    const x = pick.get(id) || { tpl: id, score: 0, reasons: [] };
    x.score += pts;
    if (reason && !x.reasons.some((r) => r.source === reason.source && r.key === reason.key)) x.reasons.push(reason);
    pick.set(id, x);
  };

  add("cover", 1000, { source: "main" });
  (CATEGORY_BASE[cat] || CATEGORY_BASE.home).forEach((id, i) => add(id, 12 - i, { source: "category" }));

  for (const t of normaliseThemes(input.themes)) {
    const id = THEME_TEMPLATE[t.key];
    if (t.positive) {
      // What buyers love goes up front: a quote slide, and the benefit slide carries it.
      add("review", 20 * t.share + 6, { source: "review", key: t.key, share: t.share, positive: true });
    } else if (id) {
      add(id, 60 * t.share + 15, { source: "review", key: t.key, share: t.share });
    }
  }
  for (const key of input.issues || []) { const id = ISSUE_TEMPLATE[key]; if (id) add(id, 30, { source: "audit", key }); }

  const g = input.gaps;
  if (g && g.n) {
    for (const k of g.mustHave || []) { const id = KIND_TEMPLATE[k.kind]; if (id) add(id, 35 * k.share + 10, { source: "competitors", key: k.kind, share: k.share, of: g.n, mustHave: true }); }
    for (const k of g.whitespace || []) { const id = KIND_TEMPLATE[k.kind]; if (id) add(id, 18, { source: "competitors", key: k.kind, share: k.share, of: g.n, whitespace: true }); }
  }

  for (const p of input.performance || []) {
    if (!pick.has(p.id) && p.verdict !== "works") continue;
    if (p.verdict === "works") add(p.id, 12 * Math.max(1, p.wins - p.losses) + 4 * Math.max(0, p.avgPts), { source: "sales", key: p.id, pts: p.avgPts });
    else if (p.verdict === "hurts" && pick.has(p.id)) { const x = pick.get(p.id); x.score -= 25; x.reasons.push({ source: "sales", key: p.id, pts: p.avgPts, hurts: true }); }
  }

  const list = [...pick.values()].sort((a, b) => b.score - a.score);
  return list.slice(0, max).map((x) => ({ tpl: x.tpl, score: Math.round(x.score), reasons: x.reasons }));
}

/**
 * What the competitors' galleries cover.
 * @param {Array<{ kinds: string[], arabic?: boolean }>} competitors one entry per competitor listing
 * @param {string[]} ours the kinds our own gallery already has
 * @returns {{ n, kinds: Array<{kind, share, ours}>, mustHave, whitespace, arabicShare }}
 *   mustHave: shown by most competitors (≥ 60%) and missing from ours;
 *   whitespace: answers a buyer question almost nobody shows (≤ 20%), so it sets us apart.
 */
export function galleryGaps(competitors, ours = []) {
  const list = (competitors || []).filter((c) => c && Array.isArray(c.kinds));
  const n = list.length;
  const have = new Set(ours);
  const kinds = GALLERY_KINDS.filter((k) => k !== "other").map((kind) => {
    const count = list.filter((c) => c.kinds.includes(kind)).length;
    return { kind, share: n ? Math.round((count / n) * 100) / 100 : 0, ours: have.has(kind) };
  });
  const answers = ["sizechart", "dimensions", "notes", "howto", "inbox", "compare", "review", "trust", "details", "benefit"];
  return {
    n,
    kinds,
    mustHave: kinds.filter((k) => k.share >= 0.6 && !k.ours && k.kind !== "main"),
    whitespace: n >= 3 ? kinds.filter((k) => k.share <= 0.2 && !k.ours && answers.includes(k.kind)) : [],
    arabicShare: n ? Math.round((list.filter((c) => c.arabic).length / n) * 100) / 100 : 0
  };
}

/**
 * How much a main image stands out among the search results around it.
 * @param {{ colours: number[][], fill: number, whiteShare: number }} ours measured main image
 * @param {Array<{ colours: number[][], fill: number, whiteShare: number }>} others its neighbours
 * @returns {{ score: number, colour: number, size: number, notes: string[] }} score 0–100
 */
export function standout(ours, others) {
  const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  const near = (cs, list) => Math.min(...cs.map((c) => Math.min(...list.map((d) => dist(c, d)))));
  const ourCol = (ours && ours.colours || []).slice(0, 3);
  const theirs = (others || []).filter((o) => o && o.colours && o.colours.length);
  if (!ourCol.length || !theirs.length) return { score: 0, colour: 0, size: 0, notes: ["noData"] };
  // Colour: how far our main colours are from the nearest colours of each neighbour, averaged.
  const perNeighbour = theirs.map((o) => near(ourCol, o.colours.slice(0, 3)));
  const colour = Math.min(1, (perNeighbour.reduce((s, x) => s + x, 0) / perNeighbour.length) / 160);
  // Size: a product that fills more of its frame than the neighbours reads bigger on a phone.
  const avgFill = theirs.reduce((s, o) => s + (o.fill || 0), 0) / theirs.length;
  const size = Math.max(0, Math.min(1, 0.5 + ((ours.fill || 0) - avgFill) * 2.5));
  const notes = [];
  if (colour < 0.25) notes.push("sameColours");
  if ((ours.fill || 0) < avgFill - 0.08) notes.push("smallerThanOthers");
  if ((ours.fill || 0) >= 0.85) notes.push("fillsFrame");
  if (colour >= 0.5) notes.push("distinctColour");
  return { score: Math.round((colour * 0.6 + size * 0.4) * 100), colour: Math.round(colour * 100) / 100, size: Math.round(size * 100) / 100, notes };
}

/**
 * Put a seasonal slide right after the main image, replacing any other seasonal slide.
 * Returns the new set and the set to roll back to.
 */
export function seasonPack(set, season) {
  if (!SEASONAL.includes(season)) throw new Error("Unknown season " + season);
  const before = (set || []).map((s) => Object.assign({}, s, { fields: Object.assign({}, s.fields) }));
  const rest = before.filter((s) => !SEASONAL.includes(s.tpl));
  const at = rest.length && rest[0].tpl === "cover" ? 1 : 0;
  const next = rest.slice(0, at).concat([{ tpl: season, fields: {}, season: true }], rest.slice(at));
  return { set: next, backup: before };
}

/** The set with seasonal slides taken out, for products that had no backup. */
export function withoutSeason(set) { return (set || []).filter((s) => !SEASONAL.includes(s.tpl)); }

export const SEASONS = SEASONAL;
