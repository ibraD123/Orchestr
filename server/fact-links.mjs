// Track the source data supplied to an image, not a claim that OCR verified its pixels.
import { createHash } from 'node:crypto';
import { normaliseListingFrameData, listingFrameFacts } from './listing-frame-data.mjs';
import { buildListingSet } from './listing-sets.mjs';
import { StoreError } from './store.mjs';
export const factHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const copy=x=>structuredClone(x), fail=(m,s=400)=>{throw new StoreError(m,s);};
export const factGroup=p=>p.catalogProductId||p.id;
const LABELS={height:'Height',width:'Width',depth:'Depth',diameter:'Diameter',internalWidth:'Inner width',internalDepth:'Inner depth',internalHeight:'Inner height',openingWidth:'Opening width',openingHeight:'Opening height',amount:'Net amount',count:'Pack count',connector:'Connector',devices:'Compatible devices',excluded:'Compatibility exclusions',steps:'Usage steps',items:'Contents / ingredients',rows:'Size chart',unit:'Unit',subject:'Product / package',measure:'Garment / body / foot',facts:'Confirmed facts'};
const FIELDS={dimensions:['height','width','depth','diameter','internalWidth','internalDepth','internalHeight','openingWidth','openingHeight'],capacity:['amount','count'],compatibility:['connector','devices','excluded'],howto:['steps'],ingredients:['items'],inbox:['items'],sizechart:['rows']};
export function slotFacts(p,s){
 const out=[],data=s.frameData||{};
 for(const key of Object.keys(data).sort())if(data[key]!==''&&data[key]!=null)out.push({key:s.kind+'.'+key,value:copy(data[key]),label:LABELS[key]||key,unit:data.unit||''});
 const free=p.listingSet?.facts?.[s.kind];
 if(free?.length)out.push({key:s.kind+'.facts',value:copy(free),label:'Confirmed '+s.kind+' facts',unit:''});
 if(!p.listingSet&&!s.frameData&&p.product.facts?.length)out.push({key:'shared.facts',value:copy(p.product.facts),label:'Project facts (shared)',unit:''});
 return out;
}
export function projectFactFields(p){return p.slots.flatMap(s=>{
 const a=s.frameData||{},fields=(FIELDS[s.kind]||[]).map(field=>({slotId:s.id,key:s.kind+'.'+field,label:(s.name||s.kind)+' · '+LABELS[field],unit:a.unit|| (s.kind==='dimensions'?'cm':''),type:['items','rows'].includes(field)?(['inbox','sizechart'].includes(s.kind)?'json':'lines'):['devices','excluded','steps'].includes(field)?'lines':field==='connector'?'text':'number',value:copy(a[field]??null)}));
 if(p.listingSet)fields.push({slotId:s.id,key:s.kind+'.facts',label:(s.name||s.kind)+' · Confirmed facts',unit:'',type:'lines',value:copy(p.listingSet.facts[s.kind]||[])});
 return fields;
 });}
