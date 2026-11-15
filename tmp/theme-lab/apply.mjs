// Applies a theme-lab palette to the source files, with the same color mapping the live preview uses.
// CSS (style blocks and .css files): colors and font names are rewritten.
// Script and markup: colors are rewritten too, and every change is listed for review.
// Usage: node tmp/theme-lab/apply.mjs electric [--dry]
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const [themeKey = "electric", flag] = process.argv.slice(2);
const DRY = flag === "--dry";

// Load the engine from lab.js without a browser: run it with a stub window/document and read __themeLab.
const sandbox = { window: {}, document: { readyState: "loading", addEventListener() {}, createElement: () => ({ style: {}, attachShadow: () => ({ innerHTML: "", getElementById: () => ({}), addEventListener() {} }) }), documentElement: {} }, localStorage: { getItem: () => null, setItem() {} }, MutationObserver: class { observe() {} }, requestAnimationFrame() {}, setTimeout, clearTimeout, console };
vm.runInNewContext(readFileSync(new URL("./lab.js", import.meta.url), "utf8"), sandbox);
const lab = sandbox.window.__themeLab;
const theme = lab.THEMES[themeKey];
lab.prime(themeKey);

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
// Outside CSS, colors are mostly data (product swatches, marketplace badges, brand presets, model hair):
// only the Basira logo and the director guide's fallback swatches belong to the interface.
const SCRIPT_ALLOW = new Set(["#52c4ae", "#04120f", "#d8f49b", "#224d39", "#f2eee5"]);
const recolorText = (text, log, where) => text.replace(COLOR_RE, (m, off) => {
  if (m[0] === "#" && /[&\w]/.test(text[off - 1] || "")) return m; // entities, words
  if (log && !SCRIPT_ALLOW.has(m.toLowerCase())) return m;
  const out = lab.recolor(m);
  if (out !== m && log) log.push(`${where}: ${m} -> ${out}  …${text.slice(Math.max(0, off - 50), off).replace(/\s+/g, " ")}⟦${m}⟧${text.slice(off + m.length, off + m.length + 30).replace(/\s+/g, " ")}…`);
  return out;
});
const f = theme.fonts;
const refontCss = (css) => css
  .replace(/["']?Bricolage Grotesque["']?/g, `"${f.display}"`)
  .replace(/["']?Reem Kufi["']?/g, `"${f.ar}"`)
  .replace(/(font(?:-family)?\s*:[^;{}]*?|--font-[a-z-]+\s*:[^;{}]*?)["']?Readex Pro["']?/g, `$1"${f.body}","Readex Pro"`);

const stats = {}; const review = [];
function processCss(css, file) {
  const before = css;
  css = recolorText(css, null, file);
  if (!file.includes("portal")) css = refontCss(css);
  stats[file] = (stats[file] || 0) + diffCount(before, css);
  return css;
}
function diffCount(a, b) { let n = 0; const A = a.match(COLOR_RE) || [], B = b.match(COLOR_RE) || []; A.forEach((x, i) => { if (x !== B[i]) n++; }); return n; }

function processHtml(file) {
  const src = readFileSync(file, "utf8");
  const parts = src.split(/(<style[^>]*>[\s\S]*?<\/style>)/);
  const out = parts.map((p, i) => {
    if (i % 2) return processCss(p, file);
    return recolorText(p, review, file + " (script/markup)");
  }).join("");
  return fixFontLinks(out, file);
}
function fixFontLinks(html, file) {
  if (file.includes("portal")) return html;
  return html.replace(/https:\/\/fonts\.googleapis\.com\/css2\?[^"']*/g, (url) => {
    let u = url.replace(/family=Bricolage\+Grotesque[^&]*/, "family=Unbounded:wght@400..700").replace(/family=Reem\+Kufi[^&]*/, "family=Alexandria:wght@400..700");
    if (!u.includes("Alexandria")) u = u.replace("&display=swap", "&family=Alexandria:wght@400..700&display=swap");
    if (!u.includes("Onest")) u = u.replace("&display=swap", "&family=Onest:wght@300..700&display=swap");
    return u;
  });
}

const files = process.argv.includes("--files") ? [] : [
  "src/landing.html", "src/app.html", "src/portal.html",
  "src/agency-operations.css", "src/catalog-repairs.css", "src/creator-workspace.css", "src/home-workspace.css", "src/listing-patterns.css", "src/listing-sequences.css", "src/listing-sets.css", "src/model-studio.css", "src/portal-operations.css", "src/workspace-design.css",
  "src/creator-workspace.js", "src/director-guide.js", "src/model-studio.js",
];
for (const file of files) {
  const src = readFileSync(file, "utf8");
  let out;
  if (file.endsWith(".html")) out = processHtml(file);
  else if (file.endsWith(".css")) out = processCss(src, file);
  else out = recolorText(src, review, file);
  if (!DRY && out !== src) writeFileSync(file, out);
}
console.log("CSS colors changed per file:", stats);
console.log(`\n${review.length} changes in scripts/markup to review:`);
for (const r of review) console.log(" ", r);
