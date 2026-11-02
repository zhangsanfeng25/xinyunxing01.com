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
  let dead=false,generation=0,runtime=null,abort=null;
  const viewport=document.createElement('div');viewport.className='detail-runtime-viewport';viewport.style.width='100%';
  const stage=document.createElement('div');stage.className='detail-runtime-stage';viewport.append(stage);
  toolsRoot.innerHTML='<p data-runtime-message role="status"></p><button type="button" class="secondary" data-runtime-reset hidden>重新加载预览</button>';
  const message=toolsRoot.querySelector('[data-runtime-message]'),retry=toolsRoot.querySelector('[data-runtime-reset]');toolsRoot.hidden=true;
  function stop(){generation++;abort?.abort();abort=null;runtime?.destroy();runtime=null;stage.replaceChildren();}
  async function start(){stop();if(dead||document.hidden)return;onStart();previewRoot.replaceChildren(viewport);stage.textContent='正在载入…';toolsRoot.hidden=true;retry.hidden=true;message.textContent='';const current=generation;abort=new AbortController();
   try{const ticket=await requestTicket({signal:abort.signal});if(dead||generation!==current)return;viewport.style.background=ticket.background??'#f7f8fa';runtime=window.mountUIRuntime({root:stage,...ticket,title:title+'详情交互预览',onStatus:state=>{if(dead||generation!==current)return;if(state.status==='failed'){message.textContent=state.error;retry.hidden=false;toolsRoot.hidden=false;stage.textContent='交互预览暂不可用';onFallback();}}});}
   catch(error){if(dead||generation!==current)return;stage.textContent='交互预览暂不可用';message.textContent=error.message;retry.hidden=false;toolsRoot.hidden=false;onFallback();onError(error);}
  }
  function visible(){if(document.hidden)stop();else start();}
  function click(event){if(event.target.closest('[data-runtime-reset]'))start();}
  toolsRoot.addEventListener('click',click);document.addEventListener('visibilitychange',visible);start();
  return {destroy(){if(dead)return;dead=true;stop();document.removeEventListener('visibilitychange',visible);toolsRoot.removeEventListener('click',click);toolsRoot.replaceChildren();toolsRoot.hidden=true;viewport.remove();}};
 }
 Object.assign(window,{highlightUISource,mountUISourceReader,mountUIRuntimeView});
})();
