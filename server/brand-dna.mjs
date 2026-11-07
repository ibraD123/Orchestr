// Brand DNA: an evidence-weighted brand genome.
//
// A genome is a set of traits. Every trait is used twice: the expression compiler turns it into
// generation instructions (template kit, logo, fonts, a brief for the copywriter), and the checker
// turns the same trait into a test (Brand Consistency Score). Generation and verification can't drift.
//
// Every trait carries an evidence ledger (brandbook, edits, approvals, rejections). Confidence is a
// Beta posterior over that ledger, with learned evidence decaying over time so a brand can evolve.
// Edits and rejections create candidate traits ("mutation"); a candidate becomes active only after
// consistent evidence or a person's decision ("selection"). Every change is versioned in the log.
//
// Sales results close the loop: a fix that raised conversion against a control group strengthens the
// rules its approved content followed, and the genome keeps a record of which slide templates and which
// kinds of fixes moved conversion for this brand. Audit priorities and the brief read that record.
//
// Pure functions with no imports: the server uses this module directly, and scripts/build.mjs inlines
// it into the app so the genome learns and checks in the browser too.

export const DIMS = ["colors", "composition", "typography", "voice"];

export const TRAIT_TYPES = {
  palette:       { dim: "colors",      check: true },
  logo:          { dim: "composition", check: true },
  textDensity:   { dim: "composition", check: true },
  template:      { dim: "composition", check: true },
  bilingual:     { dim: "composition", check: true },
  visual:        { dim: "composition", check: false },
  numerals:      { dim: "typography",  check: true },
  maxHeadline:   { dim: "typography",  check: true },
  avoidWord:     { dim: "voice",       check: true },
  noExclamation: { dim: "voice",       check: true },
  noEmoji:       { dim: "voice",       check: true },
  preferWord:    { dim: "voice",       check: false },
  voice:         { dim: "voice",       check: false }
};

export const FONT_PAIRS = {
  kufi:   { name: ["Kufi and grotesque", "كوفي وحديث"], ar: "Reem Kufi", latin: "Bricolage Grotesque", body: "Readex Pro" },
  naskh:  { name: ["Classic naskh", "نسخ كلاسيكي"], ar: "Amiri", latin: "Amiri", body: "Readex Pro" },
  modern: { name: ["Modern sans", "حديث بسيط"], ar: "Readex Pro", latin: "Readex Pro", body: "Readex Pro" }
};

export const LEARN = {
  promoteSupport: 3,       // consistent positive signals a candidate needs (decay affects confidence, not this count)
  promoteStrength: 0.7,    // and the confidence it needs
  retireStrength: 0.4,     // learned traits below this with contradicting evidence are retired
  halfLifeDays: 120        // learned evidence loses half its weight in this time
};

// Evidence from the brand itself doesn't decay; evidence learned from behaviour does.
const DURABLE = { declared: 1, brandbook: 1, analysis: 1 };
const DAY = 86400000;

/* ---------- text helpers ---------- */

