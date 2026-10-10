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
  function concealPassword() {
    $('password').type = 'password'; $('toggle-password').textContent = '显示';
    $('toggle-password').setAttribute('aria-label', '显示密码'); $('toggle-password').setAttribute('aria-pressed', 'false');
  }
  $('toggle-password').addEventListener('click', () => {
    const visible = $('password').type === 'password'; $('password').type = visible ? 'text' : 'password';
    $('toggle-password').textContent = visible ? '隐藏' : '显示';
    $('toggle-password').setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
    $('toggle-password').setAttribute('aria-pressed', String(visible));
  });

  // Lucide official icon SVGs, ISC licensed, https://github.com/lucide-icons/lucide.
  const icons = {"house":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" />\n  <path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />\n</svg>\n","file-text":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" />\n  <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" />\n  <path d=\"M10 9H8\" />\n  <path d=\"M16 13H8\" />\n  <path d=\"M16 17H8\" />\n</svg>\n","star":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" />\n</svg>\n","users":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" />\n  <path d=\"M16 3.128a4 4 0 0 1 0 7.744\" />\n  <path d=\"M22 21v-2a4 4 0 0 0-3-3.87\" />\n  <circle cx=\"9\" cy=\"7\" r=\"4\" />\n</svg>\n","settings":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\" />\n  <circle cx=\"12\" cy=\"12\" r=\"3\" />\n</svg>\n","menu":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M4 5h16\" />\n  <path d=\"M4 12h16\" />\n  <path d=\"M4 19h16\" />\n</svg>\n","x":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M18 6 6 18\" />\n  <path d=\"m6 6 12 12\" />\n</svg>\n","chevron-down":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m6 9 6 6 6-6\" />\n</svg>\n","chevron-right":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m9 18 6-6-6-6\" />\n</svg>\n","cloud":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\" />\n</svg>\n","database":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\" />\n  <path d=\"M3 5V19A9 3 0 0 0 21 19V5\" />\n  <path d=\"M3 12A9 3 0 0 0 21 12\" />\n</svg>\n","megaphone":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z\" />\n  <path d=\"M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14\" />\n  <path d=\"M8 6v8\" />\n</svg>\n","message-square":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\" />\n</svg>\n","plus":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M5 12h14\" />\n  <path d=\"M12 5v14\" />\n</svg>\n","search":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m21 21-4.34-4.34\" />\n  <circle cx=\"11\" cy=\"11\" r=\"8\" />\n</svg>\n","log-out":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m16 17 5-5-5-5\" />\n  <path d=\"M21 12H9\" />\n  <path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\" />\n</svg>\n"};
  function putIcons(scope = document) {
    scope.querySelectorAll('[data-icon]').forEach(el => {el.innerHTML = icons[el.dataset.icon] || ''; const svg = el.querySelector('svg'); if(svg) {svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false');}});
  }
  putIcons();
  let currentView = 'all', sort = 'latest', selectedPost = null, nextId = 1;
  function closeSidebar() {document.body.classList.remove('sidebar-open'); $('sidebar-backdrop').hidden=true; $('menu-toggle').setAttribute('aria-expanded','false');}
  function setView(view, focus=false) {
    currentView=view;
    const labels={all:'全部帖子',discussions:'讨论',mine:'我的帖子',saved:'收藏',announcements:'公告',members:'成员',settings:'设置'};
    $('page-title').textContent=labels[view];document.title='';
    document.querySelectorAll('[data-side]').forEach(el=>{const active=el.dataset.side===view;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    document.querySelectorAll('[data-top]').forEach(el=>{const active=el.dataset.top===(view==='announcements'?'announcements':view==='all'?'home':'discussions');el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    $('members-panel').hidden=view!=='members';$('settings-panel').hidden=view!=='settings';
    const extra=['members','settings'].includes(view);
    document.querySelector('.feed-toolbar').hidden=extra||view==='announcements';document.querySelector('.feed-sort').hidden=extra||view==='announcements';
    render();closeSidebar();if(focus)$('page-title').focus({preventScroll:true});
  }
  $('login-form').addEventListener('submit',event=>{
    event.preventDefault();if(!$('account').value.trim()||!$('password').value.trim()) {$('login-message').textContent='请输入演示账号和密码。';return;}
    $('login-form').reset();concealPassword();$('login-message').textContent='';welcome.hidden=true;workspace.hidden=false;setView('all');window.scrollTo({top:0,behavior:'instant'});$('page-title').focus({preventScroll:true});
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
  $('logout').addEventListener('click',()=>{if(dialog.open)dialog.close();if($('post-dialog').open)$('post-dialog').close();$('content-form').reset();$('reply-form').reset();clearItems();closeSidebar();$('profile-menu').hidden=true;$('profile-toggle').setAttribute('aria-expanded','false');workspace.hidden=true;welcome.hidden=false;window.scrollTo({top:0,behavior:'instant'});document.querySelector('.nav-login').focus({preventScroll:true});document.title='';});
  function openComposer(){$('content-form').reset();$('content-message').textContent='';dialog.showModal();}
  $('add-content').addEventListener('click',openComposer);$('empty-add').addEventListener('click',openComposer);$('close-dialog').addEventListener('click',()=>dialog.close());
  $('content-form').addEventListener('submit',event=>{event.preventDefault();const title=$('content-name').value.trim();if(!title){$('content-message').textContent='请填写标题。';return;}items.push({id:nextId++,title,text:$('content-text').value.trim(),author:'我',date:new Date(),saved:false,replies:[]});$('search').value='';dialog.close();$('content-form').reset();setView('all');});
  document.querySelectorAll('[data-sort]').forEach(el=>el.addEventListener('click',()=>{sort=el.dataset.sort;document.querySelectorAll('[data-sort]').forEach(button=>{const active=button===el;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});render();}));
  const formatDate=date=>date.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  function render(){
    const query=$('search').value.trim().toLocaleLowerCase();const extra=['members','settings','announcements'].includes(currentView);
    const filtered=items.filter(item=>(currentView!=='saved'||item.saved)&&(currentView!=='mine'||item.author==='我')&&(item.title+' '+item.text).toLocaleLowerCase().includes(query));
    filtered.sort((a,b)=>sort==='replies'?b.replies.length-a.replies.length||b.id-a.id:sort==='saved'?Number(b.saved)-Number(a.saved)||b.id-a.id:b.id-a.id);
    const list=$('post-list');list.replaceChildren();
    if(!extra)filtered.forEach(item=>{const row=document.createElement('article');row.className='post-row';const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent='我';const open=document.createElement('button');open.className='post-open';const title=document.createElement('h2');title.textContent=item.title;const meta=document.createElement('p');meta.textContent='我 · 临时预览 · '+formatDate(item.date);open.append(title,meta);open.addEventListener('click',()=>openPost(item));const actions=document.createElement('div');actions.className='post-actions';const replies=document.createElement('button');replies.innerHTML='<span data-icon="message-square"></span><span></span>';replies.lastChild.textContent=item.replies.length;replies.setAttribute('aria-label','查看回复：'+item.replies.length);replies.addEventListener('click',()=>openPost(item));const save=document.createElement('button');save.innerHTML='<span data-icon="star"></span><span></span>';save.lastChild.textContent=item.saved?'1':'0';save.classList.toggle('saved',item.saved);save.setAttribute('aria-label',(item.saved?'取消收藏：':'收藏：')+item.title);save.setAttribute('aria-pressed',String(item.saved));save.addEventListener('click',()=>{item.saved=!item.saved;render();});actions.append(replies,save);row.append(avatar,open,actions);putIcons(row);list.append(row);});
    $('empty-state').hidden=extra||filtered.length>0;
    $('empty-title').textContent=currentView==='saved'?'还没有收藏':query?'没有找到相关帖子':'还没有帖子';
    $('empty-description').textContent=currentView==='saved'?'点击帖子右侧的星标，留下想再读的内容。':query?'试试其他关键词。':'从一段文字开始交流。';$('empty-add').hidden=currentView==='saved'||!!query;
    $('result-status').textContent=extra?'':items.length?'当前显示 '+filtered.length+' 篇临时帖子 · 刷新或退出后清空':'';
    if(currentView==='announcements'){const p=document.createElement('p');p.className='standalone-empty';p.textContent='暂无已发布公告';list.append(p);}
  }
  function openPost(item){selectedPost=item;$('post-detail-title').textContent=item.title;$('post-detail-meta').textContent='我 · 临时预览 · '+formatDate(item.date);$('post-detail-text').textContent=item.text||'这篇帖子还没有正文。';$('reply-form').reset();renderReplies();$('post-dialog').showModal();}
  function renderReplies(){const list=$('reply-list');list.replaceChildren();if(!selectedPost.replies.length){const p=document.createElement('p');p.textContent='还没有回复';list.append(p);}selectedPost.replies.forEach(reply=>{const p=document.createElement('p');p.textContent='我：'+reply;list.append(p);});}
  $('close-post').addEventListener('click',()=>$('post-dialog').close());
  $('reply-form').addEventListener('submit',event=>{event.preventDefault();const text=$('reply-text').value.trim();if(!text||!selectedPost)return;selectedPost.replies.push(text);$('reply-form').reset();renderReplies();render();});
  $('more-announcements').addEventListener('click',()=>setView('announcements',true));
  $('motion-toggle').addEventListener('change',()=>document.documentElement.classList.toggle('motion-off',!$('motion-toggle').checked));
  $('search').addEventListener('input',render);window.addEventListener('pagehide',clearItems);render();
})();
