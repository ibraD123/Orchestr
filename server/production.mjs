import { guardBatchDirections, approvedDirections } from "./agency-direction.mjs";
import { slotFacts } from "./fact-links.mjs";
// Durable, single-process production queue. A restart never blindly repeats an in-flight paid call.
import { randomBytes, createHash } from 'node:crypto';
import { createCreatorProjectStore } from './creator-projects.mjs';
import { contentPrompt, planSlots } from './content-plan.mjs';
import { creditStatus, reserveCredits, settleCredits, recordGenerationAttempt, GENERATION_RATES } from './generation-budget.mjs';
import { newAccount } from './billing.mjs';
import { StoreError, safeName } from './store.mjs';
import { makeZip } from './zip.mjs';
const uid=prefix=>prefix+randomBytes(12).toString('hex');
const fail=(m,s=400)=>{throw new StoreError(m,s);};
const VIDEO=new Set(['tryon','video','runway','model']);
const copy=o=>structuredClone(o);
export function createProduction({edit,createBatch,enabled=()=>true,autoRun=true}){
 const clients=new Map();let busy=false,scheduled=false;
 const ps=ctx=>createCreatorProjectStore(ctx.store,{assetPrefix:`/assets/${ctx.key}/`});
 function register(ctx){clients.set(ctx.key,{store:ctx.store,key:ctx.key});}
 function schedule(){if(!autoRun||scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;drain().catch(e=>console.error('Production worker:',e.message));},10).unref?.();}
 async function quote(body,ctx){
  const ws=String(body.ws||'');await ctx.store.getGenome(ws);const store=ps(ctx),language=body.language||'both';
  const templates=await store.listTemplates(),template=templates.find(t=>t.id===(body.templateId||'builtin-uae-essentials'));
  if(!template)fail('Choose a saved content set',404);let slots;try{slots=planSlots(template,language);}catch(e){fail(e.message);}
  const catalog=await ctx.store.getCatalog(ws),sources=[],skipped=[];
  if(body.projectIds){
   if(!Array.isArray(body.projectIds)||!body.projectIds.length||body.projectIds.length>50||new Set(body.projectIds).size!==body.projectIds.length)fail('Select 1–50 distinct projects');
   for(const id of body.projectIds){const p=await store.getProject(ws,id);if(!p.product.sources[0])fail(`Upload a reference for ${p.name}`,422);sources.push({projectId:p.id,name:p.name,slots:p.slots,brief:p.brief,serviceScope:p.serviceScope});}
  }else{
   if(!Array.isArray(body.ids)||!body.ids.length||body.ids.length>50||new Set(body.ids).size!==body.ids.length)fail('Select 1–50 distinct imported products');
   for(const id of body.ids){const p=catalog.products.find(p=>p.id===id)||fail('Product does not belong to this client',404);if(!p.image)fail(`Add a source photo for ${p.sku} before production`,422);sources.push({catalogId:p.id,name:p.name[0],slots,sku:p.sku,channel:p.ch[0],category:p.category,image:p.image});}
  }
  const projectIds=sources.map(p=>p.projectId).filter(Boolean);await guardBatchDirections(ctx.store,ws,projectIds);
  if(body.targets){if(!Array.isArray(body.targets)||!body.targets.length||body.targets.length>500||new Set(body.targets.map(t=>t.projectId+':'+t.slotId+':'+t.language)).size!==body.targets.length)fail('Choose distinct correction targets');for(const t of body.targets){const p=sources.find(p=>p.projectId===t.projectId),s=p?.slots.find(s=>s.id===t.slotId);if(!s?.languages.includes(t.language))fail('Correction target does not belong to these projects',404);}}
  const directionKeys={};for(const id of projectIds)directionKeys[id]=(await approvedDirections(ctx.store,ws,id)).map(d=>d.id).sort().join("|");
  const items=[];
  for(const p of sources)for(const [index,s] of p.slots.entries()){
   if(s.factState?.planStale)fail('Confirmed product data changed. Apply its fact plan before production.',409);
   if(p.serviceScope?.role==='copy'){skipped.push({name:p.name,kind:s.kind,reason:'Catalog text service: edit the catalog copy; no image charge.'});continue;}
   if(p.serviceScope&&['dimensions','sizechart','inbox','howto','ingredients','capacity','compatibility'].includes(s.kind)&&!s.frameData)fail('Confirm actual product data for '+s.name+' before production.',409);
   if(VIDEO.has(s.kind)){skipped.push({name:p.name,kind:s.kind,reason:'Model and video stages require separate model selection and approval.'});continue;}
   for(const language of s.languages){if(body.targets&&!body.targets.some(t=>t.projectId===p.projectId&&t.slotId===s.id&&t.language===language))continue;if(!body.targets&&p.projectId&&s.selected?.[language]&&!s.factState?.staleLanguages.includes(language))continue;items.push({id:uid('frame_'),projectId:p.projectId||null,catalogId:p.catalogId||null,slotId:p.projectId?s.id:null,slotIndex:index,kind:s.kind,language,name:p.name,expectedRevisionId:p.projectId?s.selected?.[language]||null:null,expectedFactFingerprint:s.factState?.fingerprint||null,expectedDirectionKey:p.projectId?directionKeys[p.projectId]:null,prompt:contentPrompt(s,String(body.brief||p.brief||'').slice(0,4000)),credits:GENERATION_RATES.image,status:'queued'});}
  }
  if(!items.length)fail('No empty image frames to produce. Existing versions are preserved.',409);
  if(items.length>500)fail('Select a smaller batch (maximum 500 images)',413);
  const fingerprint=createHash('sha256').update(JSON.stringify({sources,template:template.id,language,brief:body.brief||'',items:items.map(({id,...i})=>i)})).digest('hex');
  const budget=creditStatus(await ctx.store.getAccount(newAccount));
  return {ws,available:enabled(),templateId:template.id,language,products:sources.length,frames:items.length,credits:items.length*GENERATION_RATES.image,budget,canStart:enabled()&&budget.left>=items.length*GENERATION_RATES.image,skipped,sources,items,fingerprint};
 }
 function publicQuote(q){const {sources,items,...rest}=q;return rest;}
 async function finalise(ctx,ws,job){
  const spent=job.items.filter(i=>i.status==='done').reduce((n,i)=>n+i.credits,0);
  await settleCredits(ctx.store,job.id,spent);
  await ctx.store.updateProduction(ws,s=>{const j=s.jobs.find(j=>j.id===job.id);if(j){j.status=j.items.some(i=>i.status==='failed')?'needs_attention':j.cancelRequested?'cancelled':'complete';j.spent=spent;j.refunded=j.credits-spent;j.finishedAt=new Date().toISOString();}});
 }
 async function recover(ctx,ws){
  const state=await ctx.store.getProduction(ws);
  for(const job of state.jobs.filter(j=>['queued','running'].includes(j.status))){
   for(const item of job.items.filter(i=>i.status==='running')){
    let revision;try{const p=await ps(ctx).getProject(ws,item.projectId);revision=p.slots.flatMap(s=>s.revisions).find(r=>r.generationId===item.id);}catch{}
    await ctx.store.updateProduction(ws,s=>{const i=s.jobs.find(j=>j.id===job.id)?.items.find(i=>i.id===item.id);if(i&&i.status==='running'){i.status=revision?'done':'failed';i.revisionId=revision?.id||null;i.error=revision?'':'The server restarted during this frame. Review the project before explicitly retrying; no automatic duplicate was started.';}});
   }
  }
 }
 async function registerAndRecover(ctx){
  register(ctx);const workspaces=await ctx.store.listWorkspaces(),jobs=new Set(),saved=new Set();
  for(const ws of workspaces){await recover(ctx,ws.id);for(const j of (await ctx.store.getProduction(ws.id)).jobs)jobs.add(j.id);const state=await ctx.store.getCreator(ws.id);for(const p of state.projects)for(const s of p.slots)for(const r of s.revisions)if(r.generationId)saved.add(r.generationId);for(const m of state.models||[])if(m.generationId)saved.add(m.generationId);}
  const account=await ctx.store.getAccount(newAccount);
  for(const [id,h] of Object.entries(account.generationBudget?.holds||{}))if(h.status==='reserved'&&!jobs.has(id))await settleCredits(ctx.store,id,saved.has(id)?h.amount:0);
  schedule();
 }
 async function drain(){
  if(busy)return;busy=true;
  try{let found=true;while(found){found=false;
   for(const ctx of clients.values())for(const w of await ctx.store.listWorkspaces()){
    const state=await ctx.store.getProduction(w.id),job=state.jobs.find(j=>['queued','running'].includes(j.status));if(!job)continue;found=true;
    const item=!job.cancelRequested&&job.items.find(i=>i.status==='queued');
    if(!item){await finalise(ctx,w.id,job);continue;}
    await ctx.store.updateProduction(w.id,s=>{const j=s.jobs.find(j=>j.id===job.id);j.status='running';j.items.find(i=>i.id===item.id).status='running';});
    try{
     await guardBatchDirections(ctx.store,w.id,[item.projectId]);if(item.expectedDirectionKey!=null&&(await approvedDirections(ctx.store,w.id,item.projectId)).map(d=>d.id).sort().join("|")!==item.expectedDirectionKey)throw new StoreError("The approved direction changed. Review a new production plan.",409);
     await recordGenerationAttempt(ctx.store,item.credits);
     const out=await edit({ws:w.id,projectId:item.projectId,slotId:item.slotId,language:item.language,expectedRevisionId:item.expectedRevisionId,expectedFactFingerprint:item.expectedFactFingerprint,prompt:item.prompt,generationId:item.id,approvedTexts:item.language==='none'?[]:undefined},ctx);
     const p=out.project||await ps(ctx).getProject(w.id,item.projectId),r=p.slots.find(s=>s.id===item.slotId)?.revisions.find(r=>r.generationId===item.id);
     if(!r)throw new Error('The generated revision was not saved');
     await ctx.store.updateProduction(w.id,s=>Object.assign(s.jobs.find(j=>j.id===job.id).items.find(i=>i.id===item.id),{status:'done',revisionId:r.id,error:'',finishedAt:new Date().toISOString()}));
    }catch(e){await ctx.store.updateProduction(w.id,s=>Object.assign(s.jobs.find(j=>j.id===job.id).items.find(i=>i.id===item.id),{status:'failed',error:String(e.message).slice(0,500),finishedAt:new Date().toISOString()}));}
   }
  }}finally{busy=false;}
 }
 async function start(body,ctx){
  if(!enabled())fail('Image generation is not configured on this server',503);
  const q=await quote(body,ctx);if(q.fingerprint!==body.fingerprint)fail('The plan changed. Review its quantity and budget again.',409);
  const id=body.requestId;if(!/^[A-Za-z0-9_-]{8,100}$/.test(id||''))fail('A unique request ID is required');
  await reserveCredits(ctx.store,id,q.credits,`batch:${ctx.key}:${q.ws}`);
  try{
   if((await ctx.store.getProduction(q.ws)).jobs.length>=100)fail('Production history is full (100 batches)',413);
   const projects=[];
   for(const source of q.sources){
    let project;
    if(source.projectId)project=await ps(ctx).getProject(q.ws,source.projectId);
    else project=await ps(ctx).createProject(q.ws,{sku:source.sku,catalogProductId:source.catalogId,name:source.name,category:source.category,channel:source.channel,placement:'gallery',brief:String(body.brief||'').slice(0,4000),preset:'free',product:{facts:[],sources:[{type:'image',url:source.image}]},slots:source.slots});
    projects.push(project);
    for(const item of q.items.filter(i=>source.projectId?i.projectId===source.projectId:i.catalogId===source.catalogId)){item.projectId=project.id;item.slotId=project.slots[item.slotIndex].id;}
   }
   const batch=await createBatch(ctx,{ws:q.ws,projectIds:projects.map(p=>p.id),name:String(body.name||'Content production').slice(0,120)});
   const job={id,ws:q.ws,name:batch.name,batchId:batch.id,projectIds:projects.map(p=>p.id),items:q.items,status:'queued',credits:q.credits,spent:0,refunded:0,skipped:q.skipped,createdAt:new Date().toISOString()};
   await ctx.store.updateProduction(q.ws,s=>{if(s.jobs.length>=100)fail('Production history is full',413);s.jobs.push(job);});register(ctx);schedule();return job;
  }catch(e){await settleCredits(ctx.store,id,0);throw e;}
 }
 async function retry(body,ctx){
  const ws=String(body.ws||''),state=await ctx.store.getProduction(ws),old=state.jobs.find(j=>j.id===body.jobId)||fail('Unknown production batch',404);
  if(!['needs_attention','complete','cancelled'].includes(old.status))fail('Wait until this batch finishes',409);
  const failed=old.items.filter(i=>i.status==='failed');if(!failed.length)fail('No failed frames to retry',409);
  if(!enabled())fail('Image generation is not configured',503);
  const amount=failed.reduce((n,i)=>n+i.credits,0);if(body.confirmCredits!==amount)fail('Review the retry budget first',409);
  const id=body.requestId;await reserveCredits(ctx.store,id,amount,`batch:${ctx.key}:${ws}`);
  try{let next;await ctx.store.updateProduction(ws,s=>{
   const previous=s.jobs.find(j=>j.id===old.id);if(previous.retryJobId)fail('A retry batch already exists for these frames',409);if(s.jobs.length>=100)fail('Production history is full',413);
   next={...copy(old),id,status:'queued',retryOf:old.id,retryJobId:null,cancelRequested:false,credits:amount,spent:0,refunded:0,finishedAt:null,createdAt:new Date().toISOString(),items:failed.map(i=>({...i,id:uid('frame_'),status:'queued',error:'',revisionId:null}))};previous.retryJobId=id;s.jobs.push(next);
  });register(ctx);schedule();return next;}catch(e){await settleCredits(ctx.store,id,0);throw e;}
 }
 const routes={'POST /api/creator/production':async(body,ctx)=>{
  const ws=String(body.ws||'');await ctx.store.getGenome(ws);register(ctx);
  if(body.action==='quote')return publicQuote(await quote(body,ctx));
  if(body.action==='start')return start(body,ctx);
  if(body.action==='retry')return retry(body,ctx);
  if(body.action==='cancel'){await ctx.store.updateProduction(ws,s=>{const j=s.jobs.find(j=>j.id===body.jobId)||fail('Unknown batch',404);if(['queued','running'].includes(j.status)){j.cancelRequested=true;j.items.filter(i=>i.status==='queued').forEach(i=>i.status='cancelled');}});schedule();return {ok:true};}
  if(body.action==='download'){
   const job=(await ctx.store.getProduction(ws)).jobs.find(j=>j.id===body.jobId)||fail('Unknown batch',404),files=[];let bytes=0;
   for(const item of job.items.filter(i=>i.status==='done')){const p=await ps(ctx).getProject(ws,item.projectId),r=p.slots.find(s=>s.id===item.slotId)?.revisions.find(r=>r.id===item.revisionId);if(!r||r.factStale||r.review.status!=='approved')continue;
    const prefix=`/assets/${ctx.key}/${ws}/`;if(!r.asset.url.startsWith(prefix))fail('Invalid asset',409);const [batch,...rest]=r.asset.url.slice(prefix.length).split('/'),data=await ctx.store.readAsset(ws,batch,rest.join('/'));bytes+=data.length;if(bytes>100_000_000)fail('Download a smaller batch (100 MB limit)',413);files.push({name:`${safeName(p.sku||p.name)}-${p.id}/${safeName(item.slotId)}-${item.language}.${r.asset.url.split('.').pop()}`,data});
   }
   if(!files.length)fail('Agency-approve generated images in Creator before downloading them',409);
   files.push({name:'README.txt',data:'Agency-approved production files. Client approval and destination upload specifications are separate. Use Client portal for final client-approved delivery.'});
   return {$file:{data:Buffer.from(makeZip(files)),type:'application/zip',name:'basira-reviewed-production.zip'}};
  }
  if(body.action!=='list')fail('Unknown production action');
  schedule();return {jobs:(await ctx.store.getProduction(ws)).jobs.slice().reverse(),budget:creditStatus(await ctx.store.getAccount(newAccount))};
 }};
 return {routes,quote,start,retry,drain,registerAndRecover};
}