export function normaliseWord(s) {
  return String(s || "").toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
const STOP = new Set(["the", "and", "for", "with", "you", "your", "are", "this", "that", "from", "our", "its", "has", "have", "was", "will", "can", "not", "but", "all", "per",
  "في", "من", "علي", "مع", "عن", "الي", "هذا", "هذه", "او", "ما", "لا", "كل", "ان", "قد", "حتي", "التي", "الذي", "هو", "هي", "لك", "لكم", "به", "بها"]);
// Arabic words carry the article and attached prepositions: «الفاخر», «والفاخر», «بالفاخر» are all «فاخر».
const AR_PREFIX = /^(وال|بال|فال|كال|لل|ال)/;
export function stem(raw) {
  const w = String(raw || "");
  if (!ARABIC.test(w)) return w;
  const cut = w.replace(/^([وبفك]?)(ال)/, "").replace(/^لل/, "");
  return cut.length >= 3 ? cut : w;
}
export function tokens(s) {
  return String(s || "").split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((w) => ({ raw: stem(w), n: normaliseWord(stem(w)) }))
    .filter((w) => w.n.length >= 3 && !STOP.has(w.n) && !/^\d+$/.test(w.n));
}
function hasWord(text, word) {
  const target = normaliseWord(stem(word));
  return tokens(text).some((t) => t.n === target);
}
const EMOJI = /\p{Extended_Pictographic}/u;
const ARABIC = /[؀-ۿ]/;
const WESTERN_DIGIT = /[0-9]/;
const ARABIC_DIGIT = /[٠-٩]/;

/* ---------- colour helpers ---------- */

function hexRgb(hex) {
  const h = String(hex || "").replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(v, 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [0, 0, 0];
}
function lab(hex) {
  const lin = (c) => { c /= 255; return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; };
  const [r, g, b] = hexRgb(hex).map(lin);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
export function colourDistance(a, b) {
  const p = lab(a), q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
function luminance(hex) {
  const lin = (c) => { c /= 255; return c > 0.03928 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; };
  const [r, g, b] = hexRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Template kit (background, headline colour, secondary text) from a brand palette, with readable contrast. */
export function kitFromPalette(palette) {
  const cols = (palette || []).filter((p) => /^#[0-9a-f]{6}$/i.test(p.hex));
  if (!cols.length) return null;
  const pick = (role) => cols.find((p) => p.role === role);
  const bg = (pick("background") || cols.slice().sort((a, b) => luminance(a.hex) - luminance(b.hex))[0]).hex;
  const others = cols.filter((p) => p.hex !== bg);
  const best = (list) => list.slice().sort((a, b) => contrast(b.hex, bg) - contrast(a.hex, bg))[0];
  let fg = (pick("accent") || pick("primary") || best(others) || {}).hex;
  if (!fg || contrast(fg, bg) < 3) fg = luminance(bg) > 0.4 ? "#1A1A1A" : "#FFFFFF";
  let accent = (pick("text") || best(others.filter((p) => p.hex !== fg)) || {}).hex;
  if (!accent || contrast(accent, bg) < 3) accent = luminance(bg) > 0.4 ? "#3A3A3A" : "#EDEDED";
  return { bg, fg, accent };
}

/** Dominant colours from RGBA pixels (logo, product photos): a small k-means, ignoring transparent and near-white/near-black background. */
export function extractPalette(d, w, h, k = 5) {
  const pts = [];
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 6000)));
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 200) continue;
    pts.push([d[i], d[i + 1], d[i + 2]]);
  }
  if (!pts.length) return [];
  let cs = [];
  for (let j = 0; j < k; j++) cs.push(pts[Math.floor(((j + 0.5) / k) * pts.length)].slice());
  for (let it = 0; it < 8; it++) {
    const sum = cs.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let bi = 0, bd = Infinity;
      cs.forEach((c, j) => { const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (dd < bd) { bd = dd; bi = j; } });
      const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    cs = sum.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3], s[3]] : cs[j]));
  }
  const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
  const out = [];
  cs.filter((c) => c[3]).sort((a, b) => b[3] - a[3]).forEach((c) => {
    const hx = hex(c);
    if (!out.some((o) => colourDistance(o.hex, hx) < 10)) out.push({ hex: hx, share: Math.round((c[3] / pts.length) * 100) / 100 });
  });
  return out;
}

/* ---------- genome ---------- */

export function newGenome(ws, identity) {
  return { ws, version: 1, updatedAt: null, identity: Object.assign({ name: "", nameAr: "", logo: null, logoPos: "top-end", palette: [], fonts: "kufi" }, identity || {}), traits: [], exemplars: [], performance: { templates: {}, fixes: {} }, log: [] };
}

export function traitKey(type, params) {
  const p = params || {};
  if (type === "avoidWord" || type === "preferWord") return type + ":" + normaliseWord(stem(p.word));
  if (type === "template") return type + ":" + p.id;
  if (type === "voice" || type === "visual") return type + ":" + normaliseWord(p.text).slice(0, 40);
  return type;
}

