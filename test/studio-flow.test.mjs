import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore } from "../server/store.mjs";
import { creatorRoutes } from "../server/creator-api.mjs";
import { studioRoutes } from "../server/studio-flow.mjs";
import { catalogRoutes } from "../server/catalog-workflow.mjs";
import { createCreatorProjectStore } from "../server/creator-projects.mjs";

const photo="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=";
test("creative drafts start without a SKU and preserve sources and brief across reloads",async()=>{
  const dir=await mkdtemp(join(tmpdir(),'basira-studio-'));
  try{
    const ctx={store:createStore(dir),key:'local'},api=creatorRoutes({guardPlan:async()=>{},meter:async()=>{}});
    const studio=studioRoutes({createProject:api['POST /api/creator/project']})['POST /api/creator/studio'];
    const p=await studio({ws:'layali',action:'start',task:'image',image:photo,brief:'اجعل الخلفية دافئة',language:'ar'},ctx);
    assert.equal(p.sku,'');assert.equal(p.catalogProductId,'');assert.equal(p.slots[0].kind,'other');assert.deepEqual(p.slots[0].languages,['ar']);
    const saved=await createCreatorProjectStore(createStore(dir)).getProject('layali',p.id);
    assert.equal(saved.brief,'اجعل الخلفية دافئة');assert.equal(saved.product.sources.length,1);
    const plan=await studio({ws:'layali',action:'prepare',projectId:p.id,channel:'noon'},ctx);
    assert.equal(plan.ready,false);assert.equal(plan.publication.available,false);assert.equal(plan.checks.find(c=>c.key==='product').ok,false);
    assert.equal((await createCreatorProjectStore(ctx.store).getProject('layali',p.id)).slots[0].revisions.length,0,'starting and checking do not generate images');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test("one catalog product can have several projects; binding is client scoped and batch actions never guess",async()=>{
  const dir=await mkdtemp(join(tmpdir(),'basira-studio-bind-'));
  try{
    const ctx={store:createStore(dir),key:'local'},api=creatorRoutes({guardPlan:async()=>{},meter:async()=>{}});
    const studio=studioRoutes({createProject:api['POST /api/creator/project']})['POST /api/creator/studio'];
    const catalog=catalogRoutes({})['POST /api/catalog'];
    const products=await catalog({ws:'layali',action:'upsert',items:[{sku:'A',listing:{titleEn:'Bottle',channel:'noon'}}]},ctx),id=products.products[0].id;
    const a=await studio({ws:'layali',action:'start',catalogProductId:id,task:'set',name:'Main set'},ctx);
    const b=await studio({ws:'layali',action:'start',catalogProductId:id,task:'image',name:'Ramadan'},ctx);
    assert.notEqual(a.id,b.id);assert.equal(a.sku,b.sku);assert.equal(a.catalogProductId,id);
    await assert.rejects(studio({ws:'noor',action:'start',catalogProductId:id},ctx),e=>e.status===404);
    const c=await studio({ws:'layali',action:'start',task:'main',preset:'amazon-main'},ctx);
    assert.equal(c.slots[0].languages[0],'none');assert.equal(c.slots[0].aspect,'1:1');
    const bound=await studio({ws:'layali',action:'bind',projectId:c.id,catalogProductId:id},ctx);
    assert.equal(bound.sku,'A');assert.equal(bound.slots[0].kind,'main','linking never replaces creative assets or layout');
    const batch=await catalog({ws:'layali',action:'projects',ids:[id]},ctx);
    assert.equal(batch.results[0].status,'failed');assert.match(batch.results[0].error,/Several/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('catalog issues open the same versioned Creator project, preserve source references and require a choice for multiple campaigns',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'basira-open-'));
 try{
 const ctx={store:createStore(dir),key:'local'},api=creatorRoutes({guardPlan:async()=>{},meter:async()=>{}}),studio=studioRoutes({createProject:api['POST /api/creator/project']})['POST /api/creator/studio'];
 const cat=await catalogRoutes({})['POST /api/catalog']({ws:'layali',action:'upsert',items:[{sku:'A',image:'https://example.com/a.png',listing:{channel:'noon',titleEn:'Dress',category:'fashion',images:[{src:'https://example.com/b.png'}]}}]},ctx),id=cat.products[0].id;
 const out=await studio({ws:'layali',action:'open',catalogProductId:id,issue:'noSizeChart',issueDescription:'Add the verified size chart'},ctx);
 assert.equal(out.project.brief,'Add the verified size chart');assert.equal(out.project.catalogProductId,id);assert.equal(out.project.product.sources.length,2);assert.equal(out.project.slots.find(s=>s.id===out.slotId).kind,'sizechart');
 const again=await studio({ws:'layali',action:'open',catalogProductId:id,issue:'noSizeChart',issueDescription:'Add the verified size chart'},ctx);assert.equal(again.project.id,out.project.id);assert.equal(again.project.slots.length,out.project.slots.length);
 const second=await studio({ws:'layali',action:'open',catalogProductId:id,forceNew:true},ctx);assert.notEqual(second.project.id,out.project.id);
 const choose=await studio({ws:'layali',action:'open',catalogProductId:id},ctx);assert.equal(choose.choices.length,2);
 const selected=await studio({ws:'layali',action:'open',catalogProductId:id,projectId:out.project.id},ctx);assert.equal(selected.project.id,out.project.id);
 await assert.rejects(studio({ws:'noor',action:'open',catalogProductId:id},ctx),e=>e.status===404);
 }finally{await rm(dir,{recursive:true,force:true});}
});
