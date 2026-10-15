(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const welcome = $('welcome'), workspace = $('workspace'), card = document.querySelector('.login-card'), dialog = $('content-dialog');
  const items = [];
  // V0.3 pure display and route helpers
  function parseRoute(hash) {
    if(['','#','#intro','#login'].includes(hash))return {kind:'landing',anchor:hash};
    if(hash==='#forum')return {kind:'view',view:'all'};
    if(hash==='#/help'||hash==='#/privacy')return {kind:'public',page:hash.slice(2)};
    const post=hash.match(/^#\/posts\/([1-9]\d*)$/);
    if(post&&Number.isSafeInteger(Number(post[1])))return {kind:'post',id:Number(post[1])};
    const view=hash.match(/^#\/view\/(all|discussions|mine|saved|members|settings|profile|announcements|load|login-events|sessions)$/);
    return view?{kind:'view',view:view[1]}:{kind:'missing'};
  }
  function readDisplayPreferences(storage) {
    let saved;try{saved=JSON.parse(storage.getItem('forum-display-v03')||'{}');}catch{saved={};}
    return {theme:['light','dark','system'].includes(saved?.theme)?saved.theme:'system',motion:typeof saved?.motion==='boolean'?saved.motion:true};
  }
  function resolveDisplayPreferences(preferences,systemDark,reducedMotion) {
    return {theme:preferences.theme==='system'?(systemDark?'dark':'light'):preferences.theme,motion:preferences.motion&&!reducedMotion};
  }
  function isDraftChanged(initial,title,body) {return initial.title!==title||initial.body!==body;}
  // End V0.3 pure helpers
  let displayPreferences;
  try{displayPreferences=readDisplayPreferences(localStorage);}catch{displayPreferences={theme:'system',motion:true};}
  const systemTheme=window.matchMedia('(prefers-color-scheme: dark)'),systemMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  function applyDisplayPreferences(){
    const resolved=resolveDisplayPreferences(displayPreferences,systemTheme.matches,systemMotion.matches);
    document.documentElement.dataset.theme=resolved.theme;
    document.documentElement.classList.toggle('motion-off',!resolved.motion);
    document.querySelector('meta[name="theme-color"]').content=resolved.theme==='dark'?'#162c31':'#dbe7e6';
    document.querySelectorAll('[data-theme-toggle]').forEach(button=>{button.setAttribute('aria-label','切换为'+(resolved.theme==='dark'?'浅色':'深色')+'主题');button.setAttribute('aria-pressed',String(resolved.theme==='dark'));const mark=button.querySelector('[data-icon]');if(mark){mark.dataset.icon=resolved.theme==='dark'?'sun':'moon';if(mark.querySelector('svg'))putIcons(button);}});
    if($('theme-select'))$('theme-select').value=displayPreferences.theme;
    if($('motion-toggle'))$('motion-toggle').checked=displayPreferences.motion;
  }
  function saveDisplayPreferences(){try{localStorage.setItem('forum-display-v03',JSON.stringify(displayPreferences));}catch{}applyDisplayPreferences();}
  applyDisplayPreferences();systemTheme.addEventListener('change',applyDisplayPreferences);systemMotion.addEventListener('change',applyDisplayPreferences);
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
    let loginCardInView=false;
    const observer = new IntersectionObserver(entries => {
      for(const entry of entries){
        if(!entry.isIntersecting){loginCardInView=false;continue;}
        if(entry.intersectionRatio>=.12&&!loginCardInView){loginCardInView=true;revealLogin(false);}
      }
    }, {threshold: [0,.12]}); observer.observe(card);
  } else card.classList.add('revealed');
  let member=null,guestLease=null,loginStage='email',factorId=null,apiQueue=Promise.resolve(),feedGeneration=0,nextCursor=null,replyCursor=null;
  let requestEpoch=0;
  const activeRequests=new Set();
  function invalidateRequests(){requestEpoch++;apiQueue=Promise.resolve();for(const controller of activeRequests)controller.abort();activeRequests.clear();}
  function requestError(message,code,status){return Object.assign(new Error(message),{code,status});}
  async function request(path,method='GET',body){
    const epoch=requestEpoch,cancelled=()=>requestError('登录状态已变化，旧操作已取消。','REQUEST_CANCELLED');
    const run=async()=>{
      if(epoch!==requestEpoch)throw cancelled();
      const controller=new AbortController();activeRequests.add(controller);let response,data;
      try{response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:method==='GET'?{}:{'Content-Type':'application/json','X-Forum-CSRF':'1'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])});data=await response.json();}
      catch{if(epoch!==requestEpoch)throw cancelled();throw requestError(method==='GET'?'连接暂不可用，请检查网络后重试。':'请求结果暂无法确认，请先刷新核对，再决定是否重试。',method==='GET'?'NETWORK_UNAVAILABLE':'WRITE_RESULT_UNKNOWN');}
      finally{activeRequests.delete(controller);}
      if(epoch!==requestEpoch)throw cancelled();
      if(!response.ok){if(member&&(response.status===401||data.code==='ACCOUNT_UNAVAILABLE'||response.status===403&&data.error==='此账号未获准访问')){leaveForum();$('login-message').textContent='登录已失效或账号已停用，请重新验证；刚才的操作请在登录后核对。';}throw requestError(data.error||'请求失败，请稍后重试。',data.code||'REQUEST_FAILED',response.status);}
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
  let otpResendUntil=0,otpResendTimer=null;
  function updateOtpCountdown(){
    const seconds=Math.max(0,Math.ceil((otpResendUntil-Date.now())/1000));
    $('send-code-label').hidden=seconds>0;
    $('send-code-interval').hidden=seconds===0;
    $('send-code-interval').textContent=seconds?`${seconds} 秒`:'';
    if(!seconds&&otpResendTimer!==null){clearInterval(otpResendTimer);otpResendTimer=null;$('send-code').disabled=false;}
  }
  updateOtpCountdown();
  $('send-code').addEventListener('click',async()=>{
    const button=$('send-code');if(button.disabled||!$('account').reportValidity())return;
    button.disabled=true;$('login-message').dataset.state='loading';$('login-message').textContent='正在发送…';
    try{
      const result=await request('/auth/otp','POST',{email:$('account').value.trim()});$('login-message').dataset.state='success';$('login-message').textContent=result.message;
      otpResendUntil=Date.now()+60000;otpResendTimer=setInterval(updateOtpCountdown,1000);updateOtpCountdown();
    }catch(error){$('login-message').dataset.state='error';$('login-message').textContent=errorText(error);button.disabled=false;}
  });
  $('restart-login').addEventListener('click',async()=>{try{await request('/auth/logout','POST',{});resetLogin();$('email-code').value='';$('login-message').textContent='';}catch(error){$('login-message').dataset.state='error';$('login-message').textContent=errorText(error);}});

  // Lucide official icon SVGs, ISC licensed, https://github.com/lucide-icons/lucide.
  const icons = {"house":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" />\n  <path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />\n</svg>\n","file-text":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" />\n  <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" />\n  <path d=\"M10 9H8\" />\n  <path d=\"M16 13H8\" />\n  <path d=\"M16 17H8\" />\n</svg>\n","star":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" />\n</svg>\n","users":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" />\n  <path d=\"M16 3.128a4 4 0 0 1 0 7.744\" />\n  <path d=\"M22 21v-2a4 4 0 0 0-3-3.87\" />\n  <circle cx=\"9\" cy=\"7\" r=\"4\" />\n</svg>\n","settings":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\" />\n  <circle cx=\"12\" cy=\"12\" r=\"3\" />\n</svg>\n","menu":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M4 5h16\" />\n  <path d=\"M4 12h16\" />\n  <path d=\"M4 19h16\" />\n</svg>\n","x":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M18 6 6 18\" />\n  <path d=\"m6 6 12 12\" />\n</svg>\n","chevron-down":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m6 9 6 6 6-6\" />\n</svg>\n","chevron-right":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m9 18 6-6-6-6\" />\n</svg>\n","cloud":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\" />\n</svg>\n","database":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\" />\n  <path d=\"M3 5V19A9 3 0 0 0 21 19V5\" />\n  <path d=\"M3 12A9 3 0 0 0 21 12\" />\n</svg>\n","megaphone":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z\" />\n  <path d=\"M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14\" />\n  <path d=\"M8 6v8\" />\n</svg>\n","message-square":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\" />\n</svg>\n","plus":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M5 12h14\" />\n  <path d=\"M12 5v14\" />\n</svg>\n","search":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m21 21-4.34-4.34\" />\n  <circle cx=\"11\" cy=\"11\" r=\"8\" />\n</svg>\n","log-out":"<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m16 17 5-5-5-5\" />\n  <path d=\"M21 12H9\" />\n  <path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\" />\n</svg>\n"};
  icons.sun="<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <circle cx=\"12\" cy=\"12\" r=\"4\" />\n  <path d=\"M12 2v2\" />\n  <path d=\"M12 20v2\" />\n  <path d=\"m4.93 4.93 1.41 1.41\" />\n  <path d=\"m17.66 17.66 1.41 1.41\" />\n  <path d=\"M2 12h2\" />\n  <path d=\"M20 12h2\" />\n  <path d=\"m6.34 17.66-1.41 1.41\" />\n  <path d=\"m19.07 4.93-1.41 1.41\" />\n</svg>\n";
  icons.moon="<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\" />\n</svg>\n";
  function putIcons(scope = document) {
    scope.querySelectorAll('[data-icon]').forEach(el => {el.innerHTML = icons[el.dataset.icon] || ''; const svg = el.querySelector('svg'); if(svg) {svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false');}});
  }
  putIcons();
  let currentView = 'all', sort = 'latest', selectedPost = null, composer=null, adminMemberFilter='',adminCursor=null,revokeTarget=null,nextMemberCursor=null;
  function closeSidebar() {document.body.classList.remove('sidebar-open'); $('sidebar-backdrop').hidden=true; $('menu-toggle').setAttribute('aria-expanded','false');}
  function setView(view, focus=false, refreshHome=true) {
    $('admin-nav').hidden=member?.role!=='admin';document.querySelectorAll('.admin-profile-action').forEach(button=>button.hidden=member?.role!=='admin');
    if(['login-events','sessions'].includes(view)&&member?.role!=='admin')return;
    if(member?.role==='guest'&&['mine','saved','members','profile','load'].includes(view)){showFeedback('游客只能浏览公开内容');return;}
    currentView=view;adminCursor=null;
    document.querySelector('.metrics-grid').hidden=view!=='load'||member?.role==='guest';
    $('load-panel').hidden=view!=='load'||member?.role==='guest';
    document.querySelector('.forum-columns').hidden=view==='load';
    if(view==='load'&&member)refreshUsage();
    const labels={all:'全部帖子',discussions:'全部帖子',mine:'我的帖子',saved:'收藏',announcements:'公告',members:'成员',settings:'设置',profile:'个人区域','login-events':'登录与会话',sessions:'登录与会话',load:'网站负载'};
    $('page-title').textContent=labels[view];document.title='躺平万岁';
    document.querySelectorAll('[data-side]').forEach(el=>{const active=el.dataset.side===view||(view==='discussions'&&el.dataset.side==='all');el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    document.querySelectorAll('[data-top]').forEach(el=>{const active=el.dataset.top===(view==='announcements'?'announcements':view==='all'?'home':'discussions');el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    document.querySelector('.announcements-panel').hidden=view!=='all';$('announcement-admin-panel').hidden=view!=='announcements'||member?.role!=='admin';$('publish-announcement').hidden=view!=='announcements'||member?.role!=='admin';$('add-member').hidden=view!=='members'||member?.role!=='admin';$('members-panel').hidden=view!=='members';$('settings-panel').hidden=view!=='settings';$('profile-panel').hidden=view!=='profile';$('admin-panel').hidden=!['login-events','sessions'].includes(view);
    const extra=['members','settings','profile','load','login-events','sessions'].includes(view);
    document.querySelector('.feed-toolbar').hidden=extra||view==='announcements';$('search').closest('label').hidden=view==='announcements';$('add-content').textContent=view==='announcements'?'发布公告':'发布帖子';$('member-form').hidden=view!=='members'||member?.role!=='admin';document.querySelector('.feed-sort').hidden=extra||view==='announcements';
    $('view-retry').hidden=true;document.querySelectorAll('#member-add-dialog,#members-dialog,#announcements-dialog').forEach(el=>{if(el.open)el.close();});syncViewRoute(view);items.length=0;render();if(member&&!restoringList)refreshView();if(member&&view==='all'&&refreshHome)refreshAnnouncements();closeSidebar();if(focus)$(view==='load'?'load-title':'page-title').focus({preventScroll:true});
  }
  $('login-form').addEventListener('submit',async event=>{
    event.preventDefault();$('enter-space').disabled=true;$('login-message').dataset.state='loading';$('login-message').textContent='正在验证…';
    try{if(loginStage==='email'){const result=await request('/auth/verify','POST',{email:$('account').value.trim(),code:$('email-code').value.trim()});if(result.stage==='authenticated')enterForum(result.member);else{loginStage='pending';$('restart-login').hidden=false;await prepareMfa();$('login-message').textContent='';}}else if(loginStage==='pending'){await prepareMfa();$('login-message').textContent='';}else{const result=await request('/auth/mfa/verify','POST',{factorId,code:$('mfa-code').value.trim()});enterForum(result.member);}}catch(error){$('login-message').dataset.state='error';$('login-message').textContent=errorText(error);}finally{$('enter-space').disabled=false;}
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
  $('profile-members').addEventListener('click',()=>{if(member?.role==='admin')setView('members',true);$('profile-menu').hidden=true;$('profile-toggle').setAttribute('aria-expanded','false');});
  $('profile-logins').addEventListener('click',()=>{if(member?.role==='admin')setView('login-events',true);$('profile-menu').hidden=true;$('profile-toggle').setAttribute('aria-expanded','false');});
  $('profile-toggle').addEventListener('click',()=>{const open=$('profile-menu').hidden;$('profile-menu').hidden=!open;$('profile-toggle').setAttribute('aria-expanded',String(open));});
  document.addEventListener('click',event=>{if(!event.target.closest('.profile-area')){$('profile-menu').hidden=true;$('profile-toggle').setAttribute('aria-expanded','false');}});
  function clearItems(){items.length=0;selectedPost=null;$('search').value='';render();}
  function leaveForum(){r2UI.reset();document.querySelectorAll('#member-add-dialog,#members-dialog,#announcements-dialog').forEach(el=>{if(el.open)el.close();});['all-member-list','all-member-message','announcement-manage-list','announcement-manage-message','members-message'].forEach(id=>$(id).replaceChildren());invalidateRequests();routeGeneration++;knownPost=null;postOriginElement=null;history.replaceState(null,'',location.href);finishDelete(false);document.querySelectorAll('.admin-profile-action').forEach(button=>button.hidden=true);member=null;guestLease=null;composer=null;adminMemberFilter='';adminCursor=null;revokeTarget=null;if($('revoke-dialog').open)$('revoke-dialog').close();$('admin-filter').reset();$('admin-nav').hidden=true;$('member-form').reset();$('member-form').hidden=true;feedGeneration++;if(dialog.open)dialog.close();if($('post-dialog').open)$('post-dialog').close();$('content-form').reset();$('reply-form').reset();clearItems();['admin-records','admin-member','admin-message','admin-note','member-list','member-message','post-manage','announcement-list','post-detail-title','post-detail-meta','post-detail-text','reply-list'].forEach(id=>$(id).replaceChildren());drawUsage({status:'unavailable'});closeSidebar();$('profile-menu').hidden=true;$('profile-toggle').setAttribute('aria-expanded','false');workspace.hidden=true;welcome.hidden=false;resetLogin();window.scrollTo({top:0,behavior:'instant'});document.title='躺平万岁';applyCurrentRoute();}
  function enterForum(identity){const priorGuest=guestLease;if(identity.role!=='guest'&&priorGuest)broadcastGuest('member',priorGuest.leaseVersion);invalidateRequests();member=identity;r2UI.reset();guestLease=identity.role==='guest'?identity:null;applyIdentityUI();$('login-form').reset();resetLogin();$('login-message').textContent='';$('profile-name').textContent=identity.displayName;document.querySelector('#profile-toggle .avatar').textContent=[...identity.displayName][0];$('identity-name').textContent=identity.displayName;$('identity-role').textContent=identity.role==='admin'?'超级管理员':identity.role==='guest'?'游客 · 只读':'成员';$('identity-avatar').textContent=[...identity.displayName][0];welcome.hidden=true;workspace.hidden=false;applyCurrentRoute();window.scrollTo({top:0,behavior:'instant'});}
  $('logout').addEventListener('click',async()=>{$('logout').disabled=true;try{await withGuestLock(()=>request(member?.role==='guest'?'/api/v1/guest/leave':'/auth/logout','POST',member?.role==='guest'?{leaseVersion:member.leaseVersion}:{}));if(member?.role==='guest')broadcastGuest('leave',member.leaseVersion);leaveForum();history.replaceState(null,'','#intro');applyCurrentRoute();}catch(error){$('forum-notice').textContent=errorText(error);}finally{$('logout').disabled=false;}});
  const mayEdit=item=>member&&member.role!=='guest'&&(member.role==='admin'||item.authorId===member.id);
  const r2UI=window.createR2UI({request,getMember:()=>member,getEpoch:()=>requestEpoch,getView:()=>currentView});
  let draftInitial={title:'',body:''},discardAction=null;
  function openComposer(table=currentView==='announcements'?'announcements':'posts',item=null){
    if(!member||member.role==='guest')return;
    composer={table,item};$('content-form').reset();$('content-form').querySelector('[type="submit"]').disabled=false;$('content-message').textContent='';
    const reply=table==='replies';$('content-name').closest('.field').hidden=reply;$('content-name').disabled=reply;$('content-name').required=!reply;
    $('content-text').maxLength=reply?2000:10000;$('content-text').required=reply;
    $('content-form').querySelector('.optional').hidden=reply;
    $('dialog-title').textContent=(item?'编辑':'发布')+({posts:'帖子',announcements:'公告',replies:'回复'}[table]);
    $('content-form').querySelector('[type="submit"]').textContent=item?'保存修改':'发布';
    if(item){$('content-name').value=item.title||'';$('content-text').value=item.body||'';}
    draftInitial={title:$('content-name').value,body:$('content-text').value};
    r2UI.openComposer(composer);
    dialog.showModal();
  }
  function closeComposer(){if(isDraftChanged(draftInitial,$('content-name').value,$('content-text').value)||r2UI.hasImageChanges()){discardAction=()=>dialog.close();$('discard-dialog').showModal();}else dialog.close();}
  $('add-content').addEventListener('click',()=>openComposer());$('empty-add').addEventListener('click',()=>openComposer());$('close-dialog').addEventListener('click',closeComposer);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeComposer();});
  $('discard-cancel').addEventListener('click',()=>{discardAction=null;$('discard-dialog').close();});
  $('discard-dialog').addEventListener('cancel',()=>{discardAction=null;});
  $('discard-confirm').addEventListener('click',()=>{const action=discardAction;discardAction=null;$('discard-dialog').close();action?.();});
  $('content-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!composer||!member)return;const button=event.submitter||$('content-form').querySelector('[type="submit"]');if(button.disabled)return;const epoch=requestEpoch,composition=composer,{table,item}=composition;button.disabled=true;
    try{r2UI.assertReady();const data={...(table==='posts'&&r2UI.imageIds()!==undefined?{imageIds:r2UI.imageIds()}:{}),body:$('content-text').value.trim(),...(table==='replies'?{}:{title:$('content-name').value.trim()}),...(item?{version:item.version}:{})};
      const result=await request('/api/v1/'+table+(item?'/'+item.id:''),item?'PATCH':'POST',data);
      if(!member||composer!==composition)return;dialog.close();$('content-form').reset();
      if(table==='replies')await refreshReplies();
      else if(table==='posts'){if(item&&selectedPost?.id===item.id){Object.assign(selectedPost,result);$('post-detail-title').textContent=result.title;$('post-detail-text').textContent=result.body;renderPostActions();}if(!item){$('search').value='';setView('all');}else await refreshView();}
      else{await refreshAnnouncements();if(currentView==='announcements')await refreshView();}
      showFeedback(item?'修改已保存':'发布成功');
    }catch(error){if(epoch===requestEpoch&&composer===composition)$('content-message').textContent=errorText(error);}finally{if(epoch===requestEpoch&&composer===composition)button.disabled=false;}
  });
  async function removeContent(table,item,button){
    if(button.disabled)return;
    const epoch=requestEpoch;button.disabled=true;try{if(!await confirmDelete(table)||!member||epoch!==requestEpoch)return;await request('/api/v1/'+table+'/'+item.id,'DELETE',{version:item.version});if(!member)return;
      if(table==='posts'){if(selectedPost?.id===item.id){selectedPost=null;closePostRoute();}await refreshView();}
      else if(table==='replies'){await refreshReplies();await refreshView();}
      else{await refreshAnnouncements();if(currentView==='announcements')await refreshView();}
      showFeedback('已删除');
    }catch(error){$('forum-notice').textContent=errorText(error);}finally{button.disabled=false;}
  }
  let deleteConfirmation=null;
  function finishDelete(accepted){const resolve=deleteConfirmation;deleteConfirmation=null;if($('delete-dialog').open)$('delete-dialog').close();if(resolve)resolve(accepted);}
  function confirmDelete(table){if(deleteConfirmation)return Promise.resolve(false);$('delete-description').textContent='删除这条'+({posts:'帖子',announcements:'公告',replies:'回复'}[table])+'？内容将从列表隐藏。';$('delete-dialog').showModal();return new Promise(resolve=>{deleteConfirmation=resolve;});}
  $('delete-cancel').addEventListener('click',()=>finishDelete(false));
  $('delete-confirm').addEventListener('click',()=>finishDelete(true));
  $('delete-dialog').addEventListener('cancel',event=>{event.preventDefault();finishDelete(false);});
  $('delete-dialog').addEventListener('close',()=>finishDelete(false));
  function actions(table,item){const host=document.createElement('div');host.className='content-actions';
    if(member?.role==='admin'&&table!=='replies'){const visibility=document.createElement('button');visibility.textContent=item.is_public?'设为仅成员可见':'设为游客可读';visibility.addEventListener('click',async()=>{visibility.disabled=true;try{await request('/api/v1/admin/visibility/'+table+'/'+item.id,'PATCH',{public:!item.is_public,version:item.version});await refreshView();await refreshAnnouncements();if(selectedPost?.id===item.id)await applyCurrentRoute();showFeedback('公开范围已更新');}catch(error){showFeedback(errorText(error),true);}finally{visibility.disabled=false;}});host.append(visibility);}
    if(table==='announcements'?member?.role!=='admin':!mayEdit(item))return host;
    const edit=document.createElement('button'),remove=document.createElement('button');edit.textContent='编辑';remove.textContent='删除';
    edit.addEventListener('click',()=>openComposer(table,item));remove.addEventListener('click',()=>removeContent(table,item,remove));host.append(edit,remove);const menu=document.createElement('details'),summary=document.createElement('summary');menu.className='action-menu';summary.textContent='更多';summary.setAttribute('aria-label','更多操作');menu.append(summary,host);return menu;
  }
  function renderPostActions(){const host=$('post-manage');host.replaceChildren();if(!selectedPost)return;if(member?.role!=='guest'){const save=document.createElement('button');save.textContent=selectedPost.bookmarked?'已收藏':'收藏';save.className='detail-bookmark';save.setAttribute('aria-pressed',String(!!selectedPost.bookmarked));save.addEventListener('click',()=>toggleBookmark(selectedPost,save));host.append(save);}host.append(actions('posts',selectedPost));}
  function provisioningMessage(result){return result.provisioningStatus==='ready'?'已准备好登录身份，成员可在登录页申请邮箱验证码。':result.provisioningStatus==='pending'?'身份正在准备，请稍后查看。':'身份准备未完成，可在成员列表重试；不会重复添加成员。';}
  function memberFeedback(message){const target=$('members-dialog').open?'all-member-message':$('member-add-dialog').open?'member-message':'members-message';$(target).textContent=message;}
  function renderMemberRow(person){
    const row=document.createElement('article'),p=document.createElement('p');row.className='member-row';p.textContent=person.displayName+' · '+(person.role==='admin'?'超级管理员':'成员')+(person.status==='disabled'?' · 已停用':'');row.append(p);
    if(member?.role!=='admin')return row;
    const email=document.createElement('p'),state=document.createElement('p');email.textContent=person.email;state.textContent=({ready:'身份已就绪',pending:'身份准备中',error:'身份准备失败，可重试',legacy:'既有成员'})[person.provisioningStatus]||'既有成员';row.append(email,state);
    if(person.id!==member.id){
      const toggle=document.createElement('button');toggle.textContent=person.status==='active'?'停用':'启用';toggle.addEventListener('click',async()=>{toggle.disabled=true;try{await request('/api/v1/members/'+person.id,'PATCH',{status:person.status==='active'?'disabled':'active'});await refreshView();}catch(error){memberFeedback(errorText(error));}finally{toggle.disabled=false;}});row.append(toggle);
      if(person.status==='active'&&person.provisioningStatus!=='ready'){
        const retry=document.createElement('button');retry.textContent='重试准备';retry.addEventListener('click',async()=>{retry.disabled=true;try{const result=await request('/api/v1/members/'+person.id+'/provision','POST',{});await refreshView();memberFeedback(provisioningMessage(result));}catch(error){memberFeedback(errorText(error));}finally{retry.disabled=false;}});row.append(retry);
      }
    }
    if(person.id!==member.id){const roleButton=document.createElement('button');roleButton.textContent=person.role==='admin'?'改为成员':'设为管理员';roleButton.addEventListener('click',async()=>{roleButton.disabled=true;try{await request('/api/v1/members/'+person.id,'PATCH',{role:person.role==='admin'?'member':'admin'});await refreshView();memberFeedback('权限已更新，对方需重新登录');}catch(error){memberFeedback(errorText(error));}finally{roleButton.disabled=false;}});row.append(roleButton);}
    const logs=document.createElement('button');logs.textContent='登录记录';logs.addEventListener('click',()=>{adminMemberFilter=String(person.id);setView('login-events',true);});row.append(logs);return row;
  }
  $('member-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;if(button.disabled)return;button.disabled=true;
    try{const result=await request('/api/v1/members','POST',{email:$('member-email').value.trim(),displayName:$('member-name').value.trim()});if(!member)return;$('member-form').reset();$('member-message').textContent=provisioningMessage(result);await refreshView();}
    catch(error){$('member-message').textContent=errorText(error);}finally{button.disabled=false;}
  });
  document.querySelectorAll('[data-sort]').forEach(el=>el.addEventListener('click',()=>{sort=el.dataset.sort;document.querySelectorAll('[data-sort]').forEach(button=>{const active=button===el;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});refreshView();}));
  const formatDate=date=>date.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const bookmarkPending=new Set();
  async function toggleBookmark(item,button){
    if(!member||member.role==='guest'||bookmarkPending.has(item.id))return;
    const epoch=requestEpoch,identity=member.id,wasSaved=!!item.bookmarked;bookmarkPending.add(item.id);button.disabled=true;
    try{
      await request('/api/v1/posts/'+item.id+'/bookmark',wasSaved?'DELETE':'PUT',{});
      if(epoch!==requestEpoch||member?.id!==identity)return;
      const count=Math.max(0,(item.bookmarkCount||0)+(wasSaved?-1:1));
      for(const post of [...items,...(selectedPost?[selectedPost]:[])])if(post.id===item.id){post.bookmarked=!wasSaved;post.bookmarkCount=count;}
      item.bookmarked=!wasSaved;item.bookmarkCount=count;
      button.classList.toggle('saved',!wasSaved);button.setAttribute('aria-pressed',String(!wasSaved));
      if(button.lastChild&&button.lastChild.nodeType!==3){button.lastChild.textContent=count;button.setAttribute('aria-label',(!wasSaved?'取消收藏：':'收藏：')+item.title);}else button.textContent=!wasSaved?'已收藏':'收藏';
      if(currentView==='saved'&&wasSaved){const index=items.findIndex(post=>post.id===item.id);if(index>=0)items.splice(index,1);render();}
      persistListState();showFeedback(wasSaved?'已取消收藏':'已收藏');
    }catch(error){if(epoch===requestEpoch)showFeedback(errorText(error),'error');}
    finally{bookmarkPending.delete(item.id);button.disabled=false;}
  }
  function render(){
    const query=$('search').value.trim().toLocaleLowerCase();const extra=['members','settings','profile','announcements','load','login-events','sessions'].includes(currentView);
    $('clear-search').hidden=!query;
    const filtered=items;
    const list=$('post-list');list.replaceChildren();
    if(!extra)filtered.forEach(item=>{const row=document.createElement('article');row.className='post-row';const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent=[...item.authorName][0];const open=document.createElement('button');open.className='post-open';const title=document.createElement('h2');title.textContent=item.title;const meta=document.createElement('p');meta.textContent=item.authorName+' · '+formatDate(new Date(item.createdAt));const excerpt=document.createElement('p');excerpt.className='post-excerpt';excerpt.textContent=(item.body||'').replace(/\s+/g,' ').slice(0,180);open.dataset.postId=String(item.id);open.append(title,excerpt,meta);open.addEventListener('click',()=>openPost(item));const actions=document.createElement('div');actions.className='post-actions';const replies=document.createElement('button');replies.innerHTML='<span data-icon="message-square"></span><span></span>';replies.lastChild.textContent=item.replyCount;replies.setAttribute('aria-label','查看回复：'+item.replyCount);replies.addEventListener('click',()=>openPost(item));const save=document.createElement('button');save.innerHTML='<span data-icon="star"></span><span></span>';save.lastChild.textContent=item.bookmarkCount;save.classList.toggle('saved',!!item.bookmarked);save.setAttribute('aria-label',(item.bookmarked?'取消收藏：':'收藏：')+item.title);save.setAttribute('aria-pressed',String(!!item.bookmarked));save.addEventListener('click',()=>toggleBookmark(item,save));save.hidden=member?.role==='guest';actions.append(replies,save);row.append(avatar,open,actions);putIcons(row);list.append(row);});
    $('empty-state').hidden=extra||filtered.length>0;
    $('empty-title').textContent=currentView==='saved'?'还没有收藏':query?'没有找到相关帖子':'还没有帖子';
    $('empty-description').textContent=currentView==='saved'?'点击帖子右侧的星标，留下想再读的内容。':query?'试试其他关键词。':'从一段文字开始交流。';$('empty-add').hidden=member?.role==='guest'||currentView==='saved'||!!query;
    $('result-status').textContent='';
    $('load-more').hidden=extra||!nextCursor;
  }
  async function openPost(item){postOriginElement=document.activeElement;knownPost={...item};history.replaceState({community:captureList()},'',location.href);history.pushState({postOrigin:true,identity:member.id},'','#/posts/'+item.id);await applyCurrentRoute();}
  function renderReplies(){const list=$('reply-list');list.replaceChildren();if(!selectedPost?.replies.length){const p=document.createElement('p');p.textContent='还没有回复';list.append(p);}selectedPost?.replies.forEach(reply=>{const p=document.createElement('p');p.textContent=reply.authorName+'：'+reply.body;const row=document.createElement('article');const meta=document.createElement('span');meta.className='reply-author';meta.textContent=reply.authorName;p.textContent=reply.body;row.className='reply-row';row.append(meta,p,actions('replies',reply));list.append(row);});$('more-replies').hidden=!replyCursor;}
  $('close-post').addEventListener('click',closePostRoute);$('post-back').addEventListener('click',closePostRoute);
  $('post-dialog').addEventListener('cancel',event=>{event.preventDefault();closePostRoute();});
  $('reply-form').addEventListener('submit',async event=>{event.preventDefault();if(!selectedPost)return;const post=selectedPost,button=event.submitter,epoch=requestEpoch;if(button.disabled)return;button.disabled=true;$('reply-message').dataset.state='loading';$('reply-message').textContent='';try{await request('/api/v1/posts/'+post.id+'/replies','POST',{body:$('reply-text').value.trim()});if(!member||selectedPost!==post)return;$('reply-form').reset();await refreshReplies();await refreshView();showFeedback('回复已发布');}catch(error){if(member&&selectedPost===post&&epoch===requestEpoch){$('reply-message').dataset.state='error';$('reply-message').textContent=errorText(error);}}finally{if(selectedPost===post&&epoch===requestEpoch)button.disabled=false;}});
  $('publish-announcement').addEventListener('click',()=>openComposer('announcements'));
  $('manage-announcements').addEventListener('click',()=>{$('announcements-dialog').showModal();refreshAnnouncements(true,feedGeneration);});
  $('add-member').addEventListener('click',()=>{if(member?.role==='admin'){$('member-form').hidden=false;$('member-message').textContent='';$('member-add-dialog').showModal();$('member-email').focus();}});
  $('all-members').addEventListener('click',()=>{$('members-dialog').showModal();refreshAllMembers();});
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.close).close()));
  $('motion-toggle').addEventListener('change',()=>{displayPreferences.motion=$('motion-toggle').checked;saveDisplayPreferences();});
  async function refreshView(append=false){
    if(!member||currentView==='load')return;const generation=++feedGeneration;nextCursor=append?nextCursor:null;
    try{
      if(currentView==='settings'||currentView==='profile')return;
      if(['login-events','sessions'].includes(currentView)){await refreshAdmin(false,generation);return;}
      if(currentView==='members'){const result=await readMemberOptions();if(generation!==feedGeneration||!member||currentView!=='members')return;const list=$('member-list');list.replaceChildren();result.items.sort((a,b)=>b.id-a.id).slice(0,3).forEach(person=>list.append(renderMemberRow(person)));$('members-message').textContent='';if($('members-dialog').open)await refreshAllMembers();return;}
      if(currentView==='announcements'){if($('announcements-dialog').open)await refreshAnnouncements(true,generation);return;}
      const params=new URLSearchParams({sort:{latest:'newest',replies:'replies',saved:'bookmarks'}[sort],filter:currentView==='mine'?'mine':currentView==='saved'?'bookmarked':'all',q:$('search').value.trim()});if(append&&nextCursor)params.set('cursor',nextCursor);
      $('result-status').textContent='';const result=await request('/api/v1/posts?'+params);if(generation!==feedGeneration||!member)return;
      const changed=append||JSON.stringify(items)!==JSON.stringify(result.items)||nextCursor!==result.nextCursor;if(!append)items.length=0;items.push(...result.items);nextCursor=result.nextCursor;if(changed)render();persistListState();$('forum-notice').textContent='';
    }catch(error){if(generation===feedGeneration){$('result-status').textContent=errorText(error);$('empty-state').hidden=true;$('view-retry').hidden=!member;}}
  }
  async function refreshReplies(append=false){const post=selectedPost;if(!post)return;$('reply-retry').hidden=true;$('reply-message').dataset.state='loading';$('reply-message').textContent='';try{const params=new URLSearchParams();if(append&&replyCursor)params.set('cursor',replyCursor);const result=await request('/api/v1/posts/'+post.id+'/replies?'+params);if(!member||selectedPost!==post)return;if(!append)post.replies=[];post.replies.push(...result.items);replyCursor=result.nextCursor;renderReplies();$('reply-message').textContent='';}catch(error){if(member&&selectedPost===post){$('reply-message').dataset.state='error';$('reply-message').textContent=errorText(error);$('reply-retry').hidden=false;}}}
  async function refreshAnnouncements(main=false,generation){if(!member||(!main&&currentView!=='all'))return;const identity=member.id;if(main)$('announcement-manage-message').textContent='';try{const result=await request('/api/v1/announcements');if(member?.id!==identity||main&&(generation!==feedGeneration||currentView!=='announcements')||!main&&currentView!=='all')return;const list=main?$('announcement-manage-list'):$('announcement-list');list.replaceChildren();if(!result.items.length){const p=document.createElement('p');p.className='announcement-empty';p.textContent='暂无已发布公告';list.append(p);}result.items.forEach(item=>{const article=document.createElement('article'),title=document.createElement('h3'),date=document.createElement('p'),body=document.createElement('p');title.textContent=item.title;date.textContent=formatDate(new Date(item.createdAt));body.textContent=item.body;article.append(title,date,body);if(main)article.append(actions('announcements',item));list.append(article);});}catch(error){if(member?.id===identity&&(!main||generation===feedGeneration)){if(main)$('announcement-manage-message').textContent=errorText(error);else $('forum-notice').textContent=errorText(error);}}}
  $('load-more').addEventListener('click',async()=>{$('load-more').disabled=true;try{await refreshView(true);}finally{$('load-more').disabled=false;}});$('more-replies').addEventListener('click',async()=>{$('more-replies').disabled=true;try{await refreshReplies(true);}finally{$('more-replies').disabled=false;}});

  let memberDialogGeneration=0;
  async function refreshAllMembers(append=false){const generation=++memberDialogGeneration,identity=member?.id;if(!identity)return;const button=$('members-more');button.disabled=true;$('all-member-message').textContent='';try{const params=new URLSearchParams({limit:'50'});if(append&&nextMemberCursor)params.set('cursor',nextMemberCursor);const result=await request('/api/v1/members?'+params);if(member?.id!==identity||generation!==memberDialogGeneration||!$('members-dialog').open)return;const list=$('all-member-list');if(!append)list.replaceChildren();result.items.forEach(person=>list.append(renderMemberRow(person)));nextMemberCursor=result.nextCursor||null;button.hidden=!nextMemberCursor;}catch(error){if(member?.id===identity)$('all-member-message').textContent=errorText(error);}finally{button.disabled=false;}}
  $('members-more').addEventListener('click',()=>refreshAllMembers(true));
  async function readMemberOptions(){const identity=member?.id,epoch=requestEpoch,items=[];let cursor=null;do{const params=new URLSearchParams({limit:'100'});if(cursor)params.set('cursor',cursor);const result=await request('/api/v1/members?'+params);if(epoch!==requestEpoch||member?.id!==identity)throw new Error('登录状态已变化');items.push(...result.items);cursor=result.nextCursor||null;}while(cursor);return {items};}
  function adminReason(value){return ({verified:'验证成功',otp_rejected:'邮箱验证未通过',mfa_rejected:'二重验证未通过',rate_limited:'请求过于频繁',provider_unavailable:'认证服务暂不可用',not_allowed:'访问未获准',session_invalid:'会话已失效',invalid_request:'输入或请求无效'})[value]||'未知';}
  function renderLoginRecord(item,sessions){
    const row=document.createElement('article');row.className='login-record';
    const values=[['成员',(item.displayName||'未确认成员')+(item.email?' · '+item.email:'')],['时间',new Date(item.createdAt).toLocaleString('zh-CN')],['结果',sessions?(item.stage==='pending'?'等待二重验证':'有效会话'):(item.result==='success'?'成功':'失败')]];
    values.forEach(([label,value])=>{const cell=document.createElement('div'),name=document.createElement('span'),body=document.createElement('p');name.className='record-label';name.textContent=label;body.textContent=value;cell.append(name,body);row.append(cell);});
    const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('p');summary.textContent='查看详情';body.textContent='IP：'+(item.ip||'未知')+'\n地区：'+([item.country,item.region,item.city].filter(Boolean).join(' / ')||'未知')+'\n浏览器 / 系统：'+(item.userAgent||'未知')+'\n'+(sessions?'到期：'+new Date(item.expiresAt).toLocaleString('zh-CN'):'验证阶段：'+({email:'邮箱',mfa:'二重验证',session:'会话'})[item.stage]+'；'+adminReason(item.reason));details.append(summary,body);row.append(details);
    if(sessions){const button=document.createElement('button');button.className='send-code';button.textContent='撤销会话';button.addEventListener('click',()=>{revokeTarget=item.managementId;$('revoke-description').textContent='撤销 '+(item.displayName||'该成员')+' 的此设备会话？该设备下次访问需要重新验证。';$('revoke-message').textContent='';$('revoke-dialog').showModal();});row.append(button);}
    return row;
  }
  async function refreshAdmin(append=false,generation=feedGeneration){
    if(member?.role!=='admin')return;const view=currentView,sessions=view==='sessions';$('admin-message').textContent='';
    $('admin-filter').hidden=sessions;$('admin-more').hidden=true;
    document.querySelectorAll('[data-admin-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.adminView===view)));
    try{
      if(!sessions){const members=await readMemberOptions();if(!member||generation!==feedGeneration||currentView!==view)return;const select=$('admin-member');select.replaceChildren();const all=document.createElement('option');all.value='';all.textContent='全部成员';select.append(all);members.items.forEach(p=>{const option=document.createElement('option');option.value=String(p.id);option.textContent=p.displayName;select.append(option);});select.value=adminMemberFilter;}
      const params=new URLSearchParams();if(!sessions){if(adminMemberFilter)params.set('memberId',adminMemberFilter);if($('admin-result').value)params.set('result',$('admin-result').value);for(const [id,key,end] of [['admin-from','from',false],['admin-to','to',true]]){if($(id).value){const time=new Date($(id).value+(end?'T23:59:59.999':'T00:00:00')).getTime();if(!Number.isFinite(time))throw new Error('日期无效');params.set(key,String(time));}}if(append&&adminCursor)params.set('cursor',adminCursor);}
      const result=await request('/api/v1/admin/'+(sessions?'sessions':'login-events')+'?'+params);if(!member||generation!==feedGeneration||currentView!==view)return;
      const list=$('admin-records');if(!append)list.replaceChildren();result.items.forEach(item=>list.append(renderLoginRecord(item,sessions)));adminCursor=result.nextCursor||null;$('admin-more').hidden=!adminCursor;
      $('admin-message').textContent=result.failureLoggingLimited?'今天失败日志已达记录上限，记录可能不完整。':result.items.length?'已加载记录。':'暂无记录。';$('admin-note').textContent=sessions?result.note:'记录保留 90 天，最多 5,000 条；仅包含本次更新后的登录。地区和浏览器信息仅供参考。';
    }catch(error){if(generation===feedGeneration)$('admin-message').textContent=errorText(error);}
  }
  $('admin-filter').addEventListener('submit',event=>{event.preventDefault();adminMemberFilter=$('admin-member').value;adminCursor=null;refreshView();});
  $('admin-refresh').addEventListener('click',()=>refreshView());
  $('admin-more').addEventListener('click',async()=>{const button=$('admin-more');button.disabled=true;try{await refreshAdmin(true);}finally{button.disabled=false;}});
  document.querySelectorAll('[data-admin-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.adminView,true)));
  $('revoke-cancel').addEventListener('click',()=>{$('revoke-dialog').close();revokeTarget=null;});
  $('revoke-dialog').addEventListener('cancel',()=>{revokeTarget=null;});
  $('revoke-confirm').addEventListener('click',async()=>{if(!revokeTarget)return;const button=$('revoke-confirm'),target=revokeTarget;button.disabled=true;try{await request('/api/v1/admin/sessions/'+target,'DELETE',{});$('revoke-dialog').close();revokeTarget=null;await refreshView();}catch(error){$('revoke-message').textContent=errorText(error);}finally{button.disabled=false;}});
  let searchTimer;$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>refreshView(),300);});
  let usageRefreshBusy=false;

  async function refreshUsage(){
    if(usageRefreshBusy||!member||member.role==='guest'||document.hidden||currentView!=='load')return;
    usageRefreshBusy=true;const epoch=requestEpoch,identity=member.id;
    try{const result=await request('/api/v1/load');if(epoch!==requestEpoch||member?.id!==identity||currentView!=='load')return;
      if(result.usage)drawUsage(result.usage);
      for(const [id,key] of [['guest-online','guestOnline'],['guest-limit','guestLimit'],['guest-remaining','remaining'],['member-active','memberActive'],['member-limit','memberLimit']])$(id).textContent=result[key];
      $('load-status').textContent='API 正常 · 数据库正常 · '+(result.system?.metrics==='ok'?'用量快照可用':result.system?.metrics==='stale'?'用量快照已过期':'用量快照暂不可用')+' · '+new Date(result.sampledAt).toLocaleTimeString('zh-CN');
    }catch(error){if(epoch===requestEpoch&&member?.id===identity){$('load-status').textContent='负载读取失败，请重试：'+errorText(error);document.querySelectorAll('.workers .metric-source,.d1 .metric-source').forEach(el=>el.textContent='暂不可用');}}
    finally{usageRefreshBusy=false;}
  }
  function drawUsage(data){
    document.querySelectorAll('.workers .metric-source,.d1 .metric-source').forEach(el=>el.textContent=data.status==='ok'?'分析数据':data.status==='stale'?'数据已过期':'暂不可用');document.querySelectorAll('.workers .metric-updated,.d1 .metric-updated').forEach(el=>el.textContent='数据更新时间：'+(data.collectedAt?formatDate(new Date(data.collectedAt)):'—'));
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
    if(liveRefreshBusy||!member||document.hidden||workspace.hidden||['load','login-events','sessions','members','settings','profile','announcements'].includes(currentView)||dialog.open||$('post-dialog').open||document.activeElement?.closest?.('.feed-panel')||$('member-form').contains(document.activeElement))return;
    liveRefreshBusy=true;
    try{await refreshView();await refreshAnnouncements();if(selectedPost&&$('post-dialog').open&&!$('reply-text').value.trim())await refreshReplies();}
    finally{liveRefreshBusy=false;}
  }
  setInterval(()=>{refreshLiveContent();},20000);
  setInterval(()=>{refreshUsage();},5000);
  setInterval(()=>{renewGuest();},60000);
  // V0.3 navigation controller
  let routeGeneration=0,routing=false,restoringList=false,postOriginElement=null,knownPost=null,feedbackTimer=null;
  function showFeedback(message,kind='success'){$('feedback-toast').textContent=message;$('feedback-toast').dataset.kind=kind;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{$('feedback-toast').textContent='';},4500);}
  function captureList(){return {postId:knownPost?.id,identity:member.id,view:currentView,sort,query:$('search').value,rows:items.map(item=>({...item})),cursor:nextCursor,scroll:window.scrollY};}
  function persistListState(){if(member&&parseRoute(location.hash).kind==='view')history.replaceState({community:captureList()},'',location.href);}
  function syncViewRoute(view){
    if(routing||!member)return;
    const hash='#/view/'+view;
    if(location.hash!==hash){routeGeneration++;knownPost=null;history.pushState({identity:member.id},'',hash);selectedPost=null;if($('post-dialog').open)$('post-dialog').close();}
  }
  function closePostRoute(){
    const close=()=>{$('reply-text').value='';if(history.state?.postOrigin&&history.state.identity===member?.id)history.back();else{history.replaceState(null,'','#/view/all');applyCurrentRoute();}};
    if(selectedPost&&$('reply-text').value.trim()){discardAction=close;$('discard-dialog').showModal();}else close();
  }
  function showPublicPage(page){
    workspace.hidden=true;welcome.hidden=true;$('public-page').hidden=false;
    for(const name of ['help','privacy','missing'])$(name+'-content').hidden=name!==page;
    document.title=({help:'登录帮助',privacy:'隐私说明',missing:'页面不存在'})[page]+' · 躺平万岁';
    window.scrollTo({top:0,behavior:'instant'});$('public-page').focus({preventScroll:true});
  }
  async function refreshRestoredList(saved,generation){
    const identity=member.id,rows=[],params=new URLSearchParams({sort:{latest:'newest',replies:'replies',saved:'bookmarks'}[saved.sort],filter:saved.view==='mine'?'mine':saved.view==='saved'?'bookmarked':'all',q:saved.query,limit:'50'});
    const maxPages=Math.max(1,Math.ceil(saved.rows.length/50));let cursor=null;
    $('result-status').textContent='';
    try{
      for(let page=0;page<maxPages;page++){
        if(cursor)params.set('cursor',cursor);
        const result=await request('/api/v1/posts?'+params);
        if(generation!==routeGeneration||member?.id!==identity)return;
        rows.push(...result.items);cursor=result.nextCursor;if(!cursor)break;
      }
      items.splice(0,items.length,...rows);nextCursor=cursor;render();persistListState();
      requestAnimationFrame(()=>{if(generation===routeGeneration){window.scrollTo({top:saved.scroll,behavior:'instant'});const sourceButton=document.querySelector('.post-open[data-post-id="'+saved.postId+'"]');(sourceButton||$('page-title')).focus({preventScroll:true});}});
    }catch(error){if(generation===routeGeneration&&member?.id===identity){$('result-status').textContent='显示上次的列表。'+errorText(error);$('view-retry').hidden=false;}}
  }
  async function applyCurrentRoute(){
    const generation=++routeGeneration,route=parseRoute(location.hash);
    if(document.body?.dataset?.defaultPage==='missing'&&!location.hash)route.kind='missing';
    if($('post-dialog').open)$('post-dialog').close();
    if(dialog.open)dialog.close();selectedPost=null;
    $('public-page').hidden=true;
    if(route.kind==='public'||route.kind==='missing'){showPublicPage(route.kind==='missing'?'missing':route.page);return;}
    if(!member){
      workspace.hidden=true;welcome.hidden=false;
      $('login-context').textContent=route.kind==='post'?'登录后继续查看这篇帖子。':route.kind==='view'?'请先验证身份，再进入成员空间。':'';
      document.title='躺平万岁';
      if(route.kind!=='landing')requestAnimationFrame(()=>{if(generation===routeGeneration&&!member)$('login').scrollIntoView({behavior:'instant'});});
      return;
    }
    workspace.hidden=false;welcome.hidden=true;
    const view=route.kind==='view'?route.view:route.kind==='post'?(history.state?.postOrigin?currentView:'discussions'):'all';
    if(['login-events','sessions'].includes(view)&&member.role!=='admin'||member.role==='guest'&&['mine','saved','members','profile','load'].includes(view)){showPublicPage('missing');return;}
    const saved=route.kind==='view'&&history.state?.community;
    routing=true;restoringList=route.kind==='post'||!!saved&&saved.identity===member.id;
    setView(view,false,route.kind!=='post');
    if(saved&&saved.identity===member.id){sort=saved.sort;$('search').value=saved.query;items.splice(0,items.length,...saved.rows);nextCursor=saved.cursor;render();document.querySelectorAll('[data-sort]').forEach(button=>{const active=button.dataset.sort===sort;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});}
    routing=false;restoringList=false;
    if(route.kind==='landing')history.replaceState({identity:member.id},'','#/view/all');
    if(saved&&saved.identity===member.id){requestAnimationFrame(()=>{if(generation===routeGeneration){window.scrollTo({top:saved.scroll,behavior:'instant'});if(postOriginElement?.isConnected)postOriginElement.focus({preventScroll:true});else{const sourceButton=document.querySelector('.post-open[data-post-id=\"'+saved.postId+'\"]');(sourceButton||$('page-title')).focus({preventScroll:true});}}});}
    else if(route.kind!=='post'){$('page-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
    if(route.kind!=='post'){if(saved&&saved.identity===member.id)await refreshRestoredList(saved,generation);return;}
    const identity=member.id;
    const preview=knownPost?.id===route.id?knownPost:null;$('post-detail-title').textContent=preview?.title||'帖子';$('post-detail-meta').textContent=preview?preview.authorName+' · '+formatDate(new Date(preview.createdAt)):'';$('post-detail-text').textContent=preview?.body||'';$('post-manage').replaceChildren();$('reply-list').replaceChildren();$('reply-message').textContent='';$('post-error').hidden=true;$('reply-retry').hidden=true;$('reply-form').hidden=true;document.querySelector('.replies-section').hidden=true;
    window.scrollTo({top:0,behavior:'instant'});$('post-dialog').showModal();
    try{
      const result=await request('/api/v1/posts/'+route.id);
      if(generation!==routeGeneration||member?.id!==identity)return;
      selectedPost={...result,authorName:result.authorName||(knownPost?.id===result.id?knownPost.authorName:result.authorId===identity?member.displayName:'成员'),replies:[]};knownPost=null;replyCursor=null;
      $('post-detail-title').textContent=result.title;$('post-detail-meta').textContent=selectedPost.authorName+' · '+formatDate(new Date(result.createdAt));$('post-detail-text').textContent=result.body||'这篇帖子还没有正文。';r2UI.renderPost(result);
      document.title=result.title+' · 躺平万岁';$('reply-form').reset();$('reply-form').querySelector('[type=submit]').disabled=false;$('reply-form').hidden=member?.role==='guest';document.querySelector('.replies-section').hidden=false;renderPostActions();await refreshReplies();
    }catch(error){
      if(generation!==routeGeneration||member?.id!==identity)return;
      $('post-detail-title').textContent=error.status===404?'帖子不存在或已删除':error.status===403?'暂时无法访问这篇帖子':'帖子加载失败';
      $('post-error-message').textContent=errorText(error);$('post-error').hidden=false;$('post-retry').hidden=error.status===403||error.status===404;
    }
  }
  // End V0.3 navigation controller
  document.querySelectorAll('[data-theme-toggle]').forEach(button=>button.addEventListener('click',()=>{displayPreferences.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';saveDisplayPreferences();}));
  $('theme-select').addEventListener('change',()=>{displayPreferences.theme=$('theme-select').value;saveDisplayPreferences();});
  $('profile-home').addEventListener('click',()=>{setView('profile',true);$('profile-menu').hidden=true;$('profile-toggle').setAttribute('aria-expanded','false');});
  document.querySelectorAll('[data-profile-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.profileView,true)));
  $('public-back').addEventListener('click',()=>{if(document.body.dataset.defaultPage==='missing'){location.href='/';return;}history.pushState(null,'',member?'#/view/all':'#intro');applyCurrentRoute();});
  $('post-retry').addEventListener('click',applyCurrentRoute);$('reply-retry').addEventListener('click',()=>refreshReplies());
  $('view-retry').addEventListener('click',()=>{$('view-retry').hidden=true;refreshView();});
  $('clear-search').addEventListener('click',()=>{$('search').value='';$('clear-search').hidden=true;clearTimeout(searchTimer);refreshView();$('search').focus();});
  $('search').addEventListener('input',()=>{$('clear-search').hidden=!$('search').value;});
  document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();const target=workspace.hidden?(welcome.hidden?$('public-page'):$('login')):$('main-content');target.setAttribute('tabindex','-1');target.focus();target.scrollIntoView({behavior:'instant',block:'start'});});
  window.addEventListener('hashchange',applyCurrentRoute);
  window.addEventListener('scroll',()=>{const saved=history.state?.community;if(saved&&member&&saved.identity===member.id&&parseRoute(location.hash).kind==='view')history.replaceState({community:{...saved,scroll:window.scrollY}},'',location.href);},{passive:true});
  window.addEventListener('beforeunload',event=>{if(dialog.open&&(isDraftChanged(draftInitial,$('content-name').value,$('content-text').value)||r2UI.hasImageChanges())){event.preventDefault();event.returnValue='';}});
  function applyIdentityUI(){
    const guest=member?.role==='guest';document.querySelector('[data-side="announcements"]').hidden=member?.role!=='admin';
    document.querySelectorAll('[data-member-only]').forEach(button=>button.hidden=guest);
    for(const id of ['add-content','empty-add','profile-home','load-nav'])$(id).hidden=guest;
    $('guest-member-login').hidden=!guest;
    document.querySelector('.mode-label').textContent=guest?'游客 · 只读':'正式成员';
    $('forum-notice').textContent='';
  }
  function revealLogin(scroll=true){
    card.classList.remove('login-pop');void card.offsetWidth;card.classList.add('revealed','login-pop');
    if(scroll)$('login').scrollIntoView({behavior:document.documentElement.classList.contains('motion-off')?'instant':'smooth'});
  }
  async function withGuestLock(callback){
    if(navigator.locks?.request)return navigator.locks.request('forum-guest-access',{mode:'exclusive'},callback);
    if(!window.indexedDB)throw new Error('浏览器无法协调游客会话，请启用站点存储后重试。');
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('forum-guest-lock',1);r.onupgradeneeded=()=>r.result.createObjectStore('locks');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('游客会话协调失败，请检查站点存储权限。'));});
    const owner=crypto.randomUUID(),acquire=()=>new Promise((resolve,reject)=>{const tx=db.transaction('locks','readwrite'),store=tx.objectStore('locks'),r=store.get('access');let held=false;r.onsuccess=()=>{if(!r.result||r.result.until<=Date.now()){store.put({owner,until:Date.now()+90000},'access');held=true;}};tx.oncomplete=()=>resolve(held);tx.onerror=()=>reject(tx.error);});
    let acquired=false;try{for(let attempt=0;attempt<20&&!acquired;attempt++){acquired=await acquire();if(!acquired)await new Promise(resolve=>setTimeout(resolve,250));}if(!acquired)throw new Error('另一个页面正在处理游客会话，请稍后重试。');return await callback();}
    finally{if(acquired)await new Promise(resolve=>{const tx=db.transaction('locks','readwrite'),store=tx.objectStore('locks'),r=store.get('access');r.onsuccess=()=>{if(r.result?.owner===owner)store.delete('access');};tx.oncomplete=resolve;tx.onerror=resolve;});db.close();}
  }
  function broadcastGuest(action,version){try{localStorage.setItem('forum-guest-event',JSON.stringify({action,version,time:Date.now()}));}catch{}}
  function markGuestHeartbeat(identity){try{localStorage.setItem('forum-guest-heartbeat',JSON.stringify({id:identity.id,version:identity.leaseVersion,time:Date.now()}));}catch{}}
  async function renewGuest(){
    if(!guestLease||document.hidden)return;const lease=guestLease;
    try{await withGuestLock(async()=>{
      if(guestLease!==lease)return;let last;try{last=JSON.parse(localStorage.getItem('forum-guest-heartbeat')||'null');}catch{}
      if(last?.id===lease.id&&last?.version===lease.leaseVersion&&Date.now()-last.time<55000)return;
      await request('/api/v1/guest/heartbeat','POST',{leaseVersion:lease.leaseVersion});if(guestLease===lease)markGuestHeartbeat(lease);
    });}catch(error){if(error.code==='GUEST_SESSION_EXPIRED'){guestLease=null;if(member?.role==='guest')leaveForum();$('guest-message').textContent='游客访问已结束，请重新进入。';}else if(error.code!=='REQUEST_CANCELLED'){$('forum-notice').textContent='游客心跳未能确认；名额可能在超时后释放。'+errorText(error);}}
  }
  $('member-login').addEventListener('click',()=>revealLogin());
  $('guest-enter').addEventListener('click',async()=>{const button=$('guest-enter');if(button.disabled)return;sessionRestoreNeeded=false;invalidateRequests();button.disabled=true;$('login-message').textContent='';$('session-retry').hidden=true;$('guest-message').dataset.state='loading';$('guest-message').textContent='正在进入…';try{const result=await withGuestLock(()=>request('/api/v1/guest/enter','POST',{}));enterForum(result.member);if(result.member.role==='guest')markGuestHeartbeat(result.member);$('guest-message').textContent='';}catch(error){$('guest-message').dataset.state='error';$('guest-message').textContent=errorText(error);}finally{button.disabled=false;}});
  $('guest-member-login').addEventListener('click',()=>{const lease=guestLease;leaveForum();guestLease=lease;history.replaceState(null,'','#login');revealLogin();});
  $('workspace-home').addEventListener('click',()=>{if(member?.role==='guest'){const lease=guestLease;leaveForum();guestLease=lease;history.replaceState(null,'','#intro');applyCurrentRoute();}else{history.pushState(null,'','#/view/all');applyCurrentRoute();}});
  function handleGuestEvent(event){
    if(event.key!=='forum-guest-event'||!event.newValue)return;
    try{const data=JSON.parse(event.newValue);
      if(guestLease?.leaseVersion!==data.version)return;
      if(data.action==='member'){leaveForum();sessionRestoreNeeded=true;restoreSession();}
      else if(data.action==='leave'){guestLease=null;if(member?.role==='guest'){leaveForum();$('guest-message').textContent='另一个页面已退出游客访问。';}}
    }catch{}
  }
  window.addEventListener('storage',handleGuestEvent);
  let restoringSession=false,sessionRestoreNeeded=true;
  async function restoreSession(){
    if(restoringSession||!sessionRestoreNeeded||member||loginStage!=='email')return;
    const epoch=requestEpoch;
    restoringSession=true;
    const sendDisabled=$('send-code').disabled,enterDisabled=$('enter-space').disabled;
    $('send-code').disabled=true;$('enter-space').disabled=true;
    $('session-retry').hidden=true;$('login-message').textContent='正在恢复本设备的登录…';
    try{
      for(let attempt=0;attempt<3;attempt++){
        if(epoch!==requestEpoch||!sessionRestoreNeeded)return;
        try{const result=await request('/api/v1/session');sessionRestoreNeeded=false;enterForum(result.member);return;}
        catch(error){
          if(error.code==='REQUEST_CANCELLED')return;
          if(error.status===401||error.status===403){sessionRestoreNeeded=false;$('login-message').textContent='';return;}
          if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
        }
      }
      $('session-retry').hidden=false;$('login-message').textContent='连接暂不可用，已保留本设备的登录凭据；可重试恢复，无需重新申请验证码。';
    }finally{restoringSession=false;$('send-code').disabled=sendDisabled;$('enter-space').disabled=enterDisabled;}
  }
  $('session-retry').addEventListener('click',()=>restoreSession());
  render();applyCurrentRoute();restoreSession();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){restoreSession();refreshUsage();refreshLiveContent();renewGuest();}});
  window.addEventListener('online',()=>{restoreSession();refreshUsage();refreshLiveContent();renewGuest();});
})();