/** Human-readable rule, English and Arabic. */
export function describe(t) {
  const p = t.params || {};
  switch (t.type) {
    case "palette": return { en: "Use only the brand palette", ar: "استخدم ألوان العلامة فقط" };
    case "logo": return { en: "Show the logo on every slide except the main image", ar: "أظهر الشعار في كل شريحة عدا الصورة الرئيسية" };
    case "textDensity": return { en: `Keep slide text under ${p.maxChars} characters`, ar: `أبقِ نص الشريحة أقل من ${p.maxChars} حرفاً` };
    case "template": return { en: `Don't use the «${p.id}» template` + (t.scope && t.scope.category ? ` for ${t.scope.category.join(", ")}` : ""), ar: `لا تستخدم قالب «${p.id}»` };
    case "bilingual": return { en: p.mode === "both" ? "Arabic and English on every slide" : `Slides in ${p.mode === "ar" ? "Arabic" : "English"} only`, ar: p.mode === "both" ? "العربية والإنجليزية في كل شريحة" : (p.mode === "ar" ? "الشرائح بالعربية فقط" : "الشرائح بالإنجليزية فقط") };
    case "numerals": return { en: p.style === "arabic" ? "Arabic-Indic digits in Arabic text (١٢)" : "Western digits in Arabic text (12)", ar: p.style === "arabic" ? "أرقام عربية في النص العربي (١٢)" : "أرقام لاتينية في النص العربي (12)" };
    case "maxHeadline": return { en: `Headlines of ${p.chars} characters or fewer`, ar: `عناوين لا تتجاوز ${p.chars} حرفاً` };
    case "avoidWord": return { en: `Avoid the word «${p.word}»`, ar: `تجنّب كلمة «${p.word}»` };
    case "preferWord": return { en: `Prefer the word «${p.word}»`, ar: `فضّل كلمة «${p.word}»` };
    case "noExclamation": return { en: "No exclamation marks", ar: "بدون علامات تعجب" };
    case "noEmoji": return { en: "No emoji", ar: "بدون رموز تعبيرية" };
    default: return { en: p.text || "", ar: p.textAr || p.text || "" };
  }
}

function now(at) { return at ? new Date(at).getTime() : Date.now(); }

/** Weighted evidence and Beta-posterior confidence for a trait at a point in time. */
export function strength(t, at) {
  const ts = now(at);
  let pos = 0, neg = 0;
  for (const e of t.evidence || []) {
    const age = Math.max(0, (ts - new Date(e.at).getTime()) / DAY);
    const w = (e.w == null ? 1 : e.w) * (DURABLE[e.kind] ? 1 : Math.pow(0.5, age / LEARN.halfLifeDays));
    if (e.sign > 0) pos += w; else neg += w;
  }
  const raw = (t.evidence || []).reduce((a, e) => a + (e.sign > 0 ? (e.w == null ? 1 : e.w) : 0), 0);
  return { pos: Math.round(pos * 100) / 100, neg: Math.round(neg * 100) / 100, raw: Math.round(raw * 100) / 100, s: Math.round(((pos + 1) / (pos + neg + 2)) * 100) / 100 };
}

export function evidenceSummary(t) {
  const out = { declared: 0, brandbook: 0, analysis: 0, edit: 0, approve: 0, reject: 0, manual: 0, outcome: 0, against: 0 };
  for (const e of t.evidence || []) { if (e.sign < 0) out.against++; else out[e.kind] = (out[e.kind] || 0) + 1; }
  return out;
}

function logChange(g, entry, at) {
  g.version += 1;
  g.updatedAt = at || new Date().toISOString();
  g.log.unshift(Object.assign({ v: g.version, at: g.updatedAt }, entry));
  if (g.log.length > 200) g.log.length = 200;
}

/** Add evidence to a trait, creating it as a candidate (or active, for declared sources) when new. */
export function addEvidence(g, spec, ev, at) {
  const key = traitKey(spec.type, spec.params);
  let t = g.traits.find((x) => x.key === key);
  const changes = [];
  const durable = DURABLE[ev.kind];
  if (!t) {
    if (ev.sign < 0) return changes; // nothing to contradict yet
    t = { id: "t" + (g.traits.length + 1) + "-" + key.replace(/[^a-z0-9]+/gi, "").slice(0, 12), key, type: spec.type, params: Object.assign({}, spec.params),
      scope: spec.scope || {}, origin: durable ? ev.kind : "learned", status: durable || ev.kind === "manual" ? "active" : "candidate", locked: false,
      createdAt: at || new Date().toISOString(), evidence: [] };
    g.traits.push(t);
    changes.push({ type: t.status === "active" ? "added" : "candidate", trait: t.id });
    if (t.status === "active" || (ev.w == null ? 1 : ev.w) >= 1) logChange(g, { type: t.status === "active" ? "added" : "candidate", trait: t.id, note: describe(t).en }, at);
  } else if (spec.params && spec.type === "maxHeadline" && ev.sign > 0) {
    // Learned length limits move towards what people actually keep.
    const n = (t.evidence || []).filter((e) => e.sign > 0).length;
    t.params.chars = Math.round((t.params.chars * n + spec.params.chars) / (n + 1));
  } else if (spec.params && spec.type === "textDensity" && ev.sign > 0) {
    t.params.maxChars = Math.min(t.params.maxChars, spec.params.maxChars);
  }
  const existed = t.evidence.length > 0;
  t.evidence.push(Object.assign({ at: at || new Date().toISOString(), w: 1 }, ev));
  if (existed && t.status === "candidate" && ev.sign > 0) changes.push({ type: "reinforced", trait: t.id });
  if (t.evidence.length > 60) t.evidence.splice(0, t.evidence.length - 60);
  // Selection: promote consistent candidates, retire learned traits that the brand keeps contradicting.
  if (!t.locked) {
    const st = strength(t, at);
    if (t.status === "candidate" && st.raw >= LEARN.promoteSupport && st.s >= LEARN.promoteStrength) {
      t.status = "active"; changes.push({ type: "promoted", trait: t.id });
      logChange(g, { type: "promoted", trait: t.id, note: describe(t).en }, at);
    } else if (t.status === "active" && t.origin === "learned" && st.s < LEARN.retireStrength && st.neg >= 2) {
      t.status = "retired"; changes.push({ type: "retired", trait: t.id });
      logChange(g, { type: "retired", trait: t.id, note: describe(t).en }, at);
    }
  }
  return changes;
}

