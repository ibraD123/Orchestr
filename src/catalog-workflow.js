// Persistent catalog is the entry point to batch Creator and client review work.
var catalogBusy=false,catalogMessage='',catalogError='',catalogViewWs=null;
function installCatalog(ws,products){
  P.filter(function(p){return p.imported&&p.ws===ws;}).forEach(function(p){delete PM[p.id];});
  P=P.filter(function(p){return !(p.imported&&p.ws===ws);});
  products.forEach(function(p){P.unshift(p);PM[p.id]=p;});
  if(state.ws===ws&&(!PM[state.pid]||PM[state.pid].ws!==ws))state.pid=(WP()[0]||{}).id||null;
}
function loadSavedCatalogs(list){var owner=state.me&&state.me.account&&state.me.account.id;return Promise.all(list.map(function(w){return post('/api/catalog',{ws:w.id,action:'list'}).then(function(c){return {ws:w.id,products:c.products};});})).then(function(all){if(owner!==(state.me&&state.me.account&&state.me.account.id))return;all.forEach(function(c){installCatalog(c.ws,c.products);});});}
var localImportDone=importDone;
importDone=function(res,label,targetWs){
  if(!state.api||!state.api.store)return localImportDone(res,label);
  var ws=targetWs||state.ws;state.imp.busy=true;render();
  return post('/api/catalog',{ws:ws,action:'upsert',items:res.items}).then(function(c){
    installCatalog(ws,c.products);if(state.ws!==ws)return;
    state.src='imported';state.imp={busy:false,url:state.imp.url,note:cwt('Saved ','تم حفظ ')+res.items.length+' SKU',warnings:res.warnings||[]};render();
  }).catch(function(e){if(state.ws===ws){state.imp.busy=false;state.imp.error=e.message;render();}});
};
var catalogBaseView=vCatalog;
vCatalog=function(){
  if(catalogViewWs!==state.ws){catalogViewWs=state.ws;catalogMessage='';catalogError='';state.catalogBatchName='';}
  var selected=WP().filter(function(p){return p.imported&&state.sel[p.id];});
  return catalogBaseView()+'<div class="card" style="margin-top:18px"><h2>'+cwt('Catalog → Creator → Client','الكتالوج ← المصمم ← العميل')+'</h2><p class="note">'+cwt('Select imported products above. Projects are prepared without paid generation. Final ZIP requires client approval for every file in the latest release.','حدد المنتجات المستوردة بالأعلى. تُجهز المشاريع دون توليد مدفوع. يتطلب الأرشيف النهائي اعتماد العميل لكل ملف في أحدث حزمة.')+'</p><p>'+selected.length+' '+cwt('products selected','منتجات محددة')+'</p><label>'+cwt('Batch name','اسم الدفعة')+'<input class="sel" id="catalog-batch-name" value="'+esc(state.catalogBatchName||'Product launch')+'"></label><div class="cw-actions" style="margin-top:12px">'+[['batch',cwt('Create client batch','إنشاء دفعة للعميل')],['projects',cwt('Prepare Creator projects','تجهيز مشاريع المصمم')],['review',cwt('Prepare client reviews','تجهيز مراجعات العميل')],['assets',cwt('Download client-approved ZIP','تنزيل الملفات المعتمدة من العميل')],['export',cwt('Export catalog CSV','تصدير الكتالوج CSV')]].map(function(x){return '<button class="btn btn-ghost btn-sm" data-catalog-action="'+x[0]+'"'+(!selected.length||catalogBusy?' disabled':'')+'>'+x[1]+'</button>';}).join('')+'</div>'+(catalogMessage?'<p class="note" role="status">'+esc(catalogMessage)+'</p>':'')+(catalogError?'<p class="err" role="alert">'+esc(catalogError)+'</p>':'')+'<p><a href="#creator">'+cwt('Open Creator','فتح المصمم')+'</a> · <a href="#approvals">'+cwt('Open client portal management','إدارة بوابة العميل')+'</a></p></div>';
};
document.addEventListener('click',function(e){
  var el=e.target.closest('[data-catalog-action]');if(!el||el.disabled)return;
  var ws=state.ws,action=el.dataset.catalogAction,ids=WP().filter(function(p){return p.imported&&state.sel[p.id];}).map(function(p){return p.id;});
  var batchName=(document.getElementById('catalog-batch-name')||{}).value||'';
  catalogBusy=true;catalogError='';catalogMessage=cwt('Processing…','جارٍ المعالجة…');render();
  fetch('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ws:ws,action:action==='batch'?'projects':action,ids:ids})}).then(function(r){
    if(!r.ok)return r.json().then(function(j){throw new Error(j.error);});
    if(action==='export'||action==='assets')return r.blob().then(function(blob){var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=action==='export'?'shoof-catalog.csv':'shoof-client-approved.zip';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);return {results:[]};});
    return r.json();
  }).then(function(j){if(action!=='batch')return j;var failed=j.results.filter(function(r){return r.status==='failed';});if(failed.length)throw new Error(failed.map(function(r){return r.sku+': '+r.error;}).join(' · '));return post('/api/collaboration',{ws:ws,action:'create',name:batchName,projectIds:[...new Set(j.results.map(function(r){return r.projectId;}))]}).then(function(b){if(state.ws===ws){agencyRoom={ws:ws,loading:false,loaded:false,batches:[],batchId:b.id,selected:{},error:'',name:'',busy:false};cw.loaded=false;cw.tab='batches';go('creator');}return j;});}).then(function(j){if(state.ws!==ws)return;catalogMessage=j.results.length?j.results.map(function(r){return r.sku+': '+r.status+(r.error?' — '+r.error:'');}).join(' · '):cwt('Download ready','الملف جاهز');if(action==='projects')cw.loaded=false;})
    .catch(function(err){if(state.ws===ws){catalogError=err.message;catalogMessage='';}}).then(function(){catalogBusy=false;if(state.ws===ws)render();});
});

document.addEventListener('input',function(e){if(e.target.id==='catalog-batch-name')state.catalogBatchName=e.target.value;});
