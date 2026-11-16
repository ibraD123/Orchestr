// Shoof credits are product units, not estimates of the provider's invoice.
import { randomBytes } from 'node:crypto';
import { newAccount, effectivePlan, PLANS, monthKey } from './billing.mjs';
import { StoreError } from './store.mjs';
export const GENERATION_RATES = Object.freeze({ image:4, edit:4, model:4, tryon:6, video:24 });
const allowances={trial:40,seller:600,agency:6000,enterprise:30000};
export function creditStatus(account, at){
  const plan=effectivePlan(account,at), month=monthKey(at), data=account.generationBudget||{used:{},holds:{}};
  const used=data.used[month]||0, held=Object.values(data.holds).filter(h=>h.status==='reserved').reduce((n,h)=>n+h.amount,0);
  const limit=PLANS[plan].credits??allowances[plan];
  return {month,limit,used,held,attempted:data.attempted?.[month]||0,attemptLimit:limit*3,left:Math.max(0,limit-used-held),rates:GENERATION_RATES,unit:'Shoof credits'};
}
export async function reserveCredits(store,id,amount,scope){
  if(!/^[A-Za-z0-9_-]{8,100}$/.test(id)||!Number.isSafeInteger(amount)||amount<1)throw new StoreError('Invalid generation reservation');
  return store.updateAccount(newAccount,a=>{
    const b=a.generationBudget||=( {used:{},holds:{}} );
    if(b.holds[id])throw new StoreError('This generation request already exists. Refresh its status before starting another.',409);
    const status=creditStatus(a);
    if(status.left<amount)throw new StoreError(`This operation needs ${amount} credits; ${status.left} are available.`,402);
    // Keep all active reservations, and a bounded idempotency history.
    const history=Object.entries(b.holds).filter(([,h])=>h.status==='settled');
    if(history.length>4000)history.slice(0,history.length-4000).forEach(([key])=>delete b.holds[key]);
    b.holds[id]={amount,month:monthKey(),scope,status:'reserved',at:new Date().toISOString()};
    return b.holds[id];
  });
}
export async function settleCredits(store,id,spent){
  return store.updateAccount(newAccount,a=>{
    const b=a.generationBudget,h=b?.holds[id];if(!h)throw new StoreError('Generation reservation not found',409);
    if(h.status==='settled')return h;
    if(!Number.isSafeInteger(spent)||spent<0||spent>h.amount)throw new StoreError('Invalid generation settlement');
    h.status='settled';h.spent=spent;h.refunded=h.amount-spent;h.finishedAt=new Date().toISOString();b.used[h.month]=(b.used[h.month]||0)+spent;return h;
  });
}
export async function recordGenerationAttempt(store,amount){
 return store.updateAccount(newAccount,a=>{
  const status=creditStatus(a),b=a.generationBudget||=( {used:{},holds:{}} ),month=monthKey();b.attempted||={};
  if((b.attempted[month]||0)+amount>status.attemptLimit)throw new StoreError('Generation is paused after repeated attempts. Contact Shoof before retrying; unused reserved credits are returned.',429);
  b.attempted[month]=(b.attempted[month]||0)+amount;
 });
}
export async function runGeneration(ctx,kind,body,run){
  const ws=String(body.ws||'');await ctx.store.getGenome(ws);
  const id=body.operationId||`gen_${randomBytes(12).toString('hex')}`,amount=GENERATION_RATES[kind];
  await reserveCredits(ctx.store,id,amount,`single:${ctx.key}:${ws}`);
  try{await recordGenerationAttempt(ctx.store,amount);const result=await run({...body,generationId:id});await settleCredits(ctx.store,id,amount);return result;}
  catch(error){await settleCredits(ctx.store,id,0);throw error;}
}