/** Record a change to the brand's identity (logo, palette, fonts) in the version log. */
export function touch(g, note, at) { logChange(g, { type: "identity", note: note || "identity" }, at); }

/** A person decides: accept a candidate, switch a rule off, or bring it back. Locks the trait against automatic changes. */
export function setStatus(g, id, status, at) {
  const t = g.traits.find((x) => x.id === id);
  if (!t) return null;
  t.status = status; t.locked = true;
  logChange(g, { type: status === "active" ? "accepted" : status === "off" ? "switched-off" : status, trait: t.id, note: describe(t).en }, at);
  return t;
}

/** Add a rule by hand (or from a brand analysis). */
export function declare(g, spec, kind, at, note) {
  // A person's or brand book's word is strong evidence; an AI analysis of materials is weaker.
  const w = kind === "analysis" ? 2 : 6;
  const changes = addEvidence(g, spec, { kind: kind || "manual", sign: 1, w, note: note || "" }, at);
  const t = g.traits.find((x) => x.key === traitKey(spec.type, spec.params));
  if (t && t.status === "candidate") { t.status = "active"; t.locked = kind === "manual"; }
  return { trait: t, changes };
}

/* ---------- observation: turning feedback into evidence ---------- */

/**
 * What an edit says about the brand. before = what Basira proposed, after = what a person kept.
 * Returns trait specs with evidence signs; learn() applies them.
 */
