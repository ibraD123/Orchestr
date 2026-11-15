import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../server/store.mjs';
import {createCreatorProjectStore} from '../server/creator-projects.mjs';
import {buildListingSet} from '../server/listing-sets.mjs';
import {agencyOperationsRoutes,agencyClientAction,agencyClientView,serviceMoney} from '../server/agency-operations.mjs';
import {createBatch,requestData,clientBatchAction} from '../server/collaboration.mjs';
import {createProduction} from '../server/production.mjs';
import {normaliseCatalogProduct} from '../server/catalog-workflow.mjs';
import {creatorRoutes} from '../server/creator-api.mjs';
import {newAccount} from '../server/billing.mjs';
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=','base64');
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'basira-agency-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=createStore(dir),ctx={store,key:'local'},ps=createCreatorProjectStore(store,{assetPrefix:'/assets/local/'}),route=agencyOperationsRoutes()['POST /api/agency'];await store.getGenome('layali');const product=normaliseCatalogProduct({sku:'ORG-1',listing:{channel:'noon',category:'home',titleEn:'Drawer organizer',images:[{src:'https://example.com/organizer.png'}]}},'layali');await store.updateCatalog('layali',c=>{c.products.push(product);});await store.saveAsset('layali','fixture01','source.png',image);return {dir,store,ctx,ps,route,product};}
async function project(f,{language='both',legacy=false}={}){const b=buildListingSet({destination:'noon',category:'home',copyMode:'captions',frames:['main','dimensions'],frameData:{dimensions:{unit:'cm',width:24,openingWidth:20}},factsConfirmed:true},{language});const p=await f.ps.createProject('layali',{name:'Organizer',catalogProductId:f.product.id,sku:'ORG-1',channel:'noon',listingSet:b.spec,product:{facts:b.facts,sources:[{url:'/assets/local/layali/fixture01/source.png',type:'image'}]},slots:b.slots});for(const s of p.slots)for(const language of s.languages){const r=await f.ps.addRevision('layali',p.id,s.id,{language,asset:{url:'/assets/local/layali/fixture01/source.png',type:'image'},prompt:'Test verified source'});await f.ps.reviewRevision('layali',p.id,s.id,r.id,{status:'approved'});}if(legacy)await f.store.updateCreator('layali',s=>{for(const slot of s.projects.find(x=>x.id===p.id).slots)for(const r of slot.revisions)delete r.factSnapshot;});return f.ps.getProject('layali',p.id);}

