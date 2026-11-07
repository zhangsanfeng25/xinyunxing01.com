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
    const slot=document.createElement('div');slot.className='card-live-frame runtime-slot';slot.textContent='正在载入组件…';card.querySelector('.live-preview-stage').append(slot);this.frames.set(card,slot);
    const abort=new AbortController();this.disposers.set(card,()=>abort.abort());
    const current=()=>this.frames.get(card)===slot;
    const failed=message=>{if(!current())return;this.disposers.get(card)?.();this.disposers.delete(card);this.frames.delete(card);this.failedCards.add(card);card.classList.remove('is-live');card.dataset.previewStatus='failed';slot.replaceChildren();const text=document.createElement('p');text.className='runtime-fallback';text.textContent='交互预览暂不可用';text.title=message;slot.append(text);this.schedule();};
    this.runtime(card,slot,status=>{if(!current())return;if(status.status==='running'){card.classList.add('is-live');card.dataset.previewStatus='running';}if(status.status==='failed')failed(status.error);},current,abort.signal).then(controller=>{if(!controller)return;if(!current())controller.destroy();else this.disposers.set(card,()=>{abort.abort();controller.destroy();});}).catch(error=>{if(!current()||abort.signal.aborted)return;failed(error.message);this.onError(error);});continue;
   }
   const source=card.dataset.previewSrc;if(!source?.startsWith('/samples/'))continue;
   const frame=document.createElement('iframe');frame.className='card-live-frame';frame.title=card.dataset.previewTitle+'卡片交互预览';frame.setAttribute('sandbox','');frame.src=source;frame.dataset.createdAt=String(Date.now());
   frame.addEventListener('load',()=>{if(this.frames.get(card)!==frame)return;card.classList.add('is-live');card.dataset.previewStatus='running';});
   this.frames.set(card,frame);card.querySelector('.live-preview-stage').append(frame);
  }
  document.body.dataset.activeCardPreviews=String(this.frames.size);
 }
}
