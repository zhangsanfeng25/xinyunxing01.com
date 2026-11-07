(() => {
 'use strict';
 const iconControl=':is(button,a):is(.icon-btn,.icon-button,.save-btn,.tree-expand,.clear-search,[data-theme-toggle])[aria-label]';
 let tooltip=null,anchor=null,timer=0,leaveTimer=0;

 function hide(){
  clearTimeout(timer);
  clearTimeout(leaveTimer);
  timer=0;
  if(tooltip?.matches(':popover-open'))tooltip.hidePopover();
  anchor=null;
 }

 function show(control){
  if(!control.isConnected||control.matches(':disabled,[aria-disabled=true]'))return;
  const label=control.getAttribute('aria-label');
  if(!label)return;
  if(!tooltip){
   const bubble=document.createElement('span');
   if(typeof bubble.showPopover!=='function')return;
   tooltip=bubble;
   tooltip.className='ui-tooltip';
   tooltip.setAttribute('popover','manual');
   // The control already exposes the same text as its accessible name.
   tooltip.setAttribute('aria-hidden','true');
   tooltip.addEventListener('pointerenter',()=>clearTimeout(leaveTimer));
   tooltip.addEventListener('pointerleave',event=>{if(!anchor?.contains(event.relatedTarget)&&!anchor?.matches(':focus-visible'))hide();});
   document.body.append(tooltip);
  }
  tooltip.textContent=label;
  tooltip.showPopover();
  const rect=control.getBoundingClientRect(),width=tooltip.offsetWidth,height=tooltip.offsetHeight;
  const left=Math.max(8,Math.min(innerWidth-width-8,rect.left+(rect.width-width)/2));
  const top=rect.top-height-8<8?rect.bottom+8:rect.top-height-8;
  tooltip.style.left=left+'px';
  tooltip.style.top=top+'px';
 }

 function activate(event,delay){
  const control=event.target.closest?.(iconControl);
  if(!control)return;
  if(control===anchor){clearTimeout(leaveTimer);return;}
  hide();
  anchor=control;
  if(delay)timer=setTimeout(()=>show(control),delay);
  else show(control);
 }

 document.addEventListener('pointerover',event=>{if(event.pointerType!=='touch')activate(event,300);});
 document.addEventListener('pointerout',event=>{
  if(!anchor?.contains(event.target)||anchor.contains(event.relatedTarget)||anchor.matches(':focus-visible'))return;
  clearTimeout(timer);timer=0;
  if(tooltip?.matches(':popover-open'))leaveTimer=setTimeout(hide,180);
  else hide();
 });
 document.addEventListener('focusin',event=>{if(event.target.matches?.(':focus-visible'))activate(event,0);});
 document.addEventListener('focusout',event=>{if(event.target===anchor)hide();});
 document.addEventListener('click',hide,true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();},true);
 document.addEventListener('scroll',hide,true);
 window.addEventListener('resize',hide);
 new MutationObserver(()=>{if(anchor&&!anchor.isConnected)hide();}).observe(document.body,{childList:true,subtree:true});
})();
