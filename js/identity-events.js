(() => {
 'use strict';
 function createIdentityEvents({target=window,storage,channelFactory,onInvalidate=()=>{},onSuspend=()=>{},onValidate=()=>{},now=()=>Date.now(),validationInterval=60000}={}){
  let closed=false,lastValidation=-Infinity;const seen=new Set(),listeners=[],key='forum-identity-event-v1';
  try{storage??=target.localStorage;}catch{}
  let channel;try{channel=(channelFactory??(()=>typeof BroadcastChannel==='function'?new BroadcastChannel('forum-identity-v1'):null))();}catch{}
  function receive(data){if(closed||!data||data.type!=='invalidate'||typeof data.nonce!=='string'||data.nonce.length>100||!['login','logout','permissions','resource'].includes(data.reason)||seen.has(data.nonce))return;seen.add(data.nonce);if(seen.size>32)seen.delete(seen.values().next().value);onInvalidate(data.reason);}
  function publish(reason){const message={type:'invalidate',reason,nonce:crypto.randomUUID()};receive(message);try{channel?.postMessage(message);}catch{}try{storage?.setItem(key,JSON.stringify(message));}catch{}}
  function listen(name,callback){const node=name==='visibilitychange'&&target.document?target.document:target;node.addEventListener(name,callback);listeners.push([node,name,callback]);}
  if(channel)channel.onmessage=event=>receive(event.data);
  listen('storage',event=>{if(event.key===key&&event.newValue)try{receive(JSON.parse(event.newValue));}catch{}});
  listen('forum-identity-message',event=>receive(event.detail));
  listen('forum-identity-change',event=>publish(event.detail?.reason??'permissions'));
  listen('pagehide',()=>onSuspend());
  listen('pageshow',event=>{if(event.persisted){onSuspend();onValidate();}});
  listen('visibilitychange',()=>{if(target.document?.visibilityState!=='hidden'&&now()-lastValidation>=validationInterval){lastValidation=now();onValidate();}});
  return {publish,announce(reason){const message={type:'invalidate',reason,nonce:crypto.randomUUID()};seen.add(message.nonce);try{channel?.postMessage(message);}catch{}try{storage?.setItem(key,JSON.stringify(message));}catch{}},destroy(){closed=true;listeners.forEach(([node,name,callback])=>node.removeEventListener(name,callback));if(channel){channel.onmessage=null;channel.close();}seen.clear();}};
 }
 window.createIdentityEvents=createIdentityEvents;
 window.broadcastForumIdentity=function(reason){const data={type:'invalidate',reason,nonce:crypto.randomUUID()};window.dispatchEvent(new CustomEvent('forum-identity-message',{detail:data}));try{localStorage.setItem('forum-identity-event-v1',JSON.stringify(data));}catch{}try{const c=new BroadcastChannel('forum-identity-v1');c.postMessage(data);c.close();}catch{}};
})();