test('a confirmed fact change finds EN/AR usage across projects, preserves old approvals, quotes only affected variants and persists',async t=>{
 const f=await setup(t),p=await project(f),second=await project(f,{language:'bilingual'});const release=await f.ps.createRelease('layali',p.id);
 const body={productId:f.product.id,key:'dimensions.openingWidth',value:'١٨',reason:'Measured actual opening'};
 const q=await f.route({ws:'layali',action:'fact_preview',...body},f.ctx);assert.equal(q.to,18);assert.equal(q.materials.length,3);assert.equal(q.credits,12);assert.ok(q.materials.every(m=>m.name==='Dimensions & scale'||m.name==='Dimensions'));
 const original=await f.ps.getProject('layali',p.id);assert.equal(original.slots[1].frameData.openingWidth,20);
 const event=await f.route({ws:'layali',action:'fact_apply',...body,fingerprint:q.fingerprint,confirm:true,requestId:'fact_change_001'},f.ctx);assert.equal(event.targets.length,3);const pending=await f.route({ws:'layali',action:'fact_updates',productId:f.product.id,eventId:event.id},f.ctx);assert.equal(pending.targets.length,3);assert.equal(pending.to,18);
 const saved=await createCreatorProjectStore(createStore(f.dir)).getProject('layali',p.id),dim=saved.slots[1];assert.equal(dim.frameData.openingWidth,18);assert.equal(saved.listingSet.frameData.dimensions.openingWidth,18);assert.equal(dim.selected.en,original.slots[1].selected.en);assert.equal(dim.revisions[0].review.status,'approved');assert.equal(dim.revisions[0].factStale,true);assert.equal(saved.slots[0].revisions[0].factStale,false);
 await assert.rejects(f.ps.createRelease('layali',p.id),e=>e.status===409);
 const api=creatorRoutes({guardPlan:async()=>{},meter:async()=>{}});await assert.rejects(api['POST /api/creator/release/export']({ws:'layali',projectId:p.id,releaseId:release.id},f.ctx),e=>e.status===409);
 const production=createProduction({edit:async()=>assert.fail('No paid calls'),createBatch,autoRun:false});const cost=await production.quote({ws:'layali',projectIds:[p.id,second.id],targets:q.targets},f.ctx);assert.equal(cost.frames,3);assert.equal(cost.credits,12);assert.match(cost.items[0].prompt,/18/);assert.doesNotMatch(cost.items[0].prompt,/Opening width: 20/);
 const revision=await f.ps.addRevision('layali',p.id,dim.id,{language:'en',asset:{url:'/assets/local/layali/fixture01/source.png',type:'image'},prompt:'Corrected opening to 18 cm'});const updated=await f.ps.getProject('layali',p.id);assert.equal(updated.slots[1].revisions.find(r=>r.id===revision.id).factStale,false);assert.equal(revision.review.status,'unreviewed');assert.equal(updated.slots[1].revisions[0].factStale,true);
 const duplicate=await f.route({ws:'layali',action:'fact_apply',...body,fingerprint:q.fingerprint,confirm:true,requestId:'fact_change_001'},f.ctx);assert.equal(duplicate.id,event.id);assert.equal((await f.store.getCreator('layali')).factChanges.length,1);
});
test('impact snapshots reject changed selection and foreign clients; legacy prompts are marked as possible wider usage',async t=>{
 const f=await setup(t),p=await project(f,{legacy:true}),body={productId:f.product.id,key:'dimensions.openingWidth',value:18,reason:'Client correction'};
 const q=await f.ps.previewFactChange('layali',body);assert.equal(q.materials.length,3);assert.ok(q.materials.every(m=>m.legacyPossible));
 await f.ps.updateProject('layali',p.id,{name:'Changed name'});
 await assert.rejects(f.ps.changeFact('layali',{...body,fingerprint:q.fingerprint,requestId:'stale_change_001',confirm:true}),e=>e.status===409);
 await assert.rejects(f.ps.previewFactChange('noor',body),e=>e.status===404);await assert.rejects(f.ps.previewFactChange('layali',{...body,key:'__proto__.polluted'}));
 assert.equal({}.polluted,undefined);
});
test('bound client answers require agency acceptance and update the exact field with provenance',async t=>{
 const f=await setup(t),p=await project(f),field=p.factFields.find(f=>f.key==='dimensions.openingWidth');
 const task=await requestData(f.ctx,{ws:'layali',projectId:p.id,slotId:field.slotId,fieldKey:field.key,question:'What is the measured opening width in cm?'});
 const batch=(await f.store.getPortal('layali')).batches[0];assert.ok(batch.projectIds.includes(p.id));
 await assert.rejects(clientBatchAction(f.store,'layali',{action:'answer',batchId:batch.id,taskId:task.id,answer:'18 inches'}));
 await clientBatchAction(f.store,'layali',{action:'answer',batchId:batch.id,taskId:task.id,answer:'١٨ سم'});
 assert.equal((await f.ps.getProject('layali',p.id)).slots[1].frameData.openingWidth,20);
 const q=await f.route({ws:'layali',action:'data_preview',taskId:task.id},f.ctx);assert.equal(q.to,18);
 await f.route({ws:'layali',action:'fact_apply',...q.request,taskId:task.id,fingerprint:q.fingerprint,requestId:'answer_change_001',confirm:true},f.ctx);
 const saved=(await f.store.getPortal('layali')).creatorTasks[0];assert.equal(saved.status,'resolved');assert.equal(saved.factChangeId,'answer_change_001');assert.equal((await f.ps.getProject('layali',p.id)).slots[1].frameData.openingWidth,18);
});
test('client direction gates production, snapshots exact images and expires when source facts change',async t=>{
 const f=await setup(t),p=await project(f),batch=await createBatch(f.ctx,{ws:'layali',projectIds:[p.id],name:'Launch'}),dim=p.slots[1];
 const d=await f.route({ws:'layali',action:'direction_submit',batchId:batch.id,note:'Calm lighting and concise bilingual facts',selections:[{projectId:p.id,slotId:dim.id,revisionId:dim.selected.en}]},f.ctx);
 const production=createProduction({edit:async()=>assert.fail(),createBatch,autoRun:false}),request={ws:'layali',projectIds:[p.id],targets:[{projectId:p.id,slotId:dim.id,language:'en'}]};
 await assert.rejects(production.quote(request,f.ctx),/direction approval/);
 await assert.rejects(agencyClientAction(f.store,'layali',{action:'direction_decide',batchId:batch.id,directionId:'old',decision:'approve',name:'Client'}),e=>e.status===409);
 await agencyClientAction(f.store,'layali',{action:'direction_decide',batchId:batch.id,directionId:d.id,decision:'approve',name:'Client'});assert.equal((await production.quote(request,f.ctx)).frames,1);
 const change={productId:f.product.id,key:'dimensions.width',value:25,reason:'Measured again'},q=await f.ps.previewFactChange('layali',change);await f.ps.changeFact('layali',{...change,fingerprint:q.fingerprint,confirm:true,requestId:'direction_fact_001'});
 assert.equal((await agencyClientView(f.store,'layali')).directions[0].status,'needs_refresh');await assert.rejects(production.quote(request,f.ctx),/direction approval/);
});
test('audit proposals keep service prices separate, freeze client-selected scope, and prepare only accepted work idempotently',async t=>{
 const f=await setup(t);const draft=await f.route({ws:'layali',action:'offer_prepare',productIds:[f.product.id]},f.ctx);assert.ok(draft.lines.length>=2);assert.equal((await agencyClientView(f.store,'layali')).offers.length,0);
 const sent=await f.route({ws:'layali',action:'offer_send',offerId:draft.id,version:draft.version,title:'UAE gallery improvements',currency:'AED',notes:'Prices include all agreed work; taxes as stated by agency.',lines:draft.lines.map(l=>({id:l.id,price:'125.50'}))},f.ctx);
 const chosen=sent.lines.find(l=>l.role==='dimensions');assert.ok(chosen);
 await assert.rejects(agencyClientAction(f.store,'layali',{action:'offer_accept',offerId:sent.id,version:sent.version-1,lineIds:[chosen.id],confirm:true,name:'Client'}),e=>e.status===409);
 const accepted=await agencyClientAction(f.store,'layali',{action:'offer_accept',offerId:sent.id,version:sent.version,lineIds:[chosen.id],confirm:true,name:'Client'});assert.equal(accepted.acceptance.total,12550);
 const out=await f.route({ws:'layali',action:'offer_execute',offerId:sent.id},f.ctx),again=await f.route({ws:'layali',action:'offer_execute',offerId:sent.id},f.ctx);assert.deepEqual(out,again);assert.equal(out.projectIds.length,1);assert.equal((await f.store.getCreator('layali')).projects.length,1);assert.equal((await f.store.getPortal('layali')).batches.length,1);assert.equal((await f.store.getAccount(newAccount)).generationBudget?.used&&Object.keys((await f.store.getAccount(newAccount)).generationBudget.used).length||0,0);
 const production=createProduction({edit:async()=>assert.fail(),createBatch,autoRun:false});await assert.rejects(production.quote({ws:'layali',projectIds:out.projectIds},f.ctx),/actual product data/);
 assert.equal(serviceMoney('0.29'),29);assert.throws(()=>serviceMoney('1.001'));assert.throws(()=>serviceMoney('-1'));assert.throws(()=>serviceMoney(NaN));
});

