import fs from 'node:fs/promises';

const ROOT='/Users/ibragimdaudov/Desktop/Basira';
const OUT=ROOT+'/tmp/pitch-basira';
const C={paper:'#F4F5EF',ink:'#233C31',green:'#355641',muted:'#66756A',light:'#C7DDB1',white:'#FFFFFF',quiet:'#E3E9DB'};
const sources={
 market:'https://www.wam.ae/en/article/c2h35yn-uae-e-commerce-market-size-reaches-aed422-billion',
 zid:'https://zid.sa/en/partners/developers/themes/',
 photoroom:'https://www.photoroom.com/enterprise',
 loai:'https://listingoptimization.ai/',
 catalogix:'https://streamoid.com/',
};
let n=0;
function text(s,value,x,y,w,h,size=26,{color=C.ink,bold=false,font='Arial',align='left',name,link}={}){
 const q=s.shapes.add({name:name||'text-'+(++n),geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 q.text=value;
 q.text.style={fontSize:size,typeface:font,color,bold,alignment:align,verticalAlignment:'top',insets:0,autoFit:'none',wrap:'square',lineSpacing:1.12};
 if(link)q.text.get(value).link={uri:link,isExternal:true};
 return q;
}
function slide(p,index,title,{dark=false,note=''}={}){
 const s=p.slides.add();s.size={width:1280,height:720};s.background.fill=dark?C.ink:C.paper;
 if(title)text(s,title,64,44,1148,115,48,{color:dark?C.white:C.ink,bold:true});
 text(s,'Basira',64,680,600,22,16,{color:dark?C.light:C.muted});
 text(s,String(index).padStart(2,'0'),1150,680,64,22,16,{color:dark?C.light:C.muted,align:'right'});
 if(note)s.speakerNotes.text=note;
 return s;
}
function body(s,head,copy,x,y,w,{dark=false,size=25}={}){
 text(s,head,x,y,w,55,30,{bold:true,color:dark?C.light:C.ink});
 text(s,copy,x,y+65,w,145,size,{color:dark?C.white:C.muted});
}
async function image(s,path,x,y,w,h,{crop,fit='contain',alt=''}={}){
 const b=await fs.readFile(path);
 return s.images.add({dataUrl:'data:'+ (path.endsWith('.webp')?'image/webp':'image/png')+';base64,'+b.toString('base64'),alt,fit,position:{left:x,top:y,width:w,height:h},...(crop?{crop}:{} )});
}
async function tile(s,row,col,x,y,w,h,alt){
 const sw=1402/5,sh=1122/4,r=w/h;let dx=0,dy=0;if(sw/sh>r)dx=(sw-sh*r)/2;else dy=(sh-sw/r)/2;
 return image(s,ROOT+'/src/assets/content-set-frames.png',x,y,w,h,{crop:{left:col/5+dx/1402,right:(4-col)/5+dx/1402,top:row/4+dy/1122,bottom:(3-row)/4+dy/1122},fit:'cover',alt});
}
function link(s,label,url,x,y,w=1100,size=16){return text(s,label,x,y,w,28,size,{color:C.muted,link:url});}

export async function buildPitch(p){
 if(p.slides.items.length)throw Error('The presentation must be empty before building');
 p.theme.defaultFont='Arial';
 let s;
 // 01. A quiet, product-led cover.
 s=slide(p,1,'',{dark:true,note:'Basira technical MVP as of 14 November 2026. Product capabilities verified against repository documentation and implementation. The product photograph is a fictional illustrative AI asset from src/assets/content-set-frames.png, not a customer result.'});
 text(s,'Basira',64,64,650,100,82,{bold:true,color:C.white});
 text(s,'AI listing content\nfor GCC commerce',64,225,715,180,60,{font:'Georgia',color:C.white});
 text(s,'Audit, create and approve product content\nfor teams in the UAE and Saudi Arabia',64,450,710,90,27,{color:C.light});
 text(s,'Pitch deck / November 2026',64,605,660,35,21,{color:C.light});
 await tile(s,1,4,846,0,434,650,'Illustrative product photography');
 text(s,'Product illustration',855,655,350,25,14,{color:C.light,align:'right'});

 // 02. The buyer problem is concrete before the operational problem.
 s=slide(p,2,'A beautiful photo can still leave questions',{note:'Qualitative problem framing and product hypothesis. The organizer example is illustrative, not a measured Basira customer case or a claim about conversion uplift.'});
 text(s,'“Will it fit?”',64,208,1100,120,77,{font:'Georgia'});
 text(s,'An organizer may show its outer dimensions.\nBuyers still need to know the usable space and opening size.',68,345,1080,100,30,{color:C.muted});
 body(s,'For the seller','Identify the missing fact or image that would help a buyer decide.',68,500,500,{size:25});
 body(s,'For the agency','Get the facts, make the change and get the right version approved.',670,500,520,{size:25});

 // 03. A deliberately narrow first customer.
 s=slide(p,3,'First customer: agencies managing multiple brands',{note:'Initial customer segment and launch strategy are proposed hypotheses, not validated traction. The current Agency plan supports 10 client workspaces. Source: server/billing.mjs and current agency workflow.'});
 text(s,'The same work,\nacross every catalog',64,205,640,145,50,{font:'Georgia'});
 text(s,'Product batches. Two languages.\nMissing facts and client feedback.\nEvery new SKU repeats the process.',67,395,630,155,28,{color:C.muted});
 body(s,'Who buys','The agency owner or content lead accountable for delivery time and quality.',825,210,375);
 body(s,'Starting categories','Home products and fragrance. Factual buying questions in one, visual storytelling in the other.',825,435,375);
 text(s,'Initial customer hypothesis to validate in paid pilots',67,625,1100,28,17,{color:C.muted});

 // 04. A process explained through native text, without decorative UI cards.
 s=slide(p,4,'Every finding becomes a specific task',{dark:true,note:'Implemented workflow: server/audit-repairs.mjs, server/catalog-audit.mjs, src/catalog-repairs.js, Creator projects and client exact-revision approvals. Generation and review are explicit actions. No automatic marketplace publishing is implied.'});
 const steps=[
  ['01','Find the problem','An error, a weak presentation or an unanswered buyer question, with a reason.'],
  ['02','Confirm the fact','A client data request links to the exact field an image needs.'],
  ['03','Prepare the image','Creator receives the product, source photo and repair brief.'],
  ['04','Approve the version','The client reviews the exact result. The team delivers approved files.']
 ];
 steps.forEach((a,i)=>{const x=64+i*298;text(s,a[0],x,225,250,80,60,{color:C.light,font:'Georgia'});text(s,a[1],x,340,260,75,29,{bold:true,color:C.white});text(s,a[2],x,435,250,150,25,{color:C.light});});
 text(s,'Approval belongs to a file version. A new edit needs a new review.',64,618,1130,34,21,{color:C.light});

 // 05. The real application rather than a marketing mockup.
 s=slide(p,5,'One starting point for product content',{note:'Real Basira Home screenshot from localhost on 14 November 2026. Home features: photo/catalog intake, optional instruction, four workflows, attention rows, recent saved projects and batches. Home screenshots show product UI and illustrative product examples, not paid customer activity.'});
 text(s,'A photo or a\ncatalog product',64,245,320,95,36,{bold:true});
 text(s,'No prompt required.\nThe original reference\nfollows the workflow.',64,370,320,150,26,{color:C.muted});
 await image(s,'/private/tmp/basira-home-20261114.png',418,183,798,435,{crop:{left:0,top:0,right:0,bottom:0.53},alt:'The working Basira Home screen'});
 text(s,'Actual Basira interface',418,633,780,27,17,{color:C.muted});

 // 06. A tightly cropped, unaltered audit finding as evidence.
 s=slide(p,6,'An audit recommends a concrete repair',{note:'Real application fragment with isolated demonstration catalog data. Crop from tmp/pitch-basira/assets/audit.png. The visible recommendation is rule/category-based, not a completed AI gallery review. Full image reading is a separate explicit action. The example does not prove live listing compliance.'});
 text(s,'The gap',64,213,440,45,30,{bold:true});
 text(s,'Buyers cannot tell what fits inside.\nOuter dimensions are not enough.',64,270,470,100,28,{color:C.muted});
 text(s,'The next image',64,407,440,45,30,{bold:true});
 text(s,'Confirm the real measurements.\nPrepare a supporting image\nthat shows the usable space.',64,465,470,130,28,{color:C.muted});
 await image(s,OUT+'/assets/audit.png',650,185,458,435,{crop:{left:1116/1580,right:60/1580,top:716/2314,bottom:(2314-1100)/2314},alt:'Audit recommendation for outer dimensions, inner space and opening'});
 text(s,'Actual interface detail. Demonstration data.',620,637,580,27,16,{color:C.muted});

 // 07. Actual category-led set creation.
 s=slide(p,7,'A product set answers buying questions',{note:'Real Listing Sets screen. Photographs within the product UI are illustrative planning examples, not generated results for a real customer. Amazon.ae/noon/Salla/Zid are content destination profiles. Source: server/listing-sets.mjs and src/listing-sequences.js.'});
 text(s,'Each image has a purpose: recognition, detail or context.',64,143,1150,48,27,{color:C.muted});
 await image(s,OUT+'/assets/listing-sets.png',64,245,1152,327,{crop:{left:240/1422,right:20/1422,top:450/800,bottom:20/800},alt:'Listing Sets builder with fragrance and marketplace destination profiles'});
 text(s,'Actual interface. Examples illustrate the planned gallery structure.',64,635,1140,26,17,{color:C.muted});

 // 08. The defensible connection between client data and affected versions.
 s=slide(p,8,'One fact connects to every image using it',{note:'Real fact-impact preview with isolated test fixtures. Demonstration width change from 24 to 26 cm affects five frame/language variants. This is a product capability demonstration, not customer traction. Source: server/fact-links.mjs, server/agency-operations.mjs, src/agency-operations.js.'});
 text(s,'A client corrects a measurement',64,213,455,100,36,{bold:true});
 text(s,'Basira finds the linked images,\nshows the repair scope and\nflags outdated versions.',64,320,465,140,28,{color:C.muted});
 text(s,'The team chooses what to update.\nApproval history stays intact.',64,510,465,90,26,{color:C.muted});
 await image(s,OUT+'/assets/fact-impact.png',650,177,526,456,{crop:{left:296/1422,right:296/1422,top:40/800,bottom:40/800},alt:'Impact preview for image variants affected by a client measurement change'});
 text(s,'Actual interface. Demonstration data.',610,642,600,24,16,{color:C.muted});

 // 09. Native multilingual product focus, with distinct image crops.
 s=slide(p,9,'English and Arabic in one workflow',{note:'Illustrative AI product images from src/assets/content-set-frames.png, beauty row, English and Arabic tiles. They are fictional examples, not actual customer outputs. EN/AR workflow, field confirmation, variant-specific versions and platform profiles are implemented. Marketplace acceptance and live integrations require separate verification.'});
 await tile(s,3,2,64,195,340,340,'Illustrative English skincare image');
 await tile(s,3,3,428,195,340,340,'Illustrative Arabic version of the same product');
 text(s,'Shared product facts.\nOne revision history.',827,219,385,100,34,{bold:true});
 text(s,'EN/AR variants, an Arabic\ninterface and review tied\nto exact file versions.',827,358,385,120,27,{color:C.muted});
 text(s,'Amazon.ae   noon   Salla   Zid',64,581,1145,45,30,{bold:true});
 text(s,'Illustrative images. Destination profiles do not guarantee marketplace acceptance.',64,636,1150,30,17,{color:C.muted});

 // 10. Honest competitive positioning, no unsupported absence claims.
 s=slide(p,10,'Our position: product context and client control',{note:'Official product pages checked 14 November 2026. Photoroom already offers batch processing, catalog, API and team workspaces. Listing Optimization AI offers Amazon image/A+ generation and review/competitor analysis. Streamoid offers fashion/lifestyle catalog operations. Table describes publicly advertised focus, not an exhaustive feature comparison or an absence claim. Sources: '+Object.values(sources).slice(2).join('\n')});
 const vals=[['Product','Advertised focus','Basira’s focus'],['Photoroom','Product imagery, video and\nvisual operations at scale','Connect a specific audit finding\nto a content repair'],['Listing Optimization AI','Amazon imagery and A+,\nreview and competitor analysis','Build an EN/AR workflow\nfor GCC teams'],['Streamoid / Catalogix','Product data, content and\ncatalog operations for fashion','Start with a focused\nagency workflow'],['Basira','Audit, confirmed product facts,\nCreator and client approvals','A connected GCC\ncontent workflow']];
 const tb=s.tables.add({rows:5,columns:3,left:64,top:200,width:1152,height:380,columnWidths:[245,465,442],values:vals});
 tb.borders.assign({fill:C.quiet,width:1,style:'solid'});
 for(let r=0;r<5;r++)for(let c=0;c<3;c++){const cell=tb.getCell(r,c);cell.fill=r===0?C.ink:r===4?'#E4EED8':C.paper;cell.text.style={fontSize:r===0?23:22,typeface:'Arial',bold:r===0||c===0,color:r===0?C.white:C.ink,insets:10,autoFit:'none',verticalAlignment:'middle'};}
 text(s,'Our focus: confirmed product facts, EN/AR production and approval of the exact version.',64,608,1140,60,21,{color:C.muted});

 // 11. Market context is not passed off as SaaS TAM.
 s=slide(p,11,'UAE and Saudi Arabia: the launch market',{note:'UAE e-commerce 2025: AED42.2bn, WAM 28 Sep 2026 reporting EZDubai/Euromonitor. Zid Theme Partners page claims 15,000+ active stores as opened 14 Nov 2026. These are commerce volume and a platform ecosystem indicator, not Basira SaaS TAM. Do not add them or infer customers from them.\n'+sources.market+'\n'+sources.zid});
 text(s,'42.2bn',64,210,570,120,83,{font:'Georgia'});
 text(s,'AED in UAE e-commerce during 2025',68,350,550,62,28,{bold:true});
 link(s,'EZDubai / Euromonitor, via WAM [1]',sources.market,68,435,550,17);
 text(s,'15 000+',700,210,515,120,83,{font:'Georgia'});
 text(s,'active stores reported by Zid',704,350,490,62,28,{bold:true});
 link(s,'Official Zid partner page [2]',sources.zid,704,435,490,17);
 text(s,'An agency relationship can bring several brands into one account.',68,525,1110,75,31,{color:C.green});
 text(s,'Market context, not Basira’s TAM. The addressable software market still needs separate sizing.',68,630,1120,28,18,{color:C.muted});

 // 12. Current configured prices, separate from observed revenue.
 s=slide(p,12,'Subscription with a defined generation budget',{note:'Prices and entitlements from server/billing.mjs and generation-budget.mjs as of 14 Nov 2026: Seller SAR399/month, two clients, 600 credits. Agency SAR1490/month, ten clients, 6000 credits. These are configured MVP prices, not evidence of willingness to pay. Annual subscription scenario is arithmetic: 100*1490*12=1,788,000 SAR. It excludes VAT and provider costs and is not revenue, valuation, forecast or market size.'});
 text(s,'Seller',64,200,470,55,30,{bold:true});text(s,'399 SAR / month',64,269,515,80,53,{font:'Georgia'});
 text(s,'Up to 2 client workspaces\n600 generation credits',64,375,510,100,27,{color:C.muted});
 text(s,'Agency',700,200,470,55,30,{bold:true});text(s,'1,490 SAR / month',700,269,515,80,53,{font:'Georgia'});
 text(s,'Up to 10 client workspaces\n6,000 generation credits',700,375,510,100,27,{color:C.muted});
 text(s,'100 Agency subscriptions = SAR 1.788m / year',64,525,1150,65,36,{bold:true});
 text(s,'Configured MVP pricing. Illustrative scenario, not revenue or a forecast. Excludes VAT and provider costs.',64,617,1140,49,18,{color:C.muted});

 // 13. Product readiness without fabricated traction.
 s=slide(p,13,'Working MVP. Next step: paid pilots',{note:'Status checked against README.md, ROADMAP.md and implementation on 14 Nov 2026. 238 automated tests passed in development. Product workflow checks used isolated demonstration fixtures and no paid provider calls. No revenue, customer, retention or conversion traction data was supplied. Live generation quality, marketplace acceptance, billing economics and commercial demand require pilot validation.'});
 body(s,'Built','Catalog and audit\nCreator and EN/AR sets\nBatches and exact versions\nClient portal\nLinked facts and repairs',64,210,540,{size:28});
 // Extend the deliberately roomy list beyond the default helper frame.
 const left=s.shapes.items.at(-1);left.position.height=260;
 body(s,'To validate','Quality on real products\nApproval turnaround\nCost per accepted image\nWillingness to pay\nRepeat usage',700,210,520,{size:28});
 const right=s.shapes.items.at(-1);right.position.height=260;
 text(s,'Automated publishing and sales uplift require separate live validation.',64,612,1140,45,23,{color:C.muted});

 // 14. Commercial milestones are explicitly proposed targets.
 s=slide(p,14,'A 90-day plan to validate demand',{note:'Proposed launch plan and target counts, not achieved milestones or a promise. No signed agency partners are implied.'});
 const phases=[['Days 1–30','5 agencies','Paid pilots across a total of\n50 SKUs in two categories.\nMeasure the starting process.'],['Days 31–60','Batch economics','Time per accepted image,\nrevision rounds and actual\nproduction cost.'],['Days 61–90','Repeat payment','A second batch, subscription\nconversion and the first\npermissioned case studies.']];
 phases.forEach((a,i)=>{const x=64+i*400;text(s,a[0],x,218,350,40,23,{color:C.muted});text(s,a[1],x,295,350,85,37,{bold:true});text(s,a[2],x,415,345,145,27,{color:C.muted});});
 text(s,'Proposed targets. Conversion uplift needs a separate test with sufficient traffic.',64,620,1130,35,21,{color:C.muted});

 // 15. A concrete partnership ask instead of a fictional funding round.
 s=slide(p,15,'A pilot with UAE and Saudi agencies',{dark:true,note:'Proposed next step for potential agency partners. Funding amount, team biographies, customer logos and contact details are deliberately not fabricated. Illustrative product asset: content-set-frames.png, fashion macro tile.'});
 text(s,'A real batch.\nA measurable result.',64,220,725,170,61,{font:'Georgia',color:C.white});
 text(s,'The agency brings products and its current process.\nBasira prepares content repairs and product sets.\nTogether, we measure quality, time and cost.',67,435,720,150,27,{color:C.light});
 text(s,'Pilot outcome: accepted content and a decision on the next batch.',67,622,1080,34,23,{color:C.light});
 await tile(s,2,1,895,190,321,370,'Illustrative fabric detail');
 text(s,'Illustration',895,577,321,25,14,{color:C.light,align:'right'});

 // 16. Source links survive as audience-readable references in the PDF.
 s=slide(p,16,'Sources and scope',{note:'All external links opened and checked 14 November 2026. Product facts derive from current repository implementation and docs. No actual growth, revenue or paid traction was supplied.'});
 const refs=[
  ['[1] UAE e-commerce: AED 42.2bn in 2025','WAM, 28 September 2026. Reporting EZDubai / Euromonitor.',sources.market],
  ['[2] Zid ecosystem: 15,000+ active stores','Official Theme Partners page. Platform-reported figure.',sources.zid],
  ['[3] Photoroom: product imagery, scale and teams','Official Enterprise page.',sources.photoroom],
  ['[4] Listing Optimization AI: Amazon imagery and A+','Official product website.',sources.loai],
  ['[5] Streamoid / Catalogix: content and catalog operations','Official company website.',sources.catalogix],
 ];
 refs.forEach((a,i)=>{let y=183+i*83;text(s,a[0],64,y,1140,32,23,{bold:true,link:a[2]});text(s,a[1],64,y+35,1140,29,18,{color:C.muted});});
 text(s,'Product and pricing reflect the Basira implementation on 14 November 2026. Commercial scenarios are hypotheses.\nIllustrations are not customer outcomes. Screenshots show the actual interface with demonstration data.',64,610,1142,55,17,{color:C.muted});
 return {slides:p.slides.items.length,sources};
}

export const paths={root:ROOT,tmp:OUT,pdf:ROOT+'/output/pdf/Basira-Pitch-Deck-EN-2026-11.pdf'};
