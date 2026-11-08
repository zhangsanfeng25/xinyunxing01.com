'use strict';
const $=s=>document.querySelector(s);
const displayPreferenceKey='forum-display-v03';
const systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
function readDisplayPreference(){
 try{return JSON.parse(localStorage.getItem(displayPreferenceKey))??{};}catch{return {};}
}
function applyMotionPreference(enabled){
 document.body.classList.toggle('reduce-motion',!enabled);
 const control=$('#motion-toggle');
 if(control){control.checked=enabled;$('#motion-status').textContent=motionStatus(enabled);}
}
function motionStatus(enabled){return enabled?(systemMotion.matches?'系统已减少动画':'已启用'):'已关闭';}
function saveMotionPreference(enabled){
 applyMotionPreference(enabled);
 try{localStorage.setItem(displayPreferenceKey,JSON.stringify({...readDisplayPreference(),motion:enabled}));}catch{}
}
applyMotionPreference(readDisplayPreference().motion!==false);
systemMotion.addEventListener('change',()=>applyMotionPreference(!document.body.classList.contains('reduce-motion')));
window.addEventListener('storage',event=>{
 if(event.key===displayPreferenceKey||event.key===null)applyMotionPreference(readDisplayPreference().motion!==false);
});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,cls='')=>`<img class="icon ${cls}" src="assets/icons/${name}.svg" alt="">`;
const navs=[['home','首页','house'],['websites','网站','globe'],['ui','UI','layout-grid'],['prompts','提示词','message-square'],['saved','收藏','bookmark']];
const state={items:[],saved:new Set(),route:'home',query:'',category:'全部',platform:'全部',view:'全部',sort:'default',collection:'全部收藏',accountTab:'个人资料',adminTab:'资源管理',role:'member',form:{kind:'website',title:'',description:'',url:'',visibility:'shared',body:''},step:1,drafts:[],theme:'light'};
const liveDeck=new LivePreviewDeck({runtime:async(card,root,onStatus,isCurrent,signal)=>{const ticket=await catalogClient.uiTicket(Number(card.dataset.previewResourceId),{signal});if(!isCurrent())return null;return window.mountUIRuntime({root,...ticket,title:card.dataset.previewTitle+'卡片交互预览',onStatus});},onError:error=>serviceError(error)});
state.backendMode=document.querySelector('meta[name="resource-data-mode"]')?.content==='api';
const catalogClient=window.createCatalogClient();
function serviceItem(row){const local=state.seedMetadata?.get(row.seedKey)||{};return {...local,...row,seedKey:row.seedKey||row.key,tags:row.tags??local.tags??[],source:local.source||{}};}
let serviceLoadGeneration=0,identityEvents=null,identityCheck=null;
function adoptPersonalItem(row){const item=serviceItem(row),index=state.items.findIndex(x=>x.kind===row.kind&&x.id===row.id);if(index<0)state.items.push(item);else state.items[index]={...state.items[index],...item};return item.seedKey;}
function clearPrivateServiceState(){clearSelectedFiles();catalogClient.invalidate();serviceLoadGeneration++;abortDetailRead();detailGeneration++;searchGeneration++;clearTimeout(searchTimer);state.gallery?.destroy();state.gallery=null;clearDetailRuntime();for(const name of ['attachmentEditor','sourceEditor','securityController','personalController','accountLifecycleController','categoryManager','notificationPreferencesController','notificationController','adminController']){state[name]?.destroy();state[name]=null;}liveDeck.suspend();state.items=[];state.saved.clear();state.serverHome=null;state.serviceSearch=state.serviceListSearch=null;state.editing=null;state.detailGalleryItem=null;state.actualMember=null;state.form={kind:'website',title:'',description:'',url:'',body:'',visibility:'shared'};state.drafts=[];document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('#detail').innerHTML='';$('#resource-remove').innerHTML='';$('#main').innerHTML='<p role="status">访问身份已变化，正在重新确认…</p>';$('#account-menu').hidden=true;$('#account-menu p').textContent='正在确认身份';$('#account-menu-button').textContent='…';document.documentElement.dataset.authCheck='1';}
async function revalidateServiceIdentity(){if(identityCheck||!catalogSession.identity)return;const previous=catalogSession.identity;identityCheck=(async()=>{try{const {member}=await catalogClient.session();if(member.id!==previous.id||member.role!==previous.role||member.revision!==previous.revision){identityEvents.publish('permissions');return;}delete document.documentElement.dataset.authCheck;}catch(error){if(error.code==='IDENTITY_CHANGED')return;if(!document.documentElement.dataset.authCheck&&(!error.status||error.status>=500))return;if(previous.role==='guest'&&error.code==='GUEST_SESSION_EXPIRED'){delete document.documentElement.dataset.authCheck;catalogSession.expire();return;}clearPrivateServiceState();delete document.documentElement.dataset.authCheck;serviceLanding(error);}finally{identityCheck=null;}})();await identityCheck;}

async function loadServiceCatalog(renderPage=true){const generation=++serviceLoadGeneration;const data=await catalogClient.bootstrap();if(generation!==serviceLoadGeneration)return;catalogSession.adopt(data.member);state.categories=data.categories;state.items=data.items.map(serviceItem);state.saved=new Set(state.items.filter(x=>x.isSaved).map(x=>x.seedKey));state.serverHome=Object.fromEntries(Object.entries(data.home).map(([name,rows])=>[name,rows.map(serviceItem)]));state.serverSettings=data.settings;document.querySelector('.site-header').hidden=false;document.querySelector('.mobile-nav').hidden=false;delete document.documentElement.dataset.authCheck;liveDeck.resume();if(renderPage)route();if(state.role!=='guest'&&!state.notificationController)state.notificationController=window.mountCatalogNotifications({button:document.querySelector('[data-action=notifications]'),client:catalogClient,onError:serviceError,pollSeconds:state.serverSettings.notificationPollSeconds});}