export function observeEdit(before, after, ctx) {
  const obs = [];
  const b = String(before || ""), a = String(after || "");
  if (b === a) return obs;
  const tb = tokens(b), ta = tokens(a);
  const setA = new Set(ta.map((t) => t.n)), setB = new Set(tb.map((t) => t.n));
  const kept = tb.filter((t) => setA.has(t.n)).length;
  const overlap = tb.length ? kept / tb.length : 0;
  // Only read word choices from edits, not full rewrites: a rewrite says too little about any one word.
  const removed = [], added = [], seen = new Set();
  for (const t of tb) if (!setA.has(t.n) && !seen.has(t.n)) { seen.add(t.n); removed.push(t); }
  for (const t of ta) if (!setB.has(t.n) && !seen.has(t.n)) { seen.add(t.n); added.push(t); }
  const headline = ctx && (ctx.role === "headline" || ctx.role === "title");
  // Cutting several words from a headline is mostly about length, so those words get little weight;
  // removing or replacing one or two words is a deliberate word choice.
  const trimming = !added.length && removed.length >= 3;
  if (overlap >= 0.3) {
    const w = trimming ? 0.25 : removed.length <= 3 ? 1 : 0.5;
    for (const t of removed) obs.push({ spec: { type: "avoidWord", params: { word: t.raw, lang: ARABIC.test(t.raw) ? "ar" : "en" } }, sign: 1, w, note: `removed «${t.raw}»` });
    for (const t of added) obs.push({ spec: { type: "preferWord", params: { word: t.raw, lang: ARABIC.test(t.raw) ? "ar" : "en" } }, sign: 1, w: 0.5, note: `added «${t.raw}»` });
  }
  // Words a person put back are evidence against avoiding them.
  for (const t of ta) if (!setB.has(t.n)) obs.push({ spec: { type: "avoidWord", params: { word: t.raw } }, sign: -1, note: `used «${t.raw}»` });
  if (/[!！]/.test(b) && !/[!！]/.test(a)) obs.push({ spec: { type: "noExclamation", params: {} }, sign: 1, note: "removed «!»" });
  if (!/[!！]/.test(b) && /[!！]/.test(a)) obs.push({ spec: { type: "noExclamation", params: {} }, sign: -1, note: "added «!»" });
  if (EMOJI.test(b) && !EMOJI.test(a)) obs.push({ spec: { type: "noEmoji", params: {} }, sign: 1, note: "removed emoji" });
  if (headline && a.length && (trimming ? a.length <= b.length * 0.85 : a.length <= b.length * 0.6)) {
    obs.push({ spec: { type: "maxHeadline", params: { chars: Math.ceil(a.length * 1.1) } }, sign: 1, note: `shortened ${b.length} → ${a.length}` });
  }
  if (ARABIC.test(a)) {
    if (WESTERN_DIGIT.test(b) && !WESTERN_DIGIT.test(a) && ARABIC_DIGIT.test(a)) obs.push({ spec: { type: "numerals", params: { style: "arabic" } }, sign: 1, note: "12 → ١٢" });
    if (ARABIC_DIGIT.test(b) && !ARABIC_DIGIT.test(a) && WESTERN_DIGIT.test(a)) obs.push({ spec: { type: "numerals", params: { style: "western" } }, sign: 1, note: "١٢ → 12" });
  }
  return obs;
}

export const REJECT_REASONS = ["tooMuchText", "offColours", "logo", "offTone", "productDiffers"];
export function observeReject(reasons, ctx) {
  const obs = [];
  for (const r of reasons || []) {
    if (r === "tooMuchText" && ctx && ctx.chars) obs.push({ spec: { type: "textDensity", params: { maxChars: Math.max(20, Math.round(ctx.chars * 0.75)) } }, sign: 1, note: "rejected: too much text" });
    if (r === "offColours") obs.push({ spec: { type: "palette", params: {} }, sign: 1, note: "rejected: off-brand colours" });
    if (r === "logo") obs.push({ spec: { type: "logo", params: { required: true } }, sign: 1, note: "rejected: logo" });
  }
  return obs;
}

/**
 * Apply one feedback event to the genome. Event types:
 *   edit       { before, after, role, ctx }
 *   reject     { reasons[], ctx: { chars, ... } }
 *   approve    { content, ctx }   reinforces active traits the content satisfies, stores an exemplar
 *   removeSlide{ template, ctx }  weak evidence against a template in that category
 *   kit        { onBrand: boolean } choosing colours outside the palette weakens the palette rule
 *   outcome    { result: win | loss | flat, upliftPts, contents[], templates[], fixes[], ctx }
 *              a product's sales result against the control group (see learnOutcome)
 * Returns the list of changes (new candidates, promotions, retirements).
 */
