(() => {
 'use strict';
 function createUICompilerClient(config){
  let workerURL,runtime;try{workerURL=new URL(config.workerUrl);runtime=new URL(config.runtimeOrigin);if(workerURL.origin!==location.origin||workerURL.href!==config.workerUrl||workerURL.search||workerURL.hash||!/^\/ui-compiler\/widget-compiler-[a-f0-9]{16}\.js$/.test(workerURL.pathname))throw 0;}catch{throw new Error('编译器地址无效');}
  if(runtime.origin!==config.runtimeOrigin||runtime.hostname===new URL(location.origin).hostname||!(runtime.protocol==='https:'||runtime.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(runtime.hostname)))throw new Error('隔离运行来源无效');
  let worker=null,pending=null,serial=0,dead=false;
  function settle(error,value,terminate=false){if(terminate){worker?.terminate();worker=null;}const task=pending;if(!task)return;pending=null;clearTimeout(task.timer);error?task.reject(error):task.resolve(value);}
  function timeout(ms){clearTimeout(pending.timer);pending.timer=setTimeout(()=>settle(new Error('编译超时，已停止编译器；原始代码仍保留'),null,true),ms);}
  function open(){if(worker)return;worker=new Worker(workerURL.href);worker.onerror=()=>settle(new Error('编译器加载失败，请重新测试'),null,true);worker.onmessage=event=>{const d=event.data;if(!pending||!d||d.id!==pending.id)return;if(d.type==='compile-phase'&&['loading','compiling'].includes(d.phase)){if(d.phase==='compiling')timeout(10000);pending.onPhase(d.phase);return;}if(d.type==='compile-error'){settle(new Error(typeof d.error==='string'?d.error.slice(0,1000):'编译失败'));return;}if(d.type!=='compile-result')return;if(d.compilerId!==config.compilerId){settle(new Error('编译器版本不一致，请刷新页面'),null,true);return;}if(d.artifact?.format!=='native-v1'||!Array.isArray(d.artifact.files)||!/^[a-f0-9]{64}$/.test(d.sourceDigest??'')){settle(new Error('编译器返回内容无效'),null,true);return;}settle(null,d);};}
  return {compile(manifest,{onPhase=()=>{}}={}){if(dead)return Promise.reject(new Error('编译器已关闭'));if(pending)return Promise.reject(new Error('编译器正在处理上一项'));return new Promise((resolve,reject)=>{pending={id:++serial,resolve,reject,onPhase,timer:null};try{open();timeout(30000);worker.postMessage({type:'compile',id:serial,manifest,runtimeOrigin:runtime.origin});}catch(error){settle(error,null,true);}});},cancel(){settle(new Error('已取消编译；原始代码仍保留'),null,true);},destroy(){dead=true;settle(new Error('编译器已关闭'),null,true);}};
 }
 window.createUICompilerClient=createUICompilerClient;
})();
