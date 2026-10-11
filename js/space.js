(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const welcome = $('welcome'), workspace = $('workspace'), card = document.querySelector('.login-card'), dialog = $('content-dialog');
  const items = [];
  // Mobile address-bar/keyboard height changes must not recrop the wallpaper.
  let wallpaperWidth = -1;
  function stabilizeWallpaper() {
    const width = window.innerWidth;
    if (width === wallpaperWidth) return;
    wallpaperWidth = width;
    const root = document.documentElement;
    root.style.removeProperty('--wallpaper-height');
    if (width <= 760) {
      const layer = document.querySelector('.wallpaper');
      const height = Math.max(window.innerHeight, layer.getBoundingClientRect().height);
      root.style.setProperty('--wallpaper-height', `${height}px`);
    }
  }
  stabilizeWallpaper();
  window.addEventListener('resize', stabilizeWallpaper, {passive: true});
  document.documentElement.classList.add('js');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {card.classList.add('revealed'); observer.disconnect();}
    }, {threshold: .12}); observer.observe(card);
  } else card.classList.add('revealed');
  let member=null,loginStage='email',factorId=null,apiQueue=Promise.resolve(),feedGeneration=0,nextCursor=null,replyCursor=null;
  async function request(path,method='GET',body){
    const run=async()=>{
      const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:method==='GET'?{}:{'Content-Type':'application/json','X-Forum-CSRF':'1'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
      let data;try{data=await response.json();}catch{throw new Error('登录服务尚未接通，请稍后重试。');}
      if(!response.ok){if(member&&(response.status===401||response.status===403&&data.error==='此账号未获准访问'))leaveForum();const error=new Error(data.error||'请求失败，请稍后重试。');error.status=response.status;throw error;}
      return data;
    };
    const promise=apiQueue.then(run);apiQueue=promise.catch(()=>{});return promise;
  }
  const errorText=error=>error.name==='TimeoutError'?'请求超时，请确认当前状态后再试。':error.message||'连接失败，请稍后重试。';
  function resetLogin(){loginStage='email';factorId=null;$('email-fields').hidden=false;$('mfa-fields').hidden=true;$('restart-login').hidden=true;$('email-code').disabled=false;$('email-code').required=true;$('mfa-code').disabled=true;$('mfa-code').required=false;$('mfa-code').value='';$('mfa-qr').removeAttribute('src');$('mfa-secret').textContent='';$('mfa-enrollment').hidden=true;$('enter-space').textContent='下一步 →';}
  async function prepareMfa(){
    const factor=await request('/auth/mfa/enroll','POST',{});factorId=factor.factorId;loginStage='mfa';$('email-fields').hidden=true;$('email-code').disabled=true;$('email-code').required=false;$('mfa-fields').hidden=false;$('restart-login').hidden=false;$('mfa-code').disabled=false;$('mfa-code').required=true;$('enter-space').textContent='验证并登录 →';
    $('mfa-instruction').textContent=factor.enrolled?'输入身份验证器中的六位验证码。':'首次登录，请先绑定身份验证器。';
    $('mfa-enrollment').hidden=factor.enrolled;
    if(!factor.enrolled){if(typeof factor.qrCode==='string'&&factor.qrCode.startsWith('data:image/svg+xml'))$('mfa-qr').src=factor.qrCode;$('mfa-secret').textContent=factor.secret;}
    $('mfa-code').focus();
  }
  $('send-code').addEventListener('click',async()=>{if(!$('account').reportValidity())return;const button=$('send-code');button.disabled=true;$('login-message').textContent='正在发送…';try{const result=await request('/auth/otp','POST',{email:$('account').value.trim()});$('login-message').textContent=result.message;setTimeout(()=>{button.disabled=false;},60000);}catch(error){$('login-message').textContent=errorText(error);button.disabled=false;}});
  $('restart-login').addEventListener('click',async()=>{try{await request('/auth/logout','POST',{});resetLogin();$('email-code').value='';$('login-message').textContent='';}catch(error){$('login-message').textContent=errorText(error);}});

  // Lucide official icon SVGs, ISC licensed, https://github.com/lucide-icons/lucide.
  const icons = {"house":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" />\n  <path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />\n</svg>\n","file-text":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" />\n  <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" />\n  <path d=\"M10 9H8\" />\n  <path d=\"M16 13H8\" />\n  <path d=\"M16 17H8\" />\n</svg>\n","star":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" />\n</svg>\n","users":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" />\n  <path d=\"M16 3.128a4 4 0 0 1 0 7.744\" />\n  <path d=\"M22 21v-2a4 4 0 0 0-3-3.87\" />\n  <circle cx=\"9\" cy=\"7\" r=\"4\" />\n</svg>\n","settings":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\" />\n  <circle cx=\"12\" cy=\"12\" r=\"3\" />\n</svg>\n","menu":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M4 5h16\" />\n  <path d=\"M4 12h16\" />\n  <path d=\"M4 19h16\" />\n</svg>\n","x":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M18 6 6 18\" />\n  <path d=\"m6 6 12 12\" />\n</svg>\n","chevron-down":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m6 9 6 6 6-6\" />\n</svg>\n","chevron-right":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m9 18 6-6-6-6\" />\n</svg>\n","cloud":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\" />\n</svg>\n","database":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\" />\n  <path d=\"M3 5V19A9 3 0 0 0 21 19V5\" />\n  <path d=\"M3 12A9 3 0 0 0 21 12\" />\n</svg>\n","megaphone":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z\" />\n  <path d=\"M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14\" />\n  <path d=\"M8 6v8\" />\n</svg>\n","message-square":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\" />\n</svg>\n","plus":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M5 12h14\" />\n  <path d=\"M12 5v14\" />\n</svg>\n","search":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m21 21-4.34-4.34\" />\n  <circle cx=\"11\" cy=\"11\" r=\"8\" />\n</svg>\n","log-out":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m16 17 5-5-5-5\" />\n  <path d=\"M21 12H9\" />\n  <path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\" />\n</svg>\n"};
  function putIcons(scope = document) {
    scope.querySelectorAll('[data-icon]').forEach(el => {el.innerHTML = icons[el.dataset.icon] || ''; const svg = el.querySelector('svg'); if(svg) {svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false');}});
  }
  putIcons();
  let currentView = 'all', sort = 'latest', selectedPost = null, composer=null;
  function closeSidebar() {document.body.classList.remove('sidebar-open'); $('sidebar-backdrop').hidden=true; $('menu-toggle').setAttribute('aria-expanded','false');}
  function setView(view, focus=false) {
    currentView=view;
    const labels={all:'全部帖子',discussions:'讨论',mine:'我的帖子',saved:'收藏',announcements:'公告',members:'成员',settings:'设置'};
    $('page-title').textContent=labels[view];document.title='';
    document.querySelectorAll('[data-side]').forEach(el=>{const active=el.dataset.side===view;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    document.querySelectorAll('[data-top]').forEach(el=>{const active=el.dataset.top===(view==='announcements'?'announcements':view==='all'?'home':'discussions');el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    $('members-panel').hidden=view!=='members';$('settings-panel').hidden=view!=='settings';
    const extra=['members','settings'].includes(view);
    document.querySelector('.feed-toolbar').hidden=extra||(view==='announcements'&&member?.role!=='admin');$('search').closest('label').hidden=view==='announcements';$('add-content').textContent=view==='announcements'?'发布公告':'发布帖子';$('member-form').hidden=view!=='members'||member?.role!=='admin';document.querySelector('.feed-sort').hidden=extra||view==='announcements';
    items.length=0;render();if(member)refreshView();closeSidebar();if(focus)$('page-title').focus({preventScroll:true});
  }
  $('login-form').addEventListener('submit',async event=>{
    event.preventDefault();$('enter-space').disabled=true;$('login-message').textContent='正在验证…';
    try{if(loginStage==='email'){const result=await request('/auth/verify','POST',{email:$('account').value.trim(),code:$('email-code').value.trim()});if(result.stage==='authenticated')enterForum(result.member);else{loginStage='pending';$('restart-login').hidden=false;await prepareMfa();$('login-message').textContent='';}}else if(loginStage==='pending'){await prepareMfa();$('login-message').textContent='';}else{const result=await request('/auth/mfa/verify','POST',{factorId,code:$('mfa-code').value.trim()});enterForum(result.member);}}catch(error){$('login-message').textContent=errorText(error);}finally{$('enter-space').disabled=false;}
  });
  $('enter-space').disabled=false;
  document.querySelectorAll('[data-side]').forEach(el=>el.addEventListener('click',()=>setView(el.dataset.side,true)));
  document.querySelectorAll('[data-top]').forEach(el=>el.addEventListener('click',()=>setView(el.dataset.top==='home'?'all':el.dataset.top,true)));
  $('brand-home').addEventListener('click',event=>{event.preventDefault();setView('all',true);});
  $('menu-toggle').addEventListener('click',()=>{const open=!document.body.classList.contains('sidebar-open');document.body.classList.toggle('sidebar-open',open);$('sidebar-backdrop').hidden=!open;$('menu-toggle').setAttribute('aria-expanded',String(open));if(open)$('close-sidebar').focus();});
  $('close-sidebar').addEventListener('click',()=>{closeSidebar();$('menu-toggle').focus();});$('sidebar-backdrop').addEventListener('click',closeSidebar);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      if(document.body.classList.contains('sidebar-open')){closeSidebar();$('menu-toggle').focus();}
      if(!$('profile-menu').hidden){$('profile-menu').hidden=true;$('profile-toggle').setAttribute('aria-expanded','false');$('profile-toggle').focus();}
    }
    if(event.key==='Tab'&&document.body.classList.contains('sidebar-open')){
      const controls=Array.from(document.querySelectorAll('.forum-sidebar button')).filter(el=>el.getClientRects().length);
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  $('profile-toggle').addEventListener('click',()=>{const open=$('profile-menu').hidden;$('profile-menu').hidden=!open;$('profile-toggle').setAttribute('aria-expanded',String(open));});
  document.addEventListener('click',event=>{if(!event.target.closest('.profile-area')){$('profile-menu').hidden=true;$('profile-toggle').setAttribute('aria-expanded','false');}});
  function clearItems(){items.length=0;selectedPost=null;$('search').value='';render();}
  function leaveForum(){member=null;composer=null;$('member-form').reset();$('member-form').hidden=true;feedGeneration++;if(dialog.open)dialog.close();if($('post-dialog').open)$('post-dialog').close();$('content-form').reset();$('reply-form').reset();clearItems();['member-list','member-message','post-manage','announcement-list','post-detail-title','post-detail-meta','post-detail-text','reply-list'].forEach(id=>$(id).replaceChildren());drawUsage({status:'unavailable'});closeSidebar();$('profile-menu').hidden=true;$('profile-toggle').setAttribute('aria-expanded','false');workspace.hidden=true;welcome.hidden=false;resetLogin();window.scrollTo({top:0,behavior:'instant'});document.title='';}
  function enterForum(identity){member=identity;$('login-form').reset();resetLogin();$('login-message').textContent='';$('profile-name').textContent=identity.displayName;document.querySelector('#profile-toggle .avatar').textContent=[...identity.displayName][0];welcome.hidden=true;workspace.hidden=false;setView('all');refreshAnnouncements();refreshUsage();window.scrollTo({top:0,behavior:'instant'});$('page-title').focus({preventScroll:true});}
  $('logout').addEventListener('click',async()=>{$('logout').disabled=true;try{await request('/auth/logout','POST',{});leaveForum();}catch(error){$('forum-notice').textContent=errorText(error);}finally{$('logout').disabled=false;}});
  const mayEdit=item=>member&&(member.role==='admin'||item.authorId===member.id);
  function openComposer(table=currentView==='announcements'?'announcements':'posts',item=null){
    composer={table,item};$('content-form').reset();$('content-message').textContent='';
    const reply=table==='replies';$('content-name').closest('.field').hidden=reply;$('content-name').disabled=reply;$('content-name').required=!reply;
    $('content-text').maxLength=reply?2000:10000;$('content-text').required=reply;
    $('content-form').querySelector('.optional').hidden=reply;
    $('dialog-title').textContent=(item?'编辑':'发布')+({posts:'帖子',announcements:'公告',replies:'回复'}[table]);
    $('content-form').querySelector('[type="submit"]').textContent=item?'保存修改':'发布';
    if(item){$('content-name').value=item.title||'';$('content-text').value=item.body||'';}
    dialog.showModal();
  }
  $('add-content').addEventListener('click',()=>openComposer());$('empty-add').addEventListener('click',()=>openComposer());$('close-dialog').addEventListener('click',()=>dialog.close());
  $('content-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!composer||!member)return;const button=event.submitter,{table,item}=composer;button.disabled=true;
    try{const data={body:$('content-text').value.trim(),...(table==='replies'?{}:{title:$('content-name').value.trim()}),...(item?{version:item.version}:{})};
      const result=await request('/api/v1/'+table+(item?'/'+item.id:''),item?'PATCH':'POST',data);
      if(!member)return;dialog.close();$('content-form').reset();
      if(table==='replies')await refreshReplies();
      else if(table==='posts'){if(item&&selectedPost?.id===item.id){Object.assign(selectedPost,result);$('post-detail-title').textContent=result.title;$('post-detail-text').textContent=result.body;renderPostActions();}if(!item){$('search').value='';setView('all');}else await refreshView();}
      else{await refreshAnnouncements();if(currentView==='announcements')await refreshView();}
    }catch(error){$('content-message').textContent=errorText(error);}finally{button.disabled=false;}
  });
  async function removeContent(table,item,button){
    if(!confirm('删除这条'+({posts:'帖子',announcements:'公告',replies:'回复'}[table])+'？内容将从列表隐藏。'))return;
    button.disabled=true;try{await request('/api/v1/'+table+'/'+item.id,'DELETE',{version:item.version});if(!member)return;
      if(table==='posts'){if(selectedPost?.id===item.id){$('post-dialog').close();selectedPost=null;}await refreshView();}
      else if(table==='replies'){await refreshReplies();await refreshView();}
      else{await refreshAnnouncements();if(currentView==='announcements')await refreshView();}
    }catch(error){$('forum-notice').textContent=errorText(error);}finally{button.disabled=false;}
  }
  function actions(table,item){const host=document.createElement('div');host.className='content-actions';
    if(table==='announcements'?member?.role!=='admin':!mayEdit(item))return host;
    const edit=document.createElement('button'),remove=document.createElement('button');edit.textContent='编辑';remove.textContent='删除';
    edit.addEventListener('click',()=>openComposer(table,item));remove.addEventListener('click',()=>removeContent(table,item,remove));host.append(edit,remove);return host;
  }
  function renderPostActions(){const host=$('post-manage');host.replaceChildren();if(selectedPost)host.append(actions('posts',selectedPost));}
  $('member-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;
    try{await request('/api/v1/members','POST',{email:$('member-email').value.trim(),displayName:$('member-name').value.trim()});if(!member)return;$('member-form').reset();$('member-message').textContent='已加入白名单。请在认证服务控制台邀请该邮箱，完成后即可使用邮箱验证码登录。';await refreshView();}
    catch(error){$('member-message').textContent=errorText(error);}finally{button.disabled=false;}
  });
  document.querySelectorAll('[data-sort]').forEach(el=>el.addEventListener('click',()=>{sort=el.dataset.sort;document.querySelectorAll('[data-sort]').forEach(button=>{const active=button===el;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});refreshView();}));
  const formatDate=date=>date.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  function render(){
    const query=$('search').value.trim().toLocaleLowerCase();const extra=['members','settings','announcements'].includes(currentView);
    const filtered=items;
    const list=$('post-list');list.replaceChildren();
    if(!extra)filtered.forEach(item=>{const row=document.createElement('article');row.className='post-row';const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent=[...item.authorName][0];const open=document.createElement('button');open.className='post-open';const title=document.createElement('h2');title.textContent=item.title;const meta=document.createElement('p');meta.textContent=item.authorName+' · '+formatDate(new Date(item.createdAt));open.append(title,meta);open.addEventListener('click',()=>openPost(item));const actions=document.createElement('div');actions.className='post-actions';const replies=document.createElement('button');replies.innerHTML='<span data-icon="message-square"></span><span></span>';replies.lastChild.textContent=item.replyCount;replies.setAttribute('aria-label','查看回复：'+item.replyCount);replies.addEventListener('click',()=>openPost(item));const save=document.createElement('button');save.innerHTML='<span data-icon="star"></span><span></span>';save.lastChild.textContent=item.bookmarkCount;save.classList.toggle('saved',!!item.bookmarked);save.setAttribute('aria-label',(item.bookmarked?'取消收藏：':'收藏：')+item.title);save.setAttribute('aria-pressed',String(!!item.bookmarked));save.addEventListener('click',async()=>{save.disabled=true;try{await request('/api/v1/posts/'+item.id+'/bookmark',item.bookmarked?'DELETE':'PUT',{});await refreshView();}catch(error){$('forum-notice').textContent=errorText(error);}finally{save.disabled=false;}});actions.append(replies,save);row.append(avatar,open,actions);putIcons(row);list.append(row);});
    $('empty-state').hidden=extra||filtered.length>0;
    $('empty-title').textContent=currentView==='saved'?'还没有收藏':query?'没有找到相关帖子':'还没有帖子';
    $('empty-description').textContent=currentView==='saved'?'点击帖子右侧的星标，留下想再读的内容。':query?'试试其他关键词。':'从一段文字开始交流。';$('empty-add').hidden=currentView==='saved'||!!query;
    $('result-status').textContent=extra?'':items.length?'已加载 '+filtered.length+' 篇帖子':'';
    $('load-more').hidden=extra||!nextCursor;
  }
  async function openPost(item){selectedPost={...item,replies:[]};replyCursor=null;$('post-detail-title').textContent=item.title;$('post-detail-meta').textContent=item.authorName+' · '+formatDate(new Date(item.createdAt));$('post-detail-text').textContent=item.body||'这篇帖子还没有正文。';$('reply-form').reset();$('reply-message').textContent='';renderPostActions();renderReplies();$('post-dialog').showModal();await refreshReplies();}
  function renderReplies(){const list=$('reply-list');list.replaceChildren();if(!selectedPost?.replies.length){const p=document.createElement('p');p.textContent='还没有回复';list.append(p);}selectedPost?.replies.forEach(reply=>{const p=document.createElement('p');p.textContent=reply.authorName+'：'+reply.body;const row=document.createElement('article');row.append(p,actions('replies',reply));list.append(row);});$('more-replies').hidden=!replyCursor;}
  $('close-post').addEventListener('click',()=>$('post-dialog').close());
  $('reply-form').addEventListener('submit',async event=>{event.preventDefault();if(!selectedPost)return;const button=event.submitter;button.disabled=true;try{await request('/api/v1/posts/'+selectedPost.id+'/replies','POST',{body:$('reply-text').value.trim()});$('reply-form').reset();await refreshReplies();await refreshView();}catch(error){$('reply-message').textContent=errorText(error);}finally{button.disabled=false;}});
  $('more-announcements').addEventListener('click',()=>setView('announcements',true));
  $('motion-toggle').addEventListener('change',()=>document.documentElement.classList.toggle('motion-off',!$('motion-toggle').checked));
  async function refreshView(append=false){
    if(!member)return;const generation=++feedGeneration;nextCursor=append?nextCursor:null;
    try{
      if(currentView==='settings')return;
      if(currentView==='members'){const result=await request('/api/v1/members');if(generation!==feedGeneration||!member)return;const list=$('member-list');list.replaceChildren();result.items.forEach(person=>{const p=document.createElement('p');p.textContent=person.displayName+' · '+(person.role==='admin'?'超级管理员':'成员')+(person.status==='disabled'?' · 已停用':'');const row=document.createElement('article');row.className='member-row';row.append(p);if(member.role==='admin'){const email=document.createElement('p');email.textContent=person.email;row.append(email);if(person.role!=='admin'){const toggle=document.createElement('button');toggle.textContent=person.status==='active'?'停用':'启用';toggle.addEventListener('click',async()=>{toggle.disabled=true;try{await request('/api/v1/members/'+person.id,'PATCH',{status:person.status==='active'?'disabled':'active'});await refreshView();}catch(error){$('member-message').textContent=errorText(error);}finally{toggle.disabled=false;}});row.append(toggle);}}list.append(row);});return;}
      if(currentView==='announcements'){await refreshAnnouncements(true,generation);return;}
      const params=new URLSearchParams({sort:{latest:'newest',replies:'replies',saved:'bookmarks'}[sort],filter:currentView==='mine'?'mine':currentView==='saved'?'bookmarked':'all',q:$('search').value.trim()});if(append&&nextCursor)params.set('cursor',nextCursor);
      $('result-status').textContent='正在加载…';const result=await request('/api/v1/posts?'+params);if(generation!==feedGeneration||!member)return;
      if(!append)items.length=0;items.push(...result.items);nextCursor=result.nextCursor;render();$('forum-notice').textContent='仅已登录的指定成员可见。';
    }catch(error){if(generation===feedGeneration){$('result-status').textContent=errorText(error);$('empty-state').hidden=true;}}
  }
  async function refreshReplies(append=false){const post=selectedPost;if(!post)return;try{const params=new URLSearchParams();if(append&&replyCursor)params.set('cursor',replyCursor);const result=await request('/api/v1/posts/'+post.id+'/replies?'+params);if(!member||selectedPost!==post)return;if(!append)post.replies=[];post.replies.push(...result.items);replyCursor=result.nextCursor;renderReplies();}catch(error){$('reply-message').textContent=errorText(error);}}
  async function refreshAnnouncements(main=false,generation){try{const result=await request('/api/v1/announcements');if(!member||main&&(generation!==feedGeneration||currentView!=='announcements'))return;const list=main?$('post-list'):$('announcement-list');list.replaceChildren();if(!result.items.length){const p=document.createElement('p');p.className='announcement-empty';p.textContent='暂无已发布公告';list.append(p);}result.items.forEach(item=>{const article=document.createElement('article'),title=document.createElement('h3'),date=document.createElement('p'),body=document.createElement('p');title.textContent=item.title;date.textContent=formatDate(new Date(item.createdAt));body.textContent=item.body;article.append(title,date,body,actions('announcements',item));list.append(article);});}catch(error){$('forum-notice').textContent=errorText(error);}}
  $('load-more').addEventListener('click',async()=>{$('load-more').disabled=true;try{await refreshView(true);}finally{$('load-more').disabled=false;}});$('more-replies').addEventListener('click',async()=>{$('more-replies').disabled=true;try{await refreshReplies(true);}finally{$('more-replies').disabled=false;}});
  let searchTimer;$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>refreshView(),300);});
  let usageRefreshBusy=false;
  async function refreshUsage(){
    if(usageRefreshBusy||!member||document.hidden)return;
    usageRefreshBusy=true;
    try{const result=await request('/api/v1/usage');if(!member)return;drawUsage(result);}catch{document.querySelectorAll('.metric-source').forEach(el=>el.textContent='暂不可用');}finally{usageRefreshBusy=false;}
  }
  function drawUsage(data){
    document.querySelectorAll('.metric-source').forEach(el=>el.textContent=data.status==='ok'?'分析数据':data.status==='stale'?'数据已过期':'暂不可用');document.querySelectorAll('.metric-updated').forEach(el=>el.textContent='数据更新时间：'+(data.collectedAt?formatDate(new Date(data.collectedAt)):'—'));
    const configs=[['requests','.workers .metric-value','.workers .meter','.workers .trend-empty'],['rowsRead','.d1-grid > div:first-child .metric-value','.d1-grid > div:first-child .meter','.d1-grid > div:first-child .trend-empty'],['rowsWritten','.d1-grid > div:last-child .metric-value','.d1-grid > div:last-child .meter','.d1-grid > div:last-child .trend-empty'],['databaseBytes','.storage-value','.storage-row .meter',null]];
    configs.forEach(([key,valueSelector,meterSelector,trendSelector])=>{
      const value=data.values?.[key],limit=data.limits?.[key],valid=typeof value==='number'&&Number.isFinite(value),label=valid?(key==='databaseBytes'?(value/1000000).toFixed(1)+' MB':value.toLocaleString('zh-CN')):'—';document.querySelector(valueSelector).textContent=label;
      const meter=document.querySelector(meterSelector),track=meter.querySelector('.meter-track');track.replaceChildren();const ratio=valid&&typeof limit==='number'?value/limit:null;
      meter.children[1].textContent=ratio===null?'—':(ratio*100).toFixed(1)+'%';meter.querySelector('.meter-tip').textContent=valid?(data.scope==='account'?'账号合计 · ':'本站统计 · ')+label+'；'+data.note:'用量未知，请稍后刷新';meter.setAttribute('aria-label',meter.querySelector('.meter-tip').textContent);
      if(ratio!==null){const bar=document.createElement('span');bar.className='meter-fill';bar.style.width=Math.min(100,ratio*100)+'%';track.append(bar);}
      if(trendSelector){const host=document.querySelector(trendSelector);host.replaceChildren();const points=(data.trend||[]).filter(p=>p.periodStart===data.periodStart&&typeof p[key]==='number').slice(-30);if(points.length<2){host.textContent='趋势数据积累中';return;}const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),line=document.createElementNS(ns,'polyline'),min=Math.min(...points.map(p=>p[key])),max=Math.max(...points.map(p=>p[key]));svg.setAttribute('viewBox','0 0 200 60');svg.setAttribute('role','img');svg.setAttribute('aria-label','今日累计用量趋势');line.setAttribute('points',points.map((p,i)=>`${i*200/(points.length-1)},${52-(p[key]-min)*44/(max-min||1)}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','currentColor');line.setAttribute('stroke-width','2');svg.append(line);host.append(svg);host.setAttribute('aria-label','今日累计用量趋势');}
    });
  }
  let liveRefreshBusy=false;
  async function refreshLiveContent(){
    if(liveRefreshBusy||!member||document.hidden||dialog.open||$('member-form').contains(document.activeElement))return;
    liveRefreshBusy=true;
    try{await refreshView();await refreshAnnouncements();if(selectedPost&&$('post-dialog').open&&!$('reply-text').value.trim())await refreshReplies();}
    finally{liveRefreshBusy=false;}
  }
  setInterval(()=>{refreshLiveContent();},20000);
  setInterval(()=>{refreshUsage();},60000);
  let restoringSession=false,sessionRestoreNeeded=true;
  async function restoreSession(){
    if(restoringSession||!sessionRestoreNeeded||member||loginStage!=='email')return;
    restoringSession=true;
    const sendDisabled=$('send-code').disabled,enterDisabled=$('enter-space').disabled;
    $('send-code').disabled=true;$('enter-space').disabled=true;
    $('login-message').textContent='正在恢复本设备的登录…';
    try{
      for(let attempt=0;attempt<3;attempt++){
        try{const result=await request('/api/v1/session');sessionRestoreNeeded=false;enterForum(result.member);return;}
        catch(error){
          if(error.status===401||error.status===403){sessionRestoreNeeded=false;$('login-message').textContent='';return;}
          if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
        }
      }
      $('login-message').textContent='连接暂不可用，已保留本设备的登录凭据；网络恢复后会重试。';
    }finally{restoringSession=false;$('send-code').disabled=sendDisabled;$('enter-space').disabled=enterDisabled;}
  }
  render();restoreSession();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){restoreSession();refreshUsage();refreshLiveContent();}});
  window.addEventListener('online',()=>{restoreSession();refreshUsage();refreshLiveContent();});
})();
