// Confirmed product data, shared by the planner, persisted slots and browser.
// These are inputs to raster generation, never measurements inferred from pixels.
export const LISTING_PATTERN_DATE='2026-11-12';
export const LISTING_FRAME_PATTERNS={
 dimensions:{en:'Size at a glance',ar:'الأبعاد بنظرة واحدة',subEn:'Product photo + labelled measurement arrows',subAr:'صورة المنتج مع أسهم وأبعاد مسماة',categories:['home','tech','bags','general'],source:'https://www.amazon.ae/Anker-000mAh-Portable-Charger-MacBook/dp/B0DSZKKJTK',evidenceEn:'Observed: Anker gallery shows three dimensions and weight.',evidenceAr:'ملاحظة: معرض أنكر يعرض ثلاثة أبعاد والوزن.'},
 inbox:{en:'What arrives in the box',ar:'ماذا يصل داخل العلبة',subEn:'Included items + exact quantities',subAr:'العناصر المرفقة وكمياتها الفعلية',categories:['home','tech','fragrance','bags','food','general'],source:'https://www.noon.com/uae-en/product/Z92A74D6B96F10E7F7DF4Z/p/',evidenceEn:'Observed: Haidue shows the set contents and quantity per tray type.',evidenceAr:'ملاحظة: هايدو يعرض محتويات المجموعة وكمية كل نوع.'},
 compatibility:{en:'Will it work with mine?',ar:'هل يناسب جهازي؟',subEn:'Confirmed devices, connector & exclusions',subAr:'الأجهزة والمنفذ والاستثناءات المؤكدة',categories:['tech'],source:'https://www.amazon.ae/Anker-000mAh-Portable-Charger-MacBook/dp/B0DSZKKJTK',evidenceEn:'Observed: Anker separates connection types and multi-device use.',evidenceAr:'ملاحظة: أنكر يفصل أنواع التوصيل واستخدام عدة أجهزة.'},
 howto:{en:'Show how it works',ar:'وضّح طريقة الاستخدام',subEn:'A short sequence using your actual instructions',subAr:'تسلسل قصير من تعليماتك الفعلية',categories:['beauty','home','general'],source:'https://www.amazon.ae/CeraVe-Moistrising-hyaluronic-essential-fragrances/dp/B0DVLNFBNB',evidenceEn:'Observed: CeraVe demonstrates refilling, with EN/AR copy.',evidenceAr:'ملاحظة: سيرافي يوضح إعادة التعبئة بنص عربي وإنجليزي.'},
 ingredients:{en:'What’s inside',ar:'ما المكونات؟',subEn:'Confirmed ingredients, without invented effects',subAr:'مكونات مؤكدة دون اختراع تأثيرات',categories:['beauty','food'],source:'https://www.noon.com/uae-en/foaming-cleanser-for-normal-to-oily-skin-with-hyaluronic-acid-236ml/N47570894A/p/',evidenceEn:'Adaptation of CeraVe’s factual product-information gallery.',evidenceAr:'تكييف لنمط عرض معلومات المنتج في معرض سيرافي.'},
 capacity:{en:'Volume & pack size',ar:'الحجم وعدد العبوات',subEn:'One clear quantity, with the correct unit',subAr:'كمية واضحة بالوحدة الصحيحة',categories:['fragrance','beauty','food'],source:'https://www.noon.com/uae-en/khamrah-unisex-eau-de-parfum-by-lattafa-100ml/ZF23DE5EC51560ADE2D7EZ/p/',evidenceEn:'Suggested from pack/volume information; not a measured bottle dimension.',evidenceAr:'اقتراح من معلومات العبوة والحجم؛ وليس قياساً لأبعاد الزجاجة.'},
 notes:{en:'The scent profile',ar:'الملامح العطرية',subEn:'Confirmed scent notes, clearly grouped',subAr:'نوتات عطرية مؤكدة ومرتبة بوضوح',categories:['fragrance'],source:'https://www.noon.com/uae-en/khamrah-unisex-eau-de-parfum-by-lattafa-100ml/ZF23DE5EC51560ADE2D7EZ/p/',evidenceEn:'Observed: Lattafa gallery has a separate aromatic-accord frame.',evidenceAr:'ملاحظة: معرض لطافة يحتوي إطاراً منفصلاً للملامح العطرية.'},
 sizechart:{en:'A size guide that fits',ar:'دليل مقاسات مناسب',subEn:'Your real size table, with measurement definitions',subAr:'جدولك الفعلي مع تعريف القياسات',categories:['fashion','bags'],source:null,evidenceEn:'Category recommendation. Clothing/footwear tables were not visually sampled in this study.',evidenceAr:'اقتراح للفئة؛ لم تشمل المعاينة البصرية جداول الملابس والأحذية.'}
};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const own=(o,k)=>typeof k==='string'&&Object.hasOwn(o,k);
const choice=(v,list,fallback)=>{if(v==null||v==='')return fallback;if(!list.includes(v))throw Error('Choose a valid measurement unit or data type');return v;};
function text(v,max=100){if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f]/.test(v))throw Error('Use short, non-empty product details');return v.trim();}
export function listingNumeric(value,{integer=false,max=100000}={}){
 if(value==null||value==='')return null;
 const raw=typeof value==='number'?String(value):typeof value==='string'?value.trim().replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<='٩'?1632:1776))).replace(/[٫,]/g,'.'):'';
 if(!/^\d+(?:\.\d{1,4})?$/.test(raw))throw Error('Enter a positive measurement, without units or ranges');
 const n=Number(raw);if(!Number.isFinite(n)||n<=0||n>max||integer&&!Number.isInteger(n))throw Error('Enter a positive measurement within the allowed range');
 return n;
}
export function normaliseListingFrameData(kind,input){
 if(input==null)return null;
 if(!record(input)||!own(LISTING_FRAME_PATTERNS,kind)||kind==='notes')throw Error('Unknown structured frame data');
 const out={};
 if(kind==='dimensions'){
  out.unit=choice(input.unit,['cm','mm','in'],'cm');out.subject=choice(input.subject,['product','package'],'product');
  for(const key of ['height','width','depth','diameter','internalWidth','internalDepth','internalHeight','openingWidth','openingHeight']){const n=listingNumeric(input[key]);if(n!==null)out[key]=n;}
  if(!['height','width','depth','diameter','internalWidth','internalDepth','internalHeight','openingWidth','openingHeight'].some(k=>out[k]!=null))throw Error('Add at least one actual measurement');
 }else if(kind==='capacity'){
  out.amount=listingNumeric(input.amount);if(out.amount===null)throw Error('Add the actual volume or weight');out.unit=choice(input.unit,['ml','L','g','kg'],'ml');out.count=listingNumeric(input.count==null||input.count===''?1:input.count,{integer:true,max:1000});
 }else if(kind==='sizechart'){
  out.unit=choice(input.unit,['cm','in'],'cm');out.measure=choice(input.measure,['garment','body','foot'],'garment');
  if(!Array.isArray(input.rows)||!input.rows.length||input.rows.length>6)throw Error('Add one to six actual size rows');
  out.rows=input.rows.map(row=>{if(!record(row))throw Error('Invalid size row');const r={size:text(row.size,16)};for(const key of out.measure==='foot'?['footLength']:['chest','waist','length']){const n=listingNumeric(row[key],{max:1000});if(n!==null)r[key]=n;}if(Object.keys(r).length<2)throw Error('Each size row needs at least one actual measurement');return r;});
  if(new Set(out.rows.map(r=>r.size.toLowerCase())).size!==out.rows.length)throw Error('Use a distinct label for each size');
 }else if(kind==='inbox'){
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>6)throw Error('Add one to six included items');
  out.items=input.items.map(item=>{if(!record(item))throw Error('Invalid included item');return {name:text(item.name,80),quantity:listingNumeric(item.quantity==null||item.quantity===''?1:item.quantity,{integer:true,max:1000})};});
 }else if(kind==='howto'||kind==='ingredients'){
  const key=kind==='howto'?'steps':'items',max=kind==='howto'?4:6;
  if(!Array.isArray(input[key])||!input[key].length||input[key].length>max)throw Error('Add the actual steps or ingredients');out[key]=input[key].map(v=>text(v,120));
 }else if(kind==='compatibility'){
  for(const key of ['devices','excluded']){if(input[key]!=null&&(!Array.isArray(input[key])||input[key].length>(key==='devices'?4:2)))throw Error('Use up to four compatible devices and two exclusions');out[key]=(input[key]||[]).map(v=>text(v,90));}
  out.connector=input.connector?text(input.connector,60):'';if(!out.devices.length&&!out.connector)throw Error('Add a confirmed device or connector');
 }
 return out;
}
export function listingFrameFacts(kind,data){
 if(!data)return [];
 if(kind==='dimensions')return [data.subject+' dimensions: '+['height','width','depth','diameter'].filter(k=>data[k]!=null).map(k=>k+' '+data[k]+' '+data.unit).join('; '),...['internalWidth','internalDepth','internalHeight','openingWidth','openingHeight'].filter(k=>data[k]!=null).map(k=>k+': '+data[k]+' '+data.unit)].filter(s=>!s.endsWith(': '));
 if(kind==='capacity')return ['Net amount per item: '+data.amount+' '+data.unit,'Pack contains '+data.count+' item(s)'];
 if(kind==='sizechart')return [data.measure+' measurements in '+data.unit,...data.rows.map(r=>r.size+': '+['chest','waist','length','footLength'].filter(k=>r[k]!=null).map(k=>k+' '+r[k]).join('; '))];
 if(kind==='inbox')return data.items.map(i=>i.quantity+' × '+i.name);
 if(kind==='howto')return data.steps.map((s,i)=>(i+1)+'. '+s);
 if(kind==='ingredients')return data.items.map(s=>'Confirmed ingredient: '+s);
 if(kind==='compatibility')return [...(data.connector?['Connector: '+data.connector]:[]),...data.devices.map(s=>'Compatible: '+s),...data.excluded.map(s=>'Not compatible: '+s)];
 return [];
}
export function listingFrameInstruction(kind,data){
 if(!data)return '';
 const instructions={dimensions:'Render a photographic measurement diagram. Use arrows only for the supplied dimensions, with the exact values and units. Clearly label product versus package dimensions. Do not estimate missing values or convert units.',capacity:'Render a volume / net-weight and pack-count infographic using exactly the supplied amount, unit and item count. Net volume is not a physical dimension; do not infer bottle size or servings.',sizechart:'Render a legible size table with the exact supplied rows and column values. Label whether these are garment or body measurements and state the unit. Do not add sizes, tolerance, fit advice or conversions.',inbox:'Show the actual included items with their exact quantities. Keep excluded props out. Do not invent the appearance of an item absent from the source; use a factual text list for unseen items.',howto:'Use numbered steps in supplied order. Never invent application, dosage, safety or health instructions. Do not invent unseen product mechanisms.',ingredients:'Show a concise list of the supplied confirmed ingredients. Do not imply medical efficacy, concentration, purity or certification. Do not invent texture or before/after results.',compatibility:'Show the exact confirmed compatible devices, connector and exclusions. Keep compatibility limitations visible; never infer additional supported devices or charging performance.'};
 return instructions[kind]+'\nVerified structured data for this frame: '+JSON.stringify(data);
}
