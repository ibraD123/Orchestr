// Slide renderer. Image models never draw the words: text is typeset by Chromium
// (HarfBuzz shaping, proper joining and bidi) over the product image, then the
// page is captured as a marketplace-ready PNG.
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const SLIDE_WIDTH = 1600;
export const SLIDE_HEIGHT = 2000;
export const SLIDE_KINDS = ["cover", "benefit", "details", "occasion"];

// Fonts are embedded so renders never depend on the network.
function fontFace(family, pkg, file, weight, range) {
  const path = require.resolve(`@fontsource/${pkg}/files/${file}`);
  const data = readFileSync(path).toString("base64");
  return `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2");unicode-range:${range}}`;
}
const AR_RANGE = "U+0600-06FF,U+0750-077F,U+0870-08FF,U+FB50-FDFF,U+FE70-FEFF,U+200C-200E,U+2010-2011,U+204F,U+2E41";
const LATIN_RANGE = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
let FONT_CSS = null;
function fontCss() {
  if (FONT_CSS) return FONT_CSS;
  FONT_CSS = [
    fontFace("Reem Kufi", "reem-kufi", "reem-kufi-arabic-600-normal.woff2", 600, AR_RANGE),
    fontFace("Reem Kufi", "reem-kufi", "reem-kufi-latin-600-normal.woff2", 600, LATIN_RANGE),
    fontFace("Readex Pro", "readex-pro", "readex-pro-arabic-400-normal.woff2", 400, AR_RANGE),
    fontFace("Readex Pro", "readex-pro", "readex-pro-latin-400-normal.woff2", 400, LATIN_RANGE),
    fontFace("Readex Pro", "readex-pro", "readex-pro-arabic-300-normal.woff2", 300, AR_RANGE),
    fontFace("Readex Pro", "readex-pro", "readex-pro-latin-300-normal.woff2", 300, LATIN_RANGE),
    fontFace("Bricolage Grotesque", "bricolage-grotesque", "bricolage-grotesque-latin-700-normal.woff2", 700, LATIN_RANGE)
  ].join("\n");
  return FONT_CSS;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function toNumerals(text, numerals) {
  const s = String(text ?? "");
  if (numerals === "arabic") return s.replace(/[0-9]/g, (d) => ARABIC_DIGITS[d]);
  return s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const COLOR = /^#[0-9a-fA-F]{3,8}$/;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

/** Validate and normalise a render request. Throws an Error with .status = 400 on bad input. */
export function normaliseSpec(input) {
  const s = input || {};
  const fail = (msg) => { const e = new Error(msg); e.status = 400; throw e; };
  const kind = SLIDE_KINDS.includes(s.kind) ? s.kind : fail(`kind must be one of ${SLIDE_KINDS.join(", ")}`);
  if (typeof s.image !== "string" || !IMAGE_DATA_URL.test(s.image)) fail("image must be a base64 data URL (png, jpeg, webp or svg)");
  if (s.image.length > 12_000_000) fail("image is larger than 9 MB");
  const kit = s.kit || {};
  for (const k of ["bg", "fg", "accent"]) if (kit[k] && !COLOR.test(kit[k])) fail(`kit.${k} must be a hex colour`);
  const lines = (v) => (Array.isArray(v) ? v : String(v || "").split("\n")).map((x) => String(x).trim()).filter(Boolean).slice(0, 6);
  const text = (v, max = 80) => String(v || "").trim().slice(0, max);
  return {
    kind,
    image: s.image,
    language: ["ar", "en", "both"].includes(s.language) ? s.language : "both",
    numerals: s.numerals === "western" ? "western" : "arabic",
    kit: { bg: kit.bg || "#2A1A0E", fg: kit.fg || "#F2C88A", accent: kit.accent || "#F4E9D8" },
    brand: text(s.brand, 24),
    headlineAr: text(s.headlineAr), headlineEn: text(s.headlineEn),
    detailsTitleAr: text(s.detailsTitleAr, 40) || "المكوّنات", detailsTitleEn: text(s.detailsTitleEn, 40) || "What's inside",
    bulletsAr: lines(s.bulletsAr), bulletsEn: lines(s.bulletsEn),
    occasionAr: text(s.occasionAr), occasionEn: text(s.occasionEn)
  };
}

/** Build the standalone HTML document for one slide. */
export function slideDocument(spec) {
  const s = spec;
  const ar = s.language !== "en", en = s.language !== "ar";
  const n = (t) => toNumerals(t, s.numerals);
  const head = (arText, enText) =>
    (ar && arText ? `<div class="hd" dir="rtl">${esc(n(arText))}</div>` : "") +
    (en && enText ? `<div class="${ar ? "sub" : "hd en"}" dir="ltr">${esc(enText)}</div>` : "");
  const brand = s.brand && s.kind !== "cover" ? `<div class="brand">${esc(s.brand)}</div>` : "";
  let body = "";
  if (s.kind === "cover") {
    body = `<div class="prod cover"><img src="${s.image}" alt=""></div>`;
  } else if (s.kind === "benefit") {
    body = `<div class="txt top">${head(s.headlineAr, s.headlineEn)}</div><div class="prod lower"><img src="${s.image}" alt=""></div>`;
  } else if (s.kind === "details") {
    const rtl = ar;
    const list = (rtl ? s.bulletsAr : s.bulletsEn).map((b) => `<li>${esc(rtl ? n(b) : b)}</li>`).join("");
    const second = ar && en && s.bulletsEn.length ? `<div class="sub" dir="ltr">${esc(s.bulletsEn.join(" · "))}</div>` : "";
    body = `<div class="prod side ${rtl ? "left" : "right"}"><img src="${s.image}" alt=""></div>
      <div class="txt details ${rtl ? "right" : "left"}" dir="${rtl ? "rtl" : "ltr"}">
        <div class="hd${rtl ? "" : " en"} small">${esc(rtl ? s.detailsTitleAr : s.detailsTitleEn)}</div><ul>${list}</ul>${second}</div>`;
  } else {
    body = `<div class="prod upper"><img src="${s.image}" alt=""></div><div class="txt bottom">${head(s.occasionAr, s.occasionEn)}</div>`;
  }
  const bg = s.kind === "cover" ? "#FFFFFF" : s.kit.bg;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss()}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${SLIDE_WIDTH}px;height:${SLIDE_HEIGHT}px;overflow:hidden}
body{background:${bg};color:${s.kit.fg};font-family:"Readex Pro",sans-serif;position:relative}
.prod{position:absolute;display:flex;align-items:center;justify-content:center}
.prod img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 40px 40px rgba(0,0,0,.28))}
.prod.cover{inset:7.5%}.prod.cover img{filter:none}
.prod.lower{inset:34% 18% 6% 18%}
.prod.upper{inset:8% 18% 26% 18%}
.prod.side{top:14%;bottom:14%;width:44%}.prod.side.left{left:4%}.prod.side.right{right:4%}
.txt{position:absolute;left:8%;right:8%;display:flex;flex-direction:column;gap:28px;align-items:center;text-align:center}
.txt.top{top:9%}.txt.bottom{bottom:8%}
.txt.details{top:22%;width:44%;align-items:stretch;text-align:start;gap:44px}
.txt.details.right{right:7%;left:auto}.txt.details.left{left:7%;right:auto}
.hd{font-family:"Reem Kufi",sans-serif;font-weight:600;font-size:150px;line-height:1.18}
.hd.en{font-family:"Bricolage Grotesque",sans-serif;font-weight:700;font-size:124px;line-height:1.02;letter-spacing:-.02em}
.txt.details .sub{font-size:48px}
.hd.small{font-size:104px}.hd.en.small{font-size:92px}
.sub{font-size:60px;font-weight:300;color:${s.kit.accent};line-height:1.3}
ul{list-style:none;display:flex;flex-direction:column;gap:40px;font-size:68px;color:${s.kit.accent}}
li{display:flex;align-items:center;gap:32px}
li::before{content:"";width:26px;height:26px;transform:rotate(45deg);background:${s.kit.fg};flex:none}
.brand{position:absolute;top:5%;${s.language === "en" ? "left" : "right"}:6%;font-family:"Bricolage Grotesque",sans-serif;font-weight:700;font-size:48px;letter-spacing:.24em;color:${s.kit.accent};opacity:.85}
</style></head><body>${brand}${body}</body></html>`;
}

let browserPromise = null;
async function browser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright-core");
      const candidates = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium", chromium.executablePath()].filter(Boolean);
      const executablePath = candidates.find((p) => existsSync(p));
      if (!executablePath) throw new Error("Chromium not found. Set CHROMIUM_PATH or run: npx playwright-core install chromium");
      return chromium.launch({ executablePath, args: ["--no-sandbox", "--font-render-hinting=none"] });
    })();
    browserPromise.catch(() => { browserPromise = null; });
  }
  return browserPromise;
}

/** Render one slide to a PNG buffer. */
export async function renderSlide(input) {
  const spec = normaliseSpec(input);
  const b = await browser();
  const page = await b.newPage({ viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT } });
  try {
    // Block every network request: the document is fully self-contained.
    await page.route("**/*", (route) => route.request().url().startsWith("data:") ? route.continue() : route.abort());
    await page.setContent(slideDocument(spec), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT } });
  } finally {
    await page.close();
  }
}

export async function rendererAvailable() {
  try { await browser(); return true; } catch { return false; }
}

export async function closeRenderer() {
  if (browserPromise) { const b = await browserPromise.catch(() => null); browserPromise = null; if (b) await b.close(); }
}
