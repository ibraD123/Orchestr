import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../server/store.mjs";
import { catalogRoutes } from "../server/catalog-workflow.mjs";
import { creatorRoutes } from "../server/creator-api.mjs";
import { listingsFromCSV } from "../server/catalog-csv.mjs";
import { createCreatorProjectStore } from "../server/creator-projects.mjs";
import { readZip } from "../server/zip.mjs";
import { decide } from "../server/portal.mjs";

test("catalog survives reload, upserts without duplicates and round-trips bilingual CSV", async () => {
  const dir=await mkdtemp(join(tmpdir(),'basira-catalog-'));
  try {
    const ctx={store:createStore(dir),key:'local'};
    const api=catalogRoutes({})['POST /api/catalog'];
    const item={sku:'SKU-1',listing:{channel:'amazon',titleEn:'Bottle',titleAr:'زجاجة',category:'home',bulletsEn:['First','Second'],bulletsAr:['أول','ثاني'],attributes:{material:'glass'},images:[{src:'https://example.com/a.jpg'},{src:'https://example.com/b.jpg'}]}};
    const first=await api({ws:'layali',action:'upsert',items:[item]},ctx);
    await api({ws:'layali',action:'upsert',items:[{...item,listing:{...item.listing,titleEn:'Updated bottle'}}]},ctx);
    const saved=await api({ws:'layali',action:'list'},{...ctx,store:createStore(dir)});
    assert.equal(saved.products.length,1);assert.equal(saved.products[0].id,first.products[0].id);assert.equal(saved.products[0].name[0],'Updated bottle');
    const file=await api({ws:'layali',action:'export',ids:[saved.products[0].id]},ctx);
    const parsed=listingsFromCSV(file.$file.data).items[0];
    assert.equal(parsed.listing.channel,'amazon');assert.deepEqual(parsed.listing.bulletsEn,item.listing.bulletsEn);assert.deepEqual(parsed.listing.bulletsAr,item.listing.bulletsAr);assert.deepEqual(parsed.listing.attributes,item.listing.attributes);assert.equal(parsed.listing.images.length,2);
    await assert.rejects(api({ws:'noor',action:'export',ids:[saved.products[0].id]},ctx),/belong/);
    await assert.rejects(api({ws:'layali',action:'upsert',items:[item,item]},ctx),/duplicate/);
    const batch=await api({ws:'layali',action:'projects',ids:[saved.products[0].id]},ctx);
    const repeated=await api({ws:'layali',action:'projects',ids:[saved.products[0].id]},ctx);
    assert.equal(batch.results[0].status,'created');assert.equal(repeated.results[0].status,'existing');
  } finally {await rm(dir,{recursive:true,force:true});}
});

test("batch assets require exact client approval and preserve approved release bytes", async () => {
  const dir=await mkdtemp(join(tmpdir(),'basira-catalog-release-'));
  try {
    const ctx={store:createStore(dir),key:'local'};
    const creator=creatorRoutes({guardPlan:async()=>{},meter:async()=>{}});
    const api=catalogRoutes({exportRelease:creator['POST /api/creator/release/export']})['POST /api/catalog'];
    const c=await api({ws:'layali',action:'upsert',items:[{sku:'A',listing:{titleEn:'A',channel:'noon'}}]},ctx),ids=[c.products[0].id];
    const ps=createCreatorProjectStore(ctx.store,{assetPrefix:'/assets/local/'});
    const p=await ps.createProject('layali',{sku:'A',name:'A',slots:[{kind:'main',languages:['none']}]});
    await ctx.store.saveAsset('layali','catalog-test','image.png',Buffer.from('exact-media'));
    const r=await ps.addRevision('layali',p.id,p.slots[0].id,{language:'none',asset:{url:'/assets/local/layali/catalog-test/image.png',type:'image'}});
    await ps.reviewRevision('layali',p.id,p.slots[0].id,r.id,{status:'approved'});await ps.createRelease('layali',p.id,{});
    await assert.rejects(api({ws:'layali',action:'assets',ids},ctx),/Client approval/);
    const sent=await api({ws:'layali',action:'review',ids},ctx);
    await ctx.store.updatePortal('layali',portal=>decide(portal,sent.results[0].reviewId,0,{decision:'approve',name:'Client'}));
    const out=await api({ws:'layali',action:'assets',ids},ctx);
    assert.equal(Buffer.from(readZip(out.$file.data).find(x=>x.name.endsWith('.png')).data).toString(),'exact-media');
    assert.ok((await ctx.store.exportWorkspace('layali')).catalog.products.length);
  } finally {await rm(dir,{recursive:true,force:true});}
});
