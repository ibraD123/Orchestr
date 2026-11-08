// Generated slides: which slides an image model may draw whole, what to ask it for, and how to
// check the text it drew against the approved text, letter by letter.
// Pure functions: the server pipeline (server/slidegen.mjs) uses them, and the app inlines them.
import { templateById } from "./templates.mjs";

// Slides with structured or long text are always typeset: tables, lists, size charts, specs.
export const TYPESET_ONLY = ["cover", "details", "compare", "icons", "trust", "sizechart", "steps", "inbox", "dimensions", "notes"];
export const GEN_LIMITS = { ar: 40, en: 60, items: 4 };

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toArabicDigits = (s) => String(s).replace(/[0-9]/g, (d) => AR_DIGITS[d]);
const toWesternDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
const HAS_AR = /[؀-ۿ]/;

/**
 * The text a slide shows, in the slide's languages, with the brand's digits applied to Arabic.
 * @returns {Array<{ key, text, lang }>}
 */
export function slideTexts(templateId, fields, { language = "both", numerals = "arabic" } = {}) {
  const tpl = templateById(templateId);
  if (!tpl) return [];
  const v = Object.assign({}, tpl.sample, fields || {});
  const ar = language !== "en", en = language !== "ar";
  const out = [];
  for (const fd of tpl.fields) {
    const raw = String(v[fd.key] == null ? "" : v[fd.key]).trim();
    if (!raw) continue;
    const lang = fd.lang || (HAS_AR.test(raw) ? "ar" : "en");
    if ((lang === "ar" && !ar) || (lang === "en" && !en)) continue;
    const text = lang === "ar" ? (numerals === "arabic" ? toArabicDigits(raw) : toWesternDigits(raw)) : raw;
    out.push({ key: fd.key, text, lang, type: fd.type });
  }
  return out;
}

/**
 * Generate the whole slide with an image model, or typeset it.
 * @returns {{ mode: "generate"|"typeset", reason, texts }}
 */
export function planSlide(templateId, fields, opts) {
  const texts = slideTexts(templateId, fields, opts);
  if (!templateById(templateId)) return { mode: "typeset", reason: "unknown", texts };
  if (TYPESET_ONLY.includes(templateId)) return { mode: "typeset", reason: templateId === "cover" ? "mainImage" : "structured", texts };
  if (texts.some((t) => t.type === "lines" || t.type === "rows")) return { mode: "typeset", reason: "structured", texts };
  if (texts.length > GEN_LIMITS.items) return { mode: "typeset", reason: "tooMuchText", texts };
  if (texts.some((t) => t.text.length > (t.lang === "ar" ? GEN_LIMITS.ar : GEN_LIMITS.en))) return { mode: "typeset", reason: "tooMuchText", texts };
  return { mode: "generate", reason: "short", texts };
}

/** Prompt for a slide drawn whole: scene, the product from the reference photo, and the exact text. */
export function slidePrompt({ templateId, texts, product, category, kit, visual, numerals, withText = true }) {
  const tpl = templateById(templateId) || { name: ["Slide"], question: [""] };
  const colours = kit ? `Use the brand colours: background ${kit.bg}, text ${kit.fg}, accent ${kit.accent || kit.ac || kit.fg}.` : "";
  const lines = [
    `Vertical 4:5 e-commerce infographic slide for an online marketplace listing (${tpl.name[0]}: ${tpl.question[0]}).`,
    `The product is ${product || "the product in the reference image"}${category ? ` (${category})` : ""}.`,
    "Use the reference photo for the product and keep it exactly as it is: same shape, colour, label, proportions and details. Do not redraw or restyle the product.",
    templateId === "searchcard"
      ? "This is the first image buyers see in marketplace search results: pure white background, the product shown from the front and filling most of the frame, one soft brand-colour shape behind it at most. No border, no price, no discount, no scene."
      : "Premium, clean composition with soft natural light; the product is the hero and clearly visible.",
    colours,
    visual ? `Brand visual style: ${visual}` : ""
  ];
  if (withText) {
    lines.push("Render ONLY the following text, exactly as written, character for character, and nothing else:");
    for (const t of texts) {
      lines.push(t.lang === "ar"
        ? `- Arabic, right to left, letters properly joined, ${numerals === "arabic" ? "Arabic-Indic digits" : "Western digits"}: «${t.text}»`
        : `- English: "${t.text}"`);
    }
    lines.push("Arabic text first and largest; English smaller underneath. Large, legible, high-contrast typography, kept well inside the frame with generous margins.");
  } else {
    lines.push("Do NOT render any text, letters, numbers, logos or watermarks. Leave the top third of the image as calm, uncluttered space in the background colour for a headline added later.");
  }
  lines.push("No other words, no fake brand names, no watermarks, no UI elements.");
  return lines.filter(Boolean).join("\n");
}

/** Normalise for comparison: keep letters and digits exactly, drop marks that do not change the word. */
export function normaliseText(s) {
  return String(s || "")
    .normalize("NFC")
    .replace(/[ً-ْٰ]/g, "") // harakat (the approved copy carries none)
    .replace(/ـ/g, "") // tatweel
    .replace(/[​-‏؜⁦-⁩﻿]/g, "") // zero-width and direction marks
    .replace(/[«»“”"'’‘.,،:;!?؟·•\-–—()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Compare the approved text with what was read back from the image.
 * Every approved line must appear exactly; text that was not asked for counts against the image.
 * @param {Array<{ text, lang }>} expected
 * @param {string[]} found  overlay text read from the image
 */
export function compareTexts(expected, found) {
  const joined = normaliseText((found || []).join(" "));
  let rest = " " + joined + " ";
  const items = (expected || []).map((e) => {
    const want = normaliseText(e.text);
    if (!want) return { text: e.text, lang: e.lang, ok: true };
    if (rest.includes(" " + want + " ")) {
      rest = rest.replace(" " + want + " ", "  ");
      return { text: e.text, lang: e.lang, ok: true };
    }
    // Same words with the other digit style: the numerals rule failed, not the words.
    const otherDigits = HAS_AR.test(e.text) && /[0-9٠-٩]/.test(e.text) ? [toArabicDigits(want), toWesternDigits(want)].find((x) => x !== want && rest.includes(" " + x + " ")) : null;
    if (otherDigits) { rest = rest.replace(" " + otherDigits + " ", "  "); return { text: e.text, lang: e.lang, ok: false, issue: "digits" }; }
    return { text: e.text, lang: e.lang, ok: false, issue: "missing" };
  });
  const extra = rest.replace(/\s+/g, " ").trim();
  const extraLetters = (extra.match(/[\p{L}\p{N}]/gu) || []).length;
  const issues = items.filter((i) => !i.ok).map((i) => ({ type: i.issue, text: i.text }));
  if (extraLetters > 2) issues.push({ type: "extra", text: extra });
  return { ok: issues.length === 0, items, extra: extraLetters > 2 ? extra : "", issues };
}