export function learn(g, ev) {
  const at = ev.at || new Date().toISOString();
  const ref = { product: ev.product || null, field: ev.field || null };
  let changes = [];
  const apply = (list, kind) => {
    for (const o of list) {
      // Contradicting evidence only touches traits that already exist.
      if (o.sign < 0 && !g.traits.some((t) => t.key === traitKey(o.spec.type, o.spec.params))) continue;
      changes = changes.concat(addEvidence(g, o.spec, { kind, sign: o.sign, w: o.w == null ? 1 : o.w, note: o.note, ref }, at));
    }
  };
  if (ev.type === "edit") apply(observeEdit(ev.before, ev.after, Object.assign({ role: ev.role }, ev.ctx)), "edit");
  else if (ev.type === "reject") apply(observeReject(ev.reasons, ev.ctx), "reject");
  else if (ev.type === "removeSlide" && ev.template) apply([{ spec: { type: "template", params: { id: ev.template, avoid: true }, scope: ev.ctx && ev.ctx.category ? { category: [ev.ctx.category] } : {} }, sign: 1, w: 0.5, note: "slide removed" }], "edit");
  else if (ev.type === "kit" && ev.onBrand === false) apply([{ spec: { type: "palette", params: {} }, sign: -1, w: 0.5, note: "chose colours outside the palette" }], "edit");
  else if (ev.type === "approve" && ev.content) {
    const r = check(g, ev.content, ev.ctx || {}, at);
    for (const res of r.results) if (res.pass && res.trait.status === "active") {
      addEvidence(g, { type: res.trait.type, params: res.trait.params }, { kind: "approve", sign: 1, w: 0.5, note: "approved", ref }, at);
    }
    g.exemplars.unshift({ id: "x" + g.version, at, ctx: ev.ctx || {}, content: ev.exemplar || null, product: ev.product || null, edits: ev.edits || 0 });
    if (g.exemplars.length > 40) g.exemplars.length = 40;
    logChange(g, { type: "approved", note: ev.label || "approved", edits: ev.edits || 0 }, at);
  }
  else if (ev.type === "outcome") changes = learnOutcome(g, ev, at, ref);
  return changes;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * A sales result for one fixed product. A win strengthens every active rule the approved content
 * followed; a loss weakens only rules learned from behaviour (one product's sales don't overrule the
 * brand book). Wins, losses and the conversion change are tallied per slide template and per kind of
 * fix, which is what audit priorities and the brief use. "flat" is recorded but moves no rule.
 */
function learnOutcome(g, ev, at, ref) {
  const perf = g.performance || (g.performance = { templates: {}, fixes: {} });
  const result = ev.result === "win" || ev.result === "loss" ? ev.result : "flat";
  const pts = Number(ev.upliftPts) || 0;
  const tally = (bucket, key) => {
    const x = bucket[key] || (bucket[key] = { wins: 0, losses: 0, flat: 0, n: 0, sumPts: 0, lastAt: null });
    x.n++; x[result === "win" ? "wins" : result === "loss" ? "losses" : "flat"]++; x.sumPts = round2(x.sumPts + pts); x.lastAt = at;
  };
  for (const id of new Set(ev.templates || [])) tally(perf.templates, id);
  for (const key of new Set(ev.fixes || [])) tally(perf.fixes, key);

  let changes = [];
  if (result !== "flat") {
    const followed = new Map();
    for (const content of ev.contents || []) {
      for (const r of check(g, content, ev.ctx || {}, at).results) if (r.pass) followed.set(r.trait.id, r.trait);
    }
    const sign = result === "win" ? 1 : -1;
    for (const t of followed.values()) {
      if (sign < 0 && t.origin !== "learned") continue;
      const note = "sales: conversion " + (pts > 0 ? "+" : "") + pts + " pts vs control";
      changes = changes.concat(addEvidence(g, { type: t.type, params: t.params }, { kind: "outcome", sign, w: 1, note, ref }, at));
      changes.push({ type: sign > 0 ? "strengthened" : "weakened", trait: t.id });
    }
  }
  logChange(g, { type: "outcome", result, pts, note: ev.label || result }, at);
  return changes;
}

/**
 * What moved conversion for this brand, from recorded sales results.
 * verdict: "works" (more wins than losses and a positive average), "hurts" (more losses), "mixed" otherwise.
 */
export function performanceOf(g) {
  const perf = (g && g.performance) || { templates: {}, fixes: {} };
  const list = (bucket) => Object.entries(bucket || {}).map(([id, x]) => {
    const avgPts = x.n ? round2(x.sumPts / x.n) : 0;
    const verdict = x.wins > x.losses && avgPts > 0 ? "works" : x.losses > x.wins ? "hurts" : "mixed";
    return { id, wins: x.wins, losses: x.losses, flat: x.flat, n: x.n, avgPts, verdict, lastAt: x.lastAt };
  }).sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || b.avgPts - a.avgPts);
  return { templates: list(perf.templates), fixes: list(perf.fixes) };
}

/** How much a kind of fix has earned its place for this brand: 0 (no evidence) to 1. */
export function fixBoost(g, key) {
  const x = performanceOf(g).fixes.find((f) => f.id === key);
  if (!x || x.verdict !== "works") return 0;
  return Math.min(1, 0.3 * (x.wins - x.losses) + 0.1 * Math.max(0, x.avgPts));
}

/* ---------- the brand in the listing audit ---------- */

