import { slotFacts, factInstruction, factHash } from "./fact-links.mjs";
import { approvedDirections } from "./agency-direction.mjs";
import { randomBytes } from "node:crypto";
import { createCreatorProjectStore, CREATOR_LIMITS } from "./creator-projects.mjs";
import { editCreatorImage, creatorImageDimensions } from "./creator-edit.mjs";
import { createModel, tryOn, runwayVideo } from "./creator-models.mjs";
import { StoreError, safeName } from "./store.mjs";
import { safeFetch } from "./connectors/net.mjs";
import { makeZip } from "./zip.mjs";
import { sendCreatorRelease, creatorFeedback } from "./creator-portal.mjs";
import { express } from "./brand-dna.mjs";

const problem = (message, status = 400) => { throw new StoreError(message, status); };
const projectStore = (ctx) => createCreatorProjectStore(ctx.store, { assetPrefix: `/assets/${ctx.key}/` });
const id = () => randomBytes(10).toString("hex");
const imagePattern = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

async function assetBytes(ctx, ws, url) {
  const prefix = `/assets/${ctx.key}/${ws}/`;
  if (!String(url || "").startsWith(prefix)) problem("Use a saved asset from this client workspace");
  const [batch, ...parts] = url.slice(prefix.length).split("/");
  return ctx.store.readAsset(ws, batch, parts.join("/"));
}
async function imageData(ctx, ws, url) {
  if (imagePattern.test(String(url))) return url;
  if (String(url || "").startsWith("/assets/")) {
    const ext = String(url).split(".").pop();
    if (!["png", "jpg", "jpeg", "webp"].includes(ext)) problem("Choose an image");
    return `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${(await assetBytes(ctx, ws, url)).toString("base64")}`;
  }
  if (!/^https:\/\//.test(String(url || ""))) problem("Upload a product photo first");
  const r = await safeFetch(url, { maxBytes: 20_000_000, timeoutMs: 30_000 });
  const type = (r.headers.get("content-type") || "").split(";")[0];
  if (r.status >= 400 || !/^image\/(png|jpeg|webp)$/.test(type)) problem("Could not read the product image", 422);
  return `data:${type};base64,${r.body.toString("base64")}`;
}
async function saveImage(ctx, ws, data) {
  if (typeof data !== "string" || data.length > Math.ceil(20_000_000 / 3) * 4 + 64) problem("Image must be under 20 MB", 413);
  const m = imagePattern.exec(data || "");
  if (!m) problem("Upload a PNG, JPEG or WebP image");
  const bytes = Buffer.from(m[2], "base64");
  if (!bytes.length || bytes.length > 20_000_000) problem("Image must be under 20 MB");
  if (bytes.toString("base64") !== m[2]) problem("Image contains invalid base64");
  const signature = m[1] === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : m[1] === "jpeg" ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const dimensions = signature ? creatorImageDimensions(data) : null;
  if (!dimensions || dimensions.width > 16000 || dimensions.height > 16000) problem("Use a valid PNG, JPEG or WebP image up to 16000 pixels per side");
  const batch = `creator-${id()}`, name = `image.${m[1]}`;
  await ctx.store.saveAsset(ws, batch, name, bytes);
  return { url: `/assets/${ctx.key}/${ws}/${batch}/${name}`, type: "image", ...dimensions };
}
async function context(body, ctx) {
  const ws = String(body.ws || "");
  await ctx.store.getGenome(ws);
  return { ws, ps: projectStore(ctx) };
}
function selected(project, slotId, language) {
  const slot = project.slots.find((x) => x.id === slotId);
  if (!slot) problem("Unknown project slot", 404);
  language = language === "both" ? "bilingual" : language || slot.languages[0];
  if (!slot.languages.includes(language)) problem("Choose a language belonging to this slot");
  const revision = slot.revisions.find((x) => x.id === slot.selected[language]);
  return { slot, revision, language };
}
function roomForRevision(project, slot) {
  if (!slot && project.slots.length >= CREATOR_LIMITS.slots) problem("Slot limit reached", 413);
  if ((slot?.revisions.length || 0) >= CREATOR_LIMITS.revisionsPerSlot || project.slots.reduce((n, s) => n + s.revisions.length, 0) >= CREATOR_LIMITS.revisionsPerProject) problem("Revision limit reached; start a new project", 413);
}
function brandDirection(genome, project = {}, lang = "en") {
  const expression = express(genome, { channel: project.channel, category: project.category, lang });
  return JSON.stringify({ palette: expression.kit, fonts: expression.fonts, numerals: expression.numerals,
    visualRules: expression.traits.filter((t) => ["visual", "textDensity", "logo"].includes(t.type)).map((t) => t.params) }).slice(0, 1800);
}

export function creatorRoutes({ guardPlan, meter, editImage = editCreatorImage, makeModel = createModel, tryOnProduct = tryOn, makeRunway = runwayVideo }) {
  return {
    "POST /api/creator/workspace": async (body, ctx) => {
      const { ws, ps } = await context(body, ctx);
      const saved = await ctx.store.getCreator(ws);
      const projects = await Promise.all((await ps.listProjects(ws)).map(async (p) => ({ ...await ps.getProject(ws, p.id), feedback: await creatorFeedback(ctx.store, ws, p.id) })));
      return { projects, templates: await ps.listTemplates(), models: saved.models || [] };
    },
    "POST /api/creator/release/review": async (body, ctx) => {
      const { ws } = await context(body, ctx);
      return sendCreatorRelease(ctx, { ws, projectId: body.projectId, releaseId: body.releaseId });
    },
    "POST /api/creator/project": async (body, ctx) => {
      const { ws, ps } = await context(body, ctx);
      const action = body.action;
      if (action === "create") {
        const input = { ...body.input };
        if (body.image) input.product = { ...(input.product || {}), sources: [await saveImage(ctx, ws, await imageData(ctx, ws, body.image))] };
        return ps.createProject(ws, input);
      }
      const project = await ps.getProject(ws, body.projectId);
      if (action === "update") return ps.updateProject(ws, project.id, body.patch);
      if (action === "slot") return ps.addSlot(ws, project.id, body.input);
      if (action === "select") return ps.selectRevision(ws, project.id, body.slotId, { revisionId: body.revisionId });
      if (action === "review") return ps.reviewRevision(ws, project.id, body.slotId, body.revisionId, { status: body.status, note: body.note });
      if (action === "release") return ps.createRelease(ws, project.id, { name: body.name, expectedSelection: body.expectedSelection });
      if (action === "template") return ps.createTemplate(ws, { projectId: project.id, slotId: body.slotId, name: body.name });
      if (action === "apply") return ps.applyTemplate(ws, project.id, { templateId: body.templateId, slotId: body.slotId });
      problem("Unknown Creator operation");
    },
    "POST /api/creator/upload": async (body, ctx) => {
      const { ws, ps } = await context(body, ctx);
      if (body.kind === "model") {
        if (((await ctx.store.getCreator(ws)).models || []).length >= 100) problem("Model library is full (100 per client)", 413);
        const asset = await saveImage(ctx, ws, body.image);
        const model = { id: id(), name: String(body.name || "Model").slice(0, 80), asset, aiPeople: false, createdAt: new Date().toISOString() };
        await ctx.store.updateCreator(ws, (s) => { if ((s.models || []).length >= 100) problem("Model library is full (100 per client)", 413); (s.models ||= []).push(model); });
        return model;
      }
      const project = await ps.getProject(ws, body.projectId);
      if (body.kind !== "source") {
        const { slot } = selected(project, body.slotId, body.language);
        if (["video", "runway"].includes(slot.kind)) problem("Use the runway workflow for a video frame", 422);
        roomForRevision(project, slot);
      }
      const asset = await saveImage(ctx, ws, body.image);
      if (body.kind === "source") return ps.updateProject(ws, project.id, { product: { ...project.product, sources: [...project.product.sources, asset] } });
      return ps.addRevision(ws, project.id, body.slotId, { asset, language: body.language, prompt: "Uploaded by agency" });
    },
    "POST /api/creator/edit": async (body, ctx) => {
      const { ws, ps } = await context(body, ctx);
      const project = await ps.getProject(ws, body.projectId);
      const { slot, revision, language } = selected(project, body.slotId, body.language);
      if (body.expectedRevisionId !== undefined && body.expectedRevisionId !== (revision?.id || null)) problem("The selected image changed; refresh the workspace before editing", 409);
      if (["video", "runway"].includes(slot.kind)) problem("Use the runway workflow to create a video revision", 422);
      if(project.serviceScope?.role==="copy")problem("This is a catalog text service. Review and edit the catalog copy instead of generating an image.",409);
      if(slot.factState?.planStale)problem("Product data conflicts with the confirmed fact. Review its change plan first.",409);
      if(body.expectedFactFingerprint&&body.expectedFactFingerprint!==slot.factState?.fingerprint)problem("Product facts changed after this production plan. Review again.",409);
      roomForRevision(project, slot);
      if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 4000) problem("Describe the frame or edit in up to 4000 characters");
      const sourceUrl = project.product.sources[0]?.url;
      if (!sourceUrl) problem("Upload a product reference first");
      await guardPlan(ctx.store);
      const source = await imageData(ctx, ws, sourceUrl);
      // Freeze imported reference bytes once, so later frames use the same product photo.
      if (/^https:\/\//.test(sourceUrl)) {
        const frozen=await saveImage(ctx,ws,source), latest=await ps.getProject(ws,project.id);
        if(latest.product.sources[0]?.url===sourceUrl)await ps.updateProject(ws,project.id,{product:{...latest.product,sources:[frozen,...latest.product.sources.slice(1)]}});
      }
      const model = body.modelId ? (await ctx.store.getCreator(ws)).models?.find((m) => m.id === body.modelId) : null;
      if (body.modelId && !model) problem("Choose a model in this client workspace", 404);
      const genome = await ctx.store.getGenome(ws);
      const directions=await approvedDirections(ctx.store,ws,project.id),direction=directions.at(-1),styleRefs=direction?await Promise.all(direction.items.map(item=>imageData(ctx,ws,item.asset.url))):[];
      const r = await editImage({ image: revision ? await imageData(ctx, ws, revision.asset.url) : source, originalImage: source,
        mode: revision ? "edit" : "generate", prompt: `${slot.kind === "main" ? "Clean marketplace main image. Pure white background. No added text, graphics or props. " : ""}${slot.layout || ""}. ${JSON.stringify(slot.style || {})}. ${body.prompt || ""}\nVerified facts for this frame: ${factInstruction(project,slot)}. These confirmed facts override conflicting old overlay values or user instructions. Replace outdated overlay facts, but preserve authentic product print. Do not invent claims. Placement: ${project.placement || "gallery"}, ${project.channel}, UAE.`,
        approvedTexts: language === "none" || slot.kind === "main" ? [] : body.approvedTexts, language, aspect: slot.aspect, product: project.name, category: project.category,
        visual: [brandDirection(genome, project, language),direction?"Client-approved direction: "+direction.note:""].filter(Boolean).join("\n").slice(0,2000), styleRefs, modelRef: model ? await imageData(ctx, ws, model.asset.url) : undefined });
      await meter(ctx.store, "ai"); await meter(ctx.store, "renders");
      await ps.addRevision(ws, project.id, slot.id, { asset: await saveImage(ctx, ws, r.image), language, parentId: revision?.id, generationId: body.generationId, prompt: body.prompt, model: r.provider, aiPeople: Boolean(r.aiPeople), factSnapshot:slotFacts(project,slot), checks: r.checks, generationStatus: r.status, approvedTexts: language === "none" || slot.kind === "main" ? [] : body.approvedTexts });
      return { project: await ps.getProject(ws, project.id), checks: r.checks, status: r.status };
    },
    "POST /api/creator/models": async (body, ctx) => {
      const { ws, ps } = await context(body, ctx);
      if (body.action === "create") {
        if (((await ctx.store.getCreator(ws)).models || []).length >= 100) problem("Model library is full (100 per client)", 413);
        await guardPlan(ctx.store);
        const r = await makeModel({ ...body.input, visual: brandDirection(await ctx.store.getGenome(ws)), referenceImage: body.image ? await imageData(ctx, ws, body.image) : undefined });
        await meter(ctx.store, "ai"); await meter(ctx.store, "renders");
        if (!r.ok || !r.images?.length) problem("Model generation did not produce an image", 422);
        const model = { id: id(), name: String(body.input?.name || "AI model").slice(0, 80), asset: await saveImage(ctx, ws, r.images[0]), generationId: body.generationId, aiPeople: true, prompt: r.prompt, createdAt: new Date().toISOString() };
        await ctx.store.updateCreator(ws, (s) => { if ((s.models || []).length >= 100) problem("Model library is full (100 per client)", 413); (s.models ||= []).push(model); });
        return model;
      }
      const project = await ps.getProject(ws, body.projectId);
      const source = project.product.sources[0]?.url;
      if (!source) problem("Upload a product reference first");
      if (body.action === "tryon") {
        roomForRevision(project, project.slots.find((s) => s.kind === "tryon"));
        const model = (await ctx.store.getCreator(ws)).models?.find((m) => m.id === body.modelId);
        if (!model) problem("Choose a model in this client workspace", 404);
        await guardPlan(ctx.store);
        const r = await tryOnProduct({ productImage: await imageData(ctx, ws, source), modelImage: await imageData(ctx, ws, model.asset.url), product: project.name, category: project.category, visual: brandDirection(await ctx.store.getGenome(ws), project), count: 1 });
        await meter(ctx.store, "ai"); await meter(ctx.store, "renders");
        if (!r.ok || !r.images?.length) problem("Try-on failed the product check. No revision was saved.", 422);
        const slot = project.slots.find((s) => s.kind === "tryon") || await ps.addSlot(ws, project.id, { kind: "tryon", name: "Try-on", languages: ["none"], aspect: "4:5" });
        await ps.addRevision(ws, project.id, slot.id, { language: "none", asset: await saveImage(ctx, ws, r.images[0]), model: model.id, generationId: body.generationId, prompt: r.prompt, aiPeople: true, approvedTexts: [], generationStatus: "needs_review", checks: { ok: r.ok, product: r.results[0]?.productCheck, reasons: r.results[0]?.reasons || [] } });
        return ps.getProject(ws, project.id);
      }
      if (body.action === "runway") {
        const { slot, revision } = selected(project, body.slotId, body.language);
        if (slot.kind !== "tryon" || revision?.review.status !== "approved") problem("Approve the selected try-on frame before making a runway video", 409);
        roomForRevision(project, project.slots.find((s) => ["runway", "video"].includes(s.kind)));
        await guardPlan(ctx.store);
        const r = await makeRunway({ source: { kind: "tryon", approved: true, image: await imageData(ctx, ws, revision.asset.url) }, productImage: await imageData(ctx, ws, source), product: project.name, category: project.category, visual: brandDirection(await ctx.store.getGenome(ws), project), seconds: 6 });
        await meter(ctx.store, "ai"); await meter(ctx.store, "renders");
        if (!r.ok || !r.video) problem("Runway video did not pass the frame checks", 422);
        const batch = `creator-${id()}`;
        await ctx.store.saveAsset(ws, batch, "runway.mp4", r.video);
        const videoSlot = project.slots.find((s) => ["runway", "video"].includes(s.kind)) || await ps.addSlot(ws, project.id, { kind: "runway", name: "Runway video", languages: ["none"], aspect: "4:5" });
        await ps.addRevision(ws, project.id, videoSlot.id, { language: "none", parentId: undefined, asset: { type: "video", url: `/assets/${ctx.key}/${ws}/${batch}/runway.mp4`, seconds: 6 }, generationId: body.generationId, prompt: r.prompt, model: r.model, aiPeople: true, generationStatus: "needs_review", checks: { ok: true, reasons: [] } });
        return ps.getProject(ws, project.id);
      }
      problem("Unknown model operation");
    },
    "POST /api/creator/release/export": async (body, ctx) => {
      const { ws, ps } = await context(body, ctx);
      const p = await ps.getProject(ws, body.projectId);
      const release = p.releases.find((r) => r.id === body.releaseId);
      if (!release) problem("Unknown release", 404);
      if(release.slots.some(s=>s.variants.some(r=>p.slots.find(x=>x.id===s.id)?.revisions.find(x=>x.id===r.id)?.factStale)))problem("This release uses outdated product facts. Prepare updated versions before delivery.",409);
      // The release schema supplies immutable asset snapshots. Never regenerate at export time.
      const revisions = release.items || release.slots || [];
      const files = [];
      const walk = async (value, path = "") => {
        if (!value || typeof value !== "object") return;
        if (value.asset?.url) {
          const ext = value.asset.url.split(".").pop();
          files.push({ name: `${String(files.length + 1).padStart(2, "0")}-${safeName(value.language || path || "asset")}.${ext}`, data: await assetBytes(ctx, ws, value.asset.url) });
          return;
        }
        for (const [key, item] of Object.entries(value)) if (typeof item === "object") await walk(item, key);
      };
      await walk(revisions);
      if (!files.length) problem("This release has no saved assets", 422);
      files.push({ name: "manifest.json", data: JSON.stringify({ project: release.productName, sku: release.sku, release, note: "Agency-approved source assets. Placement specifications and marketplace acceptance require separate review." }, null, 2) });
      return { $file: { data: Buffer.from(makeZip(files)), type: "application/zip", name: `${safeName(release.sku)}-${release.id}.zip` } };
    }
  };
}