test('a fact changed during generation leaves the saved candidate stale and never transfers the old approval',async t=>{
 const f=await setup(t),p=await project(f),s=p.slots[1];let calls=0;
 const api=creatorRoutes({guardPlan:async()=>{},meter:async()=>{},editImage:async()=>{calls++;const change={productId:f.product.id,key:'dimensions.openingWidth',value:18,reason:'Client corrected data while generation ran'},q=await f.ps.previewFactChange('layali',change);await f.ps.changeFact('layali',{...change,fingerprint:q.fingerprint,confirm:true,requestId:'mid_generation_001'});return {image:'data:image/png;base64,'+image.toString('base64'),provider:'test',checks:{ok:true},status:'needs_review'};}});
 const out=await api['POST /api/creator/edit']({ws:'layali',projectId:p.id,slotId:s.id,language:'en',prompt:'Use the confirmed frame facts.',expectedRevisionId:s.selected.en,expectedFactFingerprint:s.factState.fingerprint},f.ctx);
 assert.equal(calls,1);const candidate=out.project.slots[1].revisions.at(-1);assert.equal(candidate.factStale,true);assert.equal(candidate.review.status,'unreviewed');assert.equal(candidate.factSnapshot.find(e=>e.key==='dimensions.openingWidth').value,20);
 await assert.rejects(f.ps.reviewRevision('layali',p.id,s.id,candidate.id,{status:'approved'}),e=>e.status===409);
 await assert.rejects(api['POST /api/creator/edit']({ws:'layali',projectId:p.id,slotId:s.id,language:'en',prompt:'Retry old quote',expectedFactFingerprint:s.factState.fingerprint},f.ctx),e=>e.status===409);assert.equal(calls,1);
});
test('a changed direction stops a queued batch before any model call and refunds its reservation',async t=>{
 const f=await setup(t),p=await project(f),batch=await createBatch(f.ctx,{ws:'layali',projectIds:[p.id],name:'Direction-bound launch'}),s=p.slots[0],selection={projectId:p.id,slotId:s.id,revisionId:s.selected.none};
 const d=await f.route({ws:'layali',action:'direction_submit',batchId:batch.id,note:'First direction',selections:[selection]},f.ctx);await agencyClientAction(f.store,'layali',{action:'direction_decide',batchId:batch.id,directionId:d.id,decision:'approve',name:'Client'});
 let calls=0;const production=createProduction({edit:async()=>{calls++;assert.fail('Must not call a model');},createBatch,autoRun:false}),request={ws:'layali',projectIds:[p.id],targets:[{projectId:p.id,slotId:s.id,language:'none'}]},q=await production.quote(request,f.ctx);
 const job=await production.start({...request,fingerprint:q.fingerprint,requestId:'direction_queue_001'},f.ctx);
 await f.route({ws:'layali',action:'direction_submit',batchId:batch.id,expectedDirectionId:d.id,note:'Changed direction',selections:[selection]},f.ctx);await production.drain();
 const saved=(await f.store.getProduction('layali')).jobs.find(j=>j.id===job.id);assert.equal(calls,0);assert.equal(saved.spent,0);assert.equal(saved.refunded,4);assert.equal(saved.items[0].status,'failed');
});
test('new service drafts inherit known confirmed dimensions without inventing missing fields, while answers stay immutable',async t=>{
 const f=await setup(t),p=await project(f),known=await f.ps.createProject('layali',{name:'Next draft',catalogProductId:f.product.id,product:{facts:[],sources:[]},slots:[{kind:'dimensions',languages:['en']}]});assert.equal(known.slots[0].frameData.openingWidth,20);assert.equal(known.slots[0].frameData.height,undefined);
 const field=p.factFields.find(f=>f.key==='dimensions.openingWidth'),task=await requestData(f.ctx,{ws:'layali',projectId:p.id,slotId:field.slotId,fieldKey:field.key,question:'Opening width in cm?'}),b=(await f.store.getPortal('layali')).batches[0];
 await clientBatchAction(f.store,'layali',{action:'answer',batchId:b.id,taskId:task.id,answer:'18 cm'});await clientBatchAction(f.store,'layali',{action:'answer',batchId:b.id,taskId:task.id,answer:'18 cm'});
 await assert.rejects(clientBatchAction(f.store,'layali',{action:'answer',batchId:b.id,taskId:task.id,answer:'19 cm'}),e=>e.status===409);
});
