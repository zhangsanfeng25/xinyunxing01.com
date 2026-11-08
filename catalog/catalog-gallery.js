(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function createCatalogGalleryModel({urls,load,render,onError=()=>{}}){
  const sources=[...urls];let generation=0,asset=null,dead=false,pending=null;
  const state={index:-1,count:sources.length,src:null,zoom:1,loading:false,error:null};
  function release(){asset?.revoke?.();asset=null;state.src=null;}
  function draw(){render({...state});}
  async function select(index){
   if(dead||!Number.isSafeInteger(index)||index<0||index>=sources.length||state.index===index&&(state.src||state.loading))return;
   const current=++generation;pending?.abort();const controller=pending=new AbortController();
   release();Object.assign(state,{index,zoom:1,loading:true,error:null});draw();
   try{const next=await load(sources[index],controller.signal);if(dead||current!==generation){next.revoke?.();return;}asset=next;state.src=next.src;state.loading=false;draw();}
   catch(error){if(dead||current!==generation)return;state.loading=false;state.error=error.message;draw();onError(error);}
   finally{if(pending===controller)pending=null;}
  }
  return {get state(){return {...state};},select,next:()=>select(Math.min(sources.length-1,state.index+1)),previous:()=>select(Math.max(0,state.index-1)),retry(){if(dead)return;const index=state.index;release();return select(index);},fail(error){if(dead||!state.src)return;generation++;release();state.error=error.message;draw();onError(error);},swipe(dx,dy){if(dead||state.zoom!==1||Math.abs(dx)<48||Math.abs(dx)<=Math.abs(dy)*1.3)return;return select(Math.max(0,Math.min(sources.length-1,state.index+(dx<0?1:-1))));},toggleZoom(){if(dead||!state.src)return;state.zoom=state.zoom===1?2:1;draw();},destroy(){if(dead)return;dead=true;generation++;pending?.abort();release();state.loading=false;state.error=null;state.zoom=1;draw();}};
 }
 let sequence=0;
 async function loadGalleryImage(url,load,caller){
  const signal=AbortSignal.any([caller,AbortSignal.timeout(25000)]),image=new Image();
  let asset,timedOut=false,abort;
  const timeout=new Promise((_,reject)=>{
   abort=()=>{timedOut=true;image.removeAttribute('src');reject(caller.aborted?caller.reason:new Error('图片加载超时，请重试。'));};
   signal.addEventListener('abort',abort,{once:true});
  });
  const decoded=(async()=>{
   const result=await load(url,signal);
   if(timedOut){result.revoke?.();return;}
   asset=result;image.src=result.src;
   await image.decode();
   return result;
  })();
  try{return await Promise.race([decoded,timeout]);}
  catch(error){
   asset?.revoke?.();
   if(error.name==='EncodingError')throw new Error('图片暂时无法显示，请重试。');
   throw error;
  }finally{signal.removeEventListener('abort',abort);}
 }
 function mountCatalogGallery({root,urls,title,load,onError=()=>{}}){
  const id='catalog-lightbox-'+(++sequence),viewer=document.createElement('dialog');viewer.className='catalog-lightbox';viewer.setAttribute('aria-labelledby',id+'-title');
  root.classList.add('catalog-gallery');root.innerHTML='<button type="button" class="gallery-open" data-gallery-open aria-label="放大查看'+esc(title)+'"><img data-gallery-image alt="'+esc(title)+'" hidden></button><p data-gallery-status role="status"></p><div class="gallery-toolbar"><button type="button" class="secondary" data-gallery-previous aria-label="上一张图片">上一张</button><span data-gallery-count></span><button type="button" class="secondary" data-gallery-next aria-label="下一张图片">下一张</button></div>';
  viewer.innerHTML='<div class="dialog-head"><h2 id="'+id+'-title">'+esc(title)+'</h2><button type="button" class="secondary" data-gallery-close>关闭图片</button></div><div class="gallery-image-pane" tabindex="0" aria-label="图片查看区"><img data-gallery-image alt="'+esc(title)+'" hidden><p data-gallery-status role="status"></p></div><div class="gallery-toolbar"><button type="button" class="secondary" data-gallery-previous aria-label="上一张图片">上一张</button><span data-gallery-count></span><button type="button" class="secondary" data-gallery-next aria-label="下一张图片">下一张</button><button type="button" class="secondary" data-gallery-zoom>放大至200%</button><button type="button" class="secondary" data-gallery-fullscreen>浏览器全屏</button></div>';
  document.body.append(viewer);let dead=false,trigger=null,touch=null;
  const pages='<div class="gallery-pages" aria-label="选择图片">'+urls.map((_,i)=>'<button type="button" data-gallery-select="'+i+'" aria-label="查看第'+(i+1)+'张图片">'+(i+1)+'</button>').join('')+'</div>';for(const scope of [root,viewer])scope.querySelector('.gallery-toolbar').insertAdjacentHTML('beforebegin',pages);
  const model=createCatalogGalleryModel({urls,load:(url,signal)=>loadGalleryImage(url,load,signal),onError,render(state){
   for(const scope of [root,viewer]){const image=scope.querySelector('[data-gallery-image]');if(state.src){if(image.getAttribute('src')!==state.src)image.src=state.src;image.hidden=false;}else{image.removeAttribute('src');image.hidden=true;}const status=scope.querySelector('[data-gallery-status]');status.classList.toggle('ui-skeleton',state.loading);if(state.loading)status.innerHTML='<span class="ui-visually-hidden">正在载入图片…</span>';else status.textContent=state.error||'';scope.querySelector('[data-gallery-count]').textContent=(state.index+1)+' / '+state.count;scope.querySelector('[data-gallery-previous]').disabled=state.index<=0;scope.querySelector('[data-gallery-next]').disabled=state.index>=state.count-1;scope.querySelector('[data-gallery-previous]').hidden=state.count<2;scope.querySelector('[data-gallery-next]').hidden=state.count<2;scope.querySelector('[data-gallery-count]').hidden=state.count<2;scope.querySelector('.gallery-pages').hidden=state.count<2||scope===viewer;for(const button of scope.querySelectorAll('[data-gallery-select]'))button.setAttribute('aria-pressed',String(Number(button.dataset.gallerySelect)===state.index));}
   for(const scope of [root,viewer]){let retry=scope.querySelector('[data-gallery-retry]');if(!retry){retry=document.createElement('button');retry.type='button';retry.className='secondary';retry.dataset.galleryRetry='';retry.textContent='重试图片';scope.querySelector('.gallery-toolbar').append(retry);}retry.hidden=!state.error;}
   root.querySelector('.gallery-toolbar').hidden=!state.error;root.querySelector('[data-gallery-open]').disabled=!state.src;viewer.classList.toggle('gallery-zoomed',state.zoom===2);viewer.querySelector('[data-gallery-zoom]').textContent=state.zoom===1?'放大至200%':'适应窗口';viewer.querySelector('[data-gallery-zoom]').disabled=!state.src;
  }});
  function click(event){const button=event.target.closest('button');if(!button||dead)return;event.stopPropagation();
   if(button.hasAttribute('data-gallery-open')){trigger=button;viewer.showModal();}
   if(button.hasAttribute('data-gallery-close'))viewer.close();
   if(button.hasAttribute('data-gallery-next'))model.next();if(button.hasAttribute('data-gallery-previous'))model.previous();if(button.hasAttribute('data-gallery-zoom'))model.toggleZoom();
   if(button.hasAttribute('data-gallery-retry'))model.retry();if(button.hasAttribute('data-gallery-select'))model.select(Number(button.dataset.gallerySelect));
   if(button.hasAttribute('data-gallery-fullscreen')){if(document.fullscreenElement===viewer)document.exitFullscreen().catch(()=>{});else if(viewer.requestFullscreen)viewer.requestFullscreen().catch(()=>{viewer.querySelector('[data-gallery-status]').textContent='浏览器未允许全屏，可继续在窗口内查看。';});}
  }
  function key(event){if(model.state.zoom!==1)return;if(event.key==='ArrowLeft'){event.preventDefault();model.previous();}if(event.key==='ArrowRight'){event.preventDefault();model.next();}}
  function touchStart(event){touch=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;}
  function touchEnd(event){if(!touch)return;const point=event.changedTouches[0],start=touch;touch=null;if(point)model.swipe(point.clientX-start.x,point.clientY-start.y);}
  const panes=[root.querySelector('[data-gallery-open]'),viewer.querySelector('.gallery-image-pane')];for(const pane of panes){pane.addEventListener('touchstart',touchStart,{passive:true});pane.addEventListener('touchend',touchEnd,{passive:true});}
  function closed(){if(document.fullscreenElement===viewer)document.exitFullscreen().catch(()=>{});if(trigger?.isConnected)trigger.focus();}
  root.addEventListener('keydown',key);root.addEventListener('click',click);viewer.addEventListener('click',click);viewer.addEventListener('keydown',key);viewer.addEventListener('close',closed);
  for(const image of [root.querySelector('img'),viewer.querySelector('img')])image.addEventListener('error',()=>{if(!dead)model.fail(new Error('图片暂时无法显示，可重试或切换图片。'));});
  model.select(0);
  return {destroy(){if(dead)return;dead=true;model.destroy();if(document.fullscreenElement===viewer)document.exitFullscreen().catch(()=>{});if(viewer.open)viewer.close();for(const pane of panes){pane.removeEventListener('touchstart',touchStart);pane.removeEventListener('touchend',touchEnd);}root.removeEventListener('keydown',key);root.removeEventListener('click',click);viewer.removeEventListener('click',click);viewer.removeEventListener('keydown',key);viewer.removeEventListener('close',closed);viewer.remove();root.replaceChildren();},get state(){return model.state;}};
 }
 window.createCatalogGalleryModel=createCatalogGalleryModel;window.mountCatalogGallery=mountCatalogGallery;
})();
