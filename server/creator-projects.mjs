// Persistent Creator projects. Image/video bytes live in the asset store; this document
// contains references, append-only revision content and frozen, locally approved releases.
import { factHash, factGroup, slotFacts, ensureFactBook, decorateFacts, replaceFactPlan, freezeLegacyFacts, projectFactFields, assertCurrentRevision, inheritKnownFacts } from "./fact-links.mjs";
import { randomBytes } from "node:crypto";
import { StoreError } from "./store.mjs";
import { buildListingSet } from "./listing-sets.mjs";
import { normaliseListingFrameData } from "./listing-frame-data.mjs";

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const WS = /^[a-z0-9][a-z0-9-]{0,39}$/;
const LANGUAGES = ["en", "ar", "bilingual", "none"];
const CHANNELS = ["amazon", "noon", "salla", "zid", "shopify", "social"];
const PLACEMENTS = ["gallery", "aplus", "social"];
const KINDS = ["main", "lifestyle", "model", "tryon", "runway", "benefit", "details", "sizechart", "dimensions", "notes", "howto", "inbox", "capacity", "compatibility", "ingredients", "compare", "review", "trust", "seasonal", "video", "other"];
const LAYOUTS = ["clean", "split", "hero", "grid", "editorial", "comparison", "steps"];
const ASPECTS = ["1:1", "4:5", "3:4", "9:16", "16:9"];
export const CREATOR_LIMITS = Object.freeze({ projects: 200, slots: 20, revisionsPerSlot: 40, revisionsPerProject: 200, releases: 30, templates: 200, projectBytes: 2_000_000, stateBytes: 16_000_000 });

export const emptyCreatorState = () => ({ schemaVersion: 1, projects: [] });
export const emptyCreatorTemplateState = () => ({ schemaVersion: 1, templates: [] });
const copy = (value) => structuredClone(value);
const fail = (message, status = 400) => { throw new StoreError(message, status); };
const record = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
const uid = (prefix) => `${prefix}-${randomBytes(10).toString("hex")}`;
const now = () => new Date().toISOString();
function text(value, max, field, required = false) {
  if (value != null && typeof value !== "string") fail(`${field} must be text`);
  const out = (value || "").normalize("NFC").trim();
  if (out.length > max) fail(`${field} is too long`);
  if (required && !out) fail(`Give ${field}`);
  return out;
}
function identifier(value, field = "ID") {
  if (typeof value !== "string" || !ID.test(value)) fail(`Unknown ${field}`, 404);
  return value;
}
function choice(value, list, fallback, field) {
  if (value == null || value === "") return fallback;
  if (!list.includes(value)) fail(`Unknown ${field}`);
  return value;
}
function language(value) { return choice(value === "both" ? "bilingual" : value, LANGUAGES, "en", "language"); }
function languages(values, kind) {
  if (values == null) return kind === "main" ? ["none"] : ["en", "ar"];
  if (!Array.isArray(values) || !values.length || values.length > 4) fail("Choose the slot's languages");
  const out = [...new Set(values.map(language))];
  // A clean shared image and language-specific images are separate slots.
  if (out.includes("none") && out.length > 1) fail("A shared clean slot cannot also contain text variants");
  return out;
}
function number(value, min, max, field) {
  if (value == null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail(`Invalid ${field}`);
  return value;
}
function assertSize(value, limit, what) {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > limit) fail(`${what} is full; start a new project`, 413);
}

/** Only generic visual structure is reusable across clients. No free-text prompt,
 * product facts, photos, logos, claims, source workspace or generated output is copied. */
