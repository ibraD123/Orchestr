import { randomBytes } from 'node:crypto';
import { createCreatorProjectStore } from './creator-projects.mjs';
import { factHash, factGroup, projectFactFields, parseFactAnswer, ensureFactBook, decorateFacts } from './fact-links.mjs';
import { directionStatus } from './agency-direction.mjs';
import { baselineRepairs } from './audit-repairs.mjs';
import { auditSource } from './catalog-audit.mjs';
import { createBatch } from './collaboration.mjs';
import { StoreError } from './store.mjs';
const uid=p=>p+randomBytes(10).toString('hex'),copy=x=>structuredClone(x),fail=(m,s=400)=>{throw new StoreError(m,s);};
const text=(v,n=500)=>{if(typeof v!=='string'||!v.trim()||v.length>n)fail('Use a short non-empty description');return v.trim();};
const ps=ctx=>createCreatorProjectStore(ctx.store,{assetPrefix:`/assets/${ctx.key}/`});
const batchOf=(portal,id)=>(portal.batches||[]).find(b=>b.id===id)||fail('Choose a client batch',404);
function withReviewStatus(plan,portal){for(const m of plan.materials||[]){const reviews=(portal.reviews||[]).flatMap(r=>r.items).filter(it=>it.creator?.projectId===m.projectId&&it.creator.revisionId===m.revisionId);m.clientStatus=reviews.at(-1)?.status||'not_sent';}return plan;}
export function serviceMoney(v){if(typeof v==='number'){if(!Number.isSafeInteger(v)||v<0||v>100000000)fail('Invalid service price');return v;}if(typeof v!=='string'||!/^\d{1,7}(\.\d{1,2})?$/.test(v.trim()))fail('Enter a service price with up to two decimal places');const [whole,fraction='']=v.trim().split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));}
export async function agencyClientView(store,ws){
 const portal=await store.getPortal(ws),directions=[],state=await store.getCreator(ws);ensureFactBook(state);const staleRevisionIds=state.projects.flatMap(p=>decorateFacts(state,p).slots.flatMap(s=>s.revisions.filter(r=>r.factStale).map(r=>r.id)));
 for(const b of portal.batches||[])if(b.direction)directions.push({batchId:b.id,batchName:b.name,...await directionStatus(store,ws,b)});
 return {staleRevisionIds,offers:(portal.offers||[]).filter(o=>o.status!=='draft'),directions};
}
export async function agencyClientAction(store,ws,body){
 await store.getGenome(ws);
 if(body.action==='direction_decide'){
  const portal=await store.getPortal(ws),b=batchOf(portal,body.batchId),d=await directionStatus(store,ws,b);
  if(!d||d.id!==body.directionId||d.status!=='pending')fail('This direction changed. Refresh before deciding.',409);
  if(!['approve','changes'].includes(body.decision))fail('Choose a direction decision');
  const name=text(body.name,120),comment=body.decision==='changes'?text(body.comment,1500):String(body.comment||'').slice(0,1500);
  return store.updatePortal(ws,p=>{const current=batchOf(p,b.id).direction;if(current.id!==d.id||current.status!=='pending')fail('Direction changed',409);current.status=body.decision==='approve'?'approved':'changes';current.decision={name,comment,at:new Date().toISOString()};return current;});
 }
 if(body.action!=='offer_accept')fail('Unknown client agency action');
 if(body.confirm!==true||!Array.isArray(body.lineIds)||!body.lineIds.length||new Set(body.lineIds).size!==body.lineIds.length)fail('Select and confirm the service scope');
 const name=text(body.name,120);
 return store.updatePortal(ws,p=>{
  const o=(p.offers||[]).find(o=>o.id===body.offerId)||fail('Unknown proposal',404);
  if(o.version!==body.version||!['sent','accepted'].includes(o.status))fail('Proposal changed. Review its current version.',409);
  if(body.lineIds.some(id=>!o.lines.some(l=>l.id===id)))fail('Choose items from this proposal');
  const ids=o.lines.filter(l=>body.lineIds.includes(l.id)).map(l=>l.id);
  if(o.status==='accepted'){if(JSON.stringify(o.acceptance.lineIds)!==JSON.stringify(ids))fail('This scope is already approved; ask the agency for a new proposal',409);return o;}
  o.acceptance={lineIds:ids,total:o.lines.filter(l=>ids.includes(l.id)).reduce((n,l)=>n+l.price,0),name,at:new Date().toISOString()};o.status='accepted';return o;
 });
}
export function agencyOperationsRoutes(){const active=new Set();return {'POST /api/agency':async(body,ctx)=>{
 const lock=ctx.key+':'+body.ws+':'+body.action,locked=body.action==='offer_execute';if(locked&&active.has(lock))fail('Accepted scope is already being prepared',409);if(locked)active.add(lock);try{
 const ws=String(body.ws||'');await ctx.store.getGenome(ws);const projectStore=ps(ctx),portal=await ctx.store.getPortal(ws),action=body.action;
 if(action==='list')return {offers:portal.offers||[],directions:(await agencyClientView(ctx.store,ws)).directions};
 if(action==='facts')return projectStore.productFacts(ws,String(body.productId||''));
 if(action==='fact_updates'){
  const record=await projectStore.productFacts(ws,String(body.productId||'')),event=record.history.find(e=>e.id===body.eventId)||fail('Choose a fact change from this product',404),materials=[],targets=[];
  for(const p of record.projects)for(const s of p.slots)for(const language of s.languages){const r=s.revisions.find(r=>r.id===s.selected[language]),affected=r?.factIssues?.some(e=>e.key===event.key)||!r&&s.factState?.entries.some(e=>e.key===event.key);if(!affected)continue;const manual=['model','tryon','video','runway'].includes(s.kind);materials.push({projectId:p.id,projectName:p.name,slotId:s.id,name:s.name,language,revisionId:r?.id||null,asset:r?.asset||null,agencyApproved:r?.review.status==='approved',manual});if(!manual)targets.push({projectId:p.id,slotId:s.id,language});}
  const current=record.facts.find(f=>f.key===event.key);return withReviewStatus({event,productId:record.productId,key:event.key,from:event.from,to:current?.value??event.to,unit:current?.unit||'',materials,targets,credits:targets.length*4},portal);
 }
 if(action==='fact_preview')return withReviewStatus(await projectStore.previewFactChange(ws,body),portal);
 if(action==='fact_apply'){
  if(body.taskId){const q=await agencyOperationsRoutes()['POST /api/agency']({ws,action:'data_preview',taskId:body.taskId},ctx);body={...body,...q.request};}
  const result=await projectStore.changeFact(ws,body);
  if(body.taskId)await ctx.store.updatePortal(ws,p=>{const t=(p.creatorTasks||[]).find(t=>t.id===body.taskId);if(t?.field&&t.field.key===body.key){t.status='resolved';t.factChangeId=result.id;t.acceptedAt=new Date().toISOString();}});
  return result;
 }
 if(action==='data_preview'){
  const task=(portal.creatorTasks||[]).find(t=>t.id===body.taskId&&t.kind==='data'&&t.field&&t.answer)||fail('Choose an answered field request',404),p=await projectStore.getProject(ws,task.projectId),field=projectFactFields(p).find(f=>f.key===task.field.key&&f.slotId===task.field.slotId)||fail('The requested field no longer exists',409);
  if(field.unit!==task.field.unit)fail('The unit changed after the request. Ask for confirmation in the current unit.',409);
  const value=parseFactAnswer(field,task.answer),request={productId:factGroup(p),key:field.key,value,reason:'Client answer: '+task.question};return {...withReviewStatus(await projectStore.previewFactChange(ws,request),portal),request,taskId:task.id};
 }
 if(action==='direction_submit'){
  const b=batchOf(portal,body.batchId);if(!Array.isArray(body.selections)||!body.selections.length||body.selections.length>3||new Set(body.selections.map(x=>x.revisionId)).size!==body.selections.length)fail('Choose one to three approved reference images');
  const items=[];
  for(const selected of body.selections){if(!b.projectIds.includes(selected.projectId))fail('Choose references from this batch',404);const p=await projectStore.getProject(ws,selected.projectId),s=p.slots.find(s=>s.id===selected.slotId),r=s?.revisions.find(r=>r.id===selected.revisionId);if(!r||r.review.status!=='approved'||r.factStale||r.asset.type!=='image')fail('Agency-approve current reference images first',409);items.push({projectId:p.id,slotId:s.id,revisionId:r.id,name:s.name,language:r.language,asset:r.asset,style:copy(s.style),layout:s.layout,aspect:s.aspect,kind:s.kind});}
  const d={id:uid('direction'),version:(b.direction?.version||0)+1,status:'pending',note:text(body.note,1200),items,createdAt:new Date().toISOString()};
  return ctx.store.updatePortal(ws,p=>{const target=batchOf(p,b.id);if((target.direction?.id||null)!==(body.expectedDirectionId||null))fail('Direction changed. Refresh first.',409);if((target.directionHistory||[]).length>=30)fail('Direction history is full',413);if(target.direction)(target.directionHistory||=[]).push(target.direction);target.direction=d;return d;});
 }
 if(action==='offer_prepare'){
  if(!Array.isArray(body.productIds)||!body.productIds.length||body.productIds.length>30||new Set(body.productIds).size!==body.productIds.length)fail('Choose 1–30 catalog products');
  const catalog=await ctx.store.getCatalog(ws),lines=[];
  for(const id of body.productIds){const p=catalog.products.find(p=>p.id===id)||fail('Choose products from this client catalog',404),saved=p.repairAudit?.source===auditSource(p)?p.repairAudit.findings||[]:[],findings=[...baselineRepairs(p),...saved];
   for(const f of findings){if(lines.length>=100)break;lines.push({id:uid('line'),productId:p.id,sku:p.sku,productName:p.name[0],findingId:f.id,source:auditSource(p),title:f.title.en,titleAr:f.title.ar,description:f.proposal.en,role:f.role,price:0});}
  }
  if(!lines.length)fail('No repair recommendations for these products');
  return ctx.store.updatePortal(ws,p=>{if((p.offers||[]).length>=50)fail('Proposal history is full',413);const o={id:uid('offer'),version:1,title:'Catalog content improvements',currency:'AED',status:'draft',lines,notes:'',createdAt:new Date().toISOString()};(p.offers||=[]).push(o);return o;});
 }
 if(action==='offer_save'||action==='offer_send')return ctx.store.updatePortal(ws,p=>{
  const o=(p.offers||[]).find(o=>o.id===body.offerId)||fail('Unknown proposal',404);if(o.status!=='draft'||o.version!==body.version)fail('Proposal changed or has already been sent',409);
  if(!['AED','SAR','USD'].includes(body.currency)||!Array.isArray(body.lines)||!body.lines.length||body.lines.length>o.lines.length||new Set(body.lines.map(l=>l.id)).size!==body.lines.length)fail('Choose proposal lines and currency');
  const lines=body.lines.map(l=>{const original=o.lines.find(x=>x.id===l.id)||fail('Unknown proposal item');return {...original,price:serviceMoney(l.price)};});
  o.title=text(body.title,180);o.notes=String(body.notes||'').slice(0,1500);o.currency=body.currency;o.lines=lines;o.total=lines.reduce((n,l)=>n+l.price,0);if(!Number.isSafeInteger(o.total)||o.total>100000000)fail('Proposal total is too large');o.version++;if(action==='offer_send'){o.status='sent';o.sentAt=new Date().toISOString();}return o;
 });
 if(action==='offer_execute'){
  const o=(portal.offers||[]).find(o=>o.id===body.offerId)||fail('Unknown proposal',404);if(o.status!=='accepted')fail('Client scope approval is required first',409);if(o.execution)return o.execution;
  const catalog=await ctx.store.getCatalog(ws),projects=[];
  for(const line of o.lines.filter(l=>o.acceptance.lineIds.includes(l.id))){const p=catalog.products.find(p=>p.id===line.productId)||fail('Product was removed',409);if(auditSource(p)!==line.source)fail('Catalog changed since this proposal. Prepare a new proposal.',409);
   const state=await ctx.store.getCreator(ws);let project=state.projects.find(p=>p.serviceScope?.offerId===o.id&&p.serviceScope.lineId===line.id);
   if(!project){const kind=line.role==='copy'?'other':line.role;project=await projectStore.createProject(ws,{name:(p.name[0]+' · '+line.title).slice(0,120),sku:p.sku,catalogProductId:p.id,category:p.category,channel:p.ch[0],preset:'service-scope',brief:line.description,serviceScope:{offerId:o.id,lineId:line.id,role:line.role},product:{facts:[],sources:p.image?[{url:p.image,type:'image'}]:[]},slots:[{kind,name:line.title.slice(0,120),rationale:line.role==='copy'?'Text service: complete the catalog copy manually; this is not an image generation task.':line.description.slice(0,500),languages:kind==='main'?['none']:['en','ar'],aspect:'1:1'}]});}
   projects.push(project.id);
  }
  const latest=await ctx.store.getPortal(ws);let b=(latest.batches||[]).find(b=>b.offerId===o.id);if(!b){b=await createBatch(ctx,{ws,projectIds:projects,name:o.title});await ctx.store.updatePortal(ws,p=>{const target=batchOf(p,b.id);target.offerId=o.id;});}
  const execution={batchId:b.id,projectIds:projects,at:new Date().toISOString(),generation:'not_started'};
  return ctx.store.updatePortal(ws,p=>{const current=p.offers.find(x=>x.id===o.id);current.execution||=execution;return current.execution;});
 }
 fail('Unknown agency operation');
 }finally{if(locked)active.delete(lock);}
}};}
