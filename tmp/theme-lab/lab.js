// Basira theme lab. Repaints the live page in a candidate palette without touching project files.
// Every color in the page's style sheets (and inline styles) is matched to a role of the current
// "quiet green" palette and repainted with the same role of the chosen theme.
(() => {
  if (window.__themeLab) return;

  // ---------- Current palette: color → role (light and dark) ----------
  const OLD = {
    bg: ["#f5f5f0", "#f2f5f3", "#f6f5f1", "#f4f7ef"],
    surface2: ["#f0f2ed", "#e9eeeb", "#e7eddc", "#e9efdc"],
    line: ["#e3e6de", "#e0e5da", "#d6dfda", "#e4e1d8", "#dde4da", "#dbe3cf"],
    ink: ["#202820", "#202d26", "#0c1a17", "#17201d", "#20392e"],
    ink2: ["#5d675e", "#4a5a55", "#697469", "#4a5450", "#59624f"],
    ink3: ["#778174", "#7a8a85", "#748077", "#7d8682", "#63735c"],
    brand: ["#224d39", "#0b5d52", "#1f5c4f", "#2d3e31"],
    brandSoft: ["#e3f2d9", "#daebe6", "#e9efdf", "#e6efd9"],
    hi: ["#d8f49b"],
    logo: ["#51c2ac", "#52c4ae", "#5fc3aa", "#ffbba9"],
    side: ["#fcfcf9"],
    sideHi: ["#f0f2eb"],
    muted: ["#a8baaa", "#b4c0aa", "#a9b79b"],
    paper: ["#fffefa", "#f8faef", "#fbfcf6", "#f9fbf5"],
    dBg: ["#141a16", "#0a1210", "#121614"],
    dSurface: ["#1d2620", "#101b18", "#1b201e"],
    dSurface2: ["#28322a", "#16231f"],
    dLine: ["#354137", "#22322d", "#2c3330"],
    dInk: ["#edf3e7", "#e7efec", "#eceFed", "#eff5e7"],
    dInk2: ["#becab8", "#a2b2ac", "#b7bfbb"],
    dInk3: ["#94a58f", "#71827c", "#8a938f"],
    dBrand: ["#caeca8"],
    dBrandSoft: ["#30452c", "#123129"],
    dOnBrand: ["#1b2e1d", "#04120f", "#07130f"],
    dSide: ["#182019", "#060c0b"],
    dSideHi: ["#2a352b", "#13211d"],
    dPaper: ["#293729"],
  };
  // Colors that carry meaning (status, product art, white/black) stay as they are.
  const KEEP = ["#ffffff", "#000000", "#1d7a4c", "#62d293", "#1e7a4f", "#5cc28c", "#dbefe3", "#11301f", "#e3f2ea", "#16302a",
    "#b93a26", "#f08a73", "#b4442e", "#e5806a", "#f6e1dc", "#3a1b15", "#f8e6e1",
    "#c8771e", "#eba24c", "#94540f", "#f2b86b", "#f6e7d3", "#33230f", "#9a6a12", "#e2b35c", "#d9b45a", "#f3d58c"];

  // ---------- Candidate themes ----------
  const THEMES = {
    current: { name: "Как сейчас", note: "тихий зелёный · Bricolage", sw: ["#f5f5f0", "#224d39", "#d8f49b", "#51c2ac", "#202820"] },
    indigo: {
      name: "Индиго и шафран", note: "плитка зелидж · Fraunces",
      fonts: { display: "Fraunces", ar: "El Messiri", body: "Readex Pro", css: "Fraunces:opsz,wght@9..144,500..700&family=El+Messiri:wght@500..700" },
      c: { bg: "#F6F2EA", surface2: "#EEE8DC", line: "#E2DACB", ink: "#171A35", ink2: "#4A4F6E", ink3: "#7A7F99", brand: "#2E3C96", brandSoft: "#E4E7F8", hi: "#F6B941", logo: "#F6B941", side: "#FBF8F2", sideHi: "#EFE9DD", muted: "#AEB2CC", paper: "#FFFCF6",
        dBg: "#0E1124", dSurface: "#161A33", dSurface2: "#1F2445", dLine: "#2D335C", dInk: "#EEF0FA", dInk2: "#BBC0DD", dInk3: "#8C92B4", dBrand: "#A9B4FF", dBrandSoft: "#262E5E", dOnBrand: "#0E1124", dSide: "#0B0E1E", dSideHi: "#1C2143", dPaper: "#1B2040" },
    },
    electric: {
      name: "Электрик", note: "фиолетовый + кислотный лайм · Unbounded",
      fonts: { display: "Unbounded", ar: "Alexandria", body: "Onest", css: "Unbounded:wght@400..700&family=Alexandria:wght@400..700&family=Onest:wght@300..700" },
      c: { bg: "#F4F3FA", surface2: "#ECE9F7", line: "#DEDAF0", ink: "#14112A", ink2: "#4C4768", ink3: "#7F7A99", brand: "#5B3DF5", brandSoft: "#EAE5FF", hi: "#D6FF3F", logo: "#D6FF3F", side: "#FAF9FE", sideHi: "#EEEBFA", muted: "#B1ABCE", paper: "#FCFBFF",
        dBg: "#0D0B19", dSurface: "#151226", dSurface2: "#1E1A35", dLine: "#2C2748", dInk: "#F1EFFA", dInk2: "#BFBAD8", dInk3: "#8D87AA", dBrand: "#B3A4FF", dBrandSoft: "#2A2257", dOnBrand: "#0D0B19", dSide: "#0A0814", dSideHi: "#211C3C", dPaper: "#1C1833" },
    },
    oud: {
      name: "Уд и роза", note: "слива, роза, золото · Playfair",
      fonts: { display: "Playfair Display", ar: "Amiri", body: "Readex Pro", css: "Playfair+Display:wght@500..800&family=Amiri:wght@400;700" },
      c: { bg: "#FAF5F0", surface2: "#F2EAE3", line: "#E8DCD3", ink: "#2A1426", ink2: "#5E4659", ink3: "#8C7787", brand: "#5B1F4E", brandSoft: "#F3E3EC", hi: "#F2C2B8", logo: "#D9A441", side: "#FDF9F5", sideHi: "#F3EAE2", muted: "#C3AFBC", paper: "#FFFBF7",
        dBg: "#170D16", dSurface: "#21141F", dSurface2: "#2C1C29", dLine: "#3D2A39", dInk: "#F7ECF2", dInk2: "#D3BDCB", dInk3: "#A68F9F", dBrand: "#F0B7CF", dBrandSoft: "#3E2238", dOnBrand: "#1B0C18", dSide: "#120A11", dSideHi: "#2E1C2B", dPaper: "#2A1A27" },
    },
    desert: {
      name: "Пустыня и море", note: "терракота + морское стекло · Space Grotesk",
      fonts: { display: "Space Grotesk", ar: "Noto Kufi Arabic", body: "Readex Pro", css: "Space+Grotesk:wght@500..700&family=Noto+Kufi+Arabic:wght@500..700" },
      c: { bg: "#F7F1E8", surface2: "#EFE6D9", line: "#E4D8C6", ink: "#2B1D16", ink2: "#5F4E43", ink3: "#8D7B6E", brand: "#B4472B", brandSoft: "#F6E1D6", hi: "#9FDCD0", logo: "#9FDCD0", side: "#FBF7F0", sideHi: "#F0E7DA", muted: "#C2B2A1", paper: "#FFFBF5",
        dBg: "#17110D", dSurface: "#211914", dSurface2: "#2C221B", dLine: "#3C3027", dInk: "#F6EEE6", dInk2: "#D2C3B5", dInk3: "#A59382", dBrand: "#F08E6E", dBrandSoft: "#45251A", dOnBrand: "#1C0F0A", dSide: "#120D0A", dSideHi: "#2E241D", dPaper: "#2A2019" },
    },
  };
  for (const t of Object.values(THEMES)) if (t.c) t.sw = [t.c.bg, t.c.brand, t.c.hi, t.c.logo, t.c.ink];

  // ---------- Color math (OKLab) ----------
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  function toLab([r, g, b]) {
    r = lin(r / 255); g = lin(g / 255); b = lin(b / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function labToRgbRaw([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  }
  function fromLab([L, a, b]) {
    L = Math.min(1, Math.max(0, L));
    let k = 1, rgb = labToRgbRaw([L, a, b]);
    const ok = (v) => v.every((x) => x >= -0.0005 && x <= 1.0005);
    if (!ok(rgb)) { let lo = 0, hi = 1; for (let i = 0; i < 18; i++) { k = (lo + hi) / 2; ok(labToRgbRaw([L, a * k, b * k])) ? (lo = k) : (hi = k); } rgb = labToRgbRaw([L, a * lo, b * lo]); }
    return rgb.map((x) => Math.round(255 * gam(Math.min(1, Math.max(0, x)))));
  }
  const hexRgb = (h) => { h = h.replace("#", ""); if (h.length <= 4) h = [...h].map((x) => x + x).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1); };
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const chroma = (p) => Math.hypot(p[1], p[2]);
  const hue = (p) => ((Math.atan2(p[2], p[1]) * 180) / Math.PI + 360) % 360;
  const hex2 = (n) => n.toString(16).padStart(2, "0");
  const toHex = ([r, g, b], a = 1) => "#" + hex2(r) + hex2(g) + hex2(b) + (a < 0.999 ? hex2(Math.round(a * 255)) : "");

  const ANCHORS = [];
  for (const [role, list] of Object.entries(OLD)) for (const h of list) ANCHORS.push({ role, lab: toLab(hexRgb(h)) });
  for (const h of KEEP) ANCHORS.push({ role: null, lab: toLab(hexRgb(h)) });
  const OLD_BRAND = toLab(hexRgb("#224d39")), OLD_INK2 = toLab(hexRgb("#5d675e"));

  let theme = null, themeLab = null, cache = new Map();
  function prepare(t) {
    theme = t; cache = new Map(); themeLab = null;
    if (!t.c) return;
    themeLab = {};
    for (const [k, v] of Object.entries(t.c)) themeLab[k] = toLab(hexRgb(v));
  }
  function mapRgba(rgb, alpha) {
    const key = rgb.join(",");
    let out = cache.get(key);
    if (out === undefined) { out = mapLab(toLab(rgb)); cache.set(key, out); }
    return out ? toHex(out, alpha) : null;
  }
  function mapLab(c) {
    let best = null, bd = 9;
    for (const a of ANCHORS) { const d = dist(c, a.lab); if (d < bd) { bd = d; best = a; } }
    if (bd <= 0.055) {
      if (!best.role) return null;
      const n = themeLab[best.role], a = best.lab;
      const k = Math.min(2, Math.max(0.4, (chroma(c) + 0.008) / (chroma(a) + 0.008)));
      return fromLab([n[0] + (c[0] - a[0]), n[1] * k, n[2] * k]);
    }
    // Not a known palette color: if it belongs to the old green family, move it into the new hue family.
    const h = hue(c), C = chroma(c);
    if (C < 0.006 || h < 115 || h > 200) return null;
    if (ANCHORS.some((a) => !a.role && dist(c, a.lab) < 0.05)) return null;
    const ref = C < 0.03 ? [themeLab.ink2, OLD_INK2] : [themeLab.brand, OLD_BRAND];
    const nh = hue(ref[0]) * (Math.PI / 180);
    const nc = C * Math.min(2.2, Math.max(0.6, chroma(ref[0]) / Math.max(0.01, chroma(ref[1]))));
    return fromLab([c[0], nc * Math.cos(nh), nc * Math.sin(nh)]);
  }

  const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
  function parseColor(s) {
    if (s[0] === "#") { if (![3, 4, 6, 8].includes(s.length - 1)) return null; const v = hexRgb(s); return [v.slice(0, 3), v[3]]; }
    const n = s.match(/[\d.]+%?/g); if (!n || n.length < 3) return null;
    let a = 1; if (n[3] != null) a = n[3].endsWith("%") ? parseFloat(n[3]) / 100 : parseFloat(n[3]);
    return [n.slice(0, 3).map((x) => Math.round(parseFloat(x))), a];
  }
  function recolor(value) {
    if (!theme.c) return value;
    return value.replace(COLOR_RE, (m) => { const p = parseColor(m); if (!p) return m; return mapRgba(p[0], p[1]) || m; });
  }
  const q = (f) => `"${f}"`;
  function refont(value) {
    const f = theme.fonts; if (!f) return value;
    return value
      .replace(/["']?Bricolage Grotesque["']?/g, q(f.display))
      .replace(/["']?Reem Kufi["']?/g, q(f.ar))
      .replace(/["']?Readex Pro["']?/g, f.body === "Readex Pro" ? q("Readex Pro") : `${q(f.body)},"Readex Pro"`);
  }
  const FONT_RE = /Bricolage|Readex|Reem Kufi/;

  // ---------- Collect and apply ----------
  const entries = []; const seenStyles = new WeakSet(); const seenEls = new WeakMap();
  function walk(rules) {
    for (const r of rules) {
      if (r.style && !seenStyles.has(r.style)) {
        seenStyles.add(r.style);
        for (let i = 0; i < r.style.length; i++) {
          const prop = r.style[i], val = r.style.getPropertyValue(prop);
          const isColor = COLOR_RE.test(val); COLOR_RE.lastIndex = 0;
          const isFont = (prop === "font-family" || prop.startsWith("--")) && FONT_RE.test(val);
          if (isColor || isFont) entries.push({ style: r.style, prop, val, prio: r.style.getPropertyPriority(prop), isColor, isFont });
        }
      }
      if (r.cssRules) walk(r.cssRules);
    }
  }
  function scanSheets() {
    for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) { /* cross-origin font sheets */ } }
  }
  function apply(e) {
    let v = e.val;
    if (e.isColor) v = recolor(v);
    if (e.isFont) v = refont(v);
    if (e.style.getPropertyValue(e.prop) !== v) e.style.setProperty(e.prop, v, e.prio);
  }
  function scanInline(root = document.body) {
    if (!root || !root.querySelectorAll) return;
    const els = root.querySelectorAll("[style],[fill],[stroke],[stop-color]");
    for (const el of els) {
      if (el.closest("#theme-lab-host")) continue;
      let o = seenEls.get(el);
      const cur = { style: el.getAttribute("style"), fill: el.getAttribute("fill"), stroke: el.getAttribute("stroke"), "stop-color": el.getAttribute("stop-color") };
      if (!o || Object.keys(cur).some((k) => cur[k] !== (o.applied[k] ?? null))) { o = { orig: cur, applied: {} }; seenEls.set(el, o); }
      for (const k of Object.keys(o.orig)) {
        const v0 = o.orig[k]; if (v0 == null) continue;
        let v = recolor(v0); if (k === "style") v = refont(v);
        o.applied[k] = v; if (el.getAttribute(k) !== v) el.setAttribute(k, v);
      }
    }
  }
  function loadFonts(t) {
    if (!t.fonts || document.getElementById("theme-lab-font-" + t.key)) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.id = "theme-lab-font-" + t.key;
    l.href = "https://fonts.googleapis.com/css2?family=" + t.fonts.css + "&display=swap"; document.head.appendChild(l);
  }
  let busy = false;
  function render() {
    busy = true;
    scanSheets(); for (const e of entries) apply(e); scanInline();
    busy = false;
  }
  const still = document.createElement("style"); still.textContent = "*,*::before,*::after{transition:none!important}";
  function setTheme(key) {
    const t = THEMES[key] || THEMES.current; t.key = key; prepare(t); loadFonts(t);
    document.head.appendChild(still); render(); document.body.offsetHeight; requestAnimationFrame(() => requestAnimationFrame(() => still.remove()));
    save(); paintPanel();
  }
  function setMode(mode) {
    state.mode = mode;
    if (mode === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", mode);
    save(); paintPanel();
  }

  // ---------- State ----------
  const KEY = "basira-theme-lab";
  let state = { theme: "current", mode: "auto", open: true };
  try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  function save() { state.theme = theme ? theme.key : state.theme; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  // ---------- Panel (shadow DOM, outside the repaint) ----------
  const host = document.createElement("div"); host.id = "theme-lab-host";
  host.style.cssText = "position:fixed;inset-inline-start:16px;bottom:16px;z-index:2147483647";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host{all:initial}
    .p{font:500 13px/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;background:#fff;border:1px solid #0002;border-radius:16px;box-shadow:0 12px 40px -12px #0005;width:300px;max-width:calc(100vw - 32px);overflow:hidden}
    .h{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #0001}
    .h b{flex:1;font-size:13px} .h small{color:#666;font-weight:400}
    button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
    .x{width:26px;height:26px;border-radius:8px;display:grid;place-items:center}.x:hover{background:#0001}
    .list{padding:6px}
    .t{display:flex;align-items:center;gap:10px;width:100%;text-align:start;padding:8px;border-radius:10px;border:1.5px solid transparent}
    .t:hover{background:#0000000a} .t[aria-pressed=true]{border-color:#111;background:#0000000a}
    .sw{display:flex;flex-shrink:0}.sw i{width:16px;height:16px;border-radius:50%;margin-inline-start:-5px;border:1.5px solid #fff;box-shadow:0 0 0 1px #0002}.sw i:first-child{margin:0}
    .t>span:last-child{display:flex;flex-direction:column;min-width:0}.t em{font-style:normal;color:#666;font-size:11.5px;font-weight:400}
    .m{display:flex;gap:4px;padding:0 12px 12px}.m button{flex:1;padding:6px;border-radius:8px;background:#0000000a;font-size:12px}.m button[aria-pressed=true]{background:#111;color:#fff}
    .f{padding:0 12px 12px;color:#777;font-size:11px;font-weight:400}
    .pill{display:flex;align-items:center;gap:8px;padding:8px 12px 8px 8px;border-radius:99px;background:#fff;border:1px solid #0002;box-shadow:0 8px 24px -10px #0005;font:600 12px ui-sans-serif,system-ui,sans-serif;color:#111}
  </style><div id="w"></div>`;
  const w = root.getElementById("w");
  function paintPanel() {
    const cur = theme ? theme.key : state.theme;
    const sw = (t) => `<span class="sw">${t.sw.map((c) => `<i style="background:${c}"></i>`).join("")}</span>`;
    if (!state.open) { w.innerHTML = `<button class="pill" data-open>${sw(THEMES[cur])}${THEMES[cur].name}</button>`; return; }
    w.innerHTML = `<div class="p"><div class="h"><b>Темы Basira <small>· превью</small></b><button class="x" data-close title="Свернуть">✕</button></div>
      <div class="list">${Object.entries(THEMES).map(([k, t]) => `<button class="t" data-t="${k}" aria-pressed="${k === cur}">${sw(t)}<span><b>${t.name}</b><em>${t.note}</em></span></button>`).join("")}</div>
      <div class="m">${[["auto", "Авто"], ["light", "Светлая"], ["dark", "Тёмная"]].map(([k, n]) => `<button data-m="${k}" aria-pressed="${state.mode === k}">${n}</button>`).join("")}</div>
      <div class="f">Только просмотр: файлы проекта не меняются. Тёмная тема есть в приложении и портале.</div></div>`;
  }
  root.addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.t) setTheme(b.dataset.t);
    else if (b.dataset.m) setMode(b.dataset.m);
    else if ("close" in b.dataset) { state.open = false; save(); paintPanel(); }
    else if ("open" in b.dataset) { state.open = true; save(); paintPanel(); }
  });

  // ---------- Keep up with pages that render later ----------
  let timer = 0;
  new MutationObserver((muts) => {
    if (busy) return;
    if (muts.every((m) => host.contains(m.target) || m.target === host)) return;
    clearTimeout(timer); timer = setTimeout(render, 60);
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "fill", "stroke", "stop-color"] });

  function boot() {
    document.body.appendChild(host);
    setMode(state.mode);
    setTheme(state.theme);
  }
  window.__themeLab = { THEMES, setTheme, setMode, prime: (k) => { const t = THEMES[k]; t.key = k; prepare(t); }, recolor: (v) => recolor(v), map: (h) => { const v = hexRgb(h); return mapRgba(v.slice(0, 3), v[3]); }, seen: (el) => seenEls.get(el), stats: () => ({ rules: entries.length, theme: theme && theme.key }) };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
})();
