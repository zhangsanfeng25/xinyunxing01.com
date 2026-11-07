(() => {
 'use strict';
 const channelPattern=/^[A-Za-z0-9_-]{32,128}$/;
 function validateUIRuntimeURL(value,{appOrigin,runtimeOrigin}){
  const app=new URL(appOrigin),runtime=new URL(runtimeOrigin),url=new URL(value);
  if(app.origin!==appOrigin||runtime.origin!==runtimeOrigin||app.hostname===runtime.hostname||app.origin===runtime.origin||url.origin!==runtime.origin||url.href!==value||url.username||url.password||url.search||url.hash||!(runtime.protocol==='https:'||runtime.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(runtime.hostname))||!/^\/runtime\/[A-Za-z0-9_-]{32,128}\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.html$/.test(url.pathname))throw new Error('隔离预览地址无效');return url.href;
 }
 function createUIRuntimeMonitor({source,channel,now=()=>performance.now(),onStatus=()=>{}}){
  if(!channelPattern.test(channel))throw new Error('预览通道无效');let status='loading',last=now(),dead=false;
  const emit=(next,extra={})=>{status=next;onStatus({status,...extra});};
  function fail(reason,error){if(dead||status==='failed')return;emit('failed',{reason,error});}
  emit('loading');
  return {get status(){return status;},receive(event){
   if(dead||status==='failed'||event.source!==source||event.origin!=='null')return false;const data=event.data;
   if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!['type','channel','state','message'].includes(k))||data.type!=='ui-runtime'||data.channel!==channel||!['ready','pulse','error'].includes(data.state)||data.message!==undefined&&(typeof data.message!=='string'||data.message.length>1000))return false;
   if(data.state==='error'){fail('runtime',data.message||'组件运行失败');return true;}if(data.state==='pulse'&&status!=='running')return false;last=now();if(data.state==='ready'&&status==='loading')emit('running');return true;
  },resume(){last=now();},poll(){if(dead||status==='failed')return;const elapsed=now()-last;if(status==='loading'&&elapsed>15000)fail('load-timeout','组件未能在15秒内启动');else if(status==='running'&&elapsed>4000)fail('heartbeat','组件没有响应，已停止预览');},fail,destroy(){if(dead)return;dead=true;status='destroyed';}};
 }
 function mountUIRuntime({root,url,runtimeOrigin,channel,title='组件交互预览',onStatus=()=>{}}){
  const safe=validateUIRuntimeURL(url,{appOrigin:location.origin,runtimeOrigin});let dead=false,loads=0;
  const frame=document.createElement('iframe');frame.title=title;frame.className='ui-runtime-frame';frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';frame.allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'; fullscreen 'none'; payment 'none'; usb 'none'";
  // Bind the exact WindowProxy after insertion; no authority comes from message payloads.
  let active,timer,message,visibility;frame.src=safe;
  frame.addEventListener('load',()=>{if(++loads>1)active.fail('navigation','组件离开了预览入口，已停止运行');});root.replaceChildren(frame);
  active=createUIRuntimeMonitor({source:frame.contentWindow,channel,onStatus:state=>{root.dataset.previewStatus=state.status;if(state.status==='failed'){frame.remove();clearInterval(timer);window.removeEventListener('message',message);document.removeEventListener('visibilitychange',visibility);}onStatus(state);}});
  message=event=>active.receive(event);window.addEventListener('message',message);timer=setInterval(()=>{if(!document.hidden)active.poll();},500);
  visibility=()=>{if(!document.hidden)active.resume();};document.addEventListener('visibilitychange',visibility);
  return {get status(){return active.status;},destroy(){if(dead)return;dead=true;clearInterval(timer);window.removeEventListener('message',message);document.removeEventListener('visibilitychange',visibility);active.destroy();frame.remove();root.dataset.previewStatus='stopped';}};
 }
 Object.assign(window,{createUIRuntimeMonitor,validateUIRuntimeURL,mountUIRuntime});
})();
