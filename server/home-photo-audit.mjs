import {StoreError} from './store.mjs';
import {AuditReading,readAuditImages} from './audit-vision.mjs';
import {creatorImageDimensions} from './creator-edit.mjs';
import {llmConfigured} from './llm.mjs';
import {LISTING_CATEGORIES,LISTING_DESTINATIONS} from './listing-sets.mjs';
export function homePhotoAuditRoutes({guardPlan,meter,read=readAuditImages,configured=llmConfigured}={}){return {'POST /api/home/photo-audit':async(body,ctx)=>{
 const ws=String(body.ws||'');await ctx.store.getGenome(ws);
 const image=body.image,match=typeof image==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image);
 if(!match||image.length>7000000||!creatorImageDimensions(image))throw new StoreError('Choose a valid PNG, JPEG or WebP under 5 MB');
 const channel=body.channel||'amazon',category=body.category||'general';if(!Object.hasOwn(LISTING_DESTINATIONS,channel)||!Object.hasOwn(LISTING_CATEGORIES,category))throw new StoreError('Choose a destination and category');
 if(!configured())throw new StoreError('AI image review is not configured',503);
 await guardPlan(ctx.store);
 const result=AuditReading.parse(await read({listing:{channel,category},images:[{index:0,data:image,label:'Single uploaded photo, not a complete listing'}],mode:'photo'}));await meter(ctx.store,'ai');
 const findings=result.findings.filter(f=>f.imageIndex===0&&f.role!=='copy').map((f,i)=>({...f,type:f.type==='error'&&!f.evidence.some(e=>e.field==='image')?'improvement':f.type,id:'photo-'+i,evidence:f.evidence.filter(e=>e.field==='image'),basis:'ai'}));
 return {scope:'single_photo',findings,channel,category,checkedAt:new Date().toISOString()};
}};}
