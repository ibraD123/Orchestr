import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {normaliseListingFrameData,listingNumeric,listingFrameInstruction} from '../server/listing-frame-data.mjs';
import {buildListingSet} from '../server/listing-sets.mjs';
import {contentPrompt} from '../server/content-plan.mjs';
import {createStore} from '../server/store.mjs';
import {creatorRoutes} from '../server/creator-api.mjs';
import {studioRoutes} from '../server/studio-flow.mjs';
import {createCreatorProjectStore} from '../server/creator-projects.mjs';
import {createProduction} from '../server/production.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=';
test('measurements accept Arabic/Persian digits, preserve units and reject estimates or invalid numbers',()=>{
 assert.equal(listingNumeric('١٢٫٥'),12.5);assert.equal(listingNumeric('۱۲,۵'),12.5);
 const d=normaliseListingFrameData('dimensions',{height:'١٢٫٥',width:'8',unit:'cm',subject:'package'});assert.deepEqual(d,{height:12.5,width:8,unit:'cm',subject:'package'});
 assert.match(listingFrameInstruction('dimensions',d),/package/);assert.ok(!Object.hasOwn(d,'depth'));
 for(const v of [0,-1,'12 cm','10–12','NaN','1e3',Infinity,{},'0',100001])assert.throws(()=>listingNumeric(v));
 assert.throws(()=>normaliseListingFrameData('dimensions',{}),/actual measurement/);assert.throws(()=>normaliseListingFrameData('dimensions',{height:12,unit:'feet'}));
});
test('net volume is distinct from dimensions and zero/fractional pack quantities never become one',()=>{
 const d=normaliseListingFrameData('capacity',{amount:100,unit:'ml',count:2});assert.equal(d.amount,100);assert.match(listingFrameInstruction('capacity',d),/not a physical dimension/);
 for(const count of [0,1.5,-1,1001])assert.throws(()=>normaliseListingFrameData('capacity',{amount:100,count}));
 assert.throws(()=>normaliseListingFrameData('inbox',{items:[{name:'Cable',quantity:0}]}));
});
test('size tables preserve exact rows, distinguish body/garment/foot, and reject ambiguous or duplicate rows',()=>{
 const data=normaliseListingFrameData('sizechart',{measure:'garment',unit:'cm',rows:[{size:'M',chest:96,length:140},{size:'L',chest:100,length:142}]});assert.equal(data.rows[1].chest,100);
 const foot=normaliseListingFrameData('sizechart',{measure:'foot',rows:[{size:'EU 41',footLength:26,chest:999}]});assert.deepEqual(foot.rows,[{size:'EU 41',footLength:26}]);
 assert.throws(()=>normaliseListingFrameData('sizechart',{rows:[{size:'M'}]}));assert.throws(()=>normaliseListingFrameData('sizechart',{rows:[{size:'M',chest:96},{size:'m',chest:100}]}));
});
test('contents, ingredients, usage and compatibility require real bounded data and retain exclusions',()=>{
 const plan=buildListingSet({frames:['main','compatibility','inbox'],frameData:{compatibility:{connector:'USB-C',devices:['Device A'],excluded:['Device B']},inbox:{items:[{name:'Cable',quantity:2}]}},factsConfirmed:true});
 assert.ok(plan.facts.includes('Not compatible: Device B'));assert.ok(plan.facts.includes('2 × Cable'));
 const prompt=contentPrompt(plan.slots[1],plan.brief);assert.match(prompt,/Device B/);assert.match(prompt,/exclusions/);
 assert.throws(()=>normaliseListingFrameData('ingredients',{items:[]}));assert.throws(()=>normaliseListingFrameData('howto',{steps:Array(5).fill('Apply')}));assert.throws(()=>normaliseListingFrameData('compatibility',{}));assert.throws(()=>normaliseListingFrameData('main',{height:12}));
});
test('structured data requires confirmation, is frame-scoped and cannot be used in photo-only mode',()=>{
 const spec={frames:['main','dimensions'],frameData:{dimensions:{height:12,width:8,unit:'cm'}}};assert.throws(()=>buildListingSet(spec),/Confirm/);
 assert.throws(()=>buildListingSet({...spec,copyMode:'photo',factsConfirmed:true}),/fact captions/);
 assert.throws(()=>buildListingSet({...spec,frames:['main'],factsConfirmed:true}),/selected frame/);
 const p=buildListingSet({...spec,factsConfirmed:true});assert.deepEqual(p.slots[1].frameData,{unit:'cm',subject:'product',height:12,width:8});assert.match(contentPrompt(p.slots[1],p.brief),/"height":12/);assert.doesNotMatch(contentPrompt(p.slots[0],p.brief),/"height":12/);
 const roundTrip=buildListingSet(p.spec,{language:p.spec.language});assert.deepEqual(roundTrip.facts,p.facts);
});
test('bilingual captions cost one image per frame; separate EN/AR assets retain their original count',()=>{
 const separate=buildListingSet({},{language:'both'}),together=buildListingSet({},{language:'bilingual'});assert.equal(separate.imageVariants,6);assert.equal(together.imageVariants,4);assert.deepEqual(together.slots[1].languages,['bilingual']);assert.match(contentPrompt(together.slots[1],together.brief),/together in this single image/);assert.deepEqual(together.slots[0].languages,['none']);assert.doesNotMatch(together.brief,/separate gallery versions/);assert.match(separate.brief,/separate gallery versions/);
});
test('structured plans persist through API/reload and production quotes without leaking data into reusable templates',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'basira-frame-data-'));t.after(()=>rm(dir,{recursive:true,force:true}));const ctx={store:createStore(dir),key:'local'},raw=creatorRoutes({guardPlan:async()=>{throw Error('No paid generation');},meter:async()=>{}}),api=studioRoutes({createProject:raw['POST /api/creator/project']})['POST /api/creator/studio'];
 const req={ws:'layali',action:'preview',task:'set',language:'bilingual',listingSet:{frames:['main','dimensions','capacity'],frameData:{dimensions:{height:'12.5',width:'8',unit:'cm',subject:'product'},capacity:{amount:100,unit:'ml',count:1}},factsConfirmed:true}};
 const q=await api(req,ctx);assert.equal(q.credits,12);assert.equal(q.budget.held,0);assert.equal((await ctx.store.getCreator('layali')).projects.length,0);
 const p=await api({...req,action:'start',image,name:'Measured item'},ctx),ps=createCreatorProjectStore(createStore(dir));const saved=await ps.getProject('layali',p.id);assert.equal(saved.listingSet.frameData.dimensions.height,12.5);assert.equal(saved.slots[1].frameData.height,12.5);
 const queue=createProduction({edit:async()=>{throw Error('No paid generation');},createBatch:async()=>{},autoRun:false}),quote=await queue.quote({ws:'layali',projectIds:[p.id]},ctx);assert.equal(quote.credits,q.credits);assert.equal(quote.frames,3);assert.match(quote.items[1].prompt,/12.5/);assert.match(quote.items[1].prompt,/"unit":"cm"/);assert.equal(quote.items[1].language,'bilingual');
 const template=await ps.createTemplate('layali',{projectId:p.id,name:'Measurement structure'});assert.ok(!JSON.stringify(template).includes('frameData'));assert.ok(!JSON.stringify(template).includes('12.5'));
 await assert.rejects(api({...req,templateId:'unknown-template'},ctx),e=>e.status===404);
 await assert.rejects(queue.quote({ws:'noor',projectIds:[p.id]},ctx),e=>e.status===404);
});