export function sanitiseCreatorStyle(value) {
  const input = record(value), out = {};
  for (const key of ["background", "textColor", "accent"]) {
    if (input[key] == null) continue;
    if (typeof input[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(input[key])) fail(`Invalid ${key} colour`);
    out[key] = input[key].toLowerCase();
  }
  for (const [key, values] of Object.entries({ tone: ["minimal", "premium", "playful", "natural", "bold"], fontStyle: ["sans", "serif", "display"], textDensity: ["none", "low", "medium"], productPlacement: ["center", "left", "right", "bottom"] })) {
    if (input[key] != null) out[key] = choice(input[key], values, undefined, key);
  }
  return out;
}
function structure(input) {
  input = record(input);
  const kind = choice(input.kind, KINDS, "other", "slot kind");
  return { kind, languages: languages(input.languages, kind), aspect: choice(input.aspect, ASPECTS, "4:5", "aspect ratio"), layout: choice(input.layout, LAYOUTS, kind === "main" ? "clean" : "hero", "layout"), style: sanitiseCreatorStyle(input.style) };
}
function creativeDirection(input) {
  if(input==null)return null;
  if(typeof input!=='object'||Array.isArray(input))fail("Invalid creative direction");
  if(!Array.isArray(input.frames)||!input.frames.length||input.frames.length>8)fail("Invalid frame plan");
  return {goal:choice(input.goal,["listing","campaign","single"],"listing","content goal"),look:choice(input.look,["brand","daylight","studio"],"brand","lighting direction"),category:text(input.category,40,"product category"),templateId:text(input.templateId,80,"template ID"),frames:input.frames.map(key=>text(key,60,"frame key",true))};
}
function listingSet(input) {
  if(input==null)return null;
  try { const spec=buildListingSet(input,{language:input.language}).spec;spec.templateId=text(input.templateId,80,'template ID');return spec; }
  catch(e){fail(e.message);}
}
const cleanMain = { kind: "main", languages: ["none"], aspect: "1:1", layout: "clean", style: { background: "#ffffff", textDensity: "none", productPlacement: "center" } };
const plain = (kind, overrides = {}) => ({ kind, languages: ["en", "ar"], aspect: "4:5", layout: "hero", style: { tone: "minimal", textDensity: "low", fontStyle: "sans" }, ...overrides });
const builtin = (id, name, kind, slots) => ({ id, name, kind, scope: "builtin", slots: slots.map(structure) });
const BUILTIN_TEMPLATES = [
  builtin("builtin-uae-essentials", "UAE listing essentials", "pack", [cleanMain, plain("benefit"), plain("details"), plain("lifestyle", { languages: ["none"] }), plain("dimensions")]),
  builtin("builtin-uae-fragrance", "UAE fragrance story", "pack", [cleanMain, plain("notes"), plain("benefit"), plain("details"), plain("lifestyle", { languages: ["none"] })]),
  builtin("builtin-uae-fashion", "UAE modest fashion", "pack", [cleanMain, plain("tryon", { languages: ["none"] }), plain("sizechart"), plain("details"), plain("runway", { languages: ["none"], aspect: "9:16" })]),
  builtin("builtin-uae-social", "UAE social launch", "pack", [plain("benefit", { aspect: "9:16" }), plain("lifestyle", { languages: ["none"], aspect: "9:16" }), plain("details", { aspect: "9:16" })]),
  builtin("builtin-clean-main", "Clean main image", "single", [cleanMain]),
  builtin("builtin-benefit", "One clear benefit", "single", [plain("benefit")]),
  builtin("builtin-details", "Product details", "single", [plain("details")]),
  builtin("builtin-lifestyle", "Lifestyle scene", "single", [plain("lifestyle", { languages: ["none"] })]),
  builtin("builtin-tryon", "Model try-on", "single", [plain("tryon", { languages: ["none"] })]),
  builtin("builtin-runway", "Runway video", "single", [plain("runway", { languages: ["none"], aspect: "9:16" })])
];
function newSlot(input, templateId) {
  const s = structure(input);
  let frameData;try{frameData=normaliseListingFrameData(s.kind,input.frameData);}catch(e){fail(e.message);}
  return { id: uid("slot"), ...s, name: text(input.name, 120, "slot name") || s.kind, rationale: text(input.rationale, 500, "slot rationale"), ...(frameData?{frameData}:{}), ...(templateId ? { templateId } : {}), revisions: [], selected: {} };
}
const EVIDENCE_KEYS = new Set(["ok", "reasons", "text", "items", "extra", "issues", "type", "lang", "issue", "textApproval", "readback", "overlayTexts", "productTexts", "arabicRendering", "photorealPeople", "problems", "product", "sameProduct", "shape", "logo", "errors", "stage", "message", "reference", "aspect", "requested", "actual", "matches"]);
function evidence(value, depth = 0) {
  if (depth > 6) return null;
  if (value == null || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 2000);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => evidence(item, depth + 1));
  const out = {};
  for (const [key, item] of Object.entries(record(value))) if (EVIDENCE_KEYS.has(key)) out[key] = evidence(item, depth + 1);
  return out;
}
function revisionEvidence(input, lang) {
  const supplied = input.checks ?? record(input.qa).checks;
  const checks = supplied == null ? null : evidence(record(supplied));
  assertSize(checks, 32_000, "Image check evidence");
  const qa = { status: choice(input.generationStatus ?? record(input.qa).status, ["checked", "needs_review", "not_checked"], checks ? (checks.ok === true ? "checked" : "needs_review") : "not_checked", "generation status"), checks };
  if (input.approvedTexts === undefined) return { checks, qa };
  if (!Array.isArray(input.approvedTexts) || input.approvedTexts.length > 12) fail("Use up to 12 approved text lines");
  const approvedTexts = input.approvedTexts.map((line) => {
    line = record(line);
    const lineLang = choice(line.lang, ["en", "ar"], undefined, "approved text language");
    if (!lineLang || lang === "none" || (["en", "ar"].includes(lang) && lang !== lineLang)) fail("Approved text must match this revision's language");
    return { text: text(line.text, 500, "approved text", true), lang: lineLang };
  });
  return { checks, qa, approvedTexts };
}
function ensureState(state, key) {
  if (!state || state.schemaVersion !== 1 || !Array.isArray(state[key])) fail("Creator data needs a supported schema", 409);
  return state;
}
function findProject(state, id) {
  identifier(id, "project");
  const p = state.projects.find((item) => item.id === id);
  if (!p) fail("Unknown project", 404);
  return p;
}
function findSlot(project, id) {
  identifier(id, "slot");
  const slot = project.slots.find((item) => item.id === id);
  if (!slot) fail("Unknown slot in this project", 404);
  return slot;
}
function findRevision(slot, id) {
  identifier(id, "revision");
  const revision = slot.revisions.find((item) => item.id === id);
  if (!revision) fail("Unknown revision in this slot", 404);
  return revision;
}
function projectSummary(project) {
  return { id: project.id, ws: project.ws, sku: project.sku, catalogProductId: project.catalogProductId || "", name: project.name, category: project.category, channel: project.channel, placement: project.placement, region: project.region, slots: project.slots.length, revisions: project.slots.reduce((n, s) => n + s.revisions.length, 0), releases: project.releases.length, createdAt: project.createdAt, updatedAt: project.updatedAt };
}

