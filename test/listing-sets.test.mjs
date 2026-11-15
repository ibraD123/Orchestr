import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildListingSet, LISTING_CATEGORIES } from '../server/listing-sets.mjs';
import { contentPrompt } from '../server/content-plan.mjs';
import { createStore } from '../server/store.mjs';
import { creatorRoutes } from '../server/creator-api.mjs';
import { studioRoutes } from '../server/studio-flow.mjs';
import { createCreatorProjectStore } from '../server/creator-projects.mjs';
import { createProduction } from '../server/production.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=';

test('each category proposes a coherent set; main is clean and EN/AR galleries remain separate',()=>{
 for(const category of Object.keys(LISTING_CATEGORIES)){
  const p=buildListingSet({category,destination:'amazon'});
  assert.equal(p.slots[0].kind,'main');assert.deepEqual(p.slots[0].languages,['none']);assert.equal(p.slots[0].style.background,'#ffffff');assert.equal(p.slots[0].style.textDensity,'none');
  assert.equal(p.slots.length,4);assert.equal(p.imageVariants,6);assert.equal(p.manualStages,0);assert.ok(p.slots.every(s=>s.aspect==='1:1'));assert.match(p.brief,/no invented numbers/);
 }
 assert.match(buildListingSet({category:'beauty'}).brief,/before-and-after/);
 assert.match(buildListingSet({category:'tech'}).brief,/compatibility/);
});
test('destination and lighting change real prompts, structure, language count and cost',()=>{
 const noon=buildListingSet({destination:'noon',category:'home'});
 assert.equal(noon.imageVariants,4);assert.ok(noon.slots.every(s=>s.languages[0]==='none'));assert.match(noon.brief,/noon seller SKU/);
 const store=buildListingSet({destination:'salla',category:'home',look:'daylight'},{language:'ar'});
 assert.equal(store.slots[0].aspect,'1:1');assert.equal(store.slots[1].aspect,'4:5');assert.equal(store.slots[1].style.tone,'natural');assert.deepEqual(store.slots[1].languages,['ar']);assert.match(store.brief,/Salla/);assert.match(store.brief,/soft natural window light/);
 const zid=buildListingSet({destination:'zid',aspect:'1:1'});assert.ok(zid.slots.every(s=>s.aspect==='1:1'));assert.match(zid.brief,/Zid/);
});
test('facts are assigned to their frame; sizing or usage cannot use unrelated facts',()=>{
 assert.throws(()=>buildListingSet({frames:['main','dimensions'],facts:{main:['100 ml']},factsConfirmed:true}),/actual dimensions/);
 assert.throws(()=>buildListingSet({facts:{notes:['Oud']}}),/Confirm/);
 const p=buildListingSet({frames:['main','dimensions'],facts:{dimensions:['Height: 12 cm','Width: 8 cm']},factsConfirmed:true});
 assert.deepEqual(p.facts,['Height: 12 cm','Width: 8 cm']);assert.ok(p.slots[1].rationale.length<=500);
 assert.match(contentPrompt(p.slots[1],p.brief),/Height: 12 cm/);assert.doesNotMatch(contentPrompt(p.slots[0],p.brief),/Height: 12 cm/);
 assert.throws(()=>buildListingSet({frames:['main','howto'],copyMode:'photo',facts:{howto:['Apply once']},factsConfirmed:true}),/fact captions/);
});
test('invalid or excessive plans are rejected before they become paid work',()=>{
 for(const input of [{destination:'__proto__'},{category:'unknown'},{look:'fake'},{frames:['benefit','main']},{frames:['main','main']},{frames:['main','certificate']},{aspect:'9:16'},{destination:'noon',aspect:'4:5'},{facts:{unknown:['fake']}},{facts:{notes:['x'.repeat(151)]},factsConfirmed:true},{facts:{notes:['a','b','c']},factsConfirmed:true}])assert.throws(()=>buildListingSet(input));
 assert.throws(()=>buildListingSet({}, {note:'x'.repeat(1201)}));
});
test('agency structures retain generic layout, while destination main-image rules override styling',()=>{
 const template={id:'agency-set',slots:[{kind:'main',style:{background:'#ff0000',textDensity:'medium'}},{kind:'details',layout:'split',style:{tone:'playful',accent:'#339933'}},{kind:'runway'}]};
 const p=buildListingSet({frames:['main','details']},{template,language:'en'});
 assert.equal(p.slots[0].style.background,'#ffffff');assert.equal(p.slots[0].style.textDensity,'none');assert.equal(p.slots[1].layout,'split');assert.equal(p.slots[1].style.accent,'#339933');assert.equal(p.spec.templateId,'agency-set');assert.equal(p.manualStages,0);
});
test('listing preview is free; saved plan survives reload and produces exactly the quoted queue with frame facts',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'basira-listing-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const ctx={store:createStore(dir),key:'local'},ps=createCreatorProjectStore(ctx.store),raw=creatorRoutes({guardPlan:async()=>{throw Error('No generation during plan creation');},meter:async()=>{}}),studio=studioRoutes({createProject:raw['POST /api/creator/project']})['POST /api/creator/studio'];
 const request={ws:'layali',action:'preview',task:'set',language:'both',listingSet:{destination:'noon',category:'fragrance',copyMode:'captions',frames:['main','notes','details','lifestyle'],facts:{notes:['Oud and rose']},factsConfirmed:true},brief:'Keep props minimal.'};
 const q=await studio(request,ctx);assert.equal(q.credits,24);assert.equal(q.budget.held,0);assert.equal((await ctx.store.getCreator('layali')).projects.length,0);
 const p=await studio({...request,action:'start',image,name:'Oud launch'},ctx),saved=await createCreatorProjectStore(createStore(dir)).getProject('layali',p.id);
 assert.equal(saved.channel,'noon');assert.equal(saved.category,'fragrance');assert.deepEqual(saved.listingSet.facts.notes,['Oud and rose']);assert.deepEqual(saved.product.facts,['Oud and rose']);assert.match(saved.brief,/Keep props minimal/);assert.ok(saved.slots.every(s=>s.revisions.length===0));
 const production=createProduction({edit:async()=>{throw Error('Quote must not generate');},createBatch:async()=>{},autoRun:false});
 const quote=await production.quote({ws:'layali',projectIds:[p.id]},ctx);assert.equal(quote.frames,q.imageVariants);assert.equal(quote.credits,q.credits);assert.match(quote.items.find(i=>i.kind==='notes').prompt,/Oud and rose/);assert.doesNotMatch(quote.items.find(i=>i.kind==='main').prompt,/Oud and rose/);
 await assert.rejects(production.quote({ws:'noor',projectIds:[p.id]},ctx),e=>e.status===404);
 await assert.rejects(studio({...request,templateId:'not-owned'},ctx),e=>e.status===404);
 await assert.rejects(studio({...request,direction:{goal:'listing'}},ctx),/one creation workflow/);
 const template=await ps.createTemplate('layali',{projectId:p.id,name:'My listing structure'});assert.ok(!JSON.stringify(template).includes('Oud and rose'),'reusable structures must not leak product facts');
});

