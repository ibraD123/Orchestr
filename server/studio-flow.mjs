import { createCreatorProjectStore } from "./creator-projects.mjs";
import { creatorFeedback } from "./creator-portal.mjs";
import { creditStatus, GENERATION_RATES } from "./generation-budget.mjs";
import { newAccount } from "./billing.mjs";
import { creatorEditConfigured } from "./creator-edit.mjs";
import { buildCreativeDirection } from "./creative-direction.mjs";
import { planSlots } from "./content-plan.mjs";
import { buildListingSet } from "./listing-sets.mjs";
import { StoreError } from "./store.mjs";
const fail = (m, s = 400) => { throw new StoreError(m, s); };
const clean = (v, max = 4000) => { if (v != null && (typeof v !== "string" || v.length > max)) fail("Invalid studio text"); return (v || "").trim(); };
export const STUDIO_PRESETS = ["free", "noon-main", "amazon-main", "noon-gallery", "amazon-gallery", "social"];
export function studioSlots(task, language, preset) {
  const languages = language === "both" ? ["en", "ar"] : [language];
  const slot = (kind, name, langs = languages) => ({ kind, name, languages: langs, layout: kind === "main" ? "clean" : "hero", aspect: kind === "main" ? "1:1" : preset === "social" ? "9:16" : "4:5", style: kind === "main" ? { background: "#ffffff", textDensity: "none" } : { tone: "minimal" } });
  if (task === "main" || preset.endsWith("-main")) return [slot("main", "Main image", ["none"])];
  if (task === "set") return [slot("main", "Main image", ["none"]), slot("benefit", "Benefits"), slot("details", "Details"), slot("lifestyle", "In context", ["none"])];
  if (task === "tryon") return [slot("tryon", "Try-on", ["none"])];
  if (task === "video") return [slot("tryon", "Try-on source", ["none"]), slot("runway", "Runway video", ["none"])];
  return [slot(task === "lifestyle" ? "lifestyle" : "other", task === "lifestyle" ? "Lifestyle" : "Creative image")];
}
export function studioRoutes({ createProject }) {
  return { "POST /api/creator/studio": async (body, ctx) => {
    const ws = clean(body.ws, 40); await ctx.store.getGenome(ws);
    const ps = createCreatorProjectStore(ctx.store, { assetPrefix: `/assets/${ctx.key}/` });
    const catalog = await ctx.store.getCatalog(ws);
    const item = body.catalogProductId ? catalog.products.find((p) => p.id === body.catalogProductId) || fail("Choose a product from this client's catalog", 404) : null;
    if (body.action === "open") {
      if (!item) fail("Choose an imported product from this client",404);
      const matches=(await ps.listProjects(ws)).filter(p=>p.catalogProductId===item.id);
      if(matches.length>1&&!body.projectId&&!body.forceNew)return {choices:matches};
      let project=body.projectId?await ps.getProject(ws,body.projectId):!body.forceNew&&matches.length?await ps.getProject(ws,matches[0].id):null;
      if(project&&project.catalogProductId!==item.id)fail("This project belongs to another product",409);
      if(!project)project=await createProject({ws,action:"create",input:{name:item.name[0],sku:item.sku,catalogProductId:item.id,category:item.category,channel:item.ch[0],placement:"gallery",preset:"free",brief:clean(body.issueDescription,1000)||"Create a faithful product content set using confirmed facts only.",product:{facts:[],sources:[item.image,...item.listing.images.map(i=>i.src)].filter((v,i,a)=>v&&a.indexOf(v)===i).slice(0,10).map(url=>({type:"image",url}))},slots:studioSlots("set","both","free")}},ctx);
      if(!project.brief&&body.issueDescription)project=await ps.updateProject(ws,project.id,{brief:clean(body.issueDescription,1000)});
      const kind=({noSizeChart:"sizechart",tooFewImages:"lifestyle",oneImage:"lifestyle",onePhoto:"lifestyle",mainRule:"main",runsSmall:"sizechart",arabicBroken:"benefit",noArabicTitle:"benefit",lowRes:"main",mainImageRules:"main"})[body.issue]||"benefit";
      let slot=project.slots.find(s=>s.kind===kind);
      if(!slot&&body.issue){slot=await ps.addSlot(ws,project.id,{kind,name:kind,rationale:clean(body.issueDescription,1000),languages:kind==="main"?["none"]:["en","ar"],aspect:kind==="main"?"1:1":"4:5"});project=await ps.getProject(ws,project.id);}
      return {project,slotId:(slot||project.slots[0]).id,issue:clean(body.issue,80)};
    }
    if (body.action === "start" || body.action === "preview") {
      const task = body.task || "image", language = body.language || "en", preset = body.preset || "free";
      if (!["image", "main", "set", "lifestyle", "tryon", "video"].includes(task) || !(body.listingSet?["en","ar","both","bilingual"]:["en","ar","both"]).includes(language) || !STUDIO_PRESETS.includes(preset)) fail("Unknown creative direction");
      const brief = clean(body.brief) || "Create a faithful product composition from the original reference. Preserve the product, variant, label and logo. Add no unverified claims.", name = clean(body.name, 200) || item?.name[0] || (body.direction ? "Product story" : "Untitled creative project");
      const templates = await ps.listTemplates(), template = body.templateId ? templates.find((t) => t.id === body.templateId) || fail("Unknown template", 404) : null;
      let guided=null;
      if(body.direction&&body.listingSet)fail('Choose one creation workflow');
      if(body.listingSet){try{guided=buildListingSet(body.listingSet,{template,language,note:body.brief||''});}catch(e){fail(e.message);}}
      else if(body.direction){try{guided=buildCreativeDirection(body.direction,{template,language,note:body.brief||''});}catch(e){fail(e.message);}}
      if(body.action==='preview'){
        if(!guided)fail('Choose a guided story first');
        const budget=creditStatus(await ctx.store.getAccount(newAccount)),credits=guided.imageVariants*GENERATION_RATES.image,available=creatorEditConfigured();
        return {direction:guided.direction,listingSet:guided.spec||null,slots:guided.slots,frames:guided.slots.length,imageVariants:guided.imageVariants,manualStages:guided.manualStages,credits,budget,available,canStart:available&&credits>0&&budget.left>=credits};
      }
      return createProject({ ws, action: "create", image: body.image || item?.image || undefined, input: {
        name, sku: item?.sku || "", catalogProductId: item?.id || "", category: guided?.spec?.category || item?.category || guided?.direction.category || "", brief:guided?.brief||brief, preset, creativeDirection:guided?.direction, listingSet:guided?.spec,
        channel: guided?.spec?.destination || (preset.startsWith("amazon") ? "amazon" : preset.startsWith("noon") ? "noon" : item?.ch[0] || "social"), placement: preset === "social" ? "social" : "gallery",
        product: { facts: guided?.facts||[], sources: [] }, slots: guided ? guided.slots : template ? planSlots(template, language) : studioSlots(task, language, preset)
      } }, ctx);
    }
    const project = await ps.getProject(ws, body.projectId);
    if (body.action === "bind") {
      if (!item) fail("Choose the catalog product to link");
      return ps.updateProject(ws, project.id, { catalogProductId: item.id, sku: item.sku, category: item.category });
    }
    if (body.action !== "prepare") fail("Unknown studio action");
    // Preparation is read-only: it neither changes approved images nor publishes them.
    const linked = project.catalogProductId ? catalog.products.find((p) => p.id === project.catalogProductId) : null;
    const channel = body.channel || project.channel;
    if (!["amazon", "noon", "salla", "zid", "social"].includes(channel)) fail("Unknown destination");
    const feedback = await creatorFeedback(ctx.store, ws, project.id);
    const frames = project.slots.flatMap((s) => s.languages.map((lang) => {
      const revision = s.revisions.find((r) => r.id === s.selected[lang]);
      return { slotId: s.id, name: s.name, language: lang, revisionId: revision?.id || null, asset: revision?.asset || null, agencyApproved: revision?.review.status === "approved", clientApproved: feedback.revisions[revision?.id]?.status === "approved" };
    }));
    const checks = [
      { key: "product", ok: channel === "social" || Boolean(linked), message: "Link a catalog product for marketplace placement" },
      { key: "title", ok: channel === "social" || Boolean(linked?.listing.titleEn || linked?.listing.titleAr), message: "Catalog title is required" },
      { key: "frames", ok: frames.length > 0 && frames.every((f) => f.agencyApproved), message: "Create and agency-approve each selected frame" },
      { key: "client", ok: frames.length > 0 && frames.every((f) => f.clientApproved), message: "Client approval is required for final delivery" },
      { key: "channel", ok: !linked || channel === "social" || linked.ch.includes(channel), message: "The linked catalog product belongs to another destination" }
    ];
    const release = project.releases.at(-1);
    const currentRelease = Boolean(release && frames.every((f) => release.slots.some((s) => s.variants.some((r) => r.id === f.revisionId))));
    checks.push({ key: "release", ok: currentRelease, message: "Create a release of the current selected versions" });
    return { projectId: project.id, channel, sku: linked?.sku || "", productName: linked?.name[0] || "", checks, frames, ready: checks.every((c) => c.ok), releaseId: currentRelease ? release.id : null,
      publication: { status: "not_sent", available: false, reason: "This studio step prepares approved source files. Marketplace publication and acceptance are separate operations." } };
  } };
}
