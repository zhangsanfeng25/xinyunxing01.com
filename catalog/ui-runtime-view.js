(() => {
 'use strict';
 function packageUISource(files,title){
  const basename=path=>path.split('/').pop();
  if(files.length===1&&!files[0].path.includes('/')){
   return {name:basename(files[0].path),blob:new Blob([files[0].content],{type:'application/octet-stream'})};
  }
  // Store UTF-8 source files without compression, retaining project paths.
  const encoder=new TextEncoder(),local=[],directory=[];
  const header=size=>new DataView(new ArrayBuffer(size));
  const u16=(view,offset,value)=>view.setUint16(offset,value,true);
  const u32=(view,offset,value)=>view.setUint32(offset,value,true);
  let offset=0, directorySize=0;
  for(const file of files){
   const path=encoder.encode(file.path),body=encoder.encode(file.content);
   let crc=0xffffffff;
   for(const byte of body){
    crc^=byte;
    for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
   }
   crc=(~crc)>>>0;
   const entry=header(30),record=header(46);
   u32(entry,0,0x04034b50);u16(entry,4,20);u16(entry,6,0x800);u16(entry,12,33);
   u32(entry,14,crc);u32(entry,18,body.length);u32(entry,22,body.length);u16(entry,26,path.length);
   u32(record,0,0x02014b50);u16(record,4,20);u16(record,6,20);u16(record,8,0x800);u16(record,14,33);
   u32(record,16,crc);u32(record,20,body.length);u32(record,24,body.length);u16(record,28,path.length);u32(record,42,offset);
   local.push(entry.buffer,path,body);directory.push(record.buffer,path);
   offset+=entry.byteLength+path.length+body.length;directorySize+=record.byteLength+path.length;
  }
  const end=header(22);u32(end,0,0x06054b50);u16(end,8,files.length);u16(end,10,files.length);
  u32(end,12,directorySize);u32(end,16,offset);
  return {name:title+'.zip',blob:new Blob([...local,...directory,end.buffer],{type:'application/zip'})};
 }
 function downloadUIFile(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 function mountUIRuntimeView({previewRoot,toolsRoot,title,requestTicket,onError=()=>{},onStart=()=>{},onFallback=()=>{}}){
  let dead=false,generation=0,runtime=null,abort=null;
  const viewport=document.createElement('div');viewport.className='detail-runtime-viewport';viewport.style.width='100%';
  const stage=document.createElement('div');stage.className='detail-runtime-stage';viewport.append(stage);
  toolsRoot.innerHTML='<p data-runtime-message role="status"></p><button type="button" class="secondary" data-runtime-reset hidden>重新加载预览</button>';
  const message=toolsRoot.querySelector('[data-runtime-message]'),retry=toolsRoot.querySelector('[data-runtime-reset]');toolsRoot.hidden=true;
  function stop(){generation++;abort?.abort();abort=null;runtime?.destroy();runtime=null;stage.replaceChildren();}
  async function start(){stop();if(dead)return;onStart();previewRoot.replaceChildren(viewport);stage.textContent='正在载入…';toolsRoot.hidden=true;retry.hidden=true;message.textContent='';const current=generation;abort=new AbortController();
   try{const ticket=await requestTicket({signal:abort.signal});if(dead||generation!==current)return;viewport.style.background=ticket.background??'#f7f8fa';runtime=window.mountUIRuntime({root:stage,...ticket,title:title+'详情交互预览',onStatus:state=>{if(dead||generation!==current)return;if(state.status==='failed'){message.textContent=state.error;retry.hidden=false;toolsRoot.hidden=false;stage.textContent='交互预览暂不可用';onFallback();}}});}
   catch(error){if(dead||generation!==current)return;stage.textContent='交互预览暂不可用';message.textContent=error.message;retry.hidden=false;toolsRoot.hidden=false;onFallback();onError(error);}
  }
  function click(event){if(event.target.closest('[data-runtime-reset]'))start();}
  toolsRoot.addEventListener('click',click);start();
  return {destroy(){if(dead)return;dead=true;stop();toolsRoot.removeEventListener('click',click);toolsRoot.replaceChildren();toolsRoot.hidden=true;viewport.remove();}};
 }
 Object.assign(window,{packageUISource,downloadUIFile,mountUIRuntimeView});
})();