test('category sequences offer distinct editable plans with grounded data gates for every destination',async()=>{
 const {listingSequences,listingFrameReadiness,LISTING_DESTINATIONS}=await import('../server/listing-sets.mjs');
 for(const category of Object.keys(LISTING_CATEGORIES))for(const destination of Object.keys(LISTING_DESTINATIONS)){
  const packs=listingSequences(category,destination);assert.equal(packs.length,3);
  for(const pack of packs){assert.equal(pack.frames[0],'main');assert.equal(new Set(pack.frames).size,pack.frames.length);assert.ok(pack.frames.length<=8);}
  const simple=buildListingSet({category,destination,...packs[2]});assert.equal(simple.imageVariants,3);assert.ok(simple.slots.every(s=>s.languages.join()==='none'));
  const essential=buildListingSet({category,destination,...packs[0]});assert.equal(essential.imageVariants,destination==='noon'?4:6);
  const detailed=packs[1];assert.equal(detailed.copyMode,'captions');assert.ok(detailed.frames.some(k=>listingFrameReadiness(k).status==='needs_data'));
  assert.throws(()=>buildListingSet({category,destination,...detailed}),/actual/);
 }
 assert.throws(()=>listingSequences('__proto__'));assert.throws(()=>listingSequences('home','fake'));
 assert.equal(listingFrameReadiness('dimensions',{frameData:{dimensions:{width:'٢٤',unit:'cm'}}}).status,'needs_confirmation');
 assert.equal(listingFrameReadiness('dimensions',{frameData:{dimensions:{width:'٢٤',unit:'cm'}},factsConfirmed:true}).status,'ready');
 assert.equal(listingFrameReadiness('dimensions',{frameData:{dimensions:{width:'about 24',unit:'cm'}},factsConfirmed:true}).status,'needs_data');
 assert.equal(listingFrameReadiness('notes').status,'ready');
});
test('reordered sequences persist the buyer question, exact position and selected facts in production prompts',()=>{
 const p=buildListingSet({category:'home',frames:['main','lifestyle','dimensions','details'],facts:{dimensions:['Width: 24 cm','Opening: 18 cm']},factsConfirmed:true});
 assert.match(contentPrompt(p.slots[2],p.brief),/Gallery 3\/4/);assert.match(contentPrompt(p.slots[2],p.brief),/Will it fit my space/);assert.match(contentPrompt(p.slots[2],p.brief),/Opening: 18 cm/);
 assert.doesNotMatch(contentPrompt(p.slots[0],p.brief),/Opening: 18 cm/);
 assert.deepEqual(p.spec.frames,['main','lifestyle','dimensions','details']);
 assert.ok(p.slots.every(s=>s.rationale.length<=500));
});
