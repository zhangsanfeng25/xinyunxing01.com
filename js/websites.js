(() => {
 'use strict';
 window.createWebsiteDirectoryState=({request,getMember,getEpoch,onChange})=>{
  const state={items:[],query:'',category:'',nextCursor:null,loading:false,error:''};let generation=0;
  const identity=()=>String(getMember()?.role)+':'+getMember()?.id+':'+getEpoch();
  const canEdit=()=>['admin','member'].includes(getMember()?.role);
  async function load(query=state.query,category=state.category,append=false){
   const gen=++generation,actor=identity(),cursor=append?state.nextCursor:null;
   state.query=query;state.category=category;state.loading=true;state.error='';if(!append)state.items=[];onChange(state);
   const params=new URLSearchParams({q:query,limit:'30'});if(category)params.set('categoryId',category);if(cursor)params.set('cursor',cursor);
   try{const result=await request('/api/v1/websites?'+params);if(gen!==generation||actor!==identity())return;
    state.items=append?[...new Map([...state.items,...result.items].map(x=>[x.id,x])).values()]:result.items;state.nextCursor=result.nextCursor;
   }catch(e){if(gen===generation&&actor===identity())state.error=e.message||'加载失败，请重试';}
   finally{if(gen===generation&&actor===identity()){state.loading=false;onChange(state);}}
  }
  async function save(path,method,data){if(!canEdit())throw Error('游客不能修改网站');const actor=identity(),gen=generation;const result=await request(path,method,data);return actor===identity()&&gen===generation?result:null;}
  function recordClick(id){Promise.resolve().then(()=>request('/api/v1/websites/'+id+'/clicks','POST',{})).catch(()=>{});}
  function leave(){generation++;state.loading=false;}
  function reset(){leave();Object.assign(state,{items:[],query:'',category:'',nextCursor:null,error:''});onChange(state);}
  return {state,load,save,recordClick,canEdit,leave,reset};
 };
 window.createWebsitesUI=({request,getMember,getEpoch,onNavigate,root})=>{
  const pencil='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5"/></svg>';
  const arrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M14 3h7v7M21 3 10 14M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/></svg>';
  root.innerHTML=`<header class="website-heading"><div><p class="section-kicker">常用入口</p><h1 id="websites-title" tabindex="-1">网站收藏</h1><p class="website-intro">收藏好用的网站，随时打开。</p></div><div class="website-manage"><button id="website-categories-open" class="secondary">管理分类</button><button id="website-add" class="publish-button">＋ 添加网站</button></div></header>
   <label class="website-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg><input id="website-search" type="search" maxlength="60" placeholder="搜索网站名称、说明或分类" aria-label="搜索网站名称、说明或分类"></label>
   <div class="website-filter-row"><div id="website-filters" aria-label="网站分类"></div><span class="website-sort">按热度排序</span></div>
   <p id="website-message" role="status" aria-live="polite"></p><div id="website-grid" class="website-grid"></div><section id="website-projects" hidden><h2>个人项目</h2><div id="website-project-grid" class="website-grid projects"></div></section><div class="website-footer"><button id="website-more" class="secondary" hidden>加载更多网站</button><button id="website-retry" class="secondary" hidden>重试加载</button></div>
   <dialog id="website-editor" class="website-dialog" aria-labelledby="website-editor-title"><form id="website-form"><header class="website-dialog-heading"><h2 id="website-editor-title">添加网站</h2><button type="button" id="website-editor-close" class="icon-button" aria-label="关闭网站编辑">×</button></header><p class="website-shared">公开展示 · 正式成员共同维护</p>
   <div class="website-form-grid"><label>类型<select name="kind"><option value="website">网站</option><option value="project">个人项目</option></select></label><label>分类<select name="categoryId" required></select></label></div><label>名称<input name="name" required maxlength="60" autocomplete="off"></label><label>一句说明<textarea name="description" required maxlength="160" rows="2"></textarea></label><label id="website-url-label">网站地址<input name="url" type="url" maxlength="2048" placeholder="https://" required></label><label>Logo 地址（可选）<input name="logoUrl" maxlength="2048" placeholder="https://…，留空显示首字"></label>
   <div id="website-project-fields" hidden><label>技术栈（逗号分隔，最多 10 项）<input name="projectStack" maxlength="309" placeholder="HTML, JavaScript"></label><label>封面地址（可选）<input name="coverUrl" type="url" maxlength="2048" placeholder="https://"></label><label>GitHub 项目地址<input name="githubUrl" type="url" maxlength="2048" placeholder="https://github.com/owner/repo"></label><p class="website-shared">演示地址与 GitHub 项目地址至少填写一个。</p></div>
   <p id="website-editor-error" class="form-message" role="status"></p><button type="button" id="website-reload-edit" class="secondary" hidden>重新载入最新版本</button><footer><button type="button" id="website-editor-cancel" class="secondary">取消</button><button id="website-save" class="publish-button" type="submit">保存网站</button></footer></form></dialog>
   <dialog id="website-category-editor" class="website-dialog" aria-labelledby="website-category-title"><header class="website-dialog-heading"><h2 id="website-category-title">管理分类</h2><button id="website-category-close" class="icon-button" aria-label="关闭分类管理">×</button></header><p class="website-shared">正式成员可以添加分类或修改名称。</p><div id="website-category-list"></div><form id="website-category-form"><input type="hidden" name="id"><input type="hidden" name="version"><label id="website-category-name-label">添加分类<input name="name" required maxlength="24" autocomplete="off"></label><p id="website-category-error" class="form-message" role="status"></p><footer><button type="button" id="website-category-reset" class="secondary">取消改名</button><button type="submit" id="website-category-save" class="publish-button">保存分类</button></footer></form></dialog>
   <dialog id="website-discard" class="website-dialog small" aria-labelledby="website-discard-title"><h2 id="website-discard-title">放弃未保存的修改？</h2><p>当前输入还没有保存。</p><footer><button id="website-keep" class="secondary">继续编辑</button><button id="website-discard-confirm" class="publish-button">放弃修改</button></footer></dialog>`;
  const $=id=>root.querySelector('#'+id),form=$('website-form'),editor=$('website-editor'),categoryForm=$('website-category-form'),categoryEditor=$('website-category-editor');
  const model=window.createWebsiteDirectoryState({request,getMember,getEpoch,onChange:render});
  let categories=[],active=false,timer=null,editItem=null,initial='',categoryInitial='',pendingDiscard=null,restoreFocus=null,scroll=0,categoryGeneration=0;
  const field=name=>form.elements.namedItem(name),catField=name=>categoryForm.elements.namedItem(name);
  const values=target=>JSON.stringify([...new FormData(target).entries()]);
  function dirty(){return editor.open&&values(form)!==initial||categoryEditor.open&&values(categoryForm)!==categoryInitial;}
  function confirmLeave(next,cancel=()=>{}){if(!dirty())return true;pendingDiscard={next,cancel};$('website-discard').showModal();return false;}
  function closeEditors(){editor.close();categoryEditor.close();editItem=null;initial='';categoryInitial='';restoreFocus?.focus();}
  function tryClose(){if(confirmLeave(closeEditors))closeEditors();}
  $('website-keep').onclick=()=>{pendingDiscard?.cancel();pendingDiscard=null;$('website-discard').close();};
  $('website-discard-confirm').onclick=()=>{const next=pendingDiscard?.next;pendingDiscard=null;$('website-discard').close();initial=values(form);categoryInitial=values(categoryForm);next?.();};
  $('website-discard').addEventListener('cancel',()=>{pendingDiscard?.cancel();pendingDiscard=null;});
  for(const id of ['website-editor-close','website-editor-cancel','website-category-close'])$(id).onclick=tryClose;
  for(const el of [editor,categoryEditor])el.addEventListener('cancel',e=>{e.preventDefault();tryClose();});
  window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
  function make(tag,cls,content){const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=content;return el;}
  function safeURL(raw,local=false){try{if(local&&/^\/assets\/[a-zA-Z0-9_/-]+\.(png|webp|jpg|jpeg|svg|ico)$/.test(raw)&&!raw.includes('..'))return raw;const u=new URL(raw);if(/[\\\u0000-\u0020]/.test(raw)||u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||u.hostname.startsWith('[')||/^[\d.]+$/.test(u.hostname)||/(^|\.)(localhost|local|internal|lan|home|arpa)\.?$/.test(u.hostname))return null;return u.href;}catch{return null;}}
  function logo(item){const box=make('span','website-logo');box.append(make('span','website-initial',[...item.name][0]));const url=safeURL(item.logoUrl,true);if(url){const img=make('img');img.src=url;img.alt='';img.width=48;img.height=48;img.loading='lazy';img.referrerPolicy='no-referrer';img.onload=()=>box.classList.add('has-image');img.onerror=()=>{img.remove();box.classList.remove('has-image');};box.append(img);}return box;}
  function card(item){
   const row=make('article','website-card'+(item.kind==='project'?' project':'')),url=safeURL(item.url||item.githubUrl),link=make('a','website-link');
   if(url){link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.addEventListener('click',()=>model.recordClick(item.id));link.addEventListener('auxclick',e=>{if(e.button===1)model.recordClick(item.id);});}
   if(item.kind==='project'&&safeURL(item.coverUrl,true)){const img=make('img','website-cover');img.src=safeURL(item.coverUrl,true);img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();link.append(img);}
   const content=make('div','website-card-content'),copy=make('div','website-copy'),heading=make('h2','',item.name),description=make('p','',item.description),tag=make('span','website-tag',item.categoryName);copy.append(heading,description,tag);
   if(item.kind==='project'&&item.projectStack?.length)copy.append(make('p','website-stack',item.projectStack.join(' · ')));
   content.append(logo(item),copy);const open=make('span','website-open');open.innerHTML=arrow;content.append(open);link.append(content);link.setAttribute('aria-label','打开 '+item.name+'（新标签页）');row.append(link);
   if(item.kind==='project'){const links=make('div','project-links');for(const [label,raw]of [['演示',item.url],['GitHub',item.githubUrl]]){const href=safeURL(raw);if(href){const a=make('a','',label+' ↗');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.onclick=()=>model.recordClick(item.id);links.append(a);}}row.append(links);}
   if(model.canEdit()){const button=make('button','website-edit');button.type='button';button.innerHTML=pencil;button.setAttribute('aria-label','编辑 '+item.name);button.onclick=()=>openEditor(item,button);row.append(button);}return row;
  }
  function render(){
   if(!root.isConnected)return;
   root.querySelector('.website-manage').hidden=!model.canEdit();const s=model.state;
   $('website-message').textContent=s.error||(s.loading?'正在查找网站…':s.items.length?'':s.query||s.category?'没有找到符合条件的网站。':'还没有网站，添加第一个常用入口吧。');
   $('website-retry').hidden=!s.error;$('website-more').hidden=!s.nextCursor||!!s.error;$('website-more').disabled=s.loading;
   const sites=s.items.filter(x=>x.kind!=='project'),projects=s.items.filter(x=>x.kind==='project');$('website-grid').replaceChildren(...sites.map(card));$('website-project-grid').replaceChildren(...projects.map(card));$('website-projects').hidden=!projects.length;
   $('website-filters').replaceChildren();for(const cat of [{id:'',name:'全部'},...categories]){const button=make('button',String(cat.id)===s.category?'active':'',cat.name);button.type='button';button.setAttribute('aria-pressed',String(String(cat.id)===s.category));button.onclick=()=>{clearTimeout(timer);model.load($('website-search').value.trim(),String(cat.id));};$('website-filters').append(button);}
  }
  async function loadCategories(){const gen=++categoryGeneration,epoch=getEpoch(),id=getMember()?.id;const result=await request('/api/v1/website-categories');if(!active||gen!==categoryGeneration||epoch!==getEpoch()||id!==getMember()?.id)return false;categories=result.items;render();return true;}
  function categoryOptions(selected){field('categoryId').replaceChildren(...categories.map(c=>{const op=make('option','',c.name);op.value=c.id;return op;}));field('categoryId').value=String(selected??categories[0]?.id??'');}
  function projectFields(){const project=field('kind').value==='project';$('website-project-fields').hidden=!project;field('url').required=!project;}
  field('kind').onchange=projectFields;
  function openEditor(item=null,trigger){if(!model.canEdit())return;clearTimeout(timer);restoreFocus=trigger??$('website-add');if(!categories.length){openCategories(restoreFocus);$('website-category-error').textContent='先添加一个分类，再添加网站。';return;}
   editItem=item;form.reset();categoryOptions(item?.categoryId);for(const name of ['kind','name','description','url','logoUrl','coverUrl','githubUrl'])field(name).value=item?.[name]??(name==='kind'?'website':'');field('projectStack').value=item?.projectStack?.join(', ')??'';projectFields();$('website-editor-title').textContent=item?'编辑网站':'添加网站';$('website-editor-error').textContent='';$('website-reload-edit').hidden=true;$('website-save').disabled=false;initial=values(form);editor.showModal();field('name').focus();}
  $('website-add').onclick=()=>openEditor();
  $('website-reload-edit').onclick=()=>{const id=editItem?.id;const current=model.state.items.find(i=>i.id===id);if(current&&confirmLeave(()=>openEditor(current,restoreFocus)))openEditor(current,restoreFocus);};
  form.onsubmit=async e=>{e.preventDefault();if(!model.canEdit()||!form.reportValidity())return;const button=$('website-save');if(button.disabled)return;button.disabled=true;$('website-editor-error').textContent='正在保存…';
   const data={};for(const name of ['kind','name','description','url','logoUrl','categoryId'])data[name]=field(name).value.trim();data.categoryId=Number(data.categoryId);
   if(data.kind==='project'){data.projectStack=field('projectStack').value.split(/[,，]/).map(x=>x.trim()).filter(Boolean);data.coverUrl=field('coverUrl').value.trim();data.githubUrl=field('githubUrl').value.trim();}
   if(editItem)data.version=editItem.version;const epoch=getEpoch(),id=getMember()?.id;
   try{const result=await model.save('/api/v1/websites'+(editItem?'/'+editItem.id:''),editItem?'PATCH':'POST',data);if(!result||!active)return;initial=values(form);closeEditors();await model.load();if(active)(restoreFocus?.isConnected?restoreFocus:$('website-add')).focus();}
   catch(error){if(active&&epoch===getEpoch()&&id===getMember()?.id){$('website-editor-error').textContent=error.message;if(error.status===409){$('website-reload-edit').hidden=!editItem;await model.load();}}}
   finally{if(active&&epoch===getEpoch()&&id===getMember()?.id)button.disabled=false;}
  };
  function resetCategory(){categoryForm.reset();catField('id').value='';catField('version').value='';$('website-category-name-label').firstChild.textContent='添加分类';$('website-category-error').textContent='';categoryInitial=values(categoryForm);}
  function drawCategories(){const list=$('website-category-list');list.replaceChildren(...categories.map(c=>{const row=make('div','website-category-row'),name=make('span','',c.name),edit=make('button','secondary','修改');edit.type='button';edit.setAttribute('aria-label','修改分类 '+c.name);edit.onclick=()=>{const start=()=>{catField('id').value=c.id;catField('version').value=c.version;catField('name').value=c.name;$('website-category-name-label').firstChild.textContent='修改分类';categoryInitial=values(categoryForm);catField('name').focus();};if(confirmLeave(start))start();};row.append(name,edit);return row;}));}
  function openCategories(trigger){if(!model.canEdit())return;clearTimeout(timer);restoreFocus=trigger??$('website-categories-open');resetCategory();drawCategories();categoryEditor.showModal();}
  $('website-categories-open').onclick=()=>openCategories();$('website-category-reset').onclick=()=>{if(confirmLeave(resetCategory))resetCategory();};
  categoryForm.onsubmit=async e=>{e.preventDefault();if(!model.canEdit()||!categoryForm.reportValidity())return;const button=$('website-category-save');if(button.disabled)return;button.disabled=true;const id=catField('id').value,data={name:catField('name').value.trim()},epoch=getEpoch(),identity=getMember()?.id;if(id)data.version=Number(catField('version').value);$('website-category-error').textContent='正在保存…';
   try{const result=await model.save('/api/v1/website-categories'+(id?'/'+id:''),id?'PATCH':'POST',data);if(!result||!active)return;await loadCategories();resetCategory();drawCategories();await model.load();if(active)catField('name').focus();}
   catch(error){if(active&&epoch===getEpoch()&&identity===getMember()?.id)$('website-category-error').textContent=error.message;}
   finally{if(active&&epoch===getEpoch()&&identity===getMember()?.id)button.disabled=false;}
  };
  $('website-search').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>model.load($('website-search').value.trim(),model.state.category),300);};
  $('website-more').onclick=()=>model.load(model.state.query,model.state.category,true);$('website-retry').onclick=()=>enter();
  async function enter({focus=false}={}){active=true;const epoch=getEpoch(),id=getMember()?.id;render();$('website-search').value=model.state.query;if(focus)$('websites-title').focus({preventScroll:true});try{if(await loadCategories()){await model.load();if(active&&epoch===getEpoch()&&id===getMember()?.id)window.scrollTo({top:scroll,behavior:'instant'});}}catch(e){if(active&&epoch===getEpoch()&&id===getMember()?.id){model.state.error=e.message;render();}}}
  function leave(){scroll=window.scrollY;active=false;categoryGeneration++;clearTimeout(timer);model.leave();closeEditors();}
  function reset(){active=false;categoryGeneration++;clearTimeout(timer);model.reset();categories=[];scroll=0;pendingDiscard=null;$('website-discard').close();closeEditors();$('website-search').value='';render();}
  return {enter,leave,reset,confirmLeave};
 };
})();
