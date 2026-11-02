(() => {
 'use strict';let sequence=0;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function highlightUISource(value){const text=String(value),tokens=/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|<\/?[^<>]+>|\b(?:const|let|var|function|return|if|else|for|while|class|new|import|export|from|default|async|await|true|false|null)\b|\b\d+(?:\.\d+)?\b/g;let out='',position=0;for(const match of text.matchAll(tokens)){const token=match[0],kind=token.startsWith('//')||token.startsWith('/*')?'comment':/^["']/.test(token)?'string':token.startsWith('<')?'tag':/^\d/.test(token)?'number':'keyword';out+=esc(text.slice(position,match.index))+'<span class="code-'+kind+'">'+esc(token)+'</span>';position=match.index+token.length;}return out+esc(text.slice(position));}
 function mountUISourceReader({root,requestSources,onError=()=>{}}){
  let dead=false,files=[],selected=0;const id='ui-reader-'+(++sequence);root.innerHTML='<h3>源文件</h3><p role="status">正在读取成员源文件…</p>';
  const load=(async()=>{try{const source=await requestSources();if(dead)return;files=source.manifest?.files??[];if(!files.length){root.innerHTML='<h3>源文件</h3><p class="muted">没有独立代码文件；已有参考材料在上方显示。</p>';return;}
   root.innerHTML='<details class="ui-source-reader" open><summary>源文件（'+files.length+'）</summary><div class="runtime-controls"><label for="'+id+'">文件<select id="'+id+'" data-source-select>'+files.map((f,i)=>'<option value="'+i+'">'+esc(f.path)+'</option>').join('')+'</select></label><button type="button" class="secondary" data-source-copy>复制当前文件</button></div><pre class="review-text"><code data-source-code></code></pre><p data-source-message role="status"></p></details>';show();
  }catch(error){if(dead)return;root.innerHTML='<h3>源文件</h3><p role="status">'+esc(error.message)+'</p>';onError(error);}})();
  function show(){root.querySelector('[data-source-code]').innerHTML=highlightUISource(files[selected].content);root.querySelector('[data-source-message]').textContent='';}
  function change(event){if(event.target.hasAttribute('data-source-select')){selected=Number(event.target.value);if(files[selected])show();}}
  async function click(event){if(!event.target.closest('[data-source-copy]')||!files[selected])return;try{await navigator.clipboard.writeText(files[selected].content);if(!dead)root.querySelector('[data-source-message]').textContent='已复制当前文件。';}catch{if(!dead)root.querySelector('[data-source-message]').textContent='复制未完成，可选择代码后手动复制。';}}
  root.addEventListener('change',change);root.addEventListener('click',click);
  return {ready:load,destroy(){if(dead)return;dead=true;files=[];root.removeEventListener('change',change);root.removeEventListener('click',click);root.replaceChildren();}};
 }
 function mountUIRuntimeView({previewRoot,toolsRoot,title,requestTicket,onError=()=>{},onStart=()=>{},onFallback=()=>{}}){
  let dead=false,generation=0,runtime=null,defaultBackground='#f7f8fa';const viewport=document.createElement('div');viewport.className='detail-runtime-viewport';const stage=document.createElement('div');stage.className='detail-runtime-stage';viewport.append(stage);
  toolsRoot.innerHTML='<div class="runtime-controls"><label>预览宽度<select data-runtime-width><option value="desktop">电脑</option><option value="phone">手机</option></select></label><label>预览背景<select data-runtime-background><option value="default">默认</option><option value="light">浅色</option><option value="dark">深色</option><option value="transparent">透明棋盘格</option></select></label><button type="button" class="secondary" data-runtime-reset>重置预览</button><button type="button" class="secondary" data-runtime-stop>停止预览</button></div><p data-runtime-message role="status"></p>';
  const message=toolsRoot.querySelector('[data-runtime-message]');
  function appearance(){const phone=toolsRoot.querySelector('[data-runtime-width]').value==='phone',mode=toolsRoot.querySelector('[data-runtime-background]').value;viewport.style.width=phone?'390px':'100%';viewport.classList.toggle('runtime-checkerboard',mode==='transparent');viewport.style.background=({light:'#f7f8fa',dark:'#10141b',transparent:'transparent'})[mode]??defaultBackground;}
  function stop(){generation++;runtime?.destroy();runtime=null;stage.replaceChildren();}
  async function start(){stop();onStart();previewRoot.replaceChildren(viewport);appearance();stage.textContent='正在准备隔离预览…';const current=generation;try{const ticket=await requestTicket();if(dead||generation!==current)return;defaultBackground=ticket.background??defaultBackground;appearance();runtime=window.mountUIRuntime({root:stage,...ticket,title:title+'详情交互预览',onStatus:state=>{if(dead||generation!==current)return;message.textContent=state.status==='running'?'可在预览中体验交互；尺寸与背景切换会保留当前状态。':state.status==='failed'?'交互预览暂不可用：'+state.error:'正在启动组件…';if(state.status==='failed'){stage.textContent='交互预览暂不可用';onFallback();}}});}catch(error){if(dead||generation!==current)return;stage.textContent='交互预览暂不可用';message.textContent=error.message;onFallback();onError(error);}}
  function change(event){if(event.target.matches('[data-runtime-width],[data-runtime-background]'))appearance();}
  function click(event){if(event.target.closest('[data-runtime-reset]'))start();if(event.target.closest('[data-runtime-stop]')){stop();message.textContent='组件预览已停止。';}}
  toolsRoot.addEventListener('change',change);toolsRoot.addEventListener('click',click);start();
  return {destroy(){if(dead)return;dead=true;stop();toolsRoot.removeEventListener('change',change);toolsRoot.removeEventListener('click',click);toolsRoot.replaceChildren();viewport.remove();}};
 }
 Object.assign(window,{highlightUISource,mountUISourceReader,mountUIRuntimeView});
})();
