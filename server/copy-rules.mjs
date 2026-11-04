// Rule-based copy cleanup: apply the brand's checkable rules to existing titles and bullets
// without an AI model. Used by bulk processing before (or instead of) AI drafts.
// Pure functions: inlined into the app by scripts/build.mjs (the import line is dropped there).
import { activeTraits, normaliseWord, stem } from "./brand-dna.mjs";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const ARABIC = /[؀-ۿ]/;
const EMOJI = /\p{Extended_Pictographic}️?/gu;
const SEPARATORS = /(\s[·|\-–—]\s|,\s|،\s)/;

function tidy(s) {
  return String(s || "")
    .replace(/\s+([,،.:;!?؟])/g, "$1")
    .replace(/([,،·|\-–—])\s*(?=[,،·|\-–—])/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,،·|\-–—]+|[\s,،·|\-–—]+$/g, "")
    .trim();
}

function removeWord(text, word) {
  const target = normaliseWord(stem(word));
  let hit = false;
  const out = String(text || "").split(/(\s+)/).filter((chunk) => {
    const core = chunk.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (core && normaliseWord(stem(core)) === target) { hit = true; return false; }
    return true;
  }).join("");
  let next = hit ? tidy(out) : text;
  if (hit && /^[A-Z]/.test(String(text).trim())) next = next.charAt(0).toUpperCase() + next.slice(1);
  return { text: next, hit };
}

/** Cut a headline at the last separator that fits, or null when no separator gives a sensible cut. */
export function trimAtSeparator(text, max) {
  const s = String(text || "");
  if (s.length <= max) return s;
  const parts = s.split(SEPARATORS);
  let acc = "";
  for (let i = 0; i < parts.length; i += 2) {
    const next = acc + (i ? parts[i - 1] : "") + parts[i];
    if (next.length > max) break;
    acc = next;
  }
  return acc.length >= max * 0.5 ? tidy(acc) : null;
}

/** Cut a headline to a length limit at a separator or word boundary, never mid-word. */
export function trimHeadline(text, max) {
  const s = String(text || "");
  if (s.length <= max) return s;
  const parts = s.split(SEPARATORS);
  let acc = "";
  for (let i = 0; i < parts.length; i += 2) {
    const next = acc + (i ? parts[i - 1] : "") + parts[i];
    if (next.length > max) break;
    acc = next;
  }
  if (acc.length >= max * 0.5) return tidy(acc);
  const words = s.slice(0, max + 1).split(" ");
  words.pop();
  return tidy(words.join(" "));
}

function dedupeWords(text) {
  const seen = new Set();
  let hit = false;
  const out = String(text || "").split(/(\s+)/).filter((chunk) => {
    const n = normaliseWord(chunk);
    if (n.length < 3 || /^\d+$/.test(n)) return true;
    if (seen.has(n)) { hit = true; return false; }
    seen.add(n); return true;
  }).join("");
  return { text: hit ? tidy(out) : text, hit };
}

/**
 * @param {{ titleEn, titleAr, bulletsEn[], bulletsAr[] }} copy
 * @returns {{ copy, changes: Array<{ field, rule, detail }> }}
 */
export function cleanupCopy(copy, g, ctx) {
  const traits = activeTraits(g, ctx || {});
  const out = { titleEn: copy.titleEn || "", titleAr: copy.titleAr || "", bulletsEn: (copy.bulletsEn || []).slice(), bulletsAr: (copy.bulletsAr || []).slice() };
  const changes = [];
  const fields = [["titleEn", "en", true], ["titleAr", "ar", true], ["bulletsEn", "en", false], ["bulletsAr", "ar", false]];
  const apply = (field, fn) => {
    if (Array.isArray(out[field])) out[field] = out[field].map(fn).filter((x) => String(x).trim());
    else out[field] = fn(out[field]);
  };
  for (const [field, lang, headline] of fields) {
    for (const t of traits) {
      const p = t.params || {};
      if (t.type === "avoidWord" && (!p.lang || p.lang === lang)) {
        apply(field, (s) => { const r = removeWord(s, p.word); if (r.hit) changes.push({ field, rule: "avoidWord", detail: p.word }); return r.text; });
      } else if (t.type === "noExclamation") {
        apply(field, (s) => { if (/[!！]/.test(s)) { changes.push({ field, rule: "noExclamation", detail: "!" }); return tidy(s.replace(/[!！]+/g, "")); } return s; });
      } else if (t.type === "noEmoji") {
        apply(field, (s) => { if (EMOJI.test(s)) { EMOJI.lastIndex = 0; changes.push({ field, rule: "noEmoji", detail: "" }); return tidy(s.replace(EMOJI, "")); } return s; });
      } else if (t.type === "numerals" && lang === "ar") {
        apply(field, (s) => {
          if (!ARABIC.test(s)) return s;
          const next = p.style === "arabic" ? s.replace(/[0-9]/g, (d) => AR_DIGITS[d]) : s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
          if (next !== s) changes.push({ field, rule: "numerals", detail: p.style });
          return next;
        });
      } else if (t.type === "maxHeadline" && headline) {
        apply(field, (s) => {
          if (s.length <= p.chars) return s;
          // A cut at " · " or "," keeps whole phrases; cutting a run-on title at a word boundary leaves
          // half a phrase ("Men Women Long"), so that is left to a person or the AI draft.
          const n = trimAtSeparator(s, p.chars);
          if (n == null) { changes.push({ field, rule: "tooLong", detail: s.length + " / " + p.chars, applied: false }); return s; }
          changes.push({ field, rule: "maxHeadline", detail: s.length + " → " + n.length });
          return n;
        });
      }
    }
    if (headline) apply(field, (s) => { const r = dedupeWords(s); if (r.hit) changes.push({ field, rule: "repeatedWords", detail: "" }); return r.text; });
  }
  return { copy: out, changes };
}