export function ensureFactBook(state){
 state.factBook||={};
 for(const p of state.projects||[]){const group=factGroup(p);if(!Object.hasOwn(state.factBook,group))Object.defineProperty(state.factBook,group,{value:{},enumerable:true,writable:true,configurable:true});
  for(const s of p.slots)for(const e of slotFacts(p,s))if(!Object.hasOwn(state.factBook[group],e.key))state.factBook[group][e.key]={...e,version:1,at:p.createdAt};
 }
 return state.factBook;
}
export function expectedFacts(state,p,entries){const book=state.factBook?.[factGroup(p)]||{};return entries.map(e=>book[e.key]?{...e,value:copy(book[e.key].value)}:copy(e));}
export function factDiff(state,p,entries){const desired=expectedFacts(state,p,entries);return entries.filter((e,i)=>factHash(e.value)!==factHash(desired[i].value)).map(e=>({key:e.key,from:copy(e.value),to:copy(state.factBook[factGroup(p)][e.key].value)}));}
export function decorateFacts(state,value){
 const p=copy(value);p.factFields=projectFactFields(p);if(!state.factBook?.[factGroup(p)])return p;
 for(const s of p.slots){const entries=slotFacts(p,s),expected=expectedFacts(state,p,entries);s.factState={entries,current:expected,fingerprint:factHash(entries),expectedFingerprint:factHash(expected),planStale:factDiff(state,p,entries).length>0};
  for(const r of s.revisions){const snapshot=r.factSnapshot||entries;r.factIssues=factDiff(state,p,snapshot);r.factStale=r.factIssues.length>0;r.factTracked=!!r.factSnapshot;}
  s.factState.staleLanguages=s.languages.filter(l=>s.revisions.find(r=>r.id===s.selected[l])?.factStale);
 }
 return p;
}
export function parseFactAnswer(field,answer){
 if(typeof answer!=='string'||!answer.trim()||answer.length>2000)fail('Add the requested product value');
 if(field.type==='lines')return answer.split('\n').map(v=>v.trim()).filter(Boolean);
 if(field.type==='json'){try{return JSON.parse(answer);}catch{fail('Use the requested JSON rows, or ask the agency for help');}}
 if(field.type==='number'){
  let v=answer.trim();const suffix={cm:['cm','سم'],mm:['mm','مم'],in:['in','inch'],ml:['ml','مل'],L:['L','لتر'],g:['g','غ'],kg:['kg','كغ']}[field.unit]||[];
  for(const unit of suffix)if(v.endsWith(unit)){v=v.slice(0,-unit.length).trim();break;}
  return v;
 }
 return answer.trim();
}
export function replaceFactPlan(p,key,value){
 const [kind,field]=key.split('.');let touched=false;
 if(key==='shared.facts'){
  if(p.listingSet||!p.slots.some(s=>!s.frameData))return false;
  if(!Array.isArray(value)||value.length>50||value.some(v=>typeof v!=='string'||!v.trim()||v.length>500))fail('Use up to fifty short facts');p.product.facts=copy(value);return true;
 }
 for(const s of p.slots.filter(s=>s.kind===kind)){
  if(field==='facts'){
   if(!p.listingSet||!Array.isArray(value)||value.length>2||value.some(v=>typeof v!=='string'||!v.trim()||v.length>150))fail('Use up to two facts, each under 150 characters');
   p.listingSet.facts[kind]=copy(value);touched=true;
  }else{
   const allowed=[...(FIELDS[kind]||[]),'unit','subject','measure'];if(!allowed.includes(field))fail('Choose an editable product field');
   const defaults=kind==='dimensions'?{unit:'cm',subject:'product'}:kind==='capacity'?{unit:'ml',count:1}:kind==='sizechart'?{unit:'cm',measure:'garment'}:{};
   try{s.frameData=normaliseListingFrameData(kind,{...defaults,...s.frameData,[field]:value});}catch(e){fail(e.message);}
   if(p.listingSet){p.listingSet.frameData||={};p.listingSet.frameData[kind]=copy(s.frameData);}touched=true;
  }
 }
 if(touched&&p.listingSet){
  p.listingSet.factsConfirmed=true;
  const built=buildListingSet(p.listingSet,{language:p.listingSet.language});
  for(const s of p.slots){const next=built.slots.find(n=>n.kind===s.kind);if(next)s.rationale=next.rationale;}
  p.product.facts=built.facts;
 }
 return touched;
}
export function assertCurrentRevision(p,slot,revision){if(revision?.factStale)fail('Product facts changed. Create and review an updated version before approving or delivering this file.',409);}
export function freezeLegacyFacts(p){
 const all=p.slots.flatMap(s=>slotFacts(p,s)).filter((e,i,a)=>a.findIndex(x=>x.key===e.key)===i);
 for(const s of p.slots)for(const r of s.revisions)if(!r.factSnapshot)r.factSnapshot=copy(all); // Older generators received project-wide facts: conservatively cover all slots.
}
export function factInstruction(p,s){return [...(p.listingSet?.facts?.[s.kind]||[]),...listingFrameFacts(s.kind,s.frameData),...(!p.listingSet&&!s.frameData?p.product.facts:[])].join('; ');}

export function inheritKnownFacts(state,p){
 const book=state.factBook?.[factGroup(p)]||{};
 for(const s of p.slots){if(s.frameData||!FIELDS[s.kind])continue;const data={};for(const entry of Object.values(book))if(entry.key.startsWith(s.kind+'.')&&!entry.key.endsWith('.facts'))data[entry.key.split('.')[1]]=copy(entry.value);if(!Object.keys(data).length)continue;try{s.frameData=normaliseListingFrameData(s.kind,data);}catch{/* Incomplete known facts never become invented defaults. */}}
}
