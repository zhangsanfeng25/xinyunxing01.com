(() => {
 'use strict';const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),labels={comment:'评论与回复',feedback:'反馈结果',announcement:'管理员公告',security:'账户安全'};
 function mountCatalogNotifications({button,client,onError=()=>{},pollSeconds=120}){
  let page=1;let alive=true,epoch=0,timer=null,data=null,prefs=null,busy=false,lastAttempt=-Infinity;const dialog=document.createElement('dialog');dialog.className='notification-dialog small-dialog';dialog.setAttribute('aria-label','通知中心');document.body.append(dialog);const status=v=>{const el=dialog.querySelector('[data-notice-status]');if(el)el.textContent=v;};
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
      <button type="button" class="secondary" data-notice-refresh>刷新通知</button>
      ${count?'<button type="button" class="secondary" data-notice-all>全部标为已读</button>':''}
     </div>
     <p data-notice-status role="status"></p>
     ${data?data.items.map(row).join('')||'<p class="notification-empty">暂无通知</p>':'<p class="notification-empty">正在载入…</p>'}
     ${data?.totalPages>1?`<nav class="pagination" aria-label="通知分页"><button class="secondary" data-notice-page="${data.page-1}" ${data.page<=1?'disabled':''}>上一页</button><span>${data.page}/${data.totalPages}</span><button class="secondary" data-notice-page="${data.page+1}" ${data.page>=data.totalPages?'disabled':''}>下一页</button></nav>`:''}
     ${prefs?`<details><summary>通知偏好</summary>${prefs.items.map(p=>`<form data-notice-preference="${p.type}" class="notification-preference"><strong>${labels[p.type]}</strong><label><input type="checkbox" name="inApp" ${p.inApp?'checked':''}> 站内</label><label><input type="checkbox" name="email" ${p.email?'checked':''}> 邮件</label><button class="secondary" type="submit">保存${labels[p.type]}偏好</button></form>`).join('')}</details>`:''}
    </div>`;
  }
  async function load(){if(!alive||document.hidden||busy)return;busy=true;lastAttempt=Date.now();const own=epoch;try{const [a,b]=await Promise.all([client.notifications({page}),client.notificationPreferences()]);if(!alive||own!==epoch)return;data=a;page=a.page;prefs=b;render();}catch(error){if(alive)status(error.message);onError(error);}finally{busy=false;}}
  function open(){if(!alive)return;render();dialog.showModal();load();}
  async function click(e){const b=e.target.closest('button');if(!b)return;e.stopPropagation();if(b.hasAttribute('data-notice-close'))return dialog.close();try{if(b.dataset.noticePage)page=Number(b.dataset.noticePage);if(b.dataset.noticeRead)await client.notificationRead({id:b.dataset.noticeRead});if(b.hasAttribute('data-notice-all'))await client.notificationRead({all:true});await load();}catch(error){status(error.message);onError(error);}}
  async function submit(e){if(!e.target.matches('[data-notice-preference]'))return;e.preventDefault();const f=e.target;try{await client.notificationPreferences({type:f.dataset.noticePreference,inApp:f.elements.inApp.checked,email:f.elements.email.checked});await load();status('通知偏好已保存');}catch(error){status(error.message);onError(error);}}
  function visible(){clearInterval(timer);timer=null;if(!document.hidden){if(Date.now()-lastAttempt>=Math.max(120,pollSeconds)*1000)load();timer=setInterval(load,Math.max(120,pollSeconds)*1000);}}
  button.addEventListener('click',open);dialog.addEventListener('click',click);dialog.addEventListener('submit',submit);document.addEventListener('visibilitychange',visible);visible();return{open,destroy(){alive=false;epoch++;clearInterval(timer);button.removeEventListener('click',open);dialog.removeEventListener('click',click);dialog.removeEventListener('submit',submit);document.removeEventListener('visibilitychange',visible);dialog.close();dialog.remove();button.querySelector('.notification-dot')?.remove();button.setAttribute('aria-label','查看通知');data=prefs=null;}};
 }
 window.mountCatalogNotifications=mountCatalogNotifications;
})();