function serviceLanding(error){if(error?.status===401||error?.status===403){location.replace('/login.html');return;}$('#main').innerHTML=empty('资源暂时无法载入',error?.message||'请稍后重试。','<button class="secondary" data-action="reload">重新载入</button>');}
function serviceLogin(){location.assign('/login.html?member=1#login');}
function applyServiceIdentity(identity){document.body.dataset.role=identity.role;if(state.actualMember&&(state.actualMember.id!==identity.id||state.actualMember.role!==identity.role)){clearSelectedFiles();state.gallery?.destroy();state.gallery=null;clearDetailRuntime();state.attachmentEditor?.destroy();state.attachmentEditor=null;state.sourceEditor?.destroy();state.sourceEditor=null;state.detailGalleryItem=null;state.items=[];state.editing=null;state.form={kind:'website',title:'',description:'',url:'',body:'',visibility:'shared'};state.saved.clear();state.drafts=[];state.serverHome=null;state.serviceSearch=null;state.serviceListSearch=null;searchGeneration++;$('#main').replaceChildren();$('#detail').replaceChildren();if($('#detail').open)$('#detail').close();}state.actualMember=identity;state.role=identity.role;$('#account-menu-button').textContent=[...identity.displayName][0];$('#account-menu p').textContent=identity.displayName+(identity.role==='guest'?' · 只读':'');$('#account-menu').innerHTML='<p>'+esc(identity.displayName)+(identity.role==='guest'?' · 只读':'')+'</p>'+(identity.role==='guest'?'<button data-action="service-login">成员登录</button>':'<a href="#/account">个人账户</a><a href="#/saved">我的收藏</a>'+(identity.role==='admin'?'<a href="#/admin">管理后台</a>':''))+'<hr><button class="danger" data-action="service-leave">退出'+(identity.role==='guest'?'游客访问':'登录')+'</button>';$('.add-button').hidden=identity.role==='guest';document.querySelector('[data-action="notifications"]').hidden=identity.role==='guest';}
function serviceError(error){if(error.code==='IDENTITY_CHANGED')return;if(error.code==='ACCOUNT_UNAVAILABLE'){identityEvents?.publish('permissions');return;}if(error.code==='GUEST_SESSION_EXPIRED'){catalogSession.expire();return;}if(error.status===401){clearPrivateServiceState();serviceLanding(error);return;}toast(error.message);}
const catalogSession=state.backendMode?window.createCatalogSession({client:catalogClient,lock:window.catalogGuestLock,onIdentity:applyServiceIdentity,onExpired:()=>{state.attachmentEditor?.destroy();state.attachmentEditor=null;state.gallery?.destroy();state.gallery=null;clearDetailRuntime();liveDeck.suspend();if(!$('#guest-expiry').open)$('#guest-expiry').showModal();},onError:error=>toast(error.message)}):null;
if(state.backendMode){const expiry=document.createElement('dialog');expiry.id='guest-expiry';expiry.className='small-dialog';expiry.setAttribute('aria-labelledby','guest-expiry-title');expiry.innerHTML='<h2 id="guest-expiry-title">访问已超时</h2><p>当前页面、搜索条件和浏览位置已保留。继续浏览需要重新申请游客名额。</p><p data-resume-message role="status"></p><div class="detail-actions"><button class="primary" data-action="service-resume">继续浏览</button><button class="secondary" data-action="service-login">成员登录</button></div>';expiry.addEventListener('cancel',event=>event.preventDefault());document.body.append(expiry);
 for(const type of ['pointerdown','keydown','scroll','touchstart'])document.addEventListener(type,event=>{if(event.isTrusted)catalogSession.record();},{passive:true,capture:true});
 setInterval(()=>catalogSession.tick(),1000);
 window.addEventListener('storage',event=>{if(event.key!=='forum-guest-event'||!event.newValue)return;try{const data=JSON.parse(event.newValue);if(catalogSession.identity?.leaseVersion!==data.version)return;if(data.action==='leave')catalogSession.expire();if(data.action==='member')loadServiceCatalog().catch(serviceError);}catch{}});
}
async function serviceResume(){const button=$('[data-action="service-resume"]');button.disabled=true;try{const member=await catalogSession.resume();if(!member)return;if(member.role!=='guest')await loadServiceCatalog();$('#guest-expiry').close();liveDeck.resume();if(member.role==='guest')await restoreDetailGallery();}catch(error){$('[data-resume-message]').textContent=error.message;}finally{button.disabled=false;}}
async function serviceLeave(){try{const identity=catalogSession.identity;await window.catalogGuestLock(()=>identity.role==='guest'?catalogClient.leave({leaseVersion:identity.leaseVersion}):catalogClient.logout());if(identity.role!=='guest')identityEvents?.publish('logout');if(identity.role==='guest')try{localStorage.setItem('forum-guest-event',JSON.stringify({action:'leave',version:identity.leaseVersion,time:Date.now()}));}catch{}location.replace('/login.html');}catch(error){serviceError(error);}}
function openCategoryManager(){const kind={websites:'website',ui:'ui',prompts:'prompt'}[state.route];if(!kind||state.role!=='admin')return;let dialog=$('#category-manager');if(!dialog){dialog=document.createElement('dialog');dialog.id='category-manager';dialog.className='category-manager';dialog.setAttribute('aria-labelledby','category-manager-title');document.body.append(dialog);}state.categoryManager?.destroy();state.categoryManager=window.mountCatalogCategoryManager({dialog,kind,items:state.categories[kind],client:catalogClient,onChanged:loadServiceCatalog});}
async function fetchServiceMetadata(){const form=$('#resource-form'),button=$('[data-action="fetch-metadata"]'),message=$('[data-metadata-message]');if(!form||!button)return;const field=form.elements.namedItem('url');if(!field.reportValidity()||!field.value.trim())return;const requested=field.value.trim();button.disabled=true;message.textContent='正在读取网站信息…';try{const result=await catalogClient.metadata(requested);if(!form.isConnected)return;const values=Object.fromEntries(new FormData(form)),patch=window.catalogMetadataPatch(values,result,requested);for(const [key,value]of Object.entries(patch))form.elements.namedItem(key).value=value;state.form={...state.form,...values,...patch};message.textContent=Object.keys(patch).length?'已填入空白字段，请核对后保存。':'读取结束，已保留你的手填内容。';}catch(error){if(form.isConnected)message.textContent=error.message+'；现有内容已保留，可继续手动填写。';if(error.status===401)serviceError(error);}finally{button.disabled=false;}}
function clearDetailRuntime(){state.discussionController?.destroy();state.discussionController=null;state.detailAttachments?.destroy();state.detailAttachments=null;state.runtimeView?.destroy();state.runtimeView=null;}
function mountUIDownloads(actions,item){
 const source=document.createElement('button'),prompt=document.createElement('button');
 source.type=prompt.type='button';source.className=prompt.className='secondary';
 source.textContent='下载源文件';prompt.textContent='下载提示词';
 const fileTitle=item.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').trim()||'UI组件';
 prompt.addEventListener('click',()=>{
  const authored=(item.materials??[]).find(material=>material.kind==='prompt'&&material.body?.trim())?.body;
  const platform={web:'网页',app:'移动应用',cross:'跨平台'}[item.platform]??'网页';
  const guidance=authored||[
   '制作一个用于'+platform+'的「'+item.title+'」组件。',
   item.longDescription||item.description,
   '请提供可运行的示例，展示组件的默认状态、用户操作后的反馈，以及恢复初始状态的方式。',
   '适配窄屏和键盘操作，保留清晰的焦点样式，并为减少动态效果的偏好提供简化过渡。'
  ].filter(Boolean).join('\n\n');
  window.downloadUIFile(new Blob([guidance],{type:'text/plain;charset=utf-8'}),fileTitle+(authored?'-提示词.txt':'-复现提示词.txt'));
 });
 let alternatives=null;
 source.addEventListener('click',async()=>{
  if(alternatives){alternatives.hidden=!alternatives.hidden;source.setAttribute('aria-expanded',String(!alternatives.hidden));return;}
  source.disabled=true;
  const isCurrent=()=>source.isConnected&&$('#detail').open&&state.role!=='guest';
  try{
   const {manifest}=await catalogClient.uiSources(item.id);
   if(!isCurrent())return;
   if(manifest?.files?.length){
    const {blob,name}=window.packageUISource(manifest.files,fileTitle);window.downloadUIFile(blob,name);return;
   }
   const {items}=await catalogClient.attachments({kind:'ui',id:item.id});
   if(!isCurrent())return;
   const files=items.filter(file=>['code','archive'].includes(file.fileKind)&&file.downloadUrl);
   if(files.length){
    const linkFor=file=>{const link=document.createElement('a');link.className='secondary';link.href=file.downloadUrl;link.download=file.name;link.textContent=file.name;return link;};
    if(files.length===1){linkFor(files[0]).click();return;}
    alternatives=document.createElement('div');alternatives.className='detail-actions ui-source-downloads';
    alternatives.append(...files.map(linkFor));actions.after(alternatives);source.setAttribute('aria-expanded','true');return;
   }
   const code=(item.materials??[]).filter(material=>material.kind==='code'&&material.body);
   if(code.length){
    const files=code.map((material,index)=>({path:'source-'+(index+1)+'.'+(/^[a-z0-9]{1,8}$/i.test(material.language??'')?material.language:'txt'),content:material.body}));
    const {blob,name}=window.packageUISource(files,fileTitle);window.downloadUIFile(blob,name);
   }else toast('这项资源暂无源文件');
  }catch(error){if(isCurrent())serviceError(error);}finally{source.disabled=false;}
 });
 actions.append(source,prompt);
}
function mountDetailMedia(item){state.detailGalleryItem=item;if(item.kind==='website')return;if(state.backendMode){let attachmentRoot=$('#detail [data-detail-attachments]');if(!attachmentRoot){attachmentRoot=document.createElement('section');attachmentRoot.className='detail-section';attachmentRoot.dataset.detailAttachments='';const discussion=$('#detail [data-detail-discussion]');if(discussion)discussion.before(attachmentRoot);else $('#detail').append(attachmentRoot);}state.detailAttachments=window.mountCatalogAttachments({root:attachmentRoot,target:{kind:item.kind,id:item.id},client:catalogClient,role:state.role,presentation:item.kind==='prompt'?'prompt':'ui',mediaRoot:!item.hasRuntime&&!item.sample&&!item.previews?.length?$('#detail .detail-media'):null,onError:serviceError});}if(item.kind==='ui'&&item.hasRuntime){let tools=$('#detail [data-ui-runtime-tools]');if(!tools){tools=document.createElement('section');tools.className='detail-section';tools.dataset.uiRuntimeTools='';$('#detail [data-detail-discussion]').before(tools);}state.runtimeView=window.mountUIRuntimeView({previewRoot:$('#detail .detail-media'),toolsRoot:tools,title:item.title,requestTicket:options=>catalogClient.uiTicket(item.id,options),onError:serviceError,onStart:()=>{state.gallery?.destroy();state.gallery=null;},onFallback:()=>{if(item.previews?.length)mountDetailGallery(item);}});}else mountDetailGallery(item);}
function mountDetailGallery(item){state.gallery?.destroy();state.gallery=null;state.detailGalleryItem=item;if(item.sample||!item.previews?.length)return;const root=$('#detail .detail-media');if(!root)return;state.gallery=window.mountCatalogGallery({root,urls:item.previews.map(p=>p.url),title:item.title,onError:serviceError,load:async(url,signal)=>{if(/^\/api\/v1\/(?:files|attachments\/files)\//.test(url)){const blob=await catalogClient.image(url,{signal}),src=URL.createObjectURL(blob);return {src,revoke:()=>URL.revokeObjectURL(src)};}if(!/^https:\/\//i.test(url)&&!/^\/?assets\//.test(url))throw new Error('图片地址无效');return {src:url};}});}
async function restoreDetailGallery(){if(!$('#detail').open||!state.detailGalleryItem)return;const item=state.detailGalleryItem;try{const data=await catalogClient.detailResource(item);if($('#detail').open&&state.detailGalleryItem===item)mountDetailMedia({...item,...data,title:data.title??data.name});}catch(error){state.gallery?.destroy();state.gallery=null;serviceError(error);}}
function memberGate(){return empty('登录后继续','成员可以添加资源、收藏和管理自己的内容。','<button class="primary" data-action="service-login">成员登录</button>');}
let searchTimer,searchRequest,searchGeneration=0;
function queueServiceSearch(mode){clearTimeout(searchTimer);searchRequest?.abort();const generation=++searchGeneration,q=(mode==='global'?state.query:state.listQuery).trim().toLowerCase(),kind={websites:'website',ui:'ui',prompts:'prompt'}[state.route];if(!q){state.serviceSearch=null;state.serviceListSearch=null;return;}
 searchTimer=setTimeout(async()=>{try{const controller=searchRequest=new AbortController(),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]);const items=(await catalogClient.listAll(mode==='global'?'all':kind,q,{signal})).map(serviceItem);if(generation!==searchGeneration)return;if(mode==='global'){state.serviceSearch={q,items};if(state.route==='search')render();}else if(state.listQuery.trim().toLowerCase()===q&&kind==={websites:'website',ui:'ui',prompts:'prompt'}[state.route]){state.serviceListSearch={kind,q,items};const results=filtered(kind);$('#listing-results').innerHTML=catalogPageResults(kind,results);$('#result-count').textContent=catalogCount(paginateCatalog(kind,results,state.page));liveDeck.refresh($('#main'));}}catch(error){if(generation!==searchGeneration)return;const failed={q,items:[],error:error.name==='TimeoutError'?'搜索超时，请重试。':error.message};if(mode==='global')state.serviceSearch=failed;else state.serviceListSearch={...failed,kind};serviceError(error);render();}},250);
}
function clearSelectedFiles(){for(const job of state.selectedFiles??[])if(job.preview)URL.revokeObjectURL(job.preview);state.selectedFiles=[];}
function drawSelectedFiles(){const root=$('[data-selected-files]');if(!root)return;root.innerHTML=(state.selectedFiles??[]).map(job=>{const progress=job.progress,text=job.saved?'已上传':progress?.error||(progress?.phase==='ready'?'已上传':progress?.phase==='validating'?'校验中':progress?.phase==='waiting'?'等待上传':progress?.phase==='uploading'?'上传中 '+Math.round(progress.confirmedBytes/progress.total*100)+'%':'待上传');return '<article class="selected-file">'+(job.preview?(job.fileKind==='video'?'<video src="'+job.preview+'" preload="metadata" controls playsinline aria-label="'+esc(job.file.name)+'"></video>':'<img src="'+job.preview+'" alt="'+esc(job.file.name)+'">'):'')+'<div><strong>'+esc(job.file.name)+'</strong><p role="status">'+esc(text)+'</p></div><button type="button" class="text-button" data-remove-selected-file="'+job.key+'" '+(state.saving||job.saved?'disabled':'')+'>移除</button></article>';}).join('');}
async function removeSelectedFile(key){const job=(state.selectedFiles??[]).find(x=>x.key===key);if(!job||state.saving||state.fileCanceling||job.saved)return;state.fileCanceling=true;try{if(job.model){await job.model.cancel();if(job.model.state.objectId&&job.model.state.phase!=='canceled')throw new Error('上传状态尚未确认，请重试');}if(job.preview)URL.revokeObjectURL(job.preview);state.selectedFiles=state.selectedFiles.filter(x=>x!==job);}catch(error){const message=$('[data-editor-message]');if(message)message.textContent=error.message;}finally{state.fileCanceling=false;drawSelectedFiles();}}
async function saveServiceResource(status='published'){
 if(state.saving||state.fileCanceling||state.role==='guest')return;const form=$('#resource-form');if(!form||!window.validateCatalogEditor(form,{draft:status==='draft'}))return;state.form={...state.form,...Object.fromEntries(new FormData(form))};if(status==='draft'&&!state.form.categoryId&&!state.form.catalogCategoryId){const select=form.querySelector('[data-editor-category]'),option=[...select.options].find(option=>option.value);if(!option){$('[data-editor-message]').textContent='暂时没有可用分类。';return;}state.form[select.name]=option.value;}state.saving=true;const submitButton=form.querySelector('button[type=submit]');submitButton?.setAttribute('aria-busy','true');const controls=[...form.querySelectorAll('button,input,textarea,select')].map(node=>({node,disabled:node.disabled}));controls.forEach(({node})=>node.disabled=true);const message=$('[data-editor-message]');const editing=!!state.editing;message.textContent=(state.selectedFiles??[]).some(job=>!job.saved)?'正在上传文件…':editing?'正在保存…':'正在发布…';drawSelectedFiles();
 try{const kind=state.form.kind;if(status==='published'&&kind==='website'&&state.form.url!==state.editing?.data.url){const duplicates=await catalogClient.duplicate({url:state.form.url,...(state.editing?{excludeId:state.editing.id}:{})});if(duplicates.items.length&&!confirm('这个网址或域名已有收录：'+duplicates.items.map(item=>item.name).join('、')+'。仍要添加这条资源吗？')){message.textContent='发布已取消，填写的内容已保留。';return;}}const privacyChange=!!state.editing&&(state.form.visibility!==state.editing.data.visibility||state.editing.data.resourceStatus!=='published');await window.publishCatalogResource({form:state.form,current:state.editing?.data??null,files:state.selectedFiles??[],client:catalogClient,status,onStaged:data=>{state.editing={id:data.id,data};form.querySelectorAll('[name=kind]').forEach(node=>node.disabled=true);},onProgress:()=>drawSelectedFiles()});if(privacyChange)identityEvents?.announce('resource');clearSelectedFiles();state.editing=null;state.form={kind:'website',title:'',description:'',url:'',body:'',visibility:'shared'};state.step=1;await loadServiceCatalog(false);location.hash=status==='draft'?'/saved?view=drafts':kind==='website'?'/websites':kind==='ui'?'/ui':'/prompts';toast(status==='draft'?'草稿已保存':editing?'已保存':'已发布');}
 catch(error){if(message.isConnected)message.textContent=error.message;serviceError(error);}finally{state.saving=false;submitButton?.removeAttribute('aria-busy');controls.forEach(({node,disabled})=>node.disabled=disabled||(node.name==='kind'&&!!state.editing));drawSelectedFiles();}
}

async function editServiceResource(id){const item=state.items.find(x=>x.seedKey===id);if(!item?.canEdit||state.saving)return;clearSelectedFiles();try{const data=await catalogClient.detailResource(item);state.editing={id:item.id,data};state.form={kind:item.kind,title:data.title??data.name,description:data.description,url:data.url??'',logoUrl:data.logoUrl??'',categoryId:data.categoryId,catalogCategoryId:data.catalogCategoryId,tags:data.tags.join(', '),body:(data.materials??[]).find(m=>m.kind===(item.kind==='prompt'?'prompt':'code'))?.body??'',previewUrl:'',visibility:data.visibility};if(item.kind==='ui'){const source=await catalogClient.uiSources(item.id);if(source.manifest||source.platform)state.form.uiSource={manifest:source.manifest??null,platform:source.platform,displayType:source.displayType,background:source.background,compiled:source.compiled,diagnostic:source.diagnostic};}state.step=1;if($('#detail').open)$('#detail').close();if(location.hash==='#/add')render();else location.hash='/add';}catch(error){serviceError(error);}}
function confirmRemoveResource(id){const item=state.items.find(x=>x.seedKey===id);if(!item?.canEdit)return;const el=$('#resource-remove');el.dataset.key=id;el.innerHTML='<h2>移至回收站</h2><p>'+esc(item.title)+' 将从资源列表移除。</p><p data-remove-message role="status"></p><div class="detail-actions"><button class="secondary" data-close="resource-remove">取消</button><button class="primary" data-action="service-remove-confirm">确认移除</button></div>';el.showModal();}
async function removeServiceResource(){const el=$('#resource-remove'),item=state.items.find(x=>x.seedKey===el.dataset.key),button=$('[data-action="service-remove-confirm"]');if(!item)return;button.disabled=true;try{await catalogClient.removeResource(item);el.close();if($('#detail').open)$('#detail').close();await loadServiceCatalog();identityEvents?.announce('resource');toast('资源已移除');}catch(error){$('[data-remove-message]').textContent=error.message;serviceError(error);}finally{button.disabled=false;}}
if(state.backendMode){const el=document.createElement('dialog');el.id='resource-remove';el.className='small-dialog';document.body.append(el);}
state.folder='all';state.listQuery='';state.page=1;state.collapsedGroups=new Set();
let trigger=null,toastTimer;
function toast(text){const el=$('#toast');el.textContent=text;el.hidden=false;if(el.showPopover&&!el.matches(':popover-open'))el.showPopover();clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidePopover?.();el.hidden=true;},3500);}
function label(kind){return {website:'网站',ui:'UI',prompt:'提示词'}[kind];}
function badge(kind){return `<span class="badge">${label(kind)}</span>`;}
function empty(title,description,action=''){return `<div class="empty-state">${icon('bookmark')}<h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`;}
function heading(title,description,extra=''){return `<div class="page-heading"><div><h1>${title}</h1></div>${extra}</div>`;}
function cover(item,compact=false){
 if(item.kind==='prompt'&&!item.cover)return `<div class="no-preview">${icon('message-square')}<span>提示词</span></div>`;
 if(item.kind==='website')return `<div class="website-cover">${siteLogo(item)}<span>${esc(item.title)}</span></div>`;
 const source=item.cover?.startsWith('/api/v1/attachments/files/')?item.cover:item.thumbnail||item.cover;if(source&&item.coverType==='video')return `<video class="ui-thumbnail" src="${esc(source)}" muted playsinline preload="metadata" aria-label="${esc(item.title)}视频效果"></video>`;
 return source?cardImage(source,item.title):`<div class="no-preview">${icon('layout-grid')}<span>预览待补充</span></div>`;
}
function card(item,compact=false){
 if(item.kind==='website')return websiteCard(item);
 if(item.kind==='ui'&&(item.sample||item.hasRuntime))return previewCard(item);
 if(compact)return `<article class="compact-card"><button data-open="${esc(item.seedKey)}" class="compact-main"><img src="${esc(item.logo||'assets/icons/layout-grid.svg')}" alt="" loading="lazy"><span><strong>${esc(item.title)}</strong><small>${esc(item.description)}</small>${badge(item.kind)}</span></button><button class="save-btn ${state.saved.has(item.seedKey)?'saved':''}" data-save="${esc(item.seedKey)}" aria-pressed="${state.saved.has(item.seedKey)}" aria-label="${state.saved.has(item.seedKey)?'取消收藏':'收藏'}${esc(item.title)}">${icon('bookmark')}</button></article>`;
 return `<article class="resource-card"><button class="card-cover" style="background:${esc(item.preview?.background||'var(--canvas)')}" data-open="${esc(item.seedKey)}" aria-label="查看${esc(item.title)}">${cover(item)}<span class="cover-action">${item.kind==='ui'?'查看效果':item.kind==='prompt'?'查看内容':'查看网站'}</span></button><div class="card-body"><div class="card-title"><button data-open="${esc(item.seedKey)}">${esc(item.title)}</button><button class="save-btn ${state.saved.has(item.seedKey)?'saved':''}" data-save="${esc(item.seedKey)}" aria-label="${state.saved.has(item.seedKey)?'取消收藏':'收藏'}${esc(item.title)}" aria-pressed="${state.saved.has(item.seedKey)}">${icon('bookmark')}</button></div><p>${esc(item.description)}</p>${badge(item.kind)}</div></article>`;
}
function section(title,content,to,compact=false){return `<section class="home-section"><div class="section-heading"><h2>${title}</h2>${to?`<a class="text-link" href="#/${to}">查看全部</a>`:''}</div>${content}</section>`;}
function home(){
 const featuredSection=(title,rows,to,limit,compact=false)=>rows?.length?section(title,'<div class="'+(compact?'compact-grid':'cards-grid')+'">'+rows.slice(0,limit).map(item=>card(item,compact)).join('')+'</div>',to):'';
 if(state.serverHome){const h=state.serverHome;return heading('首页','')+
  featuredSection('精选网站',h.featuredWebsites,'websites',6,true)+
  featuredSection('精选 UI',h.featuredUI,'ui',3)+
  featuredSection('精选提示词',h.featuredPrompts,'prompts',3);}
 const by=slug=>state.items.find(x=>x.seedKey.endsWith(slug));
 const websites=[17,18,20,22,24,41].map(n=>by('site-'+String(n).padStart(2,'0'))).filter(Boolean);
 const ui=['accordion-menu','slider-switch','orbit-loader'].map(by).filter(Boolean);
 return heading('首页','')+featuredSection('精选网站',uniqueCatalogResources(websites,state.saved),'websites',6,true)+featuredSection('精选 UI',ui,'ui',3)+featuredSection('精选提示词',state.items.filter(x=>x.kind==='prompt'),'prompts',3);
}

function uniqueSearchResults(rows){return uniqueCatalogResources(rows,state.saved);}
function findCatalogItem(key){return [...state.items,...(state.serviceSearch?.items??[]),...(state.serviceListSearch?.items??[])].find(item=>item.seedKey===key);}
function search(){
 const q=state.query.trim().toLowerCase();if(state.backendMode&&q&&state.serviceSearch?.q!==q)return heading('搜索资源','在网站、UI 组件和提示词中查找。')+skeleton('正在搜索…');if(state.backendMode&&q&&state.serviceSearch?.error)return heading('搜索资源','在网站、UI 组件和提示词中查找。')+empty('搜索暂时不可用',state.serviceSearch.error,'<button class="secondary" data-action="retry-search">重试搜索</button>');const items=uniqueSearchResults(state.backendMode&&state.serviceSearch?.q===q?state.serviceSearch.items:q?state.items.filter(x=>[x.title,x.description,...x.tags].join(' ').toLowerCase().includes(q)):[]);
 return heading('搜索资源','在网站、UI 组件和提示词中查找。')+`<div class="results-meta"><span>${q?'“'+esc(state.query)+'” · '+items.length+' 个结果':'输入关键词开始搜索'}</span>${q?'<button class="text-button" data-action="clear-filters">清除搜索</button>':''}</div><div id="global-results">`+(items.length?`<div class="cards-grid">${items.map(x=>card(x)).join('')}</div><p class="search-end muted">已显示全部结果</p>`:empty(q?'没有找到匹配的资源':'你想找点什么？',q?'试试其他关键词。':'使用顶部搜索框查找你收藏的内容。'))+'</div>';
}
function saved(){
 if(state.backendMode)return '<div id="catalog-personal-root"></div>';
 let items=state.items.filter(x=>state.saved.has(x.seedKey));
 if(state.collection==='网站')items=items.filter(x=>x.kind==='website');
 if(state.collection==='UI')items=items.filter(x=>x.kind==='ui');
 const tabs=['全部收藏','网站','UI','我的发布','私人资源','草稿','回收站'];
 let body;
 if(state.backendMode&&state.collection==='草稿'){const drafts=state.items.filter(x=>x.ownerId===state.actualMember?.id&&x.resourceStatus==='draft');body=drafts.length?'<div class="cards-grid">'+drafts.map(x=>card(x)).join('')+'</div>':empty('还没有草稿','保存的草稿仅自己可见。');}
 else if(state.collection==='草稿')body=state.drafts.length?`<div class="draft-list">${state.drafts.map((x,i)=>`<button class="draft-row" data-draft="${i}"><span>${icon('file-text')}<strong>${esc(x.title||'未命名草稿')}</strong></span><span>${label(x.kind)} ${icon('chevron-right')}</span></button>`).join('')}</div>`:empty('还没有草稿','编写资源时可以先保存草稿。','<a class="secondary" href="#/add">开始添加</a>');
 else if(state.collection==='回收站')body=empty('回收站为空','移除的内容会在接入后按回收规则管理。');
 else if(state.collection==='我的发布'||state.collection==='私人资源'){const own=state.items.filter(x=>(state.backendMode?x.ownerId===state.actualMember?.id:x.seedKey.startsWith('preview-'))&&(state.collection==='我的发布'||x.visibility==='private'));body=own.length?`<div class="cards-grid">${own.map(x=>card(x)).join('')}</div>`:empty('这里暂时没有资源','你在本次预览添加的内容可在这里查看。','<a class="secondary" href="#/add">添加资源</a>');}
 else body=items.length?`<div class="cards-grid">${items.map(x=>card(x)).join('')}</div>`:empty('把喜欢的资源留在这里','点击资源卡片上的收藏按钮，下次更容易找到。','<a href="#/websites" class="secondary">浏览网站</a>');
 return heading('收藏','整理常用资源，也给新灵感留一点位置。')+`<button class="secondary mobile-categories collection-category-button" data-action="categories">${icon('menu')}分类：${state.collection}</button><div class="workspace-layout collection-layout"><aside class="side-menu" aria-label="收藏分类">${tabs.map(x=>`<button data-collection="${x}" class="${state.collection===x?'active':''}" aria-current="${state.collection===x?'page':'false'}">${esc(x)}${x==='全部收藏'?`<span>${state.saved.size}</span>`:''}</button>`).join('')}</aside><section><div class="section-heading"><h2>${state.collection}</h2><span class="muted">${['全部收藏','网站','UI'].includes(state.collection)?items.length+' 个资源':''}</span></div>${body}</section></div>`;
}
function add(){
 if(state.backendMode)return window.renderCatalogEditor({form:state.form,categories:state.categories?.[state.form.kind]??[],editing:!!state.editing,canDraft:!state.editing||state.editing.data.resourceStatus==='draft',step:state.step});
 const f=state.form;
 if(state.step===2)return heading('确认资源','检查内容后，保存在本次预览中。')+`<div class="editor-layout"><section class="panel"><div class="step-row"><span>1 填写内容</span><strong>2 确认保存</strong></div><h2>${esc(f.title)}</h2><p class="muted">${label(f.kind)} · ${f.visibility==='private'?'仅自己可见':'共享资源'}</p><p class="review-text">${esc(f.description)}</p>${f.kind==='website'?`<p class="review-url">${esc(f.url)}</p>`:`<pre class="review-text">${esc(f.body||'尚未填写材料')}</pre>`}<div class="form-actions"><button class="secondary" data-action="edit-again">返回修改</button><button class="primary" data-action="confirm-save">保存在本次预览</button></div></section><aside class="form-aside"><h3>保存说明</h3><p>当前页面用于确认布局与流程。此处保存不会发布到线上，刷新页面后恢复原始资料。</p></aside></div>`;
 return heading('添加资源','把实用的工具、喜欢的界面和自己的经验整理下来。')+`<div class="editor-layout"><form id="resource-form" class="panel"><div class="step-row"><strong>1 填写内容</strong><span>2 确认保存</span></div><fieldset class="type-picker"><legend>资源类型</legend>${[['website','网站','globe'],['ui','UI','layout-grid'],['prompt','提示词','message-square']].map(([v,n,i])=>`<label class="type-choice ${f.kind===v?'selected':''}"><input type="radio" name="kind" value="${v}" ${f.kind===v?'checked':''}>${icon(i)}${n}</label>`).join('')}</fieldset><label class="field">资源名称 <span class="required">必填</span><input name="title" maxlength="80" required value="${esc(f.title)}" placeholder="请输入名称"></label><label class="field">简介<textarea name="description" rows="3" maxlength="500" placeholder="用途与特点">${esc(f.description)}</textarea></label>${f.kind==='website'?`<label class="field">网站链接 <span class="required">必填</span><input name="url" type="url" required value="${esc(f.url)}" placeholder="https://example.com"></label>`:`<label class="field">${f.kind==='prompt'?'提示词正文':'代码或参考说明'}<textarea name="body" rows="7" placeholder="${f.kind==='prompt'?'在这里写下你自己的提示词…':'粘贴代码或记录参考说明…'}">${esc(f.body)}</textarea></label>`}<label class="field">可见范围<select name="visibility"><option value="shared" ${f.visibility==='shared'?'selected':''}>共享资源 · 访客可浏览摘要</option><option value="private" ${f.visibility==='private'?'selected':''}>私人资源 · 仅自己可见</option></select></label><div class="form-actions"><button type="button" class="secondary" data-action="save-draft">保存草稿</button><button class="primary" type="submit">下一步</button></div></form><aside class="form-aside"><h3>整理得更清楚</h3><p>一个资源保留一条记录。同一组件只改方向、配色或文案时，可以写在说明中。</p><h3>先保存，再完善</h3><p>暂时没写完的内容可以保留为草稿，之后继续补充。</p><div class="subtle-note">本地界面预览：暂未连接线上发布与文件上传。</div></aside></div>`;
}
async function loadMemberProfile(form){
 const status=form.querySelector('[data-profile-status]'),email=form.querySelector('[data-profile-email]'),retry=form.querySelector('[data-action=reload-profile]');
 retry.hidden=true;status.textContent='';email.placeholder='正在读取…';
 try{const profile=await catalogClient.accountRequest('/api/v1/account/profile');if(form.isConnected){email.value=profile.email??'';email.placeholder=profile.email?'':'未提供登录邮箱';}}
 catch(error){if(form.isConnected){email.placeholder='暂时无法读取';status.textContent=error.name==='TimeoutError'?'个人资料加载超时，请重试。':'个人资料暂时无法读取，请重试。';retry.hidden=false;}if(error.status===401)serviceError(error);}
}
async function saveMemberProfile(form){
 const button=form.querySelector('button[type=submit],button:not([type])'),status=form.querySelector('[data-profile-status]');
 if(button.disabled)return;
 button.disabled=true;status.textContent='正在保存…';
 try{
  const result=await catalogClient.accountRequest('/api/v1/account/profile',{displayName:form.elements.displayName.value},'PATCH');
  state.actualMember.displayName=result.displayName;
  $('#account-menu p').textContent=result.displayName;$('#account-menu-button').textContent=[...result.displayName][0];
  if(form.isConnected){$('[data-profile-name]').textContent=result.displayName;$('[data-profile-avatar]').textContent=[...result.displayName][0];status.textContent='昵称已保存';}
 }catch(error){if(form.isConnected)status.textContent=error.name==='TimeoutError'?'保存结果暂时无法确认，请刷新后核对。':error.message;if(error.status===401)serviceError(error);}
 finally{button.disabled=false;}
}
function account(){
 const tabs=['个人资料','登录与设备','显示设置',...(state.backendMode?['通知偏好','账号注销']:[])];let body;
 if(state.accountTab==='个人资料')body=`<div class="profile-heading"><span class="avatar large">本</span><div><h2>本地预览成员</h2></div></div><form id="profile-form"><label class="field">昵称<input name="nickname" value="本地预览成员" required maxlength="40"></label><label class="field">个人简介<textarea name="bio" rows="3" placeholder="选填"></textarea></label><button class="primary">保存预览资料</button></form>`;
 if(state.accountTab==='个人资料'){if(state.backendMode)body='<div class="profile-heading"><span class="avatar large" data-profile-avatar>'+esc([...state.actualMember.displayName][0])+'</span><div><h2 data-profile-name>'+esc(state.actualMember.displayName)+'</h2><p class="muted">'+(state.role==='admin'?'超级管理员':'成员')+'</p></div></div><form id="member-profile-form"><label class="field">登录邮箱<input data-profile-email type="email" readonly placeholder="正在加载…"></label><label class="field">昵称<input name="displayName" value="'+esc(state.actualMember.displayName)+'" required maxlength="40"></label><button class="primary">保存昵称</button><p role="status" data-profile-status></p><button class="secondary" type="button" data-action="reload-profile" hidden>重试</button></form><a class="text-link" href="#/saved?view=published">我的内容</a>';}
 else if(state.accountTab==='通知偏好')body='<div id="catalog-notification-preferences"></div>';
 else if(state.accountTab==='账号注销')body='<div id="catalog-account-lifecycle-root"></div>';
 else if(state.accountTab==='登录与设备')body='<div id="account-security-root"></div>';
 else body=`<h2>显示设置</h2><div class="setting-row"><div><strong>界面动画</strong></div><label class="switch-label"><input type="checkbox" id="motion-toggle" role="switch" aria-label="界面动画" ${document.body.classList.contains('reduce-motion')?'':'checked'}><span id="motion-status">${document.body.classList.contains('reduce-motion')?'已关闭':'已启用'}</span></label></div>`;
 return heading('个人账户','管理个人资料、设备与显示偏好。')+`<div class="workspace-layout"><aside class="side-menu" aria-label="账户设置">${tabs.map(t=>t==='通知偏好'?`<a class="${state.accountTab===t?'active':''}" href="#/account/notifications" ${state.accountTab===t?'aria-current="page"':''}>${t}</a>`:`<button data-account-tab="${t}" class="${state.accountTab===t?'active':''}">${t}</button>`).join('')}</aside><section class="panel account-panel">${body}</section></div>`;
}
function admin(){if(state.backendMode)return '<div id="catalog-admin-root"></div>';
 const shared=state.items.filter(x=>x.visibility!=='private');
 const tabs=['资源管理','成员管理','反馈处理','运行概览'];let body;
 if(state.adminTab==='资源管理')body=`<div class="section-heading"><h2>共享资源</h2><span class="muted">本地资料 ${shared.length} 条</span></div><div class="table-scroll"><table><thead><tr><th>名称</th><th>类型</th><th>来源</th><th>操作</th></tr></thead><tbody>${shared.slice(0,12).map(x=>`<tr><td>${esc(x.title)}</td><td>${badge(x.kind)}</td><td>${x.seedKey.startsWith('preview-')?'本地新增':x.kind==='website'?'用户书签':'MIT 开源样例'}</td><td><button class="text-button" data-open="${x.seedKey}">查看详情</button></td></tr>`).join('')}</tbody></table></div><p class="muted table-caption">仅展示前 12 条本地资料，用于确认表格布局。</p>`;
 else if(state.backendMode&&state.adminTab==='成员管理')body='<div id="catalog-member-lifecycle-root"></div>';
 else if(state.adminTab==='运行概览')body=`<h2>运行概览</h2><div class="stats-grid">${[['网站',41],['UI',8],['提示词',0]].map(([n,v])=>`<div class="stat"><span>${n}</span><strong>${v}</strong><small>本地初始资料</small></div>`).join('')}</div><div class="quiet-empty">${icon('database')}<div><strong>运行指标待接入</strong><p>存储、流量与请求量会使用实际服务数据，不显示估造数值。</p></div></div>`;
 else body=empty(state.adminTab==='成员管理'?'尚未连接成员目录':'暂无已连接的反馈',state.adminTab==='成员管理'?'接入账户服务后展示真实成员和邀请状态。':'反馈服务接入后在此处理，不预置虚假反馈。');
 return heading('管理后台','共享内容与站点运行的集中入口。',`<span class="status-pill">界面预览</span>`)+`<div class="workspace-layout"><aside class="side-menu" aria-label="后台导航">${tabs.map(t=>`<button data-admin-tab="${t}" class="${state.adminTab===t?'active':''}">${t}</button>`).join('')}</aside><section class="panel">${body}</section></div>`;
}
function render(){
 state.notificationPreferencesController?.destroy();state.notificationPreferencesController=null;
 state.adminController?.destroy();state.adminController=null;state.personalController?.destroy();state.personalController=null;state.accountLifecycleController?.destroy();state.accountLifecycleController=null;
 document.body.dataset.route=state.route;
 $('.desktop-nav').innerHTML=navs.map(([r,t])=>`<a href="#/${r}" class="${state.route===r?'active':''}" ${state.route===r?'aria-current="page"':''}>${t}</a>`).join('');
 $('.mobile-nav').innerHTML=navs.map(([r,t,i])=>`<a href="#/${r}" class="${state.route===r?'active':''}" ${state.route===r?'aria-current="page"':''}>${icon(i)}<span>${t}</span></a>`).join('');
 const pages={home,search,websites:()=>listing('website'),ui:()=>listing('ui'),prompts:()=>listing('prompt'),saved,add,account,admin};
 state.attachmentEditor?.destroy();state.attachmentEditor=null;state.securityController?.destroy();state.sourceEditor?.destroy();state.sourceEditor=null;
 $('#main').innerHTML=state.backendMode&&state.role==='guest'&&['add','account','admin'].includes(state.route)?memberGate():state.backendMode&&state.route==='admin'&&state.role!=='admin'?empty('没有管理权限','此入口仅供超级管理员使用。'):(pages[state.route]||home)();
 const adminRoot=$('#catalog-admin-root');if(adminRoot&&state.role==='admin')state.adminController=window.mountCatalogAdmin({root:adminRoot,client:catalogClient,member:state.actualMember,onOpen:row=>detail(adoptPersonalItem(row)),onEdit:row=>editServiceResource(adoptPersonalItem(row)),onChanged:()=>loadServiceCatalog(false),onError:serviceError});
 const personalRoot=$('#catalog-personal-root');if(personalRoot)state.personalController=window.mountCatalogPersonal({root:personalRoot,client:catalogClient,guest:state.role==='guest',onFavoriteChanged:updateFavorite,onOpen:row=>detail(adoptPersonalItem(row)),onEdit:row=>editServiceResource(adoptPersonalItem(row)),onChanged:()=>loadServiceCatalog(false),onError:serviceError});
 const lifecycleRoot=$('#catalog-account-lifecycle-root')||$('#catalog-member-lifecycle-root');if(lifecycleRoot&&state.role!=='guest')state.accountLifecycleController=window.mountCatalogAccountLifecycle({root:lifecycleRoot,client:catalogClient,member:state.actualMember,admin:lifecycleRoot.id==='catalog-member-lifecycle-root',onError:serviceError});
 const sourceRoot=$('#native-source-editor');if(sourceRoot&&state.backendMode)state.sourceEditor=window.mountUISourceEditor({root:sourceRoot,initial:state.form.uiSource,onChange:value=>state.form.uiSource=value,test:catalogClient.testUI,compilerConfig:catalogClient.compilerConfig,onError:serviceError});
 const attachmentRoot=$('#catalog-attachment-editor');if(attachmentRoot&&state.backendMode&&state.editing)state.attachmentEditor=window.mountCatalogAttachments({root:attachmentRoot,target:{kind:state.form.kind,id:state.editing?.id??null},client:catalogClient,editor:true,allowUpload:false,role:state.role,version:state.editing?.data.version??null,onVersion:(previous,next)=>{if(state.editing?.data.version===previous)state.editing.data.version=next;},onSnapshot:result=>{const item=state.items.find(x=>x.kind===state.form.kind&&x.id===state.editing?.id);if(!item)return;const media=result.items.filter(x=>x.isPreview&&x.previewUrl),cover=media.find(x=>x.isCover)??media[0];item.version=result.version;item.cover=cover?.previewUrl??state.editing.data.previews?.[0]?.url??state.editing.data.coverUrl??null;item.coverType=cover?.fileKind??'image';},onError:serviceError});
 drawSelectedFiles();
 if($('[data-publication-limits]'))loadPublicationLimits();
 const prefsRoot=$('#catalog-notification-preferences');if(prefsRoot)state.notificationPreferencesController=window.mountCatalogNotificationPreferences({root:prefsRoot,client:catalogClient,onError:serviceError});
 const profileForm=$('#member-profile-form');if(profileForm)loadMemberProfile(profileForm);
 const securityRoot=$('#account-security-root');if(securityRoot)state.securityController=window.AccountSecurity.mount(securityRoot,{member:state.actualMember,request:state.backendMode?catalogClient.accountRequest:undefined,onAuthenticated:identity=>{if(state.backendMode){loadServiceCatalog().catch(serviceError);return;}state.actualMember=identity;$('#account-menu p').textContent=identity.displayName;$('#account-menu-button').textContent=[...identity.displayName][0];}});
 document.title=`${(state.route==='account'&&state.accountTab==='通知偏好'?'通知偏好':({home:'首页',search:'搜索',websites:'网站',ui:'UI',prompts:'提示词',saved:'收藏',add:'添加资源',account:'个人账户',admin:'管理后台'})[state.route])} · 躺平万岁`;
 $('#route-announcement').textContent=document.title;
 liveDeck.refresh($('#main'));
}
function route(){
 if(state.saving){history.replaceState(null,'','#/add');toast('请等待发布完成');return;}
 abortDetailRead();detailGeneration++;
 const [path,query='']=location.hash.replace(/^#\/?/,'').split('?');
 const parts=path.split('/');const params=new URLSearchParams(query);
 const valid=['home','websites','ui','prompts','saved','add','account','admin','search'];
 const preferencesPath=['account/notifications','account/notification-preferences','notifications/preferences','notification-preferences'].includes(path);
 const next=preferencesPath?'account':valid.includes(parts[0])?parts[0]:'home';
 if(next==='account')state.accountTab=preferencesPath&&state.backendMode?'通知偏好':'个人资料';
 if(state.route==='add'&&next!=='add'&&(state.selectedFiles??[]).length){if(!confirm('文件尚未发布，确定离开？')){history.replaceState(null,'','#/add');return;}clearSelectedFiles();}
 if(state.route==='search'&&next!=='search'){
  state.query='';state.serviceSearch=null;
  $('#global-search').value='';
  document.body.classList.remove('search-open');
  clearTimeout(searchTimer);searchRequest?.abort();searchGeneration++;
 }
 if(next!==state.route){state.category='全部';state.platform='全部';state.view='全部';state.listQuery='';}
 state.route=next;
 state.sort=params.get('sort')==='name'?'name':'default';if(next==='ui'){state.platform=['web','app'].includes(params.get('platform'))?params.get('platform'):'全部';state.view=['interactive','reference'].includes(params.get('type'))?params.get('type'):'全部';}state.folder=params.get('category')||'all';state.page=Math.max(1,Math.trunc(Number(params.get('page')))||1);
 const resourceKind={websites:'website',ui:'ui',prompts:'prompt'}[next];
 if(resourceKind){state.listQuery=params.get('q')||'';if(!folderNode(resourceKind,state.folder))state.folder='all';}
 if(next==='search'){state.query=params.get('q')||'';$('#global-search').value=state.query;}
 if(next==='add'&&['website','ui','prompt'].includes(parts[1])){state.form.kind=parts[1];state.step=1;}
 $('#account-menu').hidden=true;$('#account-menu-button').setAttribute('aria-expanded','false');
 if($('#detail').open)$('#detail').close();
 if($('#category-drawer').open)$('#category-drawer').close();
 render();window.scrollTo(0,0);
 if(state.backendMode){const q=(resourceKind?state.listQuery:next==='search'?state.query:'').trim().toLowerCase(),cache=resourceKind?state.serviceListSearch:state.serviceSearch;if(q&&(!cache||cache.q!==q||resourceKind&&cache.kind!==resourceKind))queueServiceSearch(resourceKind?'list':'global');}
}
function updateFavorite(item,saved){
 const key=item.seedKey??item.key;if(!key)return;
 if(saved)state.saved.add(key);else state.saved.delete(key);
 for(const row of state.items)if(row.seedKey===key)row.isSaved=saved;
 const label=saved?'取消收藏':'收藏';
 for(const button of document.querySelectorAll('[data-save]')){
  if(button.dataset.save!==key)continue;
  button.setAttribute('aria-pressed',String(saved));
  if(button.classList.contains('save-btn')){
   button.classList.toggle('saved',saved);
   button.setAttribute('aria-label',label+item.title);
  }else button.innerHTML=icon('bookmark')+(saved?'取消收藏':'收藏资源');
 }
 const message=saved?'已收藏':'已取消收藏';
 toast(message);
 const detailRoot=$('#detail');
 if(detailRoot.open){
  let status=detailRoot.querySelector('[data-favorite-status]');
  if(!status){status=document.createElement('p');status.dataset.favoriteStatus='';status.setAttribute('role','status');detailRoot.querySelector('.detail-actions')?.after(status);}
  status.textContent=message;
 }
}
async function toggleSave(id){
 if(state.backendMode){
  if(state.role==='guest'){toast('成员登录后可以收藏资源');return;}
  const item=findCatalogItem(id);if(!item)return;
  const saved=!state.saved.has(id),buttons=[...document.querySelectorAll('[data-save]')].filter(button=>button.dataset.save===id);
  if(buttons.some(button=>button.disabled))return;
  buttons.forEach(button=>button.disabled=true);
  try{await catalogClient.favorite(item,saved,item.folderId??null);updateFavorite(item,saved);state.personalController?.refreshFavorites();}
  catch(error){serviceError(error);}
  finally{buttons.forEach(button=>button.disabled=false);}
  return;
 }
 if(state.saved.has(id)){state.saved.delete(id);toast('已从本次预览收藏中移除');}else{state.saved.add(id);toast('已收藏 · 仅保留在本次预览');}render();}
let detailGeneration=0,detailPendingId=null,detailRequest=null;
function abortDetailRead(){detailRequest?.abort();detailRequest=null;}
function formatPromptBody(value){
 const lines=value.replaceAll('\r\n','\n').split('\n'),blocks=[];
 let paragraph=[],code=null;
 const flush=()=>{if(paragraph.length){blocks.push('<p>'+esc(paragraph.join('\n'))+'</p>');paragraph=[];}};
 for(const line of lines){
  if(/^\s*```/.test(line)){
   if(code===null){flush();code=[];}else{blocks.push('<pre><code>'+esc(code.join('\n'))+'</code></pre>');code=null;}
  }else if(code!==null)code.push(line);
  else if(!line.trim())flush();else paragraph.push(line);
 }
 if(code!==null)blocks.push('<pre><code>'+esc(code.join('\n'))+'</code></pre>');
 flush();return blocks.join('');
}
function promptDetail(item,id){
 const body=state.role!=='guest'&&item.body;
 return `<div class="dialog-head"><span>提示词详情</span><button class="icon-btn" data-close="detail" aria-label="关闭资源详情">${icon('x')}</button></div><div class="prompt-detail-content"><header class="prompt-heading"><span class="prompt-category">${esc(item.category||'提示词')}</span><h2 id="detail-title">${esc(item.title)}</h2>${item.description?`<p>${esc(item.description)}</p>`:''}<div class="detail-actions">${body?'<button class="primary" data-copy-body>复制提示词</button>':''}<button class="secondary" data-save="${esc(id)}" aria-pressed="${state.saved.has(id)}">${icon('bookmark')}${state.saved.has(id)?'取消收藏':'收藏'}</button></div></header><div class="detail-media" ${item.cover||item.previews?.length?'':'hidden'}>${cover(item)}</div>${body?`<section class="prompt-body-section"><h3>完整提示词</h3><div class="prompt-formatted">${formatPromptBody(item.body)}</div></section>`:''}<dl class="resource-meta" hidden></dl></div><section class="detail-section" data-detail-discussion></section>`;
}
async function copyDetailText(button,content){
 const label=button.textContent;
 button.disabled=true;
 try{
  await navigator.clipboard.writeText(content);
  button.textContent='已复制';
  toast('已复制');
 }catch{
  button.textContent='复制失败';
  toast('复制未完成，请选择正文手动复制');
 }finally{
  setTimeout(()=>{button.textContent=label;button.disabled=false;},1400);
 }
}
async function detail(id){
 if(detailPendingId===id&&$('#detail').open)return;
 let item=findCatalogItem(id);if(!item)return;abortDetailRead();const generation=++detailGeneration;trigger=document.activeElement;const el=$('#detail');state.gallery?.destroy();state.gallery=null;clearDetailRuntime();state.detailGalleryItem=null;
 if(state.backendMode){liveDeck.yieldPending?.();detailPendingId=id;el.classList.toggle('website-detail-dialog',item.kind==='website');el.classList.toggle('prompt-detail-dialog',item.kind==='prompt');el.innerHTML='<div class="dialog-head"><span>'+esc(item.title)+'</span><button class="icon-btn" data-close="detail" aria-label="关闭资源详情">'+icon('x')+'</button></div>'+skeleton('正在载入资源详情…','detail-loading');el.showModal();const request=detailRequest=new AbortController();try{const data=await catalogClient.detailResource(item,{signal:request.signal});if(generation!==detailGeneration||!el.open)return;item={...item,...data,kind:item.kind,title:data.title??data.name,category:data.categoryName,source:item.source,body:(data.materials??[]).find(m=>m.kind===(item.kind==='prompt'?'prompt':'code'))?.body??''};}catch(error){if(request.signal.aborted||generation!==detailGeneration||!el.open)return;el.innerHTML='<div class="dialog-head"><span>'+esc(item.title)+'</span><button class="icon-btn" data-close="detail" aria-label="关闭资源详情">'+icon('x')+'</button></div><div class="detail-loading"><p role="status">'+esc(error.message)+'</p><button class="secondary" data-open="'+esc(id)+'">重试</button></div>';serviceError(error);return;}finally{if(generation===detailGeneration){detailPendingId=null;detailRequest=null;}}}
 el.innerHTML=`<div class="dialog-head"><span>${label(item.kind)}详情</span><button class="icon-btn" data-close="detail" aria-label="关闭资源详情">${icon('x')}</button></div><div class="detail-content"><div class="detail-media">${item.sample?`<iframe src="${esc(item.sample)}" sandbox title="${esc(item.title)}交互预览"></iframe>`:cover(item)}</div><div class="detail-info"><div>${badge(item.kind)}<h2 id="detail-title">${esc(item.title)}</h2></div><div class="detail-actions">${item.kind==='website'?`<a class="primary" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">访问网站 ${icon('external-link')}</a>`:''}<button class="secondary" data-save="${esc(id)}">${icon('bookmark')}${state.saved.has(id)?'取消收藏':'收藏资源'}</button></div><dl class="resource-meta"><div><dt>分类</dt><dd>${esc(item.category)}</dd></div><div><dt>来源</dt><dd>${item.kind==='website'?'你的收藏夹':esc(item.source.author||item.source.repository||item.authorName||'成员维护')}</dd></div>${item.source.licenseFile?'<div><dt>许可</dt><dd>MIT</dd></div>':''}</dl>${item.source.licenseFile?`<div class="source-links"><a class="text-link" href="${esc(item.source.url)}" target="_blank" rel="noopener noreferrer">上游来源 ${icon('external-link')}</a><a class="text-link" href="assets/licenses/${item.source.licenseFile.split('/').pop()}" target="_blank">查看许可</a></div>`:''}</div></div><section class="detail-section" data-detail-discussion><h3>评论与反馈</h3><p class="muted">评论功能接入后，可以在这里交流使用体验。</p></section>`;
 if(item.kind==='prompt'){
  el.innerHTML=promptDetail(item,id);
  el.querySelector('[data-copy-body]')?.addEventListener('click',event=>copyDetailText(event.currentTarget,item.body));
 }
 el.classList.toggle('website-detail-dialog',item.kind==='website');el.classList.toggle('prompt-detail-dialog',item.kind==='prompt');
 if(item.kind==='website'){const content=el.querySelector('.detail-content'),actions=content.querySelector('.detail-actions').innerHTML;let domain='';try{domain=new URL(item.url).hostname.replace(/^www\./,'');}catch{}content.className='detail-content website-introduction';content.innerHTML=`<div class="website-intro detail-info"><header class="website-identity">${siteLogo(item)}<div><h2 id="detail-title">${esc(item.title)}</h2><span class="website-domain">${esc(domain)}</span></div></header><div class="website-category"><span>${esc(item.category)}</span></div><section class="website-about"><h3>网站简介</h3><p class="website-summary">${esc(item.longDescription||item.description||'暂无简介')}</p>${item.tags?.length?`<ul class="website-tags" aria-label="网站标签">${item.tags.map(tag=>'<li>'+esc(tag)+'</li>').join('')}</ul>`:''}</section><dl class="resource-meta" hidden></dl><footer class="detail-actions website-footer">${actions}</footer></div>`;}
 if(state.backendMode){if(item.kind==='ui'&&state.role!=='guest')mountUIDownloads(el.querySelector('.detail-actions'),item);if(item.kind!=='prompt'&&item.models?.length)el.querySelector('.resource-meta').insertAdjacentHTML('beforeend','<div><dt>适用模型</dt><dd>'+esc(item.models.join('、'))+'</dd></div>');if(item.canEdit)el.querySelector('.detail-actions').insertAdjacentHTML('beforeend','<button class="secondary" data-service-edit="'+esc(id)+'">编辑资源</button><button class="secondary" data-service-remove="'+esc(id)+'">移除资源</button>');if(state.role==='guest'&&item.kind!=='website')el.insertAdjacentHTML('beforeend','<section class="detail-section"><p>成员登录后可查看完整材料。</p><button class="secondary" data-action="service-login">成员登录</button></section>');}
 if(state.backendMode){
  const materials=(item.materials??[]).filter(m=>item.kind!=='ui'&&(!item.body||m.body!==item.body));if(state.role!=='guest'&&materials.length)el.insertAdjacentHTML('beforeend','<section class="detail-section"><h3>参考材料</h3>'+materials.map((m,i)=>'<details><summary>'+esc(m.title||m.kind)+'</summary>'+(m.kind==='link'?'<a class="text-link" target="_blank" rel="noopener noreferrer" href="'+esc(m.url)+'">查看来源</a>':'<pre class="review-text" data-material="'+i+'">'+esc(m.body)+'</pre><button class="secondary" data-copy-material="'+i+'">复制材料</button>')+'</details>').join('')+'</section>');

 }
 if(state.backendMode&&item.kind==='website'){const marker=document.createElement('p');marker.className='link-state';marker.dataset.detailLinkState='';marker.textContent=item.linkStatus==='invalid'?'链接失效':item.linkStatus==='pending'?'链接待核实':'';el.querySelector('.detail-info').append(marker);}
 if(state.backendMode&&item.kind!=='website'&&state.role!=='guest'&&item.visibility==='shared'&&item.resourceStatus==='published')state.discussionController=window.mountCatalogDiscussion({root:el.querySelector('[data-detail-discussion]'),client:catalogClient,target:{kind:item.kind,id:item.id},member:state.actualMember,onError:serviceError,onChanged:async()=>{await loadServiceCatalog(false);const current=state.items.find(x=>x.kind===item.kind&&x.id===item.id),marker=el.querySelector('[data-detail-link-state]');if(marker)marker.textContent=current?.linkStatus==='invalid'?'链接失效':current?.linkStatus==='pending'?'链接待核实':'';}});
 if(state.backendMode){mountDetailMedia(item);if(!state.discussionController)el.querySelector('[data-detail-discussion]')?.remove();}
 el.showModal();
}
function theme(value,animate=false){
 state.theme=value;
 const apply=()=>{document.documentElement.dataset.theme=value;$('#theme-icon').src=`assets/icons/${value==='dark'?'moon':'sun'}.svg`;document.querySelector('[data-action="theme"]').setAttribute('aria-label',value==='dark'?'切换浅色模式':'切换深色模式');};
 if(animate&&!systemMotion.matches&&!document.body.classList.contains('reduce-motion')&&document.startViewTransition)document.startViewTransition(apply);
 else apply();
}
document.addEventListener('click',event=>{
 const b=event.target.closest('button,a');if(!b)return;
 if(state.backendMode&&catalogSession.expired&&!['service-resume','service-login'].includes(b.dataset.action)){event.preventDefault();return;}
 if(b.hasAttribute('data-reset-preview')){liveDeck.reset(b.closest('.interactive-card')?.querySelector('[data-live-preview]'));return;}
 if(b.dataset.action==='retry-search'){state.serviceSearch=null;queueServiceSearch('global');render();return;}
 if(b.dataset.action==='reload-profile'){loadMemberProfile(b.closest('form'));return;}
 if(b.dataset.action==='fetch-metadata'){fetchServiceMetadata();return;}if(b.dataset.action==='manage-categories'){openCategoryManager();return;}if(b.dataset.action==='service-resume'){serviceResume();return;}if(b.dataset.action==='service-leave'){serviceLeave();return;}if(b.dataset.action==='reload'){location.reload();return;}
 if(b.hasAttribute('data-copy-material')){const content=$('#detail [data-material="'+b.dataset.copyMaterial+'"]')?.textContent;if(content)copyDetailText(b,content);return;}
 if(state.backendMode&&b.dataset.serviceEdit){editServiceResource(b.dataset.serviceEdit);return;}if(state.backendMode&&b.dataset.serviceRemove){confirmRemoveResource(b.dataset.serviceRemove);return;}
 if(state.backendMode&&b.dataset.action==='service-remove-confirm'){removeServiceResource();return;}
 if(state.backendMode&&b.dataset.action==='cancel-publication'){
  if(state.saving)return;
  if((state.form.title||state.form.url||state.form.body||state.form.description||state.selectedFiles?.length)&&!confirm('放弃这次未保存的修改？'))return;
  clearSelectedFiles();state.editing=null;state.form={kind:'website',title:'',description:'',url:'',visibility:'shared',body:''};location.hash='/saved?view=published';return;
 }
 if(state.backendMode&&b.dataset.action==='confirm-save'){saveServiceResource();return;}if(state.backendMode&&b.dataset.action==='save-draft'){saveServiceResource('draft');return;}
 if(b.dataset.folder){state.folder=b.dataset.folder;state.listQuery='';state.page=1;if($('#category-drawer').open)$('#category-drawer').close();const hash=catalogHash();if(location.hash===hash)render();else location.hash=hash;return;}
 if(b.dataset.page){location.hash=catalogHash(Number(b.dataset.page));return;}
 if(b.dataset.expand){const key=b.dataset.expand;const collapsed=!state.collapsedGroups.has(key);if(collapsed)state.collapsedGroups.add(key);else state.collapsedGroups.delete(key);const group=b.closest('.tree-group');const branch=group.querySelector('.tree-children');branch.dataset.branchToggled='';branch.inert=collapsed;branch.hidden=collapsed;b.setAttribute('aria-expanded',String(!collapsed));return;}
 if(b.dataset.removeSelectedFile){removeSelectedFile(b.dataset.removeSelectedFile);return;}if(b.dataset.open){detail(b.dataset.open);return;}
 if(b.dataset.save){const id=b.dataset.save;toggleSave(id).then(()=>{if(b.isConnected&&$('#detail').open)b.innerHTML=icon('bookmark')+(state.saved.has(id)?'取消收藏':'收藏资源');});return;}
 if(b.dataset.close){$('#'+b.dataset.close).close();return;}
 if(b.dataset.filter){state[b.dataset.filter]=b.dataset.value;render();return;}
 if(b.dataset.collection){state.collection=b.dataset.collection;if($('#category-drawer').open)$('#category-drawer').close();render();return;}
 if(b.dataset.accountTab){if(state.accountTab==='通知偏好')history.replaceState(null,'','#/account');state.accountTab=b.dataset.accountTab;render();return;}
 if(b.dataset.adminTab){state.adminTab=b.dataset.adminTab;render();return;}
 if(b.dataset.draft){state.form={...state.drafts[Number(b.dataset.draft)]};state.step=1;location.hash='/add';return;}
 if(b.id==='account-menu-button'){const open=$('#account-menu').hidden;$('#account-menu').hidden=!open;b.setAttribute('aria-expanded',String(open));return;}
 const actions={'service-login':serviceLogin,categories:openCategoryDrawer,theme:()=>theme(state.theme==='light'?'dark':'light',true),about:()=>$('#about-dialog').showModal(),notifications:()=>{if(!state.backendMode)toast('静态预览未连接通知服务');},'mobile-search':()=>{document.body.classList.toggle('search-open');$('#global-search').focus();},'clear-filters':()=>{state.query='';state.category=state.platform=state.view='全部';$('#global-search').value='';state.listQuery='';state.folder='all';state.page=1;if(['websites','ui','prompts'].includes(state.route))history.replaceState(null,'',catalogHash());else if(state.route==='search')history.replaceState(null,'','#/search');render();},'save-draft':()=>{state.drafts.push({...state.form});toast('草稿已保留在本次预览');},'edit-again':()=>{state.step=1;render();},'confirm-save':()=>{const f=state.form;const item={seedKey:'preview-'+Date.now(),kind:f.kind,title:f.title,description:f.description||'本次预览添加的资源',url:f.url,category:'未分类',tags:[],logo:'assets/icons/globe.svg',source:{author:'本地预览成员'},body:f.body,visibility:f.visibility};state.items.unshift(item);state.form={kind:'website',title:'',description:'',url:'',visibility:'shared',body:''};state.step=1;location.hash=f.kind==='website'?'/websites':f.kind==='ui'?'/ui':'/prompts';toast('已保存在本次预览，尚未发布到线上');},security:()=>state.backendMode?serviceLogin():window.AccountSecurity.openLogin()};
 actions[b.dataset.action]?.();
});
document.addEventListener('click',event=>{if(!event.target.closest('.profile-wrap')){$('#account-menu').hidden=true;$('#account-menu-button').setAttribute('aria-expanded','false');}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){$('#account-menu').hidden=true;$('#account-menu-button').setAttribute('aria-expanded','false');}});
document.addEventListener('input',event=>{const el=event.target;if(el.matches('[data-editor-category-search]')){const select=$('[data-editor-category]');select.innerHTML=window.catalogCategoryOptions(state.categories?.[state.form.kind]??[],select.value,el.value,state.form.kind);return;}if(el.id==='list-search'){state.listQuery=el.value;if(state.backendMode)queueServiceSearch('list');state.page=1;history.replaceState(null,'',catalogHash());const kind={websites:'website',ui:'ui',prompts:'prompt'}[state.route];const items=filtered(kind);$('#listing-results').innerHTML=catalogPageResults(kind,items);$('#result-count').textContent=catalogCount(paginateCatalog(kind,items,state.page));liveDeck.refresh($('#main'));return;}if(el.id==='global-search'){state.query=el.value;if(state.backendMode)queueServiceSearch('global');const hash='/search'+(state.query.trim()?'?q='+encodeURIComponent(state.query.trim()):'');if(state.route!=='search'){location.hash=hash;}else{history.replaceState(null,'','#'+hash);render();}}if(el.closest('#resource-form')&&el.name)state.form[el.name]=el.value;});
document.addEventListener('change',event=>{const el=event.target;if(el.id==='ui-platform-filter'||el.id==='ui-type-filter'){state[el.id==='ui-platform-filter'?'platform':'view']=el.value;state.page=1;history.replaceState(null,'',catalogHash());render();}if(el.id==='sort-select'||el.id==='drawer-sort'){state.sort=el.value;state.page=1;history.replaceState(null,'',catalogHash());render();}if(el.name==='kind'&&el.closest('#resource-form')){state.form.kind=el.value;render();}if(el.id==='theme-select')theme(el.value,true);if(el.id==='motion-toggle')saveMotionPreference(el.checked);});
async function loadPublicationLimits(){
 const info=$('[data-publication-limits]'),picker=$('[data-publication-files]');
 if(!info||!picker)return;
 state.attachmentLimits=null;picker.disabled=true;info.textContent='正在读取站点上传限额…';
 try{
  const {limits}=await catalogClient.attachmentConfig();if(!info.isConnected)return;
  state.attachmentLimits=limits;picker.disabled=false;
  const size=bytes=>bytes>=1e9?(bytes/1e9)+' GB':bytes>=1e6?(bytes/1e6)+' MB':bytes+' 字节';
  info.textContent='单文件上限：图片 '+size(limits.image)+'（JPG、PNG、WebP、GIF），代码、文本附件 '+size(limits.code)+'，PDF 与 Office 文档 '+size(limits.document)+'，MP4 '+size(limits.video)+'，ZIP '+size(limits.archive)+'。';
 }catch(error){
  if(!info.isConnected)return;
  info.textContent='暂时无法读取上传限额。';
  const retry=document.createElement('button');retry.type='button';retry.className='text-button';retry.textContent='重试';retry.addEventListener('click',loadPublicationLimits);info.append(retry);
  if(error.status===401)serviceError(error);
 }
}
function stagePublicationFiles(files){
 if(state.saving)return;
 state.selectedFiles??=[];
 const message=$('[data-editor-message]'),errors=[];
 if(!state.attachmentLimits){if(message)message.textContent='请先读取站点上传限额。';return;}
 for(const file of files){
  try{
   const info=window.attachmentFileInfo(file);
   const limit=state.attachmentLimits[info.fileKind];
   if(file.size>limit)throw new Error(file.name+' 超出单文件大小限制');
   if(state.selectedFiles.some(job=>job.file.name===file.name&&job.file.size===file.size&&job.file.lastModified===file.lastModified))continue;
   state.selectedFiles.push({key:crypto.randomUUID(),file,preview:['image','video'].includes(info.fileKind)?URL.createObjectURL(file):null,fileKind:info.fileKind,saved:false});
  }catch(error){errors.push(error.message);}
 }
 if(message)message.textContent=errors.join('；');
 drawSelectedFiles();
}
document.addEventListener('change',event=>{
 if(!event.target.matches('[data-publication-files]'))return;
 stagePublicationFiles(event.target.files);event.target.value='';
});
document.addEventListener('dragover',event=>{
 const drop=event.target.closest('[data-publication-drop]');if(!drop||!event.dataTransfer.types.includes('Files'))return;
 event.preventDefault();event.dataTransfer.dropEffect='copy';drop.classList.add('is-dragging');
});
document.addEventListener('dragleave',event=>{
 const drop=event.target.closest('[data-publication-drop]');if(drop&&!drop.contains(event.relatedTarget))drop.classList.remove('is-dragging');
});
document.addEventListener('drop',event=>{
 const drop=event.target.closest('[data-publication-drop]');if(!drop||!event.dataTransfer.files.length)return;
 event.preventDefault();drop.classList.remove('is-dragging');stagePublicationFiles(event.dataTransfer.files);
});
document.addEventListener('submit',event=>{if(event.target.id==='member-profile-form'){event.preventDefault();saveMemberProfile(event.target);return;}if(event.target.id==='resource-form'){event.preventDefault();if(state.backendMode){saveServiceResource();return;}state.form={...state.form,...Object.fromEntries(new FormData(event.target))};if(state.form.kind==='website'){const url=new URL(state.form.url);if(!['https:','http:'].includes(url.protocol)){toast('请使用 http 或 https 网站链接');return;}}state.step=2;render();window.scrollTo(0,0);}if(event.target.id==='profile-form'){event.preventDefault();toast('资料已在本次预览中确认，尚未写入实际账户');}});
$('#detail').addEventListener('click',event=>{if(event.target===$('#detail')){const r=$('#detail').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('#detail').close();}});
$('#detail').addEventListener('close',async event=>{
 const dialog=event.currentTarget;if(dialog.open)return;
 abortDetailRead();detailGeneration++;detailPendingId=null;
 state.gallery?.destroy();state.gallery=null;clearDetailRuntime();state.detailGalleryItem=null;
 liveDeck.schedule();if(trigger?.isConnected)trigger.focus();else $('#main').focus();
 // Leave the detail shell visible until the native exit transition ends.
 const content=dialog.firstChild;
 await Promise.allSettled(dialog.getAnimations().map(animation=>animation.finished));
 if(!dialog.open&&dialog.firstChild===content)dialog.replaceChildren();
});
window.addEventListener('hashchange',route);
if(new URLSearchParams(location.search).get('theme')==='dark')theme('dark');
window.addEventListener('forum-resource-change',()=>identityEvents?.announce('resource'));
if(state.backendMode)identityEvents=window.createIdentityEvents({onInvalidate:reason=>{clearPrivateServiceState();if(reason==='logout'){location.replace('/login.html');return;}loadServiceCatalog().catch(error=>{delete document.documentElement.dataset.authCheck;serviceLanding(error);});},onSuspend:()=>{document.documentElement.dataset.authCheck='1';},onValidate:revalidateServiceIdentity});
fetch('data.json').then(r=>{if(!r.ok)throw new Error('data');return r.json();}).then(data=>{state.seedMetadata=new Map(data.items.map(item=>[item.seedKey,item]));state.items=data.items;if(state.backendMode)loadServiceCatalog().catch(serviceLanding);else route();}).catch(()=>{$('#main').innerHTML=empty('资料暂时没有载入','刷新页面后再试一次。','<button class="secondary" data-action="reload">重新载入</button>');document.querySelector('[data-action="reload"]').addEventListener('click',()=>location.reload());});

$('#category-drawer').addEventListener('close',()=>liveDeck.resume());
document.querySelectorAll('dialog').forEach(el=>{el.addEventListener('close',()=>liveDeck.schedule());});
document.addEventListener('click',()=>liveDeck.schedule());
function updateCatalogImage(image,loaded){
 if(image.matches?.('img[data-site-logo]')){
  image.classList.toggle('is-loaded',loaded);image.closest('.site-logo')?.querySelector('.logo-fallback')?.toggleAttribute('hidden',loaded);
 }
 if(image.matches?.('img[data-card-image]')){
  const wrap=image.closest('.card-image-wrap');
  wrap.classList.toggle('is-loaded',loaded);wrap.classList.toggle('has-error',!loaded);
  if(!loaded)wrap.querySelector('.card-image-loading').textContent='图片暂不可用';
 }
}
document.addEventListener('load',event=>updateCatalogImage(event.target,true),true);
document.addEventListener('error',event=>updateCatalogImage(event.target,false),true);

const cardMediaJobs=new Map(),cardMediaSelector='img[data-protected-card-image]';
const cardMediaObserver=new IntersectionObserver(entries=>{
 for(const {target,isIntersecting} of entries){
  if(!isIntersecting||!target.isConnected||cardMediaJobs.has(target))continue;
  cardMediaObserver.unobserve(target);
  const job={controller:new AbortController(),url:null};cardMediaJobs.set(target,job);
  catalogClient.image(target.dataset.protectedCardImage,{signal:job.controller.signal}).then(blob=>{
   if(!target.isConnected||job.controller.signal.aborted)return;
   job.url=URL.createObjectURL(blob);target.src=job.url;
  }).catch(()=>{if(target.isConnected&&!job.controller.signal.aborted)updateCatalogImage(target,false);});
 }
},{rootMargin:'160px'});
new MutationObserver(records=>{
 for(const {addedNodes,removedNodes} of records){
  for(const node of addedNodes){
   if(node.matches?.(cardMediaSelector))cardMediaObserver.observe(node);
   node.querySelectorAll?.(cardMediaSelector).forEach(image=>cardMediaObserver.observe(image));
  }
  for(const node of removedNodes){
   const images=node.matches?.(cardMediaSelector)?[node]:node.querySelectorAll?.(cardMediaSelector)??[];
   for(const image of images){
    if(image.isConnected)continue;
    cardMediaObserver.unobserve(image);
    const job=cardMediaJobs.get(image);if(!job)continue;
    job.controller.abort();if(job.url)URL.revokeObjectURL(job.url);cardMediaJobs.delete(image);
   }
  }
 }
}).observe($('#main'),{childList:true,subtree:true});
