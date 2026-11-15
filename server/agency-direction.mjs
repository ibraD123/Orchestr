import { createCreatorProjectStore } from './creator-projects.mjs';
import { StoreError } from './store.mjs';
export async function directionStatus(store,ws,batch){
 const d=batch.direction;if(!d)return null;
 let stale=false;const ps=createCreatorProjectStore(store);
 for(const item of d.items){try{const p=await ps.getProject(ws,item.projectId),s=p.slots.find(s=>s.id===item.slotId),r=s?.revisions.find(r=>r.id===item.revisionId);if(!r||r.factStale||r.review.status!=='approved'||JSON.stringify(s.style)!==JSON.stringify(item.style)||s.layout!==item.layout||s.aspect!==item.aspect||s.kind!==item.kind)stale=true;}catch{stale=true;}}
 return {...d,status:stale?'needs_refresh':d.status};
}
export async function approvedDirections(store,ws,projectId){
 const portal=store.getPortal?await store.getPortal(ws):{},out=[];
 for(const b of portal.batches||[])if(b.projectIds.includes(projectId)&&b.direction){const d=await directionStatus(store,ws,b);if(d.status==='approved')out.push({...d,batchId:b.id});}
 return out;
}
export async function guardBatchDirections(store,ws,projectIds){
 const portal=store.getPortal?await store.getPortal(ws):{};
 for(const b of portal.batches||[])if(b.direction&&b.projectIds.some(id=>projectIds.includes(id))){const d=await directionStatus(store,ws,b);if(d.status!=='approved')throw new StoreError(`Client direction approval required for batch: ${b.name}`,409);}
}
