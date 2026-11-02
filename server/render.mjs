// Slide renderer. Image models never draw the words: text is typeset by Chromium
// (HarfBuzz shaping, proper joining and bidi) over the product image, then the
// page is captured as a marketplace-ready PNG.
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { TEMPLATE_CSS, TEMPLATE_IDS, templateById, templateHTML } from "./templates.mjs";

const require = createRequire(import.meta.url);
export const SLIDE_WIDTH = 1600;
export const SLIDE_HEIGHT = 2000;
export const SLIDE_KINDS = TEMPLATE_IDS;

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
    fontFace("Bricolage Grotesque", "bricolage-grotesque", "bricolage-grotesque-latin-700-normal.woff2", 700, LATIN_RANGE),
    fontFace("Bricolage Grotesque", "bricolage-grotesque", "bricolage-grotesque-latin-800-normal.woff2", 800, LATIN_RANGE),
    fontFace("Readex Pro", "readex-pro", "readex-pro-arabic-600-normal.woff2", 600, AR_RANGE),
    fontFace("Readex Pro", "readex-pro", "readex-pro-latin-600-normal.woff2", 600, LATIN_RANGE)
  ].join("\n");
  return FONT_CSS;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function toNumerals(text, numerals) {
  const s = String(text ?? "");
  if (numerals === "arabic") return s.replace(/[0-9]/g, (d) => ARABIC_DIGITS[d]);
  return s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}


const COLOR = /^#[0-9a-fA-F]{3,8}$/;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

// Old request shape ({ kind, headlineAr, ... }) maps onto templates.
const LEGACY = {
  benefit: (s) => ({ headAr: s.headlineAr, headEn: s.headlineEn }),
  details: (s) => ({ titleAr: s.detailsTitleAr, titleEn: s.detailsTitleEn, linesAr: [].concat(s.bulletsAr || []).join("\n"), linesEn: [].concat(s.bulletsEn || []).join("\n") }),
  occasion: (s) => ({ headAr: s.occasionAr, headEn: s.occasionEn }),
  cover: () => ({})
};

/** Validate and normalise a render request. Throws an Error with .status = 400 on bad input. */
export function normaliseSpec(input) {
  const s = input || {};
  const fail = (msg) => { const e = new Error(msg); e.status = 400; throw e; };
  const id = s.template || s.kind;
  const tpl = templateById(id);
  if (!tpl) fail(`template must be one of ${TEMPLATE_IDS.join(", ")}`);
  if (typeof s.image !== "string" || !IMAGE_DATA_URL.test(s.image)) fail("image must be a base64 data URL (png, jpeg, webp or svg)");
  if (s.image.length > 12_000_000) fail("image is larger than 9 MB");
  let kit = null;
  if (s.kit) {
    for (const k of ["bg", "fg", "accent"]) if (s.kit[k] && !COLOR.test(s.kit[k])) fail(`kit.${k} must be a hex colour`);
    kit = { bg: s.kit.bg, fg: s.kit.fg, accent: s.kit.accent };
    for (const k of Object.keys(kit)) if (!kit[k]) delete kit[k];
  }
  const raw = s.fields && typeof s.fields === "object" ? s.fields : LEGACY[id] ? LEGACY[id](s) : {};
  const fields = {};
  for (const fd of tpl.fields) {
    const val = raw[fd.key];
    if (val == null) continue;
    fields[fd.key] = String(Array.isArray(val) ? val.join("\n") : val).slice(0, fd.type === "rows" || fd.type === "lines" ? 1200 : 160);
  }
  return {
    template: tpl.id, image: s.image, fields, kit,
    language: ["ar", "en", "both"].includes(s.language) ? s.language : "both",
    numerals: s.numerals === "western" ? "western" : "arabic",
    brand: String(s.brand || "").trim().slice(0, 24)
  };
}

/** Build the standalone HTML document for one slide. */
export function slideDocument(spec) {
  const html = templateHTML(spec.template, spec.fields, { image: spec.image, kit: spec.kit || undefined, language: spec.language, numerals: spec.numerals, brand: spec.brand });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss()}
html,body{margin:0;width:${SLIDE_WIDTH}px;height:${SLIDE_HEIGHT}px;overflow:hidden}
${TEMPLATE_CSS}
</style></head><body>${html}</body></html>`;
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

/**
 * Measure an image and check whether its background is white, the rule Amazon and Noon
 * apply to main images. Samples a ring of pixels around the border.
 */
export async function probeImage(dataUrl) {
  const b = await browser();
  const page = await b.newPage();
  try {
    await page.route("**/*", (route) => route.request().url().startsWith("data:") ? route.continue() : route.abort());
    return await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const w = img.naturalWidth, h = img.naturalHeight;
      const c = document.createElement("canvas");
      const scale = Math.min(1, 400 / Math.max(w, h));
      c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let white = 0, total = 0;
      const band = Math.max(1, Math.round(Math.min(c.width, c.height) * 0.03));
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        if (x >= band && x < c.width - band && y >= band && y < c.height - band) continue;
        const i = (y * c.width + x) * 4;
        total++;
        if (d[i + 3] > 200 && d[i] >= 243 && d[i + 1] >= 243 && d[i + 2] >= 243) white++;
      }
      return { width: w, height: h, whiteShare: total ? white / total : 0 };
    }, dataUrl);
  } finally { await page.close(); }
}

export async function rendererAvailable() {
  try { await browser(); return true; } catch { return false; }
}

export async function closeRenderer() {
  if (browserPromise) { const b = await browserPromise.catch(() => null); browserPromise = null; if (b) await b.close(); }
}
