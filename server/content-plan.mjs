// Deterministic, editable production plans: no paid model is needed to propose a set.
import { listingFrameInstruction } from "./listing-frame-data.mjs";
export const CONTENT_ROLES={
 capacity:{en:'Volume & pack size',ar:'الحجم وعدد العبوات',whyEn:'Distinguish net volume or weight from physical dimensions.',whyAr:'ميّز الحجم أو الوزن الصافي عن الأبعاد الفعلية.',prompt:'Show the confirmed net volume or weight and exact pack count. Do not infer physical dimensions, number of servings or usage duration.'},
 compatibility:{en:'Compatibility',ar:'التوافق',whyEn:'Show confirmed devices, connectors and important exclusions.',whyAr:'أظهر الأجهزة والمنافذ المؤكدة والاستثناءات المهمة.',prompt:'Present only the confirmed compatibility list and connector. Make exclusions clear. Never invent support for other devices or performance claims.'},
 ingredients:{en:'Confirmed ingredients',ar:'المكونات المؤكدة',whyEn:'Explain what is inside using supplied ingredients only.',whyAr:'وضّح المكونات باستخدام البيانات المقدمة فقط.',prompt:'Create a concise ingredient information frame using confirmed ingredients only. Do not invent concentration, origin, certification or health effects.'},
 howto:{en:'How to use',ar:'طريقة الاستخدام',whyEn:'Explain only the usage steps you have confirmed.',whyAr:'اشرح خطوات الاستخدام المؤكدة فقط.',prompt:'Show only user-confirmed usage instructions. Without confirmed usage steps, create a neutral product detail image. Never invent use or safety instructions.'},
 inbox:{en:'In the box',ar:'محتويات العلبة',whyEn:'Show only the items actually included.',whyAr:'أظهر العناصر الموجودة فعلياً فقط.',prompt:'Show only the confirmed box contents. Without a confirmed contents list, show the product alone. Never invent included accessories.'},
 main:{en:'Main photo',ar:'الصورة الرئيسية',whyEn:'A clean first impression, with no added text.',whyAr:'انطباع أول واضح دون نص إضافي.',prompt:'Show the unchanged product on pure white, without added text or props.'},
 benefit:{en:'Key benefit',ar:'الميزة الأساسية',whyEn:'Answer one buyer question using confirmed facts.',whyAr:'أجب عن سؤال للمشتري باستخدام الحقائق المؤكدة.',prompt:'Explain one confirmed product benefit with a clear short headline. If no benefit is confirmed, use a neutral product introduction without claims.'},
 details:{en:'Product details',ar:'تفاصيل المنتج',whyEn:'Show the label, texture or construction clearly.',whyAr:'أظهر الملصق أو الملمس أو تفاصيل الصنع بوضوح.',prompt:'Create an elegant product detail composition. Show only details visible in the original reference. Do not invent materials or ingredients.'},
 lifestyle:{en:'In context',ar:'مشهد الاستخدام',whyEn:'Help the buyer picture the product in their life.',whyAr:'ساعد المشتري على تصور المنتج في حياته.',prompt:'Create a restrained lifestyle scene appropriate to this product, preserving the product and label. No invented accessories sold with it.'},
 notes:{en:'Fragrance story',ar:'قصة العطر',whyEn:'Tell the fragrance story with confirmed notes only.',whyAr:'قدّم قصة العطر باستخدام النوتات المؤكدة فقط.',prompt:'Create a premium fragrance composition. Depict ingredients or fragrance notes only when explicitly confirmed in the product facts.'},
 dimensions:{en:'Dimensions',ar:'الأبعاد',whyEn:'Use verified measurements; never estimate them.',whyAr:'استخدم القياسات المؤكدة دون تخمين.',prompt:'Present the product proportions. Add dimensions only when explicitly supplied as confirmed facts; otherwise create a product close-up without numbers.'},
 sizechart:{en:'Fit and sizing',ar:'المقاس والملاءمة',whyEn:'Use the actual supplied size chart.',whyAr:'استخدم جدول المقاسات الفعلي المقدم.',prompt:'Show garment construction and fit information. Never invent a size chart or measurements; without supplied measurements create a neutral garment detail image.'},
 tryon:{en:'Try-on',ar:'تجربة المنتج',whyEn:'Choose a saved model before generating.',whyAr:'اختر عارضاً محفوظاً قبل التوليد.',prompt:'Try the unchanged product on the selected model.'},
 runway:{en:'Runway video',ar:'فيديو عرض الأزياء',whyEn:'Create after a try-on frame is reviewed and approved.',whyAr:'أنشئه بعد مراجعة واعتماد صورة التجربة.',prompt:'Animate an approved try-on frame.'}
};
export function contentPrompt(slot,brief=''){
 const role=CONTENT_ROLES[slot.kind]||CONTENT_ROLES.details;
 return [role.prompt,brief,slot.rationale,listingFrameInstruction(slot.kind,slot.frameData),slot.languages?.includes('bilingual')?'Render English and natural Arabic together in this single image. Keep Arabic RTL and separate the text blocks clearly. Preserve every supplied measurement and unit.':'','Keep one coherent visual direction across this product set. Use only confirmed facts, preserve the original product and variant.'].filter(Boolean).join('\n');
}
export function planSlots(template,language='both'){
 if(!['en','ar','both'].includes(language))throw new Error('Choose EN, AR or EN + AR');
 return template.slots.map(s=>({...s,languages:s.languages.every(l=>l==='none')?['none']:language==='both'?['en','ar']:[language]}));
}
