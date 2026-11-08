// Slide renderer. Image models never draw the words: text is typeset by Chromium
// (HarfBuzz shaping, proper joining and bidi) over the product image, then the
// page is captured as a marketplace-ready PNG.
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { TEMPLATE_CSS, TEMPLATE_IDS, TEMPLATE_FONTS, LOGO_POSITIONS, templateById, templateHTML } from "./templates.mjs";
import { measurePixels, borderColour, colourDiff, dominantColours, colourFidelity } from "./photo-metrics.mjs";
// Source passed into the page, which can't import modules.
const MEASURE_SRC = `(function(){ ${borderColour}\nreturn ${measurePixels}; })()`;
const FIDELITY_SRC = `(function(){ ${borderColour}\n${colourDiff}\n${dominantColours}\nreturn ${colourFidelity}; })()`;

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
    fontFace("Amiri", "amiri", "amiri-arabic-400-normal.woff2", 400, AR_RANGE),
    fontFace("Amiri", "amiri", "amiri-latin-400-normal.woff2", 400, LATIN_RANGE),
    fontFace("Amiri", "amiri", "amiri-arabic-700-normal.woff2", 700, AR_RANGE),
    fontFace("Amiri", "amiri", "amiri-latin-700-normal.woff2", 700, LATIN_RANGE),
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
const LOGO_URL = /^data:image\/(?:(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+|svg\+xml(?:;utf8)?,[^"<>]+)$/;
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
  let logo = null;
  if (s.logo && s.logo.src) {
    if (typeof s.logo.src !== "string" || !LOGO_URL.test(s.logo.src)) fail("logo.src must be a PNG, JPEG, WebP or SVG data URL");
    if (s.logo.src.length > 3_000_000) fail("logo is larger than 2 MB");
    logo = { src: s.logo.src, pos: LOGO_POSITIONS.indexOf(s.logo.pos) > -1 ? s.logo.pos : "top-end" };
  }
  return {
    template: tpl.id, image: s.image, fields, kit, logo, fonts: TEMPLATE_FONTS[s.fonts] ? s.fonts : "kufi",
    language: ["ar", "en", "both"].includes(s.language) ? s.language : "both",
    numerals: s.numerals === "western" ? "western" : "arabic",
    brand: String(s.brand || "").trim().slice(0, 24)
  };
}

/** Build the standalone HTML document for one slide. */
export function slideDocument(spec) {
  const html = templateHTML(spec.template, spec.fields, { image: spec.image, kit: spec.kit || undefined, language: spec.language, numerals: spec.numerals, brand: spec.brand, logo: spec.logo, fonts: spec.fonts });
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
      const b = await chromium.launch({ executablePath, args: ["--no-sandbox", "--font-render-hinting=none"] });
      // If Chromium crashes or is closed, launch a fresh one on the next request instead of failing forever.
      b.on("disconnected", () => { browserPromise = null; });
      return b;
    })();
    browserPromise.catch(() => { browserPromise = null; });
  }
  const b = await browserPromise;
  if (!b.isConnected()) { browserPromise = null; return browser(); }
  return b;
}

/** Open a page, retrying once with a fresh browser if the old one died between requests. */
async function newPage(opts) {
  try { return await (await browser()).newPage(opts); }
  catch (e) {
    if (!/closed|disconnected|crash/i.test(e.message)) throw e;
    browserPromise = null;
    return (await browser()).newPage(opts);
  }
}

/** Render one slide to a PNG buffer, or JPEG with { format: "jpeg" } (Noon accepts JPEG only). */
export async function renderSlide(input, { format = "png" } = {}) {
  const spec = normaliseSpec(input);
  const page = await newPage({ viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT } });
  try {
    // Block every network request: the document is fully self-contained.
    await page.route("**/*", (route) => route.request().url().startsWith("data:") ? route.continue() : route.abort());
    await page.setContent(slideDocument(spec), { waitUntil: "load" });
    // Load every embedded face before the screenshot: fonts.ready alone can resolve before
    // the browser has started loading the faces a slide uses.
    await page.evaluate(() => Promise.all([...document.fonts].map((f) => f.load().catch(() => null))).then(() => document.fonts.ready));
    return await page.screenshot(format === "jpeg" ? { type: "jpeg", quality: 92, clip: { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT } } : { type: "png", clip: { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT } });
  } finally {
    await page.close();
  }
}