/** A live listing's copy as checkable content: titles and bullets in both languages. */
export function listingContent(l) {
  const x = l || {};
  const texts = [{ text: x.titleEn, lang: "en", role: "title" }, { text: x.titleAr, lang: "ar", role: "title" }]
    .concat((x.bulletsEn || []).map((b) => ({ text: b, lang: "en", role: "body" })))
    .concat((x.bulletsAr || []).map((b) => ({ text: b, lang: "ar", role: "body" })));
  return { texts: texts.filter((t) => t.text && String(t.text).trim()) };
}

/**
 * Brand rules checked on a listing that is live now, in the same shape as audit issues (area "brand").
 * Only rules that can be read from copy apply here (words, «!», emoji, digits, headline length);
 * colours, logo and templates are checked on slides in the studio.
 */
export function auditBrand(g, listing, ctx) {
  const l = listing || {};
  const r = check(g, listingContent(l), Object.assign({ channel: l.channel, category: l.category }, ctx || {}));
  const issues = r.violations.map((v) => ({
    key: "brand", area: "brand",
    sev: v.trait.origin === "learned" && v.weight < 0.8 ? "low" : "med",
    detail: { trait: v.trait.id, type: v.trait.type, rule: describe(v.trait), found: v.detail || null }
  }));
  return { score: r.score, checked: r.checked, issues };
}

/* ---------- expression: genome → generation instructions ---------- */

function inScope(t, ctx) {
  const sc = t.scope || {};
  for (const k of ["channel", "category", "lang", "template"]) {
    if (sc[k] && sc[k].length && ctx && ctx[k] && sc[k].indexOf(ctx[k]) < 0) return false;
  }
  return true;
}

export function activeTraits(g, ctx, at) {
  return g.traits.filter((t) => t.status === "active" && inScope(t, ctx || {}))
    .map((t) => Object.assign({}, t, { st: strength(t, at) }))
    .sort((a, b) => b.st.s - a.st.s);
}

