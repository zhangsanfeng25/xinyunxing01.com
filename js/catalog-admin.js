(() => {
 'use strict';const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),tabs={overview:'概览',operations:'监控与容量',resources:'共享资源',members:'成员管理',categories:'分类标签',feedback:'反馈处理',announcements:'公告',settings:'网站设置',security:'会话与安全'},widgets={members:'成员',resources:'共享资源',feedback:'待处理反馈',recent:'近14天新增'},states={pending:'待核实',invalid:'确认有问题',resolved:'已修复',dismissed:'无需处理'};
 const groups=[
  {title:'运营监控',views:['overview','operations']},
  {title:'内容运营',views:['resources','categories','feedback','announcements']},
  {title:'系统管理',views:['members','security','settings']}
 ];
 const icons={overview:'layout-grid',operations:'database',resources:'file-text',categories:'bookmark',feedback:'message-square',announcements:'bell',members:'users',security:'shield',settings:'settings'};
 const sections={sessions:'网站会话',logs:'登录记录',devices:'账户与设备'};
 const date=value=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'—';
 const stateMark=(state,text)=>`<span class="admin-state admin-state--${state}">${text}</span>`;
 function table(title,columns,rows,empty){
  return `<section class="admin-surface"><h3>${title}</h3>${rows.length?`<div class="admin-table-region" role="region" aria-label="${title}" tabindex="0"><table class="admin-data-table"><thead><tr>${columns.map(name=>`<th scope="col"${name==='操作'?' class="admin-table-action"':''}>${name}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:`<p class="admin-empty">${empty}</p>`}</section>`;
 }
 function logTable(logs,preview=false){
  const title=preview?'最近登录':'登录记录';
  if(!logs)return table(title,[],[],'登录记录暂不可用，请刷新重试。');
  const rows=(preview?logs.items.slice(0,5):logs.items).map(log=>{
   const result=log.result==='success'?stateMark('ok','成功'):log.result==='failure'?stateMark('danger','失败'):stateMark('neutral','未知');
   return `<tr><th scope="row">${esc(log.displayName??'未知账号')}</th><td>${result}</td><td><time>${esc(date(log.createdAt))}</time></td></tr>`;
  });
  return table(title,['成员','结果','发生时间'],rows,'暂无登录记录。');
 }
 function sessionTable(sessions){
  if(!sessions)return table('网站会话',[],[],'网站会话暂不可用，请刷新重试。');
  const rows=sessions.items.map(session=>{
   const id=String(session.managementId??session.id??'');
   const short=id.length>16?id.slice(0,8)+'…'+id.slice(-4):id;
   const status=session.stage==='authenticated'?stateMark('ok','有效'):stateMark('neutral','待验证');
   const action=id?`<button type="button" class="secondary danger" data-security-revoke="${esc(id)}">撤销会话</button>`:'—';
   return `<tr><th scope="row">${esc(session.displayName??session.memberId??'未知成员')}</th><td><code title="${esc(id)}">${esc(short||'—')}</code></td><td>${status}</td><td class="admin-table-action">${action}</td></tr>`;
  });
  return table('网站会话',['成员','会话编号','状态','操作'],rows,'暂无可管理会话。');
 }
 function mountCatalogAdmin({root,client,member,onOpen,onEdit,onChanged=async()=>{},onError=()=>{}}){
  const [,initialView,initialSecurity]=(window.location?.hash??'').replace(/^#\/?/,'').split('/');
  let alive=true,epoch=0,view=Object.hasOwn(tabs,initialView)?initialView:'overview';
  let securityView=Object.hasOwn(sections,initialSecurity)?initialSecurity:'sessions';
  let data=null,child=null,categoryManager=null,categoryDialog=null,page=1,q='',kind='',layout=null,settings=null,loadError='';
  function tell(v){const p=root.querySelector('[data-admin-status]');if(p)p.textContent=v;}
  function navigate(next,sub='sessions'){
   if(!Object.hasOwn(tabs,next)||next===view&&sub===securityView)return;
   view=next;securityView=sub;page=1;layout=null;
   const hash='#/admin/'+view+(view==='security'?'/'+securityView:'');
   window.history?.replaceState(null,'',hash);
   return load();
  }
  function render(){
   if(!alive)return;
   const active=root.ownerDocument?.activeElement,focused=root.contains?.(active)?active.dataset:null;
   child?.destroy();child=null;
   const nav=groups.map(group=>`<div class="admin-nav-group"><h2>${group.title}</h2>${group.views.map(key=>
    `<button type="button" data-admin-view="${key}" ${key===view?'aria-current="page"':''}><img src="assets/icons/${icons[key]}.svg" alt="">${tabs[key]}</button>`
   ).join('')}</div>`).join('');
   const picker=groups.map(group=>`<optgroup label="${group.title}">${group.views.map(key=>`<option value="${key}" ${key===view?'selected':''}>${tabs[key]}</option>`).join('')}</optgroup>`).join('');
   const subnav=view==='security'?`<nav class="admin-subnav" aria-label="安全设置">${Object.entries(sections).map(([key,label])=>
    `<button type="button" data-admin-security="${key}" ${key===securityView?'aria-current="page"':''}>${label}</button>`
   ).join('')}</nav>`:'';
   root.innerHTML=`<div class="admin-shell"><aside class="admin-nav"><p>管理后台</p><nav aria-label="后台导航">${nav}</nav></aside>
    <section class="admin-main"><label class="admin-mobile-picker">管理后台<select data-admin-picker aria-label="后台页面">${picker}</select></label>
    <header class="admin-heading"><div><p>管理后台 <span aria-hidden="true">/</span> ${groups.find(group=>group.views.includes(view)).title}</p><h1>${tabs[view]}</h1></div>
    ${view==='operations'?'':'<button type="button" class="secondary" data-admin-refresh>刷新'+(view==='security'?'记录':'页面')+'</button>'}</header>
    ${subnav}<p class="admin-status" role="status" data-admin-status>${esc(loadError)}</p>
    <div class="admin-view" data-admin-pane="${view}">${data?content():loadError?'':'<div class="ui-skeleton admin-loading" role="status"><span class="ui-visually-hidden">正在载入后台…</span></div>'}</div></section></div>`;
   const ops=root.querySelector('[data-admin-operations]');if(ops)child=window.mountCatalogOperations({root:ops,client,onError});
   const host=root.querySelector('[data-admin-members]');if(host)child=window.mountCatalogAccountLifecycle({root:host,client,member,admin:true,onError});
   const security=root.querySelector('[data-admin-account-security]');if(security)child=window.AccountSecurity.mount(security,{member,request:client.accountRequest,onAuthenticated:()=>load()});
   if(focused?.adminView)root.querySelector(`[data-admin-view="${focused.adminView}"]`)?.focus();
   else if(focused?.adminSecurity)root.querySelector(`[data-admin-security="${focused.adminSecurity}"]`)?.focus();
   else if(focused?.adminPicker!==undefined)root.querySelector('[data-admin-picker]')?.focus();
   else if(focused?.adminRefresh!==undefined)root.querySelector('[data-admin-refresh]')?.focus();
  }
  function pagination(){return `<nav class="pagination" aria-label="后台资源分页"><button class="secondary" data-admin-page="${page-1}" ${page<=1?'disabled':''}>上一页</button><span>${data.total}条 · ${page}/${data.totalPages}页</span><button class="secondary" data-admin-page="${page+1}" ${page>=data.totalPages?'disabled':''}>下一页</button></nav>`;}
  function content(){
   if(view==='overview'){layout??={...data.layout,order:[...data.layout.order],hidden:[...data.layout.hidden]};return `<p class="muted">${esc(data.source)} · ${new Date(data.collectedAt).toLocaleString('zh-CN')} · 数据库统计</p><div class="admin-kpis">${layout.order.filter(k=>!layout.hidden.includes(k)).map(k=>`<article class="admin-kpi" data-accent="${({members:'blue',resources:'green',feedback:'violet',recent:'amber'})[k]}"><h3>${widgets[k]}</h3><strong>${esc(data.overview[k]??'—')}</strong><small>本站数据库</small></article>`).join('')}</div><details><summary>自定义概览</summary>${layout.order.map((k,i)=>`<div class="admin-layout-item"><label><input type="checkbox" data-widget-toggle="${k}" ${layout.hidden.includes(k)?'':'checked'}> ${widgets[k]}</label><span></span><button class="secondary" data-widget-move="${k}" data-direction="-1" ${i===0?'disabled':''} aria-label="上移${widgets[k]}">↑</button><button class="secondary" data-widget-move="${k}" data-direction="1" ${i===3?'disabled':''} aria-label="下移${widgets[k]}">↓</button></div>`).join('')}<button class="primary" data-layout-save>保存概览布局</button></details>`;}
   if(view==='resources'){
    const typeNames={website:'网站',ui:'UI',prompt:'提示词'};
    const rows=data.items.map(resource=>{
     const id=esc(resource.kind+':'+resource.id);
     return `<tr><th scope="row">${esc(resource.title)}<small class="admin-resource-description">${esc(resource.description)}</small></th><td>${esc(typeNames[resource.kind]??resource.kind)}</td><td><div class="admin-row-actions"><button type="button" class="text-button" data-admin-open="${id}">查看</button><button type="button" class="text-button" data-admin-edit="${id}">编辑</button><button type="button" class="text-button danger" data-admin-trash="${id}">移至回收站</button></div></td></tr>`;
    });
    return `<form class="admin-toolbar admin-surface--padded admin-surface" data-admin-search><label class="field">类型<select name="kind"><option value="">全部</option>${Object.entries(typeNames).map(([key,label])=>`<option value="${key}" ${kind===key?'selected':''}>${label}</option>`).join('')}</select></label><label class="field">搜索共享资源<input name="q" value="${esc(q)}" maxlength="60"></label><button class="secondary" type="submit">搜索</button></form>${table('共享资源',['名称','类型','操作'],rows,'暂无共享资源。')}${data.totalPages>1?pagination():''}`;
   }
   if(view==='operations')return '<div data-admin-operations></div>';
   if(view==='members')return '<div class="form-actions"><button class="secondary" data-admin-security="devices">邀请与账户安全</button></div><div data-admin-members></div>';
   if(view==='categories')return `<h3>主分类与子分类</h3><div class="form-actions">${[['website','网站'],['ui','UI'],['prompt','提示词']].map(([k,v])=>`<button class="secondary" data-admin-categories="${k}">管理${v}分类</button>`).join('')}</div><h3>共享资源标签</h3><p class="muted">仅管理共享资源标签。</p>${data.items.map(t=>`<form class="admin-toolbar" data-tag-rename="${esc(t.name)}"><strong>${esc(t.name)}（${t.count}）</strong><label class="field">新标签名称<input name="nextName" required maxlength="24" value="${esc(t.name)}"></label><button class="secondary" type="submit">重命名标签</button></form>`).join('')||'<p>暂无共享标签。</p>'}`;
   if(view==='feedback')return (data.items.map(f=>`<article class="admin-result"><h3>${esc(f.resourceTitle)} · ${states[f.state]}</h3><p>${esc(f.body)}</p><button class="text-button" data-feedback-open="${f.id}">打开资源</button><form data-admin-feedback="${f.id}"><label class="field">处理状态<select name="state">${Object.entries(states).map(([k,v])=>`<option value="${k}" ${k===f.state?'selected':''}>${v}</option>`).join('')}</select></label><label class="field">处理说明<input name="resolution" maxlength="1000" value="${esc(f.resolution)}"></label><button class="secondary" type="submit">保存处理结果</button></form></article>`).join('')||'<p>暂无当前可处理的反馈。</p>')+pagination();
   if(view==='announcements')return `<form data-announcement-new><label class="field">公告标题<input name="title" required maxlength="60"></label><label class="field">公告内容<textarea name="body" required maxlength="5000" rows="4"></textarea></label><button class="primary" type="submit">发布成员公告</button></form><p class="muted">仅成员可见；邮件按偏好与配额发送。</p>${data.items.map(a=>`<article class="admin-result"><form data-announcement-edit="${a.id}"><label class="field">标题<input name="title" value="${esc(a.title)}" maxlength="60" required></label><label class="field">内容<textarea name="body" required maxlength="5000">${esc(a.body)}</textarea></label><label><input type="checkbox" name="published" ${a.published?'checked':''}> 发布状态</label><button class="secondary" type="submit">保存公告</button></form></article>`).join('')}`;
   if(view==='settings'){settings=data;return `<form data-workspace-settings><label class="field">首页说明<textarea name="siteDescription" required maxlength="200">${esc(data.siteDescription)}</textarea></label><label class="field">通知刷新间隔（秒）<input name="notificationPollSeconds" type="number" min="120" max="900" required value="${data.notificationPollSeconds}"></label><button class="primary" type="submit">保存网站设置</button></form><p class="muted">游客容量固定5；正式回收站自动永久删除未启用。刷新页面后使用新通知间隔。</p><h3>邮件预算状态</h3><p>${esc(data.mail.scope)}</p><p>本站当日观察尝试：${data.mail.observedAttempts}；外部日预留：${data.mail.externalDayReserve}；安全日预留：${data.mail.securityDayReserve}。</p><p>${data.mail.evidenceValid?'预算证据在有效期内':'外部预算证据未确认或已过期，业务邮件暂停准入'}；${data.mail.businessEnabled?'业务发送配置已开启':'业务发送配置关闭'}。</p>`;}
   if(view==='security'){
    if(securityView==='devices')return '<section class="admin-surface admin-surface--padded" data-admin-account-security></section>';
    if(securityView==='logs')return logTable(data.logs);
    const loginRows=data.logs?.items;
    const metrics=[['网站会话',data.sessions?.items.length,'本次返回的可管理会话','blue'],['最近登录成功',loginRows?.filter(log=>log.result==='success').length,'本次读取的登录记录','green'],['最近登录失败',loginRows?.filter(log=>log.result==='failure').length,'本次读取的登录记录','red']];
    return `<div class="admin-kpis admin-kpis--three">${metrics.map(([name,value,note,color])=>`<article class="admin-kpi" data-accent="${color}"><h3>${name}</h3><strong>${value??'—'}</strong><small>${note}</small></article>`).join('')}</div>
     <div class="admin-analysis">${sessionTable(data.sessions)}${logTable(data.logs,true)}</div><p class="admin-caption">会话记录不等于实时在线人数。</p>`;
   }
   return '';}
  async function readSecurity(){
   if(securityView==='devices')return {};
   if(securityView==='logs')return {logs:await client.securityLogs()};
   const [sessions,logs]=await Promise.allSettled([client.securitySessions(),client.securityLogs()]);
   const unauthorized=[sessions,logs].find(result=>result.status==='rejected'&&result.reason?.status===401);
   if(unauthorized)throw unauthorized.reason;
   return {sessions:sessions.value,logs:logs.value};
  }
  async function load(){
   const own=++epoch;data=null;loadError='';render();
   try{
    const result=['members','operations'].includes(view)?{}:view==='overview'?await client.workspace():view==='resources'?await client.workspace('resources?'+new URLSearchParams({page,q,kind})):view==='categories'?await client.workspace('tags'):view==='feedback'?await client.feedbackQueue('admin',{page}):view==='security'?await readSecurity():await client.workspace(view);
    if(!alive||own!==epoch)return;
    data=result;if(view==='resources'||view==='feedback')page=data.page;render();
   }catch(error){if(!alive||own!==epoch)return;loadError=error.message;tell(loadError);root.querySelector('[data-admin-pane]')?.replaceChildren();onError(error);}
  }
  function resource(key){return data.items?.find(x=>x.kind+':'+x.id===key);}
  async function click(e){const b=e.target.closest('button');if(!b)return;e.stopPropagation();try{if(b.dataset.adminView)return navigate(b.dataset.adminView);if(Object.hasOwn(sections,b.dataset.adminSecurity))return navigate('security',b.dataset.adminSecurity);if(b.hasAttribute('data-admin-refresh'))return load();if(b.dataset.adminPage){page=Number(b.dataset.adminPage);return load();}if(b.dataset.adminOpen)return onOpen(resource(b.dataset.adminOpen));if(b.dataset.adminEdit)return onEdit(resource(b.dataset.adminEdit));if(b.dataset.adminTrash){const r=resource(b.dataset.adminTrash);if(!confirm('将共享资源移至回收站，之后可由所有者恢复。'))return;await client.removeResource(r);await onChanged();return load();}if(b.dataset.feedbackOpen){const f=data.items.find(x=>x.id===b.dataset.feedbackOpen);return onOpen({kind:f.kind,id:f.resourceId,key:f.kind+':'+f.resourceId,title:f.resourceTitle});}if(b.dataset.widgetMove){const i=layout.order.indexOf(b.dataset.widgetMove),j=i+Number(b.dataset.direction);[layout.order[i],layout.order[j]]=[layout.order[j],layout.order[i]];render();root.querySelector('details').open=true;}if(b.hasAttribute('data-layout-save')){const result=await client.workspace('layout',layout,'PATCH');layout.version=result.version;tell('概览布局已保存');}if(b.dataset.adminCategories){const kind=b.dataset.adminCategories,items=await client.categories(kind);if(!alive)return;categoryManager?.destroy();categoryDialog?.remove();categoryDialog=document.createElement('dialog');categoryDialog.className='category-manager';categoryDialog.id='admin-category-manager';document.body.append(categoryDialog);categoryManager=window.mountCatalogCategoryManager({dialog:categoryDialog,kind,items:items.items,client,onChanged:async()=>{await onChanged();}});categoryDialog.showModal();}if(b.dataset.securityRevoke){if(!confirm('撤销这个网站会话？'))return;b.disabled=true;try{await client.revokeSession(b.dataset.securityRevoke);if(alive&&view==='security'&&securityView==='sessions')await load();}finally{b.disabled=false;}return;}}catch(error){if(alive)tell(error.message);onError(error);}}
  async function submit(e){const f=e.target;if(!f.matches('[data-admin-search],[data-tag-rename],[data-admin-feedback],[data-announcement-new],[data-announcement-edit],[data-workspace-settings]'))return;e.preventDefault();e.stopPropagation();const d=Object.fromEntries(new FormData(f)),button=f.querySelector('button[type=submit]');button.disabled=true;try{if(f.hasAttribute('data-admin-search')){q=d.q;kind=d.kind;page=1;await load();return;}if(f.dataset.tagRename)await client.workspace('tags',{name:f.dataset.tagRename,nextName:d.nextName},'PATCH');if(f.dataset.adminFeedback){const r=data.items.find(x=>x.id===f.dataset.adminFeedback);await client.feedbackAction('items/'+r.id,{...d,version:r.version},'PATCH');}if(f.hasAttribute('data-announcement-new'))await client.workspace('announcements',d,'POST');if(f.dataset.announcementEdit){const a=data.items.find(x=>x.id===Number(f.dataset.announcementEdit));await client.workspace('announcements/'+a.id,{...d,published:f.elements.published.checked,version:a.version},'PATCH');}if(f.hasAttribute('data-workspace-settings'))await client.workspace('settings',{...d,notificationPollSeconds:Number(d.notificationPollSeconds),version:settings.version},'PATCH');await onChanged();await load();tell('已保存');}catch(error){if(alive)tell(error.message);onError(error);}finally{button.disabled=false;}}
  function change(e){if(e.target.dataset.adminPicker!==undefined){navigate(e.target.value);return;}if(e.target.dataset.widgetToggle){const k=e.target.dataset.widgetToggle;layout.hidden=e.target.checked?layout.hidden.filter(x=>x!==k):[...new Set([...layout.hidden,k])];}}
  root.addEventListener('click',click);root.addEventListener('submit',submit);root.addEventListener('change',change);load();return{destroy(){alive=false;epoch++;child?.destroy();categoryManager?.destroy();categoryDialog?.close();categoryDialog?.remove();root.removeEventListener('click',click);root.removeEventListener('submit',submit);root.removeEventListener('change',change);root.replaceChildren();data=null;}};
 }
 window.mountCatalogAdmin=mountCatalogAdmin;
})();