/** Frames from an MP4, at the start, middle and end, as JPEG data URLs (Chrome decodes H.264). */
export async function videoFrames(mp4, { count = 3, maxSide = 1024 } = {}) {
  const page = await newPage();
  try {
    const src = "https://basira.local/video.mp4";
    await page.route("**/*", (route) => {
      const u = route.request().url();
      if (u === src) return route.fulfill({ status: 200, contentType: "video/mp4", body: Buffer.from(mp4) });
      if (u === "https://basira.local/") return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>frames</title>" });
      return u.startsWith("data:") || u === "about:blank" ? route.continue() : route.abort();
    });
    await page.goto("https://basira.local/");
    return await page.evaluate(async ({ src, count, maxSide }) => {
      const v = document.createElement("video");
      v.muted = true; v.preload = "auto"; v.src = src;
      await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error("This video can't be decoded")); });
      const d = v.duration || 0, out = [];
      const times = Array.from({ length: count }, (_, i) => Math.min(Math.max(0.05, (d * (i + 0.5)) / count), Math.max(0.05, d - 0.05)));
      const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement("canvas"); c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
      for (const t of times) {
        await new Promise((res) => { v.onseeked = res; v.currentTime = t; });
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        out.push(c.toDataURL("image/jpeg", 0.85));
      }
      return out;
    }, { src, count, maxSide });
  } finally { await page.close(); }
}

/** Any PNG or WebP data URL → JPEG bytes at the same size, transparency on white (Noon accepts JPEG only). */
export async function toJpeg(dataUrl, quality = 0.92) {
  const page = await newPage();
  try {
    await page.route("**/*", (route) => route.request().url().startsWith("data:") ? route.continue() : route.abort());
    const b64 = await page.evaluate(async ({ src, q }) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0);
      return c.toDataURL("image/jpeg", q).split(",")[1];
    }, { src: dataUrl, q: quality });
    return Buffer.from(b64, "base64");
  } finally { await page.close(); }
}

/**
 * Measure an image and check whether its background is white, the rule Amazon and Noon
 * apply to main images. Samples a ring of pixels around the border.
 */
export async function probeImage(dataUrl) {
  const page = await newPage();
  try {
    await page.route("**/*", (route) => route.request().url().startsWith("data:") ? route.continue() : route.abort());
    return await page.evaluate(async ({ src, fn }) => {
      const measure = new Function("return " + fn)();
      const img = new Image();
      img.src = src;
      await img.decode();
      const w = img.naturalWidth, h = img.naturalHeight;
      const scale = Math.min(1, 400 / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const m = measure(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      return { width: w, height: h, whiteShare: m.whiteShare, fill: m.fill, transparent: m.transparent };
    }, { src: dataUrl, fn: MEASURE_SRC });
  } finally { await page.close(); }
}

/** Print a self-contained HTML document to an A4 PDF with the embedded brand fonts. */
export async function renderPdf(html) {
  const page = await newPage();
  try {
    await page.route("**/*", (route) => route.request().url().startsWith("data:") ? route.continue() : route.abort());
    await page.setContent(String(html).replace("<head>", () => `<head><style>${fontCss()}</style>`), { waitUntil: "load" });
    await page.evaluate(() => Promise.all([...document.fonts].map((f) => f.load().catch(() => null))).then(() => document.fonts.ready));
    return await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  } finally { await page.close(); }
}

/** Render ready-made slide HTML (a .bz root, e.g. sceneHTML) to a 1600 × 2000 PNG with the brand fonts. */
export async function renderHtml(bodyHtml) {
  const page = await newPage({ viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT } });
  try {
    await page.route("**/*", (route) => route.request().url().startsWith("data:") ? route.continue() : route.abort());
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fontCss()}\nhtml,body{margin:0;width:${SLIDE_WIDTH}px;height:${SLIDE_HEIGHT}px;overflow:hidden}\n${TEMPLATE_CSS}</style></head><body>${bodyHtml}</body></html>`, { waitUntil: "load" });
    await page.evaluate(() => Promise.all([...document.fonts].map((f) => f.load().catch(() => null))).then(() => document.fonts.ready));
    return await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT } });
  } finally { await page.close(); }
}

/** Fit any image to a 1600 × 2000 PNG (cover crop, centred): image models return their own sizes. */
export async function fitSlideImage(dataUrl) {
  return renderHtml(`<img src="${dataUrl}" alt="" style="position:absolute;inset:0;width:${SLIDE_WIDTH}px;height:${SLIDE_HEIGHT}px;object-fit:cover">`);
}

/** Colour fidelity of a generated image against the product photo, decoded in Chromium. */
export async function imageFidelity(originalDataUrl, generatedDataUrl) {
  const page = await newPage();
  try {
    await page.route("**/*", (route) => route.request().url().startsWith("data:") ? route.continue() : route.abort());
    return await page.evaluate(async ({ a, b, fn }) => {
      const fidelity = new Function("return " + fn)();
      const pixels = async (src) => {
        const img = new Image(); img.src = src; await img.decode();
        const scale = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, c.width, c.height);
        return { data: ctx.getImageData(0, 0, c.width, c.height).data, width: c.width, height: c.height };
      };
      return fidelity(await pixels(a), await pixels(b));
    }, { a: originalDataUrl, b: generatedDataUrl, fn: FIDELITY_SRC });
  } finally { await page.close(); }
}

export async function rendererAvailable() {
  try { await browser(); return true; } catch { return false; }
}

export const browserForTests = () => browser();

export async function closeRenderer() {
  if (browserPromise) { const b = await browserPromise.catch(() => null); browserPromise = null; if (b) await b.close(); }
}