/** Pick past approved work that fits this context: same category, then channel, then language, newest first. */
export function exemplars(g, ctx, n = 3) {
  const c = ctx || {};
  return (g.exemplars || []).filter((x) => x.content)
    .map((x) => ({ x, score: (x.ctx.category === c.category ? 3 : 0) + (x.ctx.channel === c.channel ? 2 : 0) + (x.ctx.lang === c.lang ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || (a.x.at < b.x.at ? 1 : -1)).slice(0, n).map((s) => s.x);
}

/** Everything a generator needs for this context: template kit, fonts, logo, and a brief for the copywriter. */
export function express(g, ctx, at) {
  const traits = activeTraits(g, ctx, at);
  const id = g.identity || {};
  const kit = kitFromPalette(id.palette);
  const has = (type) => traits.find((t) => t.type === type);
  const lines = [];
  lines.push(`Brand: ${id.name || "the brand"}${id.nameAr ? " (" + id.nameAr + ")" : ""}.`);
  const voice = traits.filter((t) => t.type === "voice");
  if (voice.length) lines.push("Voice: " + voice.map((t) => t.params.text).join(" "));
  const visual = traits.filter((t) => t.type === "visual");
  if (visual.length) lines.push("Visual style: " + visual.map((t) => t.params.text).join(" "));
  const rules = traits.filter((t) => t.type !== "voice" && t.type !== "visual");
  if (rules.length) {
    lines.push("Rules, strongest first (confidence in brackets):");
    for (const t of rules) {
      const ev = evidenceSummary(t);
      const why = [ev.declared || ev.brandbook ? "brand book" : "", ev.edit ? ev.edit + " edits" : "", ev.approve ? ev.approve + " approvals" : "", ev.reject ? ev.reject + " rejections" : "", ev.outcome ? ev.outcome + " sales wins" : ""].filter(Boolean).join(", ");
      lines.push(`- [${t.st.s.toFixed(2)}] ${describe(t).en}${why ? " (" + why + ")" : ""}`);
    }
  }
  const perf = performanceOf(g);
  const worked = perf.templates.filter((x) => x.verdict === "works").slice(0, 4);
  if (worked.length) lines.push("Slides that raised conversion for this brand in sales results: " + worked.map((x) => `${x.id} (+${x.avgPts} pts on average, ${x.wins} of ${x.n} products)`).join("; ") + ".");
  const ex = exemplars(g, ctx);
  if (ex.length) {
    lines.push("Approved examples for similar products:");
    for (const x of ex) lines.push("- " + JSON.stringify(x.content));
  }
  return {
    traits, kit,
    fonts: FONT_PAIRS[id.fonts] ? id.fonts : "kufi",
    logo: id.logo ? { src: id.logo, pos: id.logoPos || "top-end" } : null,
    language: (has("bilingual") || { params: {} }).params.mode || null,
    numerals: (has("numerals") || { params: {} }).params.style || null,
    maxChars: (has("textDensity") || { params: {} }).params.maxChars || null,
    avoidTemplates: traits.filter((t) => t.type === "template" && t.params.avoid).map((t) => t.params.id),
    provenTemplates: worked.map((x) => x.id),
    brief: lines.join("\n")
  };
}

/* ---------- checking: the same traits as tests ---------- */

/**
 * Brand Consistency Score for one piece of content.
 * content: { texts: [{ text, lang, role }], kit: { bg, fg, accent }, template, language, logo: boolean, chars }
 * Scores are weighted by each trait's confidence. Dimensions with nothing checkable return null.
 */
export function check(g, content, ctx, at) {
  const traits = activeTraits(g, ctx, at).filter((t) => TRAIT_TYPES[t.type] && TRAIT_TYPES[t.type].check);
  const texts = (content && content.texts) || [];
  const all = texts.map((x) => x.text || "").join(" \n ");
  const palette = ((g.identity && g.identity.palette) || []).map((p) => p.hex);
  const results = [];
  for (const t of traits) {
    let pass = null, detail = "";
    const p = t.params || {};
    switch (t.type) {
      case "palette":
        if (content.kit && palette.length) {
          const off = ["bg", "fg"].filter((k) => content.kit[k] && Math.min(...palette.map((h) => colourDistance(h, content.kit[k]))) > 15);
          pass = !off.length; detail = off.length ? off.map((k) => content.kit[k]).join(", ") : "";
        }
        break;
      case "logo": if (content.template && content.template !== "cover") { pass = !!content.logo; } break;
      case "textDensity": if (content.chars != null) { pass = content.chars <= p.maxChars; detail = content.chars + " / " + p.maxChars; } break;
      case "template": if (content.template) { pass = !(p.avoid && content.template === p.id); } break;
      case "bilingual": if (content.language) { pass = content.language === p.mode; } break;
      case "numerals": {
        const arTexts = texts.filter((x) => x.lang === "ar" || ARABIC.test(x.text || ""));
        if (arTexts.length) { const bad = arTexts.some((x) => (p.style === "arabic" ? WESTERN_DIGIT : ARABIC_DIGIT).test(x.text || "")); pass = !bad; }
        break;
      }
      case "maxHeadline": {
        const heads = texts.filter((x) => x.role === "headline" || x.role === "title");
        if (heads.length) { const long = heads.filter((x) => (x.text || "").length > p.chars); pass = !long.length; detail = long.map((x) => x.text.length).join(", "); }
        break;
      }
      case "avoidWord": if (texts.length && (!p.lang || texts.some((x) => (x.lang || (ARABIC.test(x.text || "") ? "ar" : "en")) === p.lang))) { pass = !hasWord(all, p.word); detail = pass ? "" : p.word; } break;
      case "noExclamation": if (texts.length) { pass = !/[!！]/.test(all); detail = pass ? "" : "!"; } break;
      case "noEmoji": if (texts.length) pass = !EMOJI.test(all); break;
    }
    if (pass !== null) results.push({ trait: t, dim: TRAIT_TYPES[t.type].dim, pass, detail, weight: t.st.s });
  }
  const dims = {};
  for (const d of DIMS) {
    const r = results.filter((x) => x.dim === d);
    const w = r.reduce((s, x) => s + x.weight, 0);
    dims[d] = r.length ? Math.round((100 * r.reduce((s, x) => s + (x.pass ? x.weight : 0), 0)) / w) : null;
  }
  const present = DIMS.filter((d) => dims[d] != null);
  const totalW = results.reduce((s, x) => s + x.weight, 0);
  const score = results.length ? Math.round((100 * results.reduce((s, x) => s + (x.pass ? x.weight : 0), 0)) / totalW) : null;
  return { score, dims, present, results, violations: results.filter((x) => !x.pass), checked: results.length };
}

/* ---------- learning metrics ---------- */

/** Edits a person made per approved item, oldest first: the number that should fall as the genome learns. */
export function editTrend(g) {
  return (g.log || []).filter((l) => l.type === "approved").slice().reverse().map((l) => ({ at: l.at, edits: l.edits || 0 }));
}
