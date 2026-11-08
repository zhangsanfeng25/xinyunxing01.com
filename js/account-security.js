(() => {
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function withIdentityLock(callback){
  if(navigator.locks?.request)return navigator.locks.request('forum-guest-access',{mode:'exclusive'},callback);
  if(!window.indexedDB)throw new Error('浏览器无法协调设备身份，请启用站点存储后重试。');
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('forum-guest-lock',1);r.onupgradeneeded=()=>r.result.createObjectStore('locks');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('设备身份协调失败'));}),owner=crypto.randomUUID();
  const acquire=()=>new Promise((resolve,reject)=>{const tx=db.transaction('locks','readwrite'),store=tx.objectStore('locks'),r=store.get('access');let held=false;r.onsuccess=()=>{if(!r.result||r.result.until<=Date.now()){store.put({owner,until:Date.now()+90000},'access');held=true;}};tx.oncomplete=()=>resolve(held);tx.onerror=()=>reject(tx.error);});
  let held=false;try{for(let n=0;n<20&&!held;n++){held=await acquire();if(!held)await new Promise(resolve=>setTimeout(resolve,250));}if(!held)throw new Error('其他标签页正在处理登录，请稍后重试。');return await callback();}finally{if(held)await new Promise(resolve=>{const tx=db.transaction('locks','readwrite'),store=tx.objectStore('locks'),r=store.get('access');r.onsuccess=()=>{if(r.result?.owner===owner)store.delete('access');};tx.oncomplete=resolve;tx.onerror=resolve;});db.close();}
 }
 async function rawApi(path,body,method=body===undefined?'GET':'POST',options={}){
  let response,data;try{response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json','X-Forum-CSRF':'1'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:options.signal??AbortSignal.timeout(20000)});data=await response.json();}
  catch{throw new Error('账户服务暂时无法连接，请稍后重试。');}
  if(!response.ok)throw Object.assign(new Error(data.error??'操作未完成'),{status:response.status,code:data.code});return data;
 }
 const api=(path,body,method)=>['/auth/password','/auth/verify'].includes(path)?withIdentityLock(()=>rawApi(path,body,method)):rawApi(path,body,method);
 const field=(label,name,type='text',extra='')=>`<label class="field">${label}<input name="${name}" type="${type}" ${extra}></label>`;
 const passwordField=(label,name='password',extra='')=>field(label,name,'password',`required minlength="12" maxlength="128" autocomplete="new-password" ${extra}`);
 const message='<p data-security-message role="status" aria-live="polite"></p>';
 function mount(container,options={}){
  const requestAccount=options.request;
  const api=(path,body,method,requestOptions)=>requestAccount&&path.startsWith('/api/')?requestAccount(path,body,method,requestOptions):(['/auth/password','/auth/verify'].includes(path)?withIdentityLock(()=>rawApi(path,body,method)):rawApi(path,body,method,requestOptions));
  let alive=true,mode='login',factorId=null,refreshController;const valid=()=>alive&&container.isConnected;
  const tell=text=>{if(valid()){const node=container.querySelector('[data-security-message]');if(node)node.textContent=text;}};
  function show(html){if(valid())container.innerHTML=`<div class="account-security">${html}${message}</div>`;}
  function login(){mode='login';show(`<h2>成员登录</h2><p class="muted">仅受邀成员可登录。首次、新设备及连续 48 小时未访问时需要邮箱验证。</p><form data-security-form="password">${field('用户名或邮箱','account','text','required autocomplete="username" maxlength="254"')}${passwordField('密码','password','data-current-password')}<button class="primary" type="submit">登录</button></form><div class="security-actions"><button type="button" class="text-button" data-security-action="email-login">使用邮箱验证码 / 旧账号开通密码</button><button type="button" class="text-button" data-security-action="reset">忘记密码</button></div>`);const pw=container.querySelector('[name=password]');if(pw)pw.autocomplete='current-password';}
  function emailLogin(){mode='legacy-email';show(`<h2>邮箱验证登录</h2><form data-security-form="email-send">${field('绑定邮箱','email','email','required autocomplete="email"')}<button class="secondary">发送验证码</button></form><form data-security-form="email-verify">${field('绑定邮箱','email','email','required autocomplete="email"')}${field('邮件验证码','code','text','required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10"')}<button class="primary">验证并继续</button></form><button type="button" class="text-button" data-security-action="login">返回密码登录</button>`);}
  async function stage(data){
   if(!valid())return;
   if(data.stage==='email'){mode='device-email';show(`<h2>验证当前设备</h2><p class="muted">请填写绑定邮箱收到的验证码。该登录验证 10 分钟内有效。</p><form data-security-form="device-email">${field('邮件验证码','code','text','required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10"')}<button class="primary">验证并继续</button></form><button type="button" class="text-button" data-security-action="login">重新登录</button>`);}
   else if(data.stage==='mfa'){
    const factor=await api('/auth/mfa/enroll',{});if(!valid())return;factorId=factor.factorId;mode='mfa';
    show(`<h2>管理员二重验证</h2><p>${factor.enrolled?'请输入身份验证器中的六位验证码。':'首次使用，请在身份验证器中添加下方密钥。'}</p>${factor.enrolled?'':`<p class="security-secret">${escape(factor.secret)}</p><div data-security-qr></div>`}<form data-security-form="mfa">${field('动态验证码','code','text','required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"')}<button class="primary">安全登录</button></form>`);
    if(!factor.enrolled&&factor.qrCode?.startsWith('data:image/svg+xml')){const image=document.createElement('img');image.src=factor.qrCode;image.alt='身份验证器绑定二维码';image.width=160;image.height=160;container.querySelector('[data-security-qr]').append(image);}
   }else if(data.stage==='devices'){
    mode='devices';show(`<h2>选择一台设备退出</h2><p class="muted">当前已有三个有效设备。选择旧设备退出后，才能登录本设备。</p><div class="security-devices">${data.devices.map(d=>`<div class="setting-row"><div><strong>${escape(d.name)}</strong><p>最近访问：${escape(new Date(d.lastSeenAt).toLocaleString())}</p></div><button class="secondary danger" type="button" data-replace-device="${escape(d.id)}">退出并登录本设备</button></div>`).join('')}</div>`);
   }else if(data.stage==='authenticated'||data.member){window.broadcastForumIdentity?.('login');options.onAuthenticated?.(data.member);await refresh();tell('已完成安全登录。');}
  }
  async function refresh(){
   refreshController?.abort();
   const controller=refreshController=new AbortController();
   const current=()=>valid()&&refreshController===controller;
   const deadline=AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]);
   const read=path=>api(path,undefined,undefined,{signal:deadline});
   show('<h2>登录与设备</h2><p role="status">正在加载设备信息…</p>');
   try{const session=options.member?{member:options.member}:await read('/api/v1/session');if(!current())return;if(session.member.role==='guest'){login();return;}
    const devices=await read('/api/v1/account/devices?profile=1');
    const profile=devices.profile??await read('/api/v1/account/profile');if(!current())return;
    show(`<h2>登录与设备</h2><p class="muted">${escape(session.member.displayName)} · 最多三个有效设备。退出设备会立即撤销网站访问。</p><div class="security-devices">${devices.items.length?devices.items.map(d=>`<div class="setting-row"><div><strong>${escape(d.name||'浏览器')}${d.current?' · 当前设备':''}</strong><p>最近访问：${escape(new Date(d.lastSeenAt).toLocaleString())}</p></div><button class="secondary danger" type="button" data-revoke-device="${escape(d.id)}">${d.current?'退出当前设备':'退出设备'}</button></div>`).join(''):'<p>暂无有效设备。</p>'}</div><hr><h3>${profile.passwordReady?'修改密码':'开通用户名和密码'}</h3><p class="muted">修改后只保留当前设备。邮箱由管理员核实后发起变更。</p><form data-security-form="change-password">${profile.username?'':field('用户名','username','text','required minlength="3" maxlength="32" pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}" autocomplete="username"')}${profile.passwordReady?field('当前密码','currentPassword','password','required autocomplete="current-password"'):''}${passwordField('新密码（12—128 个字符）')}<button class="primary">${profile.passwordReady?'修改密码':'开通密码'}</button></form>${session.member.role==='admin'?'<hr><div data-security-admin></div>':''}`);
    if(session.member.role==='admin')renderAdmin(read,current).catch(()=>{if(current()){const admin=container.querySelector('[data-security-admin]');if(admin)admin.innerHTML='<p>暂时无法加载管理信息。</p><button type="button" class="secondary" data-security-action="retry">重试</button>';}});
   }catch(error){if(!current())return;if([401,403].includes(error.status)){login();return;}show('<h2>登录与设备</h2><p>账户服务暂不可用，尚未读取设备。</p><button type="button" class="secondary" data-security-action="retry">重新载入</button>');tell(error.name==='TimeoutError'?'设备信息加载超时，请重试。':error.status===429?'账户服务暂时繁忙，请重试。':error.message);}
  }
  async function renderAdmin(read,current){
   const [members,invitations]=await Promise.all([read('/api/v1/members?limit=100'),read('/api/v1/admin/invitations')]);if(!current())return;const host=container.querySelector('[data-security-admin]');if(!host)return;
   host.innerHTML=`<h3>邀请成员</h3><p class="muted">邀请绑定指定邮箱，24 小时内使用一次。重新邀请会撤销旧链接。</p><form data-security-form="invite">${field('受邀邮箱','email','email','required')}${field('显示名称','displayName','text','required maxlength="40"')}<button class="primary">创建邀请</button></form><div class="security-invites">${invitations.items.map(i=>`<div class="setting-row"><div><strong>${escape(i.email)}</strong><p>${i.revokedAt?'已撤销':i.state==='complete'?'已使用':Date.now()>=i.expiresAt?'已过期':'等待兑换'} · 到期 ${escape(new Date(i.expiresAt).toLocaleString())}</p></div>${!i.revokedAt&&i.state==='pending'?`<button class="secondary" type="button" data-revoke-invite="${escape(i.id)}">撤销</button>`:''}</div>`).join('')}</div><hr><h3>核实后变更成员邮箱</h3><p class="muted">请先通过既有渠道核实身份。新邮箱验证完成后，成员全部设备会退出。</p><form data-security-form="email-change"><label class="field">成员<select name="memberId" required>${members.items.map(m=>`<option value="${m.id}">${escape(m.displayName)} · ${escape(m.email)}</option>`).join('')}</select></label>${field('新邮箱','email','email','required')}<button class="secondary">发送新邮箱验证申请</button></form>`;
  }
  function reset(){show(`<h2>重置密码</h2><p class="muted">重置链接 30 分钟内有效，仅可使用一次。完成后全部设备退出。</p><form data-security-form="reset">${field('用户名或绑定邮箱','account','text','required autocomplete="username"')}<button class="primary">申请重置链接</button></form><button type="button" class="text-button" data-security-action="login">返回登录</button>`);}
  function redemption(kind,token){mode='redeem';show(`<h2>${kind==='invite'?'接受邀请':kind==='reset'?'重置密码':'确认变更邮箱'}</h2><p class="muted">${kind==='email_change'?'请确认收件的新邮箱，完成后全部设备退出。':'请填写接收链接的邮箱。完成后需要重新登录。'}</p><form data-security-form="redeem">${field('收件邮箱','email','email','required autocomplete="email"')}${kind==='invite'?field('用户名','username','text','required minlength="3" maxlength="32" pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}" autocomplete="username"'):''}${kind!=='email_change'?passwordField('新密码（12—128 个字符）'):''}<button class="primary">确认完成</button></form>`);options.redemption={kind,token};}
  async function submit(event){const form=event.target.closest('[data-security-form]');if(!form)return;event.preventDefault();const data=Object.fromEntries(new FormData(form)),button=form.querySelector('button[type=submit],button:not([type])');if(button?.disabled)return;if(button){button.disabled=true;button.ariaBusy='true';}tell(form.dataset.securityForm==='email-send'?'正在发送…':'正在验证…');
   try{switch(form.dataset.securityForm){
    case 'password':await stage(await api('/auth/password',data));break;
    case 'email-send':await api('/auth/otp',data);tell('若此邮箱已获邀请，将收到验证码。');break;
    case 'email-verify':await stage(await api('/auth/verify',data));break;
    case 'device-email':await stage(await api('/auth/device/verify',data));break;
    case 'mfa':await stage(await api('/auth/mfa/verify',{...data,factorId}));break;
    case 'reset':tell((await api('/auth/reset/request',data)).message);break;
    case 'redeem':await api('/auth/account/redeem',{...data,...options.redemption});options.redemption=null;login();tell('账户变更已完成，请重新登录。');break;
    case 'change-password':await api('/api/v1/account/password',data);form.reset();await refresh();tell('密码已更新，当前设备保留。其他设备的网站访问已撤销，认证服务的退出正在处理。');break;
    case 'invite':{const result=await api('/api/v1/admin/invitations',data);await refresh();tell('邀请已创建，安全邮件待发送。到期：'+new Date(result.expiresAt).toLocaleString());break;}
    case 'email-change':await api('/api/v1/admin/members/'+data.memberId+'/email',{email:data.email});form.reset();tell('新邮箱验证申请已创建，安全邮件待发送。');break;
   }}catch(error){tell(error.message);}finally{form.querySelectorAll('input[type=password],input[autocomplete=one-time-code]').forEach(input=>input.value='');if(button){button.disabled=false;button.ariaBusy=null;}}
  }
  async function click(event){const button=event.target.closest('button');if(!button)return;
   if(button.dataset.securityAction){({login,'email-login':emailLogin,reset,retry:refresh})[button.dataset.securityAction]?.();return;}
   if(!button.dataset.replaceDevice&&!button.dataset.revokeDevice&&!button.dataset.revokeInvite)return;button.disabled=true;
   try{if(button.dataset.replaceDevice)await stage(await api('/auth/device/replace',{deviceId:button.dataset.replaceDevice}));
    else if(button.dataset.revokeDevice){const result=await api('/api/v1/account/devices/'+button.dataset.revokeDevice,{},'DELETE');if(result.currentLoggedOut)options.onLoggedOut?.();await refresh();tell('设备的网站访问已撤销，认证服务的退出正在处理。');}
    else{await api('/api/v1/admin/invitations/'+button.dataset.revokeInvite,{},'DELETE');await refresh();tell('邀请已撤销。');}
   }catch(error){tell(error.message);}finally{button.disabled=false;}
  }
  container.addEventListener('submit',submit);container.addEventListener('click',click);
  if(options.redemption)redemption(options.redemption.kind,options.redemption.token);else if(options.stage)stage(options.stage).catch(error=>tell(error.message));else if(options.login)login();else refresh();
  return {destroy(){alive=false;refreshController?.abort();container.removeEventListener('submit',submit);container.removeEventListener('click',click);},refresh};
 }
 let dialog=null,controller=null;
 function openLogin(options={}){
  if(!dialog){dialog=document.createElement('dialog');dialog.className='small-dialog account-security-dialog';dialog.setAttribute('aria-label','账户安全');const close=document.createElement('button');close.type='button';close.className='icon-btn security-close';close.setAttribute('aria-label','关闭账户安全');close.textContent='×';close.addEventListener('click',()=>dialog.close());dialog.append(close,document.createElement('section'));document.body.append(dialog);dialog.addEventListener('close',()=>{controller?.destroy();controller=null;dialog.querySelector('section').replaceChildren();});}
  controller?.destroy();controller=mount(dialog.querySelector('section'),{login:true,...options});if(!dialog.open)dialog.showModal();
 }
 function checkLink(){const match=location.hash.match(/^#\/account\/(invite|reset|email_change)\?token=([a-f0-9]{64})$/);if(!match)return;history.replaceState(null,'','#/account');openLogin({redemption:{kind:match[1],token:match[2]}});}
 window.AccountSecurity={mount,openLogin};window.addEventListener('hashchange',checkLink);document.addEventListener('DOMContentLoaded',checkLink);
})();
