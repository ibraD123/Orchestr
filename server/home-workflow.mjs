// Only saved client work feeds Home. No sample activity or inferred decisions.
export function homeDecisions(batches=[],operations={}){
 const out=[],seen=new Set(),add=item=>{if(!seen.has(item.id)){seen.add(item.id);out.push(item);}};
 for(const batch of batches.slice().reverse())for(const p of batch.items||[]){
  for(const task of p.tasks||[]){
   if(task.kind==='data'&&task.status==='answered')add({id:task.id,kind:'data',taskId:task.id,projectId:p.projectId,batchId:batch.id,field:!!task.field,title:p.name,detail:task.question,priority:0});
   if(task.kind==='edit'&&['open','reopened','working'].includes(task.status))add({id:task.id,kind:'edit',taskId:task.id,projectId:p.projectId,batchId:batch.id,slotId:task.slotId,language:task.language,title:p.name,detail:task.original?.text||'',priority:1});
  }
  if(p.frames?.some(f=>f.factStale))add({id:'facts:'+p.projectId,kind:'facts',projectId:p.projectId,batchId:batch.id,title:p.name,detail:'',priority:2});
  if(p.status==='changes'&&!(p.tasks||[]).some(t=>t.kind==='edit'&&['open','reopened','working'].includes(t.status)))add({id:'changes:'+p.projectId,kind:'batch',projectId:p.projectId,batchId:batch.id,title:p.name,detail:'',priority:1});
 }
 for(const o of operations.offers||[])if(o.status==='accepted'&&!o.execution)add({id:'offer:'+o.id,kind:'offer',offerId:o.id,title:o.title,count:o.acceptance?.lineIds?.length||0,priority:2});
 for(const b of batches){const d=(operations.directions||[]).find(d=>d.batchId===b.id);if(d&&['changes','needs_refresh'].includes(d.status)||!d&&b.items?.some(p=>p.frames?.some(f=>f.agencyApproved)))add({id:'direction:'+b.id,kind:'direction',batchId:b.id,title:b.name,detail:d?.decision?.comment||'',priority:3});}
 return out.sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
}