/** Adapter contract: getCreator(ws), updateCreator(ws, fn), getCreatorTemplates(),
 * updateCreatorTemplates(fn). Updates must serialize read/mutate/write, persist only
 * when fn succeeds, and return its result. Account scoping is supplied by the adapter. */
function previewFact(state,input){
 const group=input.productId,projects=state.projects.filter(p=>factGroup(p)===group);if(!projects.length)fail('Choose a product with a Creator project',404);
 if(typeof input.key!=='string'||!projects.some(p=>slotFacts(p,p.slots.find(s=>s.kind===input.key.split('.')[0])||{frameData:null,kind:'other'}).some(e=>e.key===input.key)||projectFactFields(p).some(f=>f.key===input.key)))fail('Choose a tracked product fact');
 const before=state.factBook[group]?.[input.key],next=copy(state),targets=[],materials=[];let canonical;
 for(const p of next.projects.filter(p=>factGroup(p)===group)){
  if(!p.slots.some(s=>s.kind===input.key.split('.')[0]||input.key==='shared.facts'))continue;
  freezeLegacyFacts(p);if(!replaceFactPlan(p,input.key,input.value))continue;
  canonical=p.slots.flatMap(s=>slotFacts(p,s)).find(e=>e.key===input.key)||canonical;
 }
 if(!canonical)fail('Choose a tracked product fact');

 next.factBook[group][input.key]={...canonical,version:(before?.version||0)+1};
 for(const raw of next.projects.filter(p=>factGroup(p)===group)){
  const p=decorateFacts(next,raw),old=projects.find(x=>x.id===p.id);
  for(const s of p.slots)for(const lang of s.languages){const r=s.revisions.find(r=>r.id===s.selected[lang]);
   const planned=slotFacts(p,s).some(e=>e.key===input.key),affected=r?.factStale||planned&&!r;
   if(!affected)continue;const manual=['model','tryon','video','runway'].includes(s.kind);
   const m={projectId:p.id,projectName:p.name,slotId:s.id,name:s.name,language:lang,revisionId:r?.id||null,asset:r?.asset||null,agencyApproved:r?.review.status==='approved',legacyPossible:!!r&&!old.slots.find(x=>x.id===s.id).revisions.find(v=>v.id===r.id)?.factSnapshot,manual};materials.push(m);
   if(!manual)targets.push({projectId:p.id,slotId:s.id,language:lang});
  }
 }
 if(targets.length>500)fail('Split this change into a smaller product group',413);
 return {productId:group,key:input.key,from:copy(before?.value??null),to:copy(canonical.value),label:canonical.label,unit:canonical.unit,materials,targets,credits:targets.length*4,publication:'not_sent',fingerprint:factHash({book:state.factBook[group],projects:projects.map(p=>({id:p.id,updatedAt:p.updatedAt,slots:p.slots})),key:input.key,value:input.value})};
}
export function createCreatorProjectStore(store, { assetPrefix } = {}) {
  function asset(value, ws) {
    const input = typeof value === "string" ? { url: value } : record(value);
    const url = text(input.url, 2048, "asset URL", true);
    if (url.startsWith("/assets/")) {
      if (url.includes("%") || url.includes("\\") || url.split("/").some((p) => p === "." || p === "..") || /[?#\s]/.test(url)) fail("Invalid stored asset URL");
      const parts = url.split("/");
      if (parts.length < 6 || parts[3] !== ws || parts.slice(2).some((p) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(p))) fail("Use an asset from this client workspace");
      if (assetPrefix && !url.startsWith(`${assetPrefix.replace(/\/$/, "")}/${ws}/`)) fail("Use an asset from this account");
    } else {
      let parsed;
      try { parsed = new URL(url); } catch { fail("Save the image/video to assets before adding a revision"); }
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) fail("Asset URLs must use HTTPS");
    }
    const out = { url, type: choice(input.type, ["image", "video"], "image", "asset type") };
    for (const [key, min, max] of [["width", 1, 16000], ["height", 1, 16000], ["seconds", 0.1, 300]]) {
      const v = number(input[key], min, max, key);
      if (v !== undefined) out[key] = v;
    }
    return out;
  }
  function product(value, ws) {
    const input = record(value), facts = input.facts || [], sources = input.sources || [];
    if (!Array.isArray(facts) || facts.length > 50) fail("Use up to 50 confirmed product facts");
    if (!Array.isArray(sources) || sources.length > 12) fail("Use up to 12 source assets");
    return { facts: facts.map((f) => text(f, 500, "product fact", true)), sources: sources.map((a) => asset(a, ws)) };
  }
  async function read(ws) {
    if (!WS.test(ws)) fail("Unknown workspace", 404);
    await store.getGenome(ws);
    const state=ensureState(await store.getCreator(ws), "projects");ensureFactBook(state);return state;
  }
  async function change(ws, fn) {
    if (!WS.test(ws)) fail("Unknown workspace", 404);
    await store.getGenome(ws);
    return store.updateCreator(ws, async (state) => {
      ensureState(state, "projects");ensureFactBook(state);
      const out = await fn(state);
      assertSize(state, CREATOR_LIMITS.stateBytes, "Creator workspace");
      return copy(out);
    });
  }
  async function changeProject(ws, projectId, fn) {
    return change(ws, async (state) => {
      const p = findProject(state, projectId);
      const out = await fn(p, state);
      p.updatedAt = now();
      assertSize(p, CREATOR_LIMITS.projectBytes, "Creator project");
      return out === undefined ? p : out;
    });
  }
  const api = {
    async listProjects(ws) { return copy((await read(ws)).projects.map(projectSummary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); },
    async getProject(ws, projectId) { const state=await read(ws);return decorateFacts(state,findProject(state,projectId)); },
    async createProject(ws, input = {}) {
      input = record(input);
      return change(ws, (state) => {
        if (state.projects.length >= CREATOR_LIMITS.projects) fail("Creator project limit reached", 413);
        const sku = text(input.sku, 120, "product SKU");
        if (input.slots != null && (!Array.isArray(input.slots) || input.slots.length > CREATOR_LIMITS.slots)) fail("Use up to 20 slots");
        const at = now();
        const p = { id: uid("project"), ws, sku, catalogProductId: text(input.catalogProductId, 64, "catalog product ID"), brief: text(input.brief, 4000, "creative brief"), preset: text(input.preset, 40, "creative preset"), creativeDirection:creativeDirection(input.creativeDirection), listingSet:listingSet(input.listingSet), name: text(input.name, 200, "a product name", true), category: text(input.category, 80, "category"), channel: choice(input.channel, CHANNELS, "amazon", "channel"), placement: choice(input.placement, PLACEMENTS, "gallery", "placement"), region: "uae", product: product(input.product, ws), slots: (input.slots || []).map((s) => newSlot(record(s))), releases: [], createdAt: at, updatedAt: at };
        assertSize(p, CREATOR_LIMITS.projectBytes, "Creator project");
        if(input.serviceScope)p.serviceScope={offerId:text(input.serviceScope.offerId,80,"offer ID",true),lineId:text(input.serviceScope.lineId,80,"scope ID",true),role:text(input.serviceScope.role,40,"service role")};
        inheritKnownFacts(state,p);state.projects.push(p);ensureFactBook(state);
        return decorateFacts(state,p);
      });
    },
    async updateProject(ws, projectId, patch = {}) {
      patch = record(patch);
      return changeProject(ws, projectId, (p, state) => {
        if (patch.sku !== undefined) {
          const sku = text(patch.sku, 120, "product SKU");
          p.sku = sku;
        }
        if (patch.catalogProductId !== undefined) p.catalogProductId = text(patch.catalogProductId, 64, "catalog product ID");
        if (patch.brief !== undefined) p.brief = text(patch.brief, 4000, "creative brief");
        if (patch.preset !== undefined) p.preset = text(patch.preset, 40, "creative preset");
        if (patch.name !== undefined) p.name = text(patch.name, 200, "a product name", true);
        if (patch.category !== undefined) p.category = text(patch.category, 80, "category");
        if (patch.channel !== undefined) p.channel = choice(patch.channel, CHANNELS, p.channel, "channel");
        if (patch.placement !== undefined) p.placement = choice(patch.placement, PLACEMENTS, p.placement || "gallery", "placement");
        if (patch.product !== undefined) p.product = product({ ...p.product, ...record(patch.product) }, ws);
      });
    },
    async addSlot(ws, projectId, input = {}) {
      return changeProject(ws, projectId, (p) => {
        if (p.slots.length >= CREATOR_LIMITS.slots) fail("Slot limit reached", 413);
        const slot = newSlot(record(input));
        p.slots.push(slot);
        return slot;
      });
    },
    async addRevision(ws, projectId, slotId, input = {}) {
      input = record(input);
      return changeProject(ws, projectId, (p) => {
        const slot = findSlot(p, slotId), lang = language(input.language);
        if (!slot.languages.includes(lang)) fail("This language does not belong to the slot");
        if (["video", "runway"].includes(slot.kind) !== (input.asset?.type === "video")) fail("The revision media type must match this slot");
        if (slot.revisions.length >= CREATOR_LIMITS.revisionsPerSlot || p.slots.reduce((n, s) => n + s.revisions.length, 0) >= CREATOR_LIMITS.revisionsPerProject) fail("Revision limit reached; start a new project", 413);
        const parentId = input.parentId || slot.selected[lang] || null;
        if (parentId) findRevision(slot, parentId);
        const at = now();
        const revision = { id: uid("revision"), language: lang, parentId, asset: asset(input.asset, ws), generationId: text(input.generationId, 100, "generation request"), prompt: text(input.prompt, 6000, "AI instruction"), model: text(input.model, 120, "model"), aiPeople: Boolean(input.aiPeople), ...revisionEvidence(input, lang), structure: structure(slot), factSnapshot: copy(input.factSnapshot||slotFacts(p,slot)), productSnapshot: { sku: p.sku, name: p.name, category: p.category, facts: copy(p.product.facts) }, review: { status: "unreviewed", note: "", at: null }, createdAt: at };
        slot.revisions.push(revision);
        if (input.select !== false) slot.selected[lang] = revision.id;
        return revision;
      });
    },
    async selectRevision(ws, projectId, slotId, input = {}) {
      return changeProject(ws, projectId, (p) => {
        const slot = findSlot(p, slotId), revision = findRevision(slot, input.revisionId);
        if (!slot.languages.includes(revision.language)) fail("This revision language is no longer part of the slot", 409);
        slot.selected[revision.language] = revision.id;
        return slot;
      });
    },
    async reviewRevision(ws, projectId, slotId, revisionId, input = {}) {
      return changeProject(ws, projectId, (p,state) => {
        const slot = findSlot(p, slotId), revision = findRevision(slot, revisionId);
        if (slot.selected[revision.language] !== revisionId) fail("Select this exact revision before reviewing it", 409);
        const status = choice(input.status, ["approved", "changes_requested"], undefined, "review status");
        if (!status) fail("Choose a review status");
        if(status==="approved")assertCurrentRevision(p,slot,decorateFacts(state,p).slots.find(s=>s.id===slotId).revisions.find(r=>r.id===revisionId));
        revision.review = { status, note: text(input.note, 1000, "review note"), at: now() };
        return revision;
      });
    },
    async createRelease(ws, projectId, input = {}) {
      return changeProject(ws, projectId, (p,state) => {
        if (!p.slots.length) fail("Add output slots before creating a release", 409);
        if (p.releases.length >= CREATOR_LIMITS.releases) fail("Release limit reached", 413);
        if (input.expectedSelection != null) {
          const expected = record(input.expectedSelection);
          if (Object.keys(expected).length !== p.slots.length || p.slots.some((slot) => {
            const selected = record(expected[slot.id]);
            return Object.keys(selected).length !== slot.languages.length || slot.languages.some((lang) => selected[lang] !== slot.selected[lang]);
          })) fail("The selected revisions changed; review the project before releasing", 409);
        }
        const slots = p.slots.map((slot) => ({ id: slot.id, name: slot.name, ...structure(slot), variants: slot.languages.map((lang) => {
          const selected = slot.selected[lang];
          if (!selected) fail(`Select the ${lang} revision for ${slot.name}`, 409);
          const r = findRevision(slot, selected);
          assertCurrentRevision(p,slot,decorateFacts(state,p).slots.find(s=>s.id===slot.id).revisions.find(v=>v.id===r.id));
          if (r.language !== lang || r.review.status !== "approved") fail(`Approve the selected ${lang} revision for ${slot.name}`, 409);
          return copy(r);
        }) }));
        const release = { id: uid("release"), name: text(input.name, 120, "release name") || `Release ${p.releases.length + 1}`, status: "approved", approvalScope: "agency", projectId: p.id, ws, sku: p.sku, productName: p.name, channel: p.channel, placement: p.placement || "gallery", region: "uae", product: copy(p.product), slots, createdAt: now() };
        p.releases.push(release);
        return release;
      });
    },
    async productFacts(ws, group) {
      const state=await read(ws),projects=state.projects.filter(p=>factGroup(p)===group);if(!projects.length)fail("Choose a product with a Creator project",404);
      return {productId:group,facts:Object.values(state.factBook[group]||{}),projects:projects.map(p=>decorateFacts(state,p)),fields:projects.flatMap(projectFactFields),history:(state.factChanges||[]).filter(e=>e.productId===group).slice(-30).reverse()};
    },
    async previewFactChange(ws,input){return previewFact(await read(ws),input);},
    async changeFact(ws,input){
      if(input.confirm!==true)fail("Confirm the new product fact and its affected materials");
      if(!/^[A-Za-z0-9_-]{8,100}$/.test(input.requestId||''))fail("A unique fact change ID is required");
      return change(ws,state=>{
        const previous=(state.factChanges||[]).find(e=>e.id===input.requestId);
        const requestHash=factHash({productId:input.productId,key:input.key,value:input.value,reason:input.reason||''});
        if(previous){if(previous.requestHash!==requestHash)fail("This change ID was already used",409);return previous;}
        const plan=previewFact(state,input);if(plan.fingerprint!==input.fingerprint)fail("Product facts or versions changed. Review the impact again.",409);
        if((state.factChanges||[]).length>=200)fail("Fact change history is full",413);
        const event={id:input.requestId,productId:input.productId,key:input.key,from:plan.from,to:plan.to,reason:text(input.reason,500,'change reason',true),at:now(),requestHash,source:input.taskId?{type:'client_answer',taskId:text(input.taskId,80,'information request ID')}:{type:'agency_confirmation'},targets:plan.targets,credits:plan.credits,publication:'not_sent'};
        for(const p of state.projects.filter(p=>factGroup(p)===input.productId)){
          if(!p.slots.some(s=>s.kind===input.key.split('.')[0]||input.key==='shared.facts'))continue;
          freezeLegacyFacts(p);replaceFactPlan(p,input.key,input.value);p.updatedAt=event.at;assertSize(p,CREATOR_LIMITS.projectBytes,'Creator project');
        }
        state.factBook[input.productId][input.key]={key:input.key,value:copy(plan.to),label:plan.label,unit:plan.unit,version:(state.factBook[input.productId][input.key]?.version||0)+1,at:event.at};
        (state.factChanges||=[]).push(event);return event;
      });
    },
    async listTemplates() { return copy([...BUILTIN_TEMPLATES, ...ensureState(await store.getCreatorTemplates(), "templates").templates]); },
    async createTemplate(ws, input = {}) {
      input = record(input);
      const project = await api.getProject(ws, input.projectId);
      const slots = input.slotId ? [findSlot(project, input.slotId)] : project.slots;
      if (!slots.length) fail("Add slots before saving a template");
      const template = { id: uid("template"), name: text(input.name, 120, "a template name", true), kind: input.slotId ? "single" : "pack", scope: "agency", slots: slots.map(structure), createdAt: now() };
      return store.updateCreatorTemplates((state) => {
        ensureState(state, "templates");
        if (state.templates.length >= CREATOR_LIMITS.templates) fail("Agency template limit reached", 413);
        state.templates.push(template);
        return copy(template);
      });
    },
    async applyTemplate(ws, projectId, input = {}) {
      const templateId = identifier(input.templateId, "template");
      const template = (await api.listTemplates()).find((t) => t.id === templateId);
      if (!template) fail("Unknown agency template", 404);
      return changeProject(ws, projectId, (p) => {
        if (input.slotId) {
          if (template.kind !== "single") fail("Apply a single-image template to one slot");
          const slot = findSlot(p, input.slotId), next = structure(template.slots[0]);
          if (slot.revisions.length && ["video", "runway"].includes(slot.kind) !== ["video", "runway"].includes(next.kind)) fail("Use a new slot when changing between an image and video template", 409);
          // Existing variants and approvals remain associated with their original
          // revision structure. A template configures subsequent AI generations.
          if (slot.revisions.length && (next.languages.some((lang) => !slot.languages.includes(lang)) || slot.languages.some((lang) => !next.languages.includes(lang)))) fail("Use a new slot for a template with different languages", 409);
          Object.assign(slot, next, { templateId });
        } else {
          if (p.slots.length + template.slots.length > CREATOR_LIMITS.slots) fail("This template exceeds the project's slot limit", 413);
          p.slots.push(...template.slots.map((s) => newSlot(s, templateId)));
        }
      });
    }
  };
  return api;
}
