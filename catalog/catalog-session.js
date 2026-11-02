(() => {
 'use strict';
 // Same lease/storage protocol as the existing login page. No activity from timers.
 function createCatalogSession({client,lock,now=Date.now,visible=()=>!document.hidden,storage=localStorage,onExpired=()=>{},onIdentity=()=>{},onError=()=>{}}){
  let identity=null,expired=false,lastActivity=-Infinity,lastAttempt=-Infinity,epoch=0,busy=false;
  function shared(){try{return JSON.parse(storage.getItem('forum-guest-heartbeat')||'null');}catch{return null;}}
  function publish(){try{storage.setItem('forum-guest-heartbeat',JSON.stringify({id:identity.id,version:identity.leaseVersion,time:now(),expiresAt:identity.expiresAt}));}catch{}}
  function adopt(member){epoch++;identity={...member};expired=false;lastActivity=-Infinity;lastAttempt=-Infinity;onIdentity(identity);}
  function expire(){if(identity?.role==='guest'&&!expired){expired=true;epoch++;onExpired();}}
  function absorb(){const data=shared();if(identity?.role==='guest'&&data?.id===identity.id&&data.version===identity.leaseVersion&&Number.isSafeInteger(data.expiresAt))identity.expiresAt=Math.max(identity.expiresAt,data.expiresAt);return data;}
  async function tick(){
   if(identity?.role!=='guest'||expired||busy)return;const previous=absorb();
   if(identity.expiresAt<=now()){expire();return;}
   if(!visible()||now()-lastActivity>60000||now()-lastAttempt<55000||previous?.id===identity.id&&previous.version===identity.leaseVersion&&now()-previous.time<55000)return;
   const generation=epoch,lease=identity;busy=true;lastAttempt=now();
   try{await lock(async()=>{const other=absorb();if(generation!==epoch||other?.id===lease.id&&other.version===lease.leaseVersion&&now()-other.time<55000)return;
    const result=await client.heartbeat({leaseVersion:lease.leaseVersion,visible:visible(),activityAgeMs:Math.max(0,now()-lastActivity)});
    if(generation===epoch){identity={...result.member};publish();}
   });}catch(error){if(generation===epoch){if(error.code==='GUEST_SESSION_EXPIRED')expire();else onError(error);}}finally{busy=false;}
  }
  async function resume(){const generation=epoch;const result=await lock(()=>client.enter());if(generation!==epoch)return;adopt(result.member);lastActivity=now();if(identity.role==='guest')publish();return identity;}
  return {get identity(){return identity;},get expired(){return expired;},adopt,expire,record(){if(!expired&&visible())lastActivity=now();},tick,resume};
 }
 async function catalogGuestLock(callback){
  if(navigator.locks?.request)return navigator.locks.request('forum-guest-access',{mode:'exclusive'},callback);
  if(!window.indexedDB)throw new Error('浏览器无法协调游客会话，请启用站点存储后重试。');
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('forum-guest-lock',1);r.onupgradeneeded=()=>r.result.createObjectStore('locks');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('游客会话协调失败'));});
  const owner=crypto.randomUUID();let acquired=false;
  const acquire=()=>new Promise((resolve,reject)=>{const tx=db.transaction('locks','readwrite'),store=tx.objectStore('locks'),r=store.get('access');let held=false;r.onsuccess=()=>{if(!r.result||r.result.until<=Date.now()){store.put({owner,until:Date.now()+90000},'access');held=true;}};tx.oncomplete=()=>resolve(held);tx.onerror=()=>reject(tx.error);});
  try{for(let attempt=0;attempt<20&&!acquired;attempt++){acquired=await acquire();if(!acquired)await new Promise(resolve=>setTimeout(resolve,250));}if(!acquired)throw new Error('另一个页面正在处理游客会话，请稍后重试。');return await callback();}
  finally{if(acquired)await new Promise(resolve=>{const tx=db.transaction('locks','readwrite'),store=tx.objectStore('locks'),r=store.get('access');r.onsuccess=()=>{if(r.result?.owner===owner)store.delete('access');};tx.oncomplete=resolve;tx.onerror=resolve;});db.close();}
 }
 window.createCatalogSession=createCatalogSession;window.catalogGuestLock=catalogGuestLock;
})();
