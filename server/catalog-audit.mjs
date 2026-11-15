import { createHash } from 'node:crypto';
import { StoreError } from './store.mjs';
import { baselineRepairs, repairInstruction } from './audit-repairs.mjs';
import { readAuditImages, loadAuditImage, AuditReading } from './audit-vision.mjs';
import { llmConfigured } from './llm.mjs';
import { buildListingSet, LISTING_CATEGORIES } from './listing-sets.mjs';
import { createCreatorProjectStore } from './creator-projects.mjs';
import { normaliseCatalogProduct } from './catalog-workflow.mjs';
import { creditStatus, GENERATION_RATES } from './generation-budget.mjs';
import { newAccount } from './billing.mjs';
import { creatorEditConfigured } from './creator-edit.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const auditSource=p=>hash({listing:p.listing,image:p.image});
const fail=(m,s=400)=>{throw new StoreError(m,s);};
export function catalogAuditRoutes({createProject,guardPlan=async()=>{},meter=async()=>{},read=readAuditImages,load=loadAuditImage,configured=llmConfigured}={}){
 const running=new Set();
 const report=p=>({source:auditSource(p),checkedAt:p.repairAudit?.checkedAt||null,stale:!!p.repairAudit&&p.repairAudit.source!==auditSource(p),coverage:p.repairAudit?.source===auditSource(p)?p.repairAudit.coverage:null,findings:[...baselineRepairs(p).filter(f=>f.basis!=='category'||p.repairAudit?.source!==auditSource(p)||!p.repairAudit?.coveredRoles?.includes(f.role)),...(p.repairAudit?.source===auditSource(p)?p.repairAudit.findings:[])],handoffs:p.repairAudit?.handoffs||{},aiAvailable:configured()});
 return {'POST /api/catalog/audit':async(body,ctx)=>{
  const ws=String(body.ws||'');await ctx.store.getGenome(ws);const cat=await ctx.store.getCatalog(ws),p=cat.products.find(p=>p.id===body.productId)||fail('Choose a product from this client catalog',404),source=auditSource(p),action=body.action||'read';
  if(action==='read')return report(p);
  const lock=ctx.key+':'+ws+':'+p.id;if(running.has(lock))fail('This product audit is already being processed',409);running.add(lock);
  try{
   if(action==='analyze'){
    if(!configured())fail('AI gallery audit is not configured',503);await guardPlan(ctx.store);
    const urls=[...(p.listing.images||[]).map(i=>i.src)];if(!urls.length&&p.image)urls.push(p.image);const selected=urls.slice(0,6);
    const results=await Promise.all(selected.map(async(url,index)=>{try{return {index,data:await load(url,{...ctx,ws})};}catch{return {index,error:true};}})),images=results.filter(i=>i.data);
    const raw=AuditReading.parse(await read({listing:p.listing,images}));await meter(ctx.store,'ai');
    const allowed=new Set(images.map(i=>i.index));const findings=raw.findings.filter(f=>(f.imageIndex==null||allowed.has(f.imageIndex))&&(images.length||f.role==='copy'||f.evidence.some(e=>e.field!=='image'))).map(f=>{
     const evidence=f.evidence.filter(e=>e.field==='image'?f.imageIndex!==null&&allowed.has(f.imageIndex):JSON.stringify(p.listing[e.field]||'').includes(e.quote));
     return {...f,id:'vision-'+hash({title:f.title.en,image:f.imageIndex,role:f.role}).slice(0,16),type:f.type==='error'&&!evidence.length?'improvement':f.type,evidence,basis:'ai',origin:'vision'};
    });
    const updated=await ctx.store.updateCatalog(ws,c=>{const item=c.products.find(x=>x.id===p.id)||fail('Product was removed',409);if(auditSource(item)!==source)fail('Catalog changed during audit. Run it again.',409);item.repairAudit={source,checkedAt:new Date().toISOString(),coverage:{total:urls.length,loaded:images.map(i=>i.index),failed:results.filter(i=>i.error).map(i=>i.index),limited:urls.length>6},findings,coveredRoles:images.length?raw.coveredRoles:[],handoffs:item.repairAudit?.handoffs||{}};c.version++;});return report(updated.products.find(x=>x.id===p.id));
   }
   const current=report(p);if(body.source!==source)fail('The catalog changed. Refresh this audit before continuing.',409);
   const finding=current.findings.find(f=>f.id===body.findingId)||fail('Refresh this finding before continuing',409);
   const ps=createCreatorProjectStore(ctx.store,{assetPrefix:`/assets/${ctx.key}/`});
   if(action==='preview'||action==='draft'){
    if(finding.role==='copy')fail('Review and edit the catalog text for this finding');
    const language=body.language||'both',category=Object.hasOwn(LISTING_CATEGORIES,p.category)?p.category:'general';
    let built;try{built=buildListingSet({copyMode:'captions',...body.listingSet,category,destination:p.ch[0],frames:finding.role==='main'?['main']:['main',finding.role]},{language,note:repairInstruction(finding)});}catch(e){fail(e.message);}
    const slots=built.slots.filter(s=>s.kind===finding.role),variants=slots.reduce((n,s)=>n+s.languages.length,0),credits=variants*GENERATION_RATES.image,budget=creditStatus(await ctx.store.getAccount(newAccount));
    if(action==='preview')return {frames:slots.length,imageVariants:variants,credits,budget,available:creatorEditConfigured(),canStart:creatorEditConfigured()&&budget.left>=credits,slots,listingSet:built.spec,direction:built.direction};
    if(body.image&&(!/^data:image\/(png|jpeg|webp);base64,/.test(body.image)||body.image.length>27000000))fail('Upload a PNG, JPEG or WebP reference under 20 MB');
    const requestHash=hash({source,findingId:finding.id,spec:built.spec,image:body.image||null}),previous=current.handoffs[finding.id];
    if(previous?.requestHash===requestHash){try{return {project:await ps.getProject(ws,previous.projectId),finding};}catch{}}
    const urls=[...(p.listing.images||[]).map(i=>i.src)];const target=Number.isInteger(finding.imageIndex)?urls[finding.imageIndex]:null;
    const sources=[target,p.image,...urls].filter((v,i,a)=>v&&a.indexOf(v)===i).slice(0,10);if(!sources.length&&!body.image)fail('Upload a real product photo in Catalog before starting this repair',422);
    const project=await createProject({ws,action:'create',image:body.image||undefined,input:{name:(p.name[0]+' · '+finding.title.en).slice(0,200),sku:p.sku,catalogProductId:p.id,category,channel:p.ch[0],placement:'gallery',preset:'audit-repair',brief:built.brief,product:{facts:built.facts,sources:sources.map(url=>({type:'image',url}))},slots}},ctx);
    await ctx.store.updateCatalog(ws,c=>{const item=c.products.find(x=>x.id===p.id)||fail('Product was removed',409);if(auditSource(item)!==source)fail('Catalog changed. Draft saved in Creator; refresh the audit.',409);item.repairAudit={...(item.repairAudit||{}),source,findings:item.repairAudit?.source===source?item.repairAudit.findings||[]:[],handoffs:{...(item.repairAudit?.handoffs||{}),[finding.id]:{projectId:project.id,slotId:project.slots[0].id,requestHash,status:'draft',createdAt:new Date().toISOString()}}};c.version++;});return {project,finding};
   }
   if(action==='recheck'){
    const h=current.handoffs[finding.id]||fail('Create a repair draft first',409),project=await ps.getProject(ws,h.projectId),slot=project.slots.find(s=>s.id===h.slotId),revision=slot?.revisions.find(r=>r.id===body.revisionId);
    if(!revision||!Object.values(slot.selected).includes(revision.id))fail('Select the exact current revision to check',409);await guardPlan(ctx.store);
    const data=await load(revision.asset.url,{...ctx,ws});const result=AuditReading.parse(await read({listing:{...p.listing,attributes:{...p.listing.attributes,confirmedRepairFacts:project.product.facts}},images:[{index:0,data,label:'Exact candidate revision '+revision.id}],mode:'recheck',finding}));await meter(ctx.store,'ai');
    const latest=await ps.getProject(ws,project.id);if(!Object.values(latest.slots.find(s=>s.id===slot.id).selected).includes(revision.id))fail('The selected version changed during the check',409);
    const check={revisionId:revision.id,language:revision.language,checkedAt:new Date().toISOString(),findings:result.findings,status:result.findings.length?'needs_review':'no_issue_observed',publication:'not_verified'};
    await ctx.store.updateCatalog(ws,c=>{const item=c.products.find(x=>x.id===p.id)||fail('Product was removed',409);if(auditSource(item)!==source||item.repairAudit?.handoffs?.[finding.id]?.projectId!==project.id)fail('Audit changed during this check',409);item.repairAudit.handoffs[finding.id].check=check;c.version++;});return check;
   }
   if(action==='copy'){
    const fields=['titleEn','titleAr','bulletsEn','bulletsAr'],patch=body.patch;if(finding.role!=='copy'||body.confirm!==true||!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!fields.includes(k)))fail('Review and confirm the catalog text changes');
    for(const [k,v]of Object.entries(patch))if(k.startsWith('bullets')?(!Array.isArray(v)||v.length>12||v.some(x=>typeof x!=='string'||x.length>1000)):(typeof v!=='string'||v.length>1000))fail('Invalid catalog text');
    const updated=await ctx.store.updateCatalog(ws,c=>{const i=c.products.findIndex(x=>x.id===p.id);if(i<0||auditSource(c.products[i])!==source)fail('Catalog changed. Refresh before saving.',409);const old=c.products[i],next=normaliseCatalogProduct({...old,reviews:old.rev,listing:{...old.listing,...patch}},ws);next.repairHistory=[...(old.repairHistory||[]),{findingId:finding.id,at:new Date().toISOString(),previous:Object.fromEntries(Object.keys(patch).map(k=>[k,old.listing[k]]))}].slice(-20);c.products[i]=next;c.version++;});return {catalog:updated,publication:'not_sent'};
   }
   fail('Unknown catalog audit action');
  }finally{running.delete(lock);}
 }};
}
