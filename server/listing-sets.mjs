import { CONTENT_ROLES } from "./content-plan.mjs";
import { DIRECTOR_LOOKS } from "./creative-direction.mjs";
import { normaliseListingFrameData, listingFrameFacts } from "./listing-frame-data.mjs";

// Editorial presets, not marketplace acceptance certificates. Keep source dates visible.
export const LISTING_POLICY_DATE = '2026-11-12';
export const LISTING_DESTINATIONS = {
 amazon:{name:'Amazon.ae',copy:'captions',aspect:'1:1',source:'https://sellercentral.amazon.ae/help/hub/reference/external/G1881',support:'https://m.media-amazon.com/images/G/39/help/HardlinesConsumables_Styleguide_EN_AE._CB1198675309_.pdf',ruleEn:'Main: product on pure white, no added text or props. Use the gallery for details and context. Check your category in Seller Central.',ruleAr:'الرئيسية: المنتج على أبيض صافٍ دون نص مضاف أو عناصر تزيين. استخدم المعرض للتفاصيل والسياق، وراجع فئتك في مركز البائع.',prompt:'Amazon.ae listing gallery. MAIN: pure white RGB 255,255,255; entire actual product, no added text, graphics, borders, watermarks or misleading accessories. Category-specific exceptions require seller review. Gallery: faithful details and context; no prices, rankings, promotions or unsupported claims.'},
 noon:{name:'noon',copy:'photo',aspect:'1:1',source:'https://helpcenter.noon.partners/en/category/product-listing/image-requirements-and-rejection-reasons-for-the-seller-sku',ruleEn:'Main: a full front view on white; fashion may use light grey. Gallery starts photo-led. Confirm category rules before adding captions. Final files need JPEG.',ruleAr:'الرئيسية: منظر أمامي كامل على أبيض، ويمكن الرمادي الفاتح للأزياء. يبدأ المعرض بالصور. راجع قواعد الفئة قبل إضافة النصوص. الملفات النهائية بصيغة JPEG.',prompt:'noon seller SKU gallery. MAIN: full front view on white, light shadows, no lifestyle scene, added copy, graphics or collage. Fashion may use light grey; use white for this set. Gallery: accurate product photos, no seller watermark, pricing, warranty claims or misleading accessories. Captions, if requested, must be brief factual annotations subject to category QC; avoid decorative text. Do not promise platform acceptance.'},
 salla:{name:'Salla',copy:'captions',aspect:'4:5',source:'https://help.salla.sa/article/إضافة-صور-وفيديوهات-المنتج/o67hdm4qs3h30gubvyfk7v9y',ruleEn:'A branded product-page gallery. Match the image ratio to your store theme and preview the crop on mobile.',ruleAr:'معرض لصفحة المنتج بهوية علامتك. طابق نسبة الصور مع قالب المتجر وراجع القص على الجوال.',prompt:'Salla own-store product gallery. Use a coherent brand direction with generous mobile-safe margins. Image ratio is our editorial choice, not a universal platform requirement. Preserve the actual product. Do not invent discounts, testimonials, certifications or results.'},
 zid:{name:'Zid',copy:'captions',aspect:'4:5',source:'https://helpdesk.zid.sa/ar/products/product-details',ruleEn:'A branded product-page gallery. Choose your main photo, keep the sequence clear and check your theme’s mobile crop.',ruleAr:'معرض لصفحة المنتج بهوية علامتك. اختر الصورة الرئيسية ورتب الصور بوضوح وراجع قص قالب المتجر على الجوال.',prompt:'Zid own-store product gallery. Use a coherent brand direction with generous mobile-safe margins. Image ratio is our editorial choice, not a universal platform requirement. Preserve the actual product. Do not invent discounts, testimonials, certifications or results.'}
};
export const LISTING_CATEGORIES = {
 fragrance:{en:'Fragrance',ar:'العطور',glyph:'◈',row:1,questionEn:'What does it feel like?',questionAr:'ما الإحساس الذي يقدمه؟',roles:['main','notes','details','lifestyle'],detailEn:'Bottle, cap & finish',detailAr:'الزجاجة والغطاء والتشطيب',direction:'Emphasise the actual bottle, cap and finish. Scent notes must come only from supplied facts; with none, use a neutral bottle composition without ingredient props. Lifestyle: restrained dressing-table or gifting context; no invented gift packaging.'},
 beauty:{en:'Beauty & care',ar:'الجمال والعناية',glyph:'✳',row:3,questionEn:'What am I putting on my skin?',questionAr:'ماذا سأضع على بشرتي؟',roles:['main','benefit','details','lifestyle'],detailEn:'Packaging, up close',detailAr:'العبوة عن قرب',direction:'Show actual packaging and label. Do not invent cosmetic texture, ingredients, medical claims, before-and-after results or usage instructions. Lifestyle: a calm vanity scene; keep packaging authentic.'},
 fashion:{en:'Fashion',ar:'الأزياء',glyph:'⌁',row:2,questionEn:'How will it look and fit?',questionAr:'كيف يبدو وكيف يناسبني؟',roles:['main','details','benefit','lifestyle'],detailEn:'Fabric & construction',detailAr:'القماش وتفاصيل الصنع',direction:'Preserve garment colour, cut, fabric appearance and closures visible in the source. Do not invent unseen garment details, size charts or model fit. Use respectful UAE styling. Main: preserve a supplied adult model if appropriate; never invent a new model or pose from a flat garment. New model try-on is a separate reviewed workflow.'},
 home:{en:'Home & living',ar:'المنزل',glyph:'⌂',row:0,questionEn:'Will it belong in my space?',questionAr:'هل يناسب مساحتي؟',roles:['main','details','benefit','lifestyle'],detailEn:'Finish & craftsmanship',detailAr:'التشطيب وتفاصيل الصنع',direction:'Preserve the product form and visible finish. Lifestyle: a believable contemporary UAE home. Do not infer dimensions, capacity, materials or care instructions from a photograph. No misleading scale comparisons.'},
 tech:{en:'Tech & accessories',ar:'التقنية والإكسسوارات',glyph:'⊞',row:0,questionEn:'Will it work for me?',questionAr:'هل يناسب احتياجي؟',roles:['main','benefit','details','lifestyle'],detailEn:'Ports & visible details',detailAr:'المنافذ والتفاصيل الظاهرة',direction:'Show only visible ports, controls and included components confirmed by the user. Never invent battery life, compatibility, certifications, specifications or accessories. Do not create exploded internals.'},
 bags:{en:'Bags & shoes',ar:'الحقائب والأحذية',glyph:'◇',row:2,questionEn:'What makes the details different?',questionAr:'ما الذي يميز التفاصيل؟',roles:['main','details','benefit','lifestyle'],detailEn:'Stitching & hardware',detailAr:'الخياطة والتفاصيل المعدنية',direction:'Preserve visible stitching, hardware, sole and silhouette. No invented compartments, leather claims or dimensions. Do not add an unsupplied model; a new model try-on needs the separate reviewed workflow.'},
 food:{en:'Food & beverages',ar:'الأغذية والمشروبات',glyph:'◒',row:3,questionEn:'What exactly am I buying?',questionAr:'ماذا أشتري بالضبط؟',roles:['main','benefit','details','lifestyle'],detailEn:'The label, clearly',detailAr:'الملصق بوضوح',direction:'Keep the real label, pack quantity and variant accurate. Do not invent ingredients, nutrition, allergens, halal or organic marks, health claims or serving instructions. Any serving scene must not imply unconfirmed ingredients or contents.'},
 general:{en:'Other products',ar:'منتجات أخرى',glyph:'✦',row:0,questionEn:'Why is this the right choice?',questionAr:'لماذا هو الخيار المناسب؟',roles:['main','benefit','details','lifestyle'],detailEn:'A closer look',detailAr:'نظرة أقرب',direction:'Build a clear product introduction, visible details and believable context. Do not infer unverified features, materials, specifications or included items.'}
};
export const LISTING_EXTRA_ROLES = ['dimensions','sizechart','howto','inbox','notes','capacity','compatibility','ingredients'];
export const LISTING_FACT_ROLES = ['dimensions','sizechart','howto','inbox','capacity','compatibility','ingredients'];
// A sequence is an editorial starting point. It never supplies product facts.
export const LISTING_BUYER_QUESTIONS = {
 main:['What exactly am I buying?','ماذا أشتري بالضبط؟'], benefit:['Why choose this product?','لماذا أختار هذا المنتج؟'],
 details:['What does the finish look like?','كيف تبدو التفاصيل عن قرب؟'], lifestyle:['Where will I use it?','أين سأستخدمه؟'],
 dimensions:['Will it fit my space?','هل يناسب مساحتي؟'], sizechart:['Which size should I choose?','أي مقاس أختار؟'],
 inbox:['What is actually included?','ما المحتويات المرفقة فعلياً؟'], howto:['How do I use it?','كيف أستخدمه؟'],
 notes:['What is the scent profile?','ما الملامح العطرية؟'], capacity:['How much do I get?','ما الكمية التي أحصل عليها؟'],
 compatibility:['Will it work with my device?','هل يعمل مع جهازي؟'], ingredients:['What is it made with?','ما مكوناته؟']
};
export function listingSequences(category='fragrance',destination='amazon'){
 if(!Object.hasOwn(LISTING_CATEGORIES,category)||!Object.hasOwn(LISTING_DESTINATIONS,destination))throw Error('Choose a listing set');
 const answers={fragrance:['notes','capacity'],beauty:['ingredients','howto'],fashion:['sizechart','inbox'],home:['dimensions','inbox'],tech:['compatibility','inbox'],bags:['dimensions','inbox'],food:['ingredients','capacity'],general:['dimensions','inbox']}[category];
 const essentials=LISTING_CATEGORIES[category].roles.slice();
 return [
  {id:'essentials',en:'The essential story',ar:'القصة الأساسية',subEn:'Introduce it. Show the detail. Put it in context.',subAr:'عرّف بالمنتج، وأظهر تفاصيله وسياق استخدامه.',frames:essentials,copyMode:LISTING_DESTINATIONS[destination].copy},
  {id:'answers',en:'Remove the buying doubts',ar:'أجب عن أسئلة الشراء',subEn:'A fuller gallery with the facts buyers need to decide.',subAr:'معرض أشمل بالحقائق التي تساعد المشتري على القرار.',frames:[...new Set(['main',...answers,...essentials.filter(k=>k!=='main')])],copyMode:'captions'},
  {id:'visual',en:'Let the product speak',ar:'دع المنتج يتحدث',subEn:'Three clean photographs. No added copy.',subAr:'ثلاث صور واضحة دون نص مضاف.',frames:['main','details','lifestyle'],copyMode:'photo'}
 ];
}
export function listingFrameReadiness(kind,input={}){
 const lines=input.facts?.[kind]||[];let data;
 try{data=normaliseListingFrameData(kind,input.frameData?.[kind]);}catch(e){return {status:'needs_data',message:e.message};}
 if(!Array.isArray(lines)||lines.length>2||lines.some(f=>typeof f!=='string'||!f.trim()||f.length>150))return {status:'needs_data',message:'Use up to two facts per frame, at most 150 characters each'};
 if(LISTING_FACT_ROLES.includes(kind)&&!lines.length&&!data)return {status:'needs_data',message:'Add actual product data'};
 if((lines.length||data)&&!input.factsConfirmed)return {status:'needs_confirmation',message:'Confirm your product facts before continuing'};
 return {status:'ready',message:''};
}
const own=(o,k)=>typeof k==='string'&&Object.hasOwn(o,k);
export function listingOptions(category='fragrance',template=null){
 if(!own(LISTING_CATEGORIES,category))throw Error('Choose a product category');
 const allowed=new Set(['main','benefit','details','lifestyle',...LISTING_EXTRA_ROLES]);
 const original=template?template.slots.filter(s=>allowed.has(s.kind)):LISTING_CATEGORIES[category].roles.map(kind=>({kind}));
 const slots=[{kind:'main'},...original.filter(s=>s.kind!=='main')].filter((s,i,a)=>a.findIndex(x=>x.kind===s.kind)===i);
 for(const kind of [...LISTING_CATEGORIES[category].roles,...LISTING_EXTRA_ROLES])if(!slots.some(s=>s.kind===kind))slots.push({kind});
 return slots;
}
export function buildListingSet(input,{template=null,language='both',note=''}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Choose a listing set');
 const destination=input.destination||'amazon',category=input.category||'fragrance',look=input.look||'brand';
 if(!own(LISTING_DESTINATIONS,destination)||!own(LISTING_CATEGORIES,category)||!own(DIRECTOR_LOOKS,look)||!['en','ar','both','bilingual'].includes(language))throw Error('Unknown listing set direction');
 if(typeof note!=='string'||note.length>1200)throw Error('Keep the extra direction under 1200 characters');
 const profile=LISTING_DESTINATIONS[destination],copyMode=input.copyMode||profile.copy,aspect=input.aspect||profile.aspect;
 if(!['photo','captions'].includes(copyMode)||!['1:1','4:5'].includes(aspect))throw Error('Choose a gallery format');
 if(['amazon','noon'].includes(destination)&&aspect!=='1:1')throw Error('This marketplace set uses a square gallery');
 const options=listingOptions(category,template),frames=input.frames||(template?['main',...template.slots.map(s=>s.kind)].filter((k,i,a)=>a.indexOf(k)===i&&options.some(o=>o.kind===k)).slice(0,8):LISTING_CATEGORIES[category].roles.slice());
 if(!Array.isArray(frames)||!frames.length||frames.length>8||frames[0]!=='main'||new Set(frames).size!==frames.length||frames.some(k=>!options.some(o=>o.kind===k)))throw Error('Keep the main photo first and choose up to eight distinct frames');
 const supplied=input.facts||{};
 if(!supplied||typeof supplied!=='object'||Array.isArray(supplied)||Object.keys(supplied).some(k=>!frames.includes(k)))throw Error('Facts must belong to a selected frame');
 const data=input.frameData||{};
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!frames.includes(k)))throw Error('Structured data must belong to a selected frame');
 const facts={},all=[],free=[],frameData={};
 for(const kind of frames){const lines=supplied[kind]||[];if(!Array.isArray(lines)||lines.length>2||lines.some(f=>typeof f!=='string'||!f.trim()||f.length>150))throw Error('Use up to two facts per frame, at most 150 characters each');facts[kind]=lines.map(f=>f.trim());free.push(...facts[kind]);const structured=normaliseListingFrameData(kind,data[kind]);if(structured)frameData[kind]=structured;all.push(...facts[kind],...listingFrameFacts(kind,structured));}
 if(free.length>12)throw Error('Use up to twelve confirmed facts in a set');
 if(all.length>40)throw Error('Keep the set to forty product data entries');
 if(all.length&&input.factsConfirmed!==true)throw Error('Confirm your product facts before continuing');
 for(const kind of frames)if(LISTING_FACT_ROLES.includes(kind)&&!facts[kind].length&&!frameData[kind])throw Error('Add the actual '+CONTENT_ROLES[kind].en.toLowerCase()+' facts, or remove that frame');
 if(copyMode==='photo'&&frames.some(k=>LISTING_FACT_ROLES.includes(k)))throw Error('Choose fact captions for sizing, instructions or box contents');
 const slots=frames.map((kind,index)=>{
  const s=options.find(o=>o.kind===kind),shared=kind==='main'||kind==='lifestyle'||copyMode==='photo';
  return {kind,name:kind==='details'?LISTING_CATEGORIES[category].detailEn:CONTENT_ROLES[kind].en,rationale:('Gallery '+(index+1)+'/'+frames.length+'. Buyer question: '+LISTING_BUYER_QUESTIONS[kind][0]+' '+(kind==='main'?'Clean product photo only.':kind==='details'?LISTING_CATEGORIES[category].detailEn+'.':'')+' Use only these frame facts: '+(facts[kind].join('; ')||(frameData[kind]?'see the verified structured data.':'none; neutral visual, no feature claims.'))+' '+(shared?'No added overlay text.':'Short factual copy only.')).trim(),...(frameData[kind]?{frameData:frameData[kind]}:{}),languages:shared?['none']:language==='both'?['en','ar']:[language],aspect:kind==='main'?'1:1':aspect,layout:kind==='main'?'clean':s.layout||(['dimensions','sizechart'].includes(kind)?'split':kind==='howto'?'steps':'hero'),style:kind==='main'?{background:'#ffffff',textDensity:'none',productPlacement:'center'}:{...s.style,tone:look==='daylight'?'natural':look==='studio'?'minimal':s.style?.tone||'premium',textDensity:shared?'none':'low'}};
 });
 const brief=[profile.prompt,LISTING_CATEGORIES[category].direction,DIRECTOR_LOOKS[look].prompt,language==='bilingual'?'Render English and Arabic together in each text frame.':'EN and AR, when both selected, are separate gallery versions.','Preserve the exact product, variant, label and logo. Only use confirmed facts assigned to the frame; no invented numbers, certificates, testimonials or sales claims. Arabic copy: natural Modern Standard Arabic for UAE/GCC shoppers, correct RTL, keep brand names/model codes intact. Follow the requested language mode. Any main-image rule overrides artistic direction.',note.trim()?'Extra user direction: '+note.trim():''].filter(Boolean).join('\n');
 const spec={destination,category,look,copyMode,aspect,frames:[...frames],facts,frameData,factsConfirmed:all.length>0,language,templateId:template?.id||'',policyDate:LISTING_POLICY_DATE};
 return {spec,direction:{goal:'listing',look,category,frames:[...frames],templateId:template?.id||''},slots,facts:all,brief,imageVariants:slots.reduce((n,s)=>n+s.languages.length,0),manualStages:0};
}
