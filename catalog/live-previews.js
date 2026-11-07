'use strict';
class LivePreviewDeck {
 constructor({runtime=null,onError=()=>{}}={}){
  this.root=null;this.cards=[];this.frames=new Map();this.preferred=null;this.raf=0;this.paused=false;
  this.runtime=runtime;this.onError=onError;this.disposers=new Map();this.failedCards=new WeakSet();
  this.observer=new IntersectionObserver(()=>this.schedule(),{threshold:[0,.1,.3,.6,1]});
  // IntersectionObserver handles viewport crossings without work on every scroll pixel.
  window.addEventListener('resize',()=>this.schedule(),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.cancelScheduled();else this.schedule();});
 }
 limit(){return matchMedia('(max-width:760px)').matches?1:3;}
 refresh(root){
  this.observer.disconnect();
  for(const card of this.frames.keys())if(!root.contains(card))this.release(card);
  this.root=root;this.cards=[...root.querySelectorAll('[data-live-preview]')];
  for(const card of this.cards){
   this.observer.observe(card);
   if(!card.dataset.deckBound){
    card.dataset.deckBound='true';
    card.addEventListener('pointerenter',()=>{this.preferred=card;this.schedule();});
    card.addEventListener('focusin',()=>{this.preferred=card;this.schedule();});
   }
  }
  this.schedule();
 }
 cancelScheduled(){if(this.raf){cancelAnimationFrame(this.raf);this.raf=0;}}
 schedule(){if(document.hidden||this.paused)return;if(!this.raf)this.raf=requestAnimationFrame(()=>{this.raf=0;this.update();});}
 suspend(){this.paused=true;this.cancelScheduled();for(const card of this.frames.keys())this.release(card);document.body.dataset.activeCardPreviews='0';}
 resume(){this.paused=false;this.schedule();}
 release(card){
  this.disposers.get(card)?.();this.disposers.delete(card);
  const frame=this.frames.get(card);if(frame){document.body.dataset.previewReleases=String(Number(document.body.dataset.previewReleases||0)+1);frame.remove();this.frames.delete(card);}
  card.classList.remove('is-live');card.dataset.previewStatus='paused';
 }
 reset(card){if(!card)return;this.failedCards.delete(card);this.release(card);card.querySelector('.runtime-slot')?.remove();this.preferred=card;this.schedule();}
 update(){
  const limit=this.limit();document.body.dataset.previewLimit=String(limit);
  if(this.paused||document.hidden||document.querySelector('dialog[open]'))return;
  const header=document.querySelector('.site-header')?.getBoundingClientRect().bottom||0;
  const bottom=innerHeight-(matchMedia('(max-width:760px)').matches?64:0);
  const focused=document.activeElement;
  const candidates=this.cards.filter(card=>card.isConnected&&!this.failedCards.has(card)).map(card=>{
   const r=card.getBoundingClientRect();const visible=Math.max(0,Math.min(r.bottom,bottom)-Math.max(r.top,header));
   const frame=this.frames.get(card);return {card,active:this.frames.has(card),ratio:visible/r.height,distance:Math.abs((r.top+r.bottom)/2-(header+bottom)/2),focused:frame===focused||!!frame?.contains?.(focused)};
  }).filter(x=>x.ratio>=(x.active ? .1 : .25)).sort((a,b)=>Number(b.focused)-Number(a.focused)||Number(b.card===this.preferred)-Number(a.card===this.preferred)||Number(b.active)-Number(a.active)||b.ratio-a.ratio||a.distance-b.distance);
  const selected=new Set(candidates.slice(0,limit).map(x=>x.card));
  for(const card of [...this.frames.keys()])if(!selected.has(card))this.release(card);
  for(const card of selected){
   if(this.frames.has(card))continue;
   if(card.dataset.previewResourceId&&this.runtime){
    const slot=document.createElement('div');slot.className='card-live-frame runtime-slot';card.querySelector('.live-preview-stage').append(slot);this.frames.set(card,slot);
    slot.dataset.previewStatus='loading';
    card.dataset.previewStatus='loading';
    const abort=new AbortController();
    const current=()=>this.frames.get(card)===slot;
    let controller;
    const failed=reason=>{
     if(!current())return;
     this.disposers.get(card)?.();this.disposers.delete(card);this.frames.delete(card);
     this.failedCards.add(card);card.classList.remove('is-live');card.dataset.previewStatus='failed';
     slot.dataset.previewStatus='failed';
     const notice=document.createElement('div');notice.className='runtime-fallback';
     const message=document.createElement('p');message.setAttribute('role','status');message.textContent=reason;
     const button=document.createElement('button');
     button.type='button';button.className='secondary';button.textContent='重试';
     button.setAttribute('aria-label','重试'+card.dataset.previewTitle+'预览');
     button.addEventListener('click',()=>{card.closest?.('.interactive-card')?.querySelector('.card-info')?.focus();this.reset(card);});
     notice.append(message,button);slot.replaceChildren(notice);
     document.body.dataset.activeCardPreviews=String(this.frames.size);
     this.schedule();
    };
    const timer=setTimeout(()=>failed('预览未能在 5 秒内启动'),5000);
    this.disposers.set(card,()=>{clearTimeout(timer);abort.abort();controller?.destroy();});
    this.runtime(card,slot,status=>{
     if(!current())return;
     if(status.status==='running'){clearTimeout(timer);slot.dataset.previewStatus='running';card.classList.add('is-live');card.dataset.previewStatus='running';}
     if(status.status==='failed')failed(status.error||'组件运行失败');
    },current,abort.signal).then(result=>{
     if(!current())result?.destroy();else controller=result;
    }).catch(error=>{
     if(!current()||abort.signal.aborted)return;
     failed(error.name==='TimeoutError'?'预览请求超时':error.message||'无法请求交互预览');
     if(error.status===401||error.code==='ACCOUNT_UNAVAILABLE')this.onError(error);
    });continue;
   }
   const source=card.dataset.previewSrc;if(!source?.startsWith('/samples/'))continue;
   const frame=document.createElement('iframe');frame.className='card-live-frame';frame.title=card.dataset.previewTitle+'卡片交互预览';frame.setAttribute('sandbox','');frame.src=source;frame.dataset.createdAt=String(Date.now());
   frame.addEventListener('load',()=>{if(this.frames.get(card)!==frame)return;card.classList.add('is-live');card.dataset.previewStatus='running';});
   this.frames.set(card,frame);card.querySelector('.live-preview-stage').append(frame);
  }
  document.body.dataset.activeCardPreviews=String(this.frames.size);
 }
}
