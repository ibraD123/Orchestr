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
 return s.images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:path.endsWith('.webp')?'image/webp':'image/png',alt,fit,position:{left:x,top:y,width:w,height:h},...(crop?{crop}:{} )});
}
async function tile(s,row,col,x,y,w,h,alt){
 return image(s,ROOT+'/src/assets/content-set-frames.png',x,y,w,h,{crop:{left:col/5,right:(4-col)/5,top:row/4,bottom:(3-row)/4},fit:'cover',alt});
}
function link(s,label,url,x,y,w=1100,size=16){return text(s,label,x,y,w,28,size,{color:C.muted,link:url});}

export async function buildPitch(p){
 if(p.slides.items.length)throw Error('The presentation must be empty before building');
 p.theme.defaultFont='Arial';
 let s;
 // 01. A quiet, product-led cover.
 s=slide(p,1,'',{dark:true,note:'Basira technical MVP as of 14 November 2026. Product capabilities verified against repository documentation and implementation. The product photograph is a fictional illustrative AI asset from src/assets/content-set-frames.png, not a customer result.'});
 text(s,'Basira',64,64,650,100,82,{bold:true,color:C.white});
 text(s,'Товарный контент\nс понятной задачей',64,225,715,180,60,{font:'Georgia',color:C.white});
 text(s,'Аудит, комплекты EN/AR и согласование\nдля e-commerce-команд ОАЭ и Саудии',64,450,710,90,27,{color:C.light});
 text(s,'Pitch deck / Ноябрь 2026',64,605,660,35,21,{color:C.light});
 await tile(s,1,4,846,0,434,650,'Иллюстративная предметная фотография парфюма');
 text(s,'Иллюстрация продукта',855,655,350,25,14,{color:C.light,align:'right'});

 // 02. The buyer problem is concrete before the operational problem.
 s=slide(p,2,'Красивое фото оставляет вопросы',{note:'Qualitative problem framing and product hypothesis. The organizer example is illustrative, not a measured Basira customer case or a claim about conversion uplift.'});
 text(s,'«Поместится ли?»',64,208,1100,120,77,{font:'Georgia'});
 text(s,'У органайзера может быть внешний размер,\nно покупателю важны ещё внутреннее пространство и проём.',68,345,1080,100,30,{color:C.muted});
 body(s,'Для продавца','Нужно понять, какой факт или кадр действительно отсутствует.',68,500,500,{size:25});
 body(s,'Для агентства','Нужно получить данные, внести правку и согласовать нужную версию.',670,500,520,{size:25});

 // 03. A deliberately narrow first customer.
 s=slide(p,3,'Первый клиент: агентство с несколькими брендами',{note:'Initial customer segment and launch strategy are proposed hypotheses, not validated traction. The current Agency plan supports 10 client workspaces. Source: server/billing.mjs and current agency workflow.'});
 text(s,'Повторяющаяся работа\nпо всему каталогу',64,205,640,145,50,{font:'Georgia'});
 text(s,'Партии товаров, версии на двух языках,\nзапросы данных и клиентские правки.\nКаждый новый SKU повторяет этот процесс.',67,395,630,155,28,{color:C.muted});
 body(s,'Покупатель продукта','Руководитель агентства или контент-команды, который отвечает за срок и качество партии.',825,210,375);
 body(s,'Стартовые категории','Товары для дома и парфюмерия. Размеры и комплектация в первой, визуальная подача во второй.',825,435,375);
 text(s,'Гипотеза первого сегмента для проверки в платном пилоте',67,625,1100,28,17,{color:C.muted});

 // 04. A process explained through native text, without decorative UI cards.
 s=slide(p,4,'Каждое замечание становится задачей',{dark:true,note:'Implemented workflow: server/audit-repairs.mjs, server/catalog-audit.mjs, src/catalog-repairs.js, Creator projects and client exact-revision approvals. Generation and review are explicit actions. No automatic marketplace publishing is implied.'});
 const steps=[
  ['01','Найти проблему','Ошибка, недостаток подачи или вопрос покупателя с объяснением.'],
  ['02','Уточнить факт','Запрос клиенту связан с конкретным полем кадра.'],
  ['03','Подготовить кадр','Creator получает товар, исходник и задачу исправления.'],
  ['04','Согласовать версию','Клиент проверяет конкретный результат. Команда передаёт готовые файлы.']
 ];
 steps.forEach((a,i)=>{const x=64+i*298;text(s,a[0],x,225,250,80,60,{color:C.light,font:'Georgia'});text(s,a[1],x,340,260,75,29,{bold:true,color:C.white});text(s,a[2],x,435,250,150,25,{color:C.light});});
 text(s,'Одобрение относится к версии файла. Новая правка требует новой проверки.',64,618,1130,34,21,{color:C.light});

 // 05. The real application rather than a marketing mockup.
 s=slide(p,5,'Одна точка входа в работу с товаром',{note:'Real Basira Home screenshot from localhost on 14 November 2026. Home features: photo/catalog intake, optional instruction, four workflows, attention rows, recent saved projects and batches. Home screenshots show product UI and illustrative product examples, not paid customer activity.'});
 text(s,'Фото или товар\nиз каталога',64,245,320,95,36,{bold:true});
 text(s,'Инструкция необязательна.\nИсходник переходит\nв выбранный сценарий.',64,370,320,150,26,{color:C.muted});
 await image(s,'/private/tmp/basira-home-20261114.png',418,183,798,435,{crop:{left:0,top:0,right:0,bottom:0.53},alt:'Рабочий экран Главной Basira'});
 text(s,'Рабочий интерфейс Basira',418,633,780,27,17,{color:C.muted});

 // 06. A tightly cropped, unaltered audit finding as evidence.
 s=slide(p,6,'Аудит предлагает конкретное исправление',{note:'Real application fragment with isolated demonstration catalog data. Crop from tmp/pitch-basira/assets/audit.png. The visible recommendation is rule/category-based, not a completed AI gallery review. Full image reading is a separate explicit action. The example does not prove live listing compliance.'});
 text(s,'Что не так',64,213,440,45,30,{bold:true});
 text(s,'Неясно, что помещается внутрь.\nОдного внешнего размера мало.',64,270,470,100,28,{color:C.muted});
 text(s,'Что сделать',64,407,440,45,30,{bold:true});
 text(s,'Подтвердить реальные размеры\nи подготовить кадр с нужными\nизмерениями.',64,465,470,130,28,{color:C.muted});
 await image(s,OUT+'/assets/audit.png',620,185,510,435,{crop:{left:1116/1580,right:60/1580,top:716/2314,bottom:(2314-1100)/2314},alt:'Рекомендация аудита показать внешние и внутренние размеры и проём'});
 text(s,'Фрагмент продукта. Демонстрационные данные.',620,637,580,27,16,{color:C.muted});

 // 07. Actual category-led set creation.
 s=slide(p,7,'Комплект строится вокруг вопросов покупателя',{note:'Real Listing Sets screen. Photographs within the product UI are illustrative planning examples, not generated results for a real customer. Amazon.ae/noon/Salla/Zid are content destination profiles. Source: server/listing-sets.mjs and src/listing-sequences.js.'});
 text(s,'Главное фото, детали и применение получают свою роль в галерее.',64,143,1150,48,27,{color:C.muted});
 await image(s,OUT+'/assets/listing-sets.png',64,211,1152,406,{crop:{left:240/1422,right:20/1422,top:196/800,bottom:0},alt:'Конструктор Listing Sets с парфюмерией и профилями площадок'});
 text(s,'Рабочий интерфейс. Превью показывают структуру комплекта.',64,635,1140,26,17,{color:C.muted});

 // 08. The defensible connection between client data and affected versions.
 s=slide(p,8,'Один факт связан со всеми его версиями',{note:'Real fact-impact preview with isolated test fixtures. Demonstration width change from 24 to 26 cm affects five frame/language variants. This is a product capability demonstration, not customer traction. Source: server/fact-links.mjs, server/agency-operations.mjs, src/agency-operations.js.'});
 text(s,'Клиент уточнил размер',64,213,455,80,36,{bold:true});
 text(s,'Basira находит связанные кадры,\nпоказывает объём исправлений\nи отмечает устаревшие версии.',64,320,465,140,28,{color:C.muted});
 text(s,'Команда выбирает обновления.\nИстория согласований сохраняется.',64,510,465,90,26,{color:C.muted});
 await image(s,OUT+'/assets/fact-impact.png',610,177,606,456,{crop:{left:296/1422,right:296/1422,top:40/800,bottom:40/800},alt:'Предпросмотр затронутых вариантов после подтверждения размера клиентом'});
 text(s,'Рабочий интерфейс. Демонстрационные данные.',610,642,600,24,16,{color:C.muted});

 // 09. Native multilingual product focus, with distinct image crops.
 s=slide(p,9,'Английский и арабский в одном процессе',{note:'Illustrative AI product images from src/assets/content-set-frames.png, beauty row, English and Arabic tiles. They are fictional examples, not actual customer outputs. EN/AR workflow, field confirmation, variant-specific versions and platform profiles are implemented. Marketplace acceptance and live integrations require separate verification.'});
 await tile(s,3,2,64,195,340,340,'Иллюстративный английский кадр косметического товара');
 await tile(s,3,3,428,195,340,340,'Иллюстративный арабский кадр того же товара');
 text(s,'Общие факты о товаре\nи единая история правок',827,219,385,100,34,{bold:true});
 text(s,'EN/AR-варианты, арабский\nинтерфейс и контроль\nконкретных версий.',827,358,385,120,27,{color:C.muted});
 text(s,'Amazon.ae   noon   Salla   Zid',64,581,1145,45,30,{bold:true});
 text(s,'Иллюстрации. Профили подготовки контента не гарантируют принятие площадкой.',64,636,1150,30,17,{color:C.muted});

 // 10. Honest competitive positioning, no unsupported absence claims.
 s=slide(p,10,'Конкуренция: ставка на товарный контекст',{note:'Official product pages checked 14 November 2026. Photoroom already offers batch processing, catalog, API and team workspaces. Listing Optimization AI offers Amazon image/A+ generation and review/competitor analysis. Streamoid offers fashion/lifestyle catalog operations. Table describes publicly advertised focus, not an exhaustive feature comparison or an absence claim. Sources: '+Object.values(sources).slice(2).join('\n')});
 const vals=[['Продукт','Публичный фокус','Позиция Basira'],['Photoroom','Фото, видео и обработка\nизображений в масштабе','Конкурировать на связи\nаудита с исправлением'],['Listing Optimization AI','Изображения и A+ для Amazon,\nанализ отзывов и конкурентов','Строить процесс EN/AR\nдля команд региона'],['Streamoid / Catalogix','Данные, контент и каталоги\nдля fashion и lifestyle','Начать с компактного\nагентского workflow'],['Basira','Аудит, подтверждённые факты,\nCreator и клиентские версии','Проверить ценность\nв платных пилотах']];
 const tb=s.tables.add({rows:5,columns:3,left:64,top:200,width:1152,height:380,columnWidths:[245,465,442],values:vals});
 tb.borders.assign({fill:C.quiet,width:1,style:'solid'});
 for(let r=0;r<5;r++)for(let c=0;c<3;c++){const cell=tb.getCell(r,c);cell.fill=r===0?C.ink:r===4?'#E4EED8':C.paper;cell.text.style={fontSize:r===0?23:23,typeface:'Arial',bold:r===0||c===0,color:r===0?C.white:C.ink,insets:15,autoFit:'none',verticalAlignment:'middle'};}
 text(s,'Массовая обработка и командный доступ уже есть у конкурентов. Наше отличие должно доказать себя в работе.',64,608,1140,60,21,{color:C.muted});

 // 11. Market context is not passed off as SaaS TAM.
 s=slide(p,11,'ОАЭ и Саудия: среда для первого запуска',{note:'UAE e-commerce 2025: AED42.2bn, WAM 28 Sep 2026 reporting EZDubai/Euromonitor. Zid Theme Partners page claims 15,000+ active stores as opened 14 Nov 2026. These are commerce volume and a platform ecosystem indicator, not Basira SaaS TAM. Do not add them or infer customers from them.\n'+sources.market+'\n'+sources.zid});
 text(s,'42,2 млрд',64,210,570,120,83,{font:'Georgia'});
 text(s,'AED e-commerce в ОАЭ за 2025 год',68,350,550,62,28,{bold:true});
 link(s,'EZDubai / Euromonitor, публикация WAM [1]',sources.market,68,435,550,17);
 text(s,'15 000+',700,210,515,120,83,{font:'Georgia'});
 text(s,'активных магазинов заявляет Zid',704,350,490,62,28,{bold:true});
 link(s,'Официальная партнёрская страница Zid [2]',sources.zid,704,435,490,17);
 text(s,'Выход через агентства даёт доступ к нескольким брендам в одной продаже.',68,525,1110,75,31,{color:C.green});
 text(s,'Контекст рынка, не TAM Basira. Доступный SaaS-рынок требует отдельной оценки.',68,630,1120,28,18,{color:C.muted});

 // 12. Current configured prices, separate from observed revenue.
 s=slide(p,12,'Подписка с понятным бюджетом генераций',{note:'Prices and entitlements from server/billing.mjs and generation-budget.mjs as of 14 Nov 2026: Seller SAR399/month, two clients, 600 credits. Agency SAR1490/month, ten clients, 6000 credits. These are configured MVP prices, not evidence of willingness to pay. Annual subscription scenario is arithmetic: 100*1490*12=1,788,000 SAR. It excludes VAT and provider costs and is not revenue, valuation, forecast or market size.'});
 text(s,'Seller',64,200,470,55,30,{bold:true});text(s,'399 SAR / мес.',64,269,515,80,53,{font:'Georgia'});
 text(s,'До 2 клиентских пространств\n600 кредитов генерации',64,375,510,100,27,{color:C.muted});
 text(s,'Agency',700,200,470,55,30,{bold:true});text(s,'1 490 SAR / мес.',700,269,515,80,53,{font:'Georgia'});
 text(s,'До 10 клиентских пространств\n6 000 кредитов генерации',700,375,510,100,27,{color:C.muted});
 text(s,'100 Agency-подписок = 1,788 млн SAR в год',64,525,1150,65,36,{bold:true});
 text(s,'Тарифы MVP. Расчётный сценарий, не текущая выручка и не прогноз. До НДС и расходов на провайдеров.',64,617,1140,49,18,{color:C.muted});

 // 13. Product readiness without fabricated traction.
 s=slide(p,13,'Рабочий MVP. Следующий этап: платные пилоты',{note:'Status checked against README.md, ROADMAP.md and implementation on 14 Nov 2026. 238 automated tests passed in development. Product workflow checks used isolated demonstration fixtures and no paid provider calls. No revenue, customer, retention or conversion traction data was supplied. Live generation quality, marketplace acceptance, billing economics and commercial demand require pilot validation.'});
 body(s,'Реализовано','Каталог и аудит\nCreator и комплекты EN/AR\nПартии и точные версии\nПортал клиента\nСвязанные факты и исправления',64,210,540,{size:28});
 // Extend the deliberately roomy list beyond the default helper frame.
 const left=s.shapes.items.at(-1);left.position.height=260;
 body(s,'Проверяем в пилоте','Качество на реальных товарах\nСкорость согласования\nСебестоимость принятого кадра\nГотовность платить\nПовторное использование',700,210,520,{size:28});
 const right=s.shapes.items.at(-1);right.position.height=260;
 text(s,'Автопубликация и доказанный рост продаж требуют отдельной живой проверки.',64,612,1140,45,23,{color:C.muted});

 // 14. Commercial milestones are explicitly proposed targets.
 s=slide(p,14,'План проверки спроса на 90 дней',{note:'Proposed launch plan and target counts, not achieved milestones or a promise. No signed agency partners are implied.'});
 const phases=[['Дни 1–30','5 агентств','Платный пилот на суммарно\n50 SKU в двух категориях.\nЗамер исходного процесса.'],['Дни 31–60','Экономика партии','Время на принятый кадр,\nчисло правок и фактическая\nстоимость производства.'],['Дни 61–90','Повторная оплата','Вторая партия, переход\nна подписку и первые\nразрешённые кейсы.']];
 phases.forEach((a,i)=>{const x=64+i*400;text(s,a[0],x,218,350,40,23,{color:C.muted});text(s,a[1],x,295,350,85,37,{bold:true});text(s,a[2],x,415,345,145,27,{color:C.muted});});
 text(s,'Цели запуска. Рост конверсии измеряем отдельно на подходящем объёме трафика.',64,620,1130,35,21,{color:C.muted});

 // 15. A concrete partnership ask instead of a fictional funding round.
 s=slide(p,15,'Пилот с агентствами ОАЭ и Саудии',{dark:true,note:'Proposed next step for potential agency partners. Funding amount, team biographies, customer logos and contact details are deliberately not fabricated. Illustrative product asset: content-set-frames.png, fashion macro tile.'});
 text(s,'Первая партия\nдля реальной команды',64,220,725,170,61,{font:'Georgia',color:C.white});
 text(s,'Агентство приносит товары и текущий процесс.\nBasira готовит исправления и комплекты.\nВместе измеряем качество, срок и стоимость.',67,435,720,150,27,{color:C.light});
 text(s,'Результат пилота: принятый контент и решение о следующей партии.',67,622,1080,34,23,{color:C.light});
 await tile(s,2,1,895,190,321,370,'Иллюстративная деталь ткани');
 text(s,'Иллюстрация',895,577,321,25,14,{color:C.light,align:'right'});

 // 16. Source links survive as audience-readable references in the PDF.
 s=slide(p,16,'Источники и границы утверждений',{note:'All external links opened and checked 14 November 2026. Product facts derive from current repository implementation and docs. No actual growth, revenue or paid traction was supplied.'});
 const refs=[
  ['[1] Рынок ОАЭ: 42,2 млрд AED за 2025 год','WAM, 28.09.2026. Данные EZDubai / Euromonitor.',sources.market],
  ['[2] Экосистема Zid: 15 000+ активных магазинов','Официальная страница Theme Partners. Заявление платформы.',sources.zid],
  ['[3] Photoroom: изображения, масштабирование и команды','Официальная Enterprise-страница.',sources.photoroom],
  ['[4] Listing Optimization AI: изображения и A+ для Amazon','Официальный сайт продукта.',sources.loai],
  ['[5] Streamoid / Catalogix: контент и операционная работа с каталогом','Официальный сайт компании.',sources.catalogix],
 ];
 refs.forEach((a,i)=>{let y=183+i*83;text(s,a[0],64,y,1140,32,23,{bold:true,link:a[2]});text(s,a[1],64,y+35,1140,29,18,{color:C.muted});});
 text(s,'Продукт и тарифы: текущая реализация Basira от 14.11.2026. Коммерческие сценарии отмечены как гипотезы.\nИллюстрации не являются клиентскими результатами. Скриншоты показывают интерфейс и демонстрационные данные.',64,610,1142,55,17,{color:C.muted});
 return {slides:p.slides.items.length,sources};
}

export const paths={root:ROOT,tmp:OUT,pdf:ROOT+'/output/pdf/Basira-Pitch-Deck-RU-2026-11.pdf'};
