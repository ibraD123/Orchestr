import { CONTENT_ROLES } from "./content-plan.mjs";
// Shared by the browser and API. The guide is a composition proposal, not photo recognition.
export const DIRECTOR_GOALS={
 listing:{en:'A product page',ar:'صفحة منتج',shortEn:'A complete listing story',shortAr:'قصة متكاملة للمنتج',prompt:'Create a coherent product-page image set. Introduce the product clearly, answer buyer questions, then show a believable context.',roles:['main','benefit','details','lifestyle']},
 campaign:{en:'A social story',ar:'قصة للتواصل',shortEn:'A launch worth a look',shortAr:'إطلاق يستحق الانتباه',prompt:'Create a cohesive vertical social content story with a strong product focus and generous room for short copy. Do not invent offers or claims.',roles:['benefit','details','lifestyle']},
 single:{en:'One standout image',ar:'صورة لافتة واحدة',shortEn:'One focused creative',shortAr:'تصميم واحد مركز',prompt:'Create one refined product composition. Keep the product faithful and communicate one clear idea.',roles:['other']}
};
export const DIRECTOR_LOOKS={
 brand:{en:'In your brand’s world',ar:'في عالم علامتك',subEn:'Saved colours & visual direction',subAr:'الألوان والاتجاه البصري المحفوظ',prompt:'Follow the saved Brand DNA visual direction and palette. Use consistent lighting and composition across this set.'},
 daylight:{en:'Soft daylight',ar:'ضوء نهاري ناعم',subEn:'Natural light · calm shadows',subAr:'إضاءة طبيعية · ظلال هادئة',prompt:'Use soft natural window light, calm shadows and restrained natural surfaces. Keep the saved brand palette and the product colours accurate.'},
 studio:{en:'Crisp studio',ar:'استوديو واضح',subEn:'Clean light · editorial space',subAr:'إضاءة واضحة · مساحة أنيقة',prompt:'Use crisp diffused studio lighting, clean editorial composition and generous negative space. Keep the saved brand palette and the product colours accurate.'}
};
export const DIRECTOR_CATEGORIES={general:['Everyday product','منتج عام'],fragrance:['Fragrance','العطور'],beauty:['Beauty','الجمال'],fashion:['Fashion','الأزياء'],home:['Home','المنزل'],food:['Food','الأغذية']};
export const DIRECTOR_EXTRA_ROLES=['notes','dimensions','sizechart','howto','inbox'];
export function directorRole(kind){
 const base=CONTENT_ROLES[kind]||{en:kind==='other'?'Creative image':kind,ar:kind==='other'?'صورة إبداعية':kind,prompt:'Create a faithful product composition with no invented claims.',whyEn:'Keep one clear idea in focus.',whyAr:'ركّز على فكرة واضحة واحدة.'};
 const stories={main:['Meet the product','تعرّف على المنتج'],benefit:['A reason to choose','سبب للاختيار'],details:['A closer look','نظرة أقرب'],lifestyle:['Picture it in your life','تخيّله في حياتك'],notes:['Tell the scent story','قدّم قصة العطر'],dimensions:['Put size in perspective','وضّح الحجم'],sizechart:['Find the right fit','اختر المقاس المناسب'],howto:['Show how it works','وضّح طريقة الاستخدام'],inbox:['What’s in the box','ماذا داخل العلبة'],other:['Make it memorable','اجعله مميزاً']};
 return {...base,titleEn:stories[kind]?.[0]||base.en,titleAr:stories[kind]?.[1]||base.ar,needsFacts:['dimensions','sizechart'].includes(kind),manual:['tryon','model','video','runway'].includes(kind)};
}
export function directorOptions({goal='listing',template=null}={}){
 if(!Object.hasOwn(DIRECTOR_GOALS,goal))throw Error('Choose a content goal');
 const original=template?.slots||DIRECTOR_GOALS[goal].roles.map(kind=>({kind}));
 const slots=original.map((s,i)=>({...s,key:template?'template-'+i:'role-'+s.kind}));
 for(const kind of DIRECTOR_EXTRA_ROLES)if(!slots.some(s=>s.kind===kind))slots.push({kind,key:'extra-'+kind});
 return slots;
}
export function directorSlots(options,keys,language,goal,look){
 return keys.map(key=>{
  const input=options.find(o=>o.key===key);if(!input)throw Error('The frame plan changed; choose the frames again');
  const s={...input},role=directorRole(s.kind),shared=['main','lifestyle','model','tryon','video','runway'].includes(s.kind)||s.languages?.every(l=>l==='none');
  const languages=shared?['none']:language==='both'?['en','ar']:[language];
  return {kind:s.kind,name:s.name||role.en,rationale:role.whyEn,languages,aspect:s.kind==='main'?'1:1':goal==='campaign'?'9:16':s.aspect||'4:5',layout:s.kind==='main'?'clean':s.layout||'hero',style:s.kind==='main'?{...s.style,background:'#ffffff',textDensity:'none'}:{...s.style,tone:look==='daylight'?'natural':look==='studio'?'minimal':'premium'}};
 });
}
export function buildCreativeDirection(input,{template=null,language='both',note=''}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Choose a creative direction');
 const goal=input.goal||'listing',look=input.look||'brand',category=input.category||'general';
 if(!Object.hasOwn(DIRECTOR_GOALS,goal)||!Object.hasOwn(DIRECTOR_LOOKS,look)||!Object.hasOwn(DIRECTOR_CATEGORIES,category)||!['en','ar','both'].includes(language))throw Error('Unknown creative direction');
 if(typeof note!=='string'||note.length>2500)throw Error('Keep the optional note under 2500 characters');
 const options=directorOptions({goal,template}),frames=input.frames||options.slice(0,template?.slots.length||DIRECTOR_GOALS[goal].roles.length).map(o=>o.key);
 if(!Array.isArray(frames)||!frames.length||frames.length>8||new Set(frames).size!==frames.length||frames.some(k=>typeof k!=='string'))throw Error('Choose 1–8 different frames');
 const facts=input.facts||[];
 if(!Array.isArray(facts)||facts.length>12||facts.some(f=>typeof f!=='string'||!f.trim()||f.length>150))throw Error('Use up to 12 confirmed facts, at most 150 characters per fact');
 if(facts.length&&input.factsConfirmed!==true)throw Error('Confirm your product facts before saving the plan');
 const slots=directorSlots(options,frames,language,goal,look);
 if(slots.some(s=>directorRole(s.kind).needsFacts)&&!facts.length)throw Error('Add confirmed measurements or remove the sizing frame');
 const brief=[DIRECTOR_GOALS[goal].prompt,DIRECTOR_LOOKS[look].prompt,`Product category selected by user: ${category}.`, 'Use only confirmed product facts. With no confirmed benefit, introduce the product neutrally. Do not infer features, ingredients, origin, measurements or certifications from the reference photo.',note.trim()?'Additional direction from the user:\n'+note.trim():''].filter(Boolean).join('\n');
 return {direction:{goal,look,category,templateId:template?.id||'',frames:[...frames]},slots,facts:facts.map(f=>f.trim()),brief,imageVariants:slots.filter(s=>!directorRole(s.kind).manual).reduce((n,s)=>n+s.languages.length,0),manualStages:slots.filter(s=>directorRole(s.kind).manual).length};
}
