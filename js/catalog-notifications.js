(() => {
 'use strict';const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),labels={comment:'评论与回复',feedback:'反馈结果',announcement:'管理员公告',security:'账户安全'};
 function mountCatalogNotifications({button,client,onError=()=>{},pollSeconds=120}){
  let page=1,alive=true,timer=null,data=null,busy=false,loadFailed=false,lastAttempt=-Infinity;const dialog=document.createElement('dialog');dialog.className='notification-dialog small-dialog';dialog.setAttribute('aria-label','通知中心');document.body.append(dialog);const status=v=>{const el=dialog.querySelector('[data-notice-status]');if(el)el.textContent=v;};
  function render(){
   if(!alive)return;
   const count=data?.unread??0;
   button.setAttribute('aria-label','查看通知'+(count?'，'+count+'条未读':''));
   button.querySelector('.notification-dot')?.remove();
   if(count)button.insertAdjacentHTML('beforeend','<span class="notification-dot">'+(count>99?'99+':count)+'</span>');
   const row=n=>`<article class="notification-row">
    <p class="notification-type">${labels[n.type]}${n.read?'':' · 未读'}</p>
    <h3>${esc(n.resourceTitle??(n.type==='security'?'账户安全提醒':'站内消息'))}</h3>
    ${n.body?`<p class="comment-body">${esc(n.body)}</p>`:''}
    <div class="notification-row-meta"><time>${new Date(n.createdAt).toLocaleString('zh-CN')}</time>${n.read?'':`<button type="button" class="text-button" data-notice-read="${esc(n.id)}">标为已读</button>`}</div>
   </article>`;
   dialog.innerHTML=`<header class="dialog-head"><h2>通知中心</h2><button type="button" class="icon-btn" data-notice-close aria-label="关闭通知中心">×</button></header>
    <div class="notification-content">
     <div class="notification-toolbar">${data?`<span>${count?count+' 条未读':'无未读通知'}</span>`:''}
      <a class="text-link" href="#/account/notifications" data-notice-preferences-link>通知偏好</a>
      <button type="button" class="secondary" data-notice-refresh>刷新通知</button>
      ${count?'<button type="button" class="secondary" data-notice-all>全部标为已读</button>':''}
     </div>
     <p data-notice-status role="status"></p>
     ${data?data.items.map(row).join('')||'<p class="notification-empty">暂无通知</p>':loadFailed?'':'<div class="notification-loading" role="status"><span class="ui-visually-hidden">正在载入通知…</span></div>'}
     ${data?.totalPages>1?`<nav class="pagination" aria-label="通知分页"><button class="secondary" data-notice-page="${data.page-1}" ${data.page<=1?'disabled':''}>上一页</button><span>${data.page}/${data.totalPages}</span><button class="secondary" data-notice-page="${data.page+1}" ${data.page>=data.totalPages?'disabled':''}>下一页</button></nav>`:''}
    </div>`;
  }
  async function load(){if(!alive||document.hidden||busy)return;busy=true;if(loadFailed&&!data){loadFailed=false;render();}lastAttempt=Date.now();try{const a=await client.notifications({page});if(!alive)return;data=a;page=a.page;render();}catch(error){if(alive){if(!data){loadFailed=true;render();}status(error.message);}onError(error);}finally{busy=false;}}
  function open(){if(!alive)return;render();dialog.showModal();load();}
  async function click(e){if(e.target.closest('[data-notice-preferences-link]'))return dialog.close();const b=e.target.closest('button');if(!b||b.type==='submit')return;e.stopPropagation();if(b.hasAttribute('data-notice-close'))return dialog.close();try{if(b.dataset.noticePage)page=Number(b.dataset.noticePage);if(b.dataset.noticeRead)await client.notificationRead({id:b.dataset.noticeRead});if(b.hasAttribute('data-notice-all'))await client.notificationRead({all:true});await load();}catch(error){status(error.message);onError(error);}}
  function visible(){clearInterval(timer);timer=null;if(!document.hidden){if(Date.now()-lastAttempt>=Math.max(120,pollSeconds)*1000)load();timer=setInterval(load,Math.max(120,pollSeconds)*1000);}}
  button.addEventListener('click',open);dialog.addEventListener('click',click);document.addEventListener('visibilitychange',visible);visible();return{open,destroy(){alive=false;clearInterval(timer);button.removeEventListener('click',open);dialog.removeEventListener('click',click);document.removeEventListener('visibilitychange',visible);dialog.close();dialog.remove();button.querySelector('.notification-dot')?.remove();button.setAttribute('aria-label','查看通知');data=null;}};
 }
 window.mountCatalogNotifications=mountCatalogNotifications;
 window.mountCatalogNotificationPreferences=function({root,client,onError=()=>{}}){
  const controller=new AbortController();
  let alive=true,saving=false;
  const status=message=>{root.querySelector('[role=status]').textContent=message;};
  async function load(){
   root.innerHTML='<h2>通知偏好</h2><div class="ui-skeleton notification-loading" role="status"><span class="ui-visually-hidden">正在读取通知偏好…</span></div>';
   try{
    const result=await client.notificationPreferences(undefined,{signal:controller.signal});
    if(!alive)return;
    root.innerHTML='<h2>通知偏好</h2><form data-notice-preference>'+result.items.filter(p=>Object.hasOwn(labels,p.type)).map(p=>
     '<fieldset class="notification-preference" data-preference-type="'+p.type+'"><legend>'+labels[p.type]+'</legend><label><input type="checkbox" name="inApp" '+(p.inApp?'checked':'')+'> 站内</label><label><input type="checkbox" name="email" '+(p.email?'checked':'')+'> 邮件</label></fieldset>'
    ).join('')+'<div class="form-actions"><button class="primary" type="submit">保存偏好</button></div><p role="status"></p></form>';
   }catch(error){
    if(!alive)return;
    root.innerHTML='<h2>通知偏好</h2><p role="status"></p><button type="button" class="secondary" data-notice-retry>重试</button>';
    status(error.message);onError(error);
   }
  }
  async function submit(event){
   const form=event.target;
   if(!form.matches('[data-notice-preference]'))return;
   event.preventDefault();
   if(saving)return;
   const items=[...form.querySelectorAll('[data-preference-type]')].map(group=>({
    type:group.dataset.preferenceType,inApp:group.querySelector('[name=inApp]').checked,email:group.querySelector('[name=email]').checked
   }));
   const controls=[...form.querySelectorAll('fieldset,button')];
   saving=true;controls.forEach(control=>control.disabled=true);status('正在保存…');
   try{
    await client.notificationPreferences({items},{signal:controller.signal});
    if(alive)status('通知偏好已保存');
   }catch(error){
    if(alive){status(error.message);onError(error);}
   }finally{saving=false;controls.forEach(control=>control.disabled=false);}
  }
  const retry=event=>{if(event.target.closest('[data-notice-retry]'))load();};
  root.addEventListener('click',retry);root.addEventListener('submit',submit);load();
  return{destroy(){alive=false;controller.abort();root.removeEventListener('click',retry);root.removeEventListener('submit',submit);}};
 };
})();
