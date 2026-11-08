(() => {
 'use strict';
 function createCatalogClient(fetcher=fetch){
  function signal(options={}){const timeout=typeof AbortSignal!=='undefined'?AbortSignal.timeout(options.timeout??20000):null;return options.signal&&timeout&&typeof AbortSignal.any==='function'?AbortSignal.any([options.signal,timeout]):options.signal??timeout;}
  async function rawRequest(path,data,method=data===undefined?'GET':'POST',options={}){const response=await fetcher(path,{method,signal:signal(options),credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json','X-Forum-CSRF':'1'},...(data===undefined?{}:{body:JSON.stringify(data)})});let value;try{value=await response.json();}catch{throw new Error('资源服务返回无效内容，请重试');}if(!response.ok)throw Object.assign(new Error(value.error??'资源服务暂不可用'),{status:response.status,code:value.code,retryAfter:Number(response.headers.get('Retry-After'))||0});return value;}
  let queue=Promise.resolve(),epoch=0,folderCache=null;const changed=()=>Object.assign(new Error('访问身份已变化，请重新载入'),{code:'IDENTITY_CHANGED'});
  function enqueue(task,deadline,generation=epoch){
   const execute=async()=>{
    deadline?.throwIfAborted();
    if(generation!==epoch)throw changed();
    const value=await task();
    if(generation!==epoch)throw changed();
    return value;
   };
   const run=()=>{
    deadline?.throwIfAborted();
    return typeof navigator!=='undefined'&&navigator.locks?.request
     ?navigator.locks.request('forum-catalog-api',{mode:'exclusive',...(deadline?{signal:deadline}:{})},execute)
     :execute();
   };
   const result=queue.then(run,run);queue=result.catch(()=>{});
   if(!deadline)return result;
   return new Promise((resolve,reject)=>{
    const stop=()=>reject(deadline.reason);
    if(deadline.aborted)stop();else deadline.addEventListener('abort',stop,{once:true});
    result.then(resolve,reject).finally(()=>deadline.removeEventListener('abort',stop));
   });
  }
  const sessionBusy=error=>error.code==='SESSION_BUSY'||error.status===429&&error.message==='登录会话正在更新，请稍后重试';
  async function sessionRequest(task,deadline,retry,generation=epoch){
   for(let attempt=0;;attempt++){
    try{return await enqueue(task,deadline,generation);}
    catch(error){
     if(!retry||!sessionBusy(error)||attempt>=2||error.retryAfter>2)throw error;
     await new Promise(resolve=>setTimeout(resolve,(error.retryAfter||1)*1000));
     deadline?.throwIfAborted();
    }
   }
  }
  function request(path,data,method,options={}){
   const deadline=signal(options),read=(method??(data===undefined?'GET':'POST'))==='GET';
   return sessionRequest(()=>rawRequest(path,data,method,{...options,signal:deadline}),deadline,read||options.retrySessionBusy);
  }
  async function image(path,options={}){
   if(!/^\/api\/v1\/(?:files\/|attachments\/files\/)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/preview)?$/.test(path))throw new Error('图片地址无效');
   const generation=epoch,deadline=signal({timeout:20000,...options});
   try{
    const response=await sessionRequest(async()=>{
     const result=await fetcher(path,{credentials:'same-origin',cache:'no-store',signal:deadline});
     if(generation!==epoch){await result.body?.cancel();throw changed();}
     if(!result.ok){
      let data;try{data=await result.json();}catch{}
      throw Object.assign(new Error(data?.error??'图片暂不可用'),{status:result.status,code:data?.code,retryAfter:Number(result.headers.get('Retry-After'))||0});
     }
     return result;
    },deadline,true,generation);
    if(!/^image\/(png|jpeg|webp|gif|avif)(?:;|$)/i.test(response.headers.get('Content-Type')??'')||Number(response.headers.get('Content-Length'))>10000000){
     await response.body?.cancel();throw new Error('图片格式不受支持或超过查看上限');
    }
    // The authentication lease is finished when headers arrive. Streaming the body must not block other requests.
    const blob=await response.blob();
    if(generation!==epoch)throw changed();
    if(blob.size>10000000)throw new Error('图片超过当前查看上限');
    return blob;
   }catch(error){if(error.name==='TimeoutError')throw new Error('图片加载超时，请重试。');if(sessionBusy(error))error.message='图片服务暂时繁忙，请重试。';throw error;}
  }
  const attachmentPath=target=>'/api/v1/attachments/'+encodeURIComponent(target.kind)+'/'+encodeURIComponent(target.id);
  const uploadPath=id=>'/api/v1/attachment-uploads/'+encodeURIComponent(id);
  function putAttachmentPart(id,number,fingerprint,body,options={}){return enqueue(async()=>{const response=await fetcher(uploadPath(id)+'/parts/'+number,{method:'PUT',credentials:'same-origin',cache:'no-store',signal:signal({...options,timeout:120000}),headers:{'Content-Type':'application/octet-stream','X-Forum-CSRF':'1','X-Part-SHA256':fingerprint},body});let data;try{data=await response.json();}catch{throw new Error('上传返回无效内容，请查询后重试');}if(!response.ok)throw Object.assign(new Error(data.error??'分片暂未确认'),{status:response.status,code:data.code,retryAfter:Number(response.headers.get('Retry-After'))||0});return data;});}
  const resourcePath=(kind,id)=>'/api/v1/'+(kind==='website'?'websites':'design-resources')+(id?'/'+encodeURIComponent(id):'');
  const query=data=>Object.entries(data??{}).filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
  return {bootstrap:()=>request('/api/v1/catalog/bootstrap'),operations:()=>request('/api/v1/admin/operations'),saveStoragePolicy:data=>request('/api/v1/admin/operations/storage',data,'PATCH'),accountRequest:(path,data,method,options)=>request(path,data,method,{timeout:10000,...options}),siteSettings:()=>request('/api/v1/site-settings'),comments:(target,query={})=>request('/api/v1/resource-comments/'+encodeURIComponent(target.kind)+'/'+encodeURIComponent(target.id)+'?'+new URLSearchParams(query)),commentAction:(path,data,method)=>request('/api/v1/resource-comments/'+path,data,method),feedback:(target,query={})=>request('/api/v1/resource-feedback/'+encodeURIComponent(target.kind)+'/'+encodeURIComponent(target.id)+'?'+new URLSearchParams(query)),feedbackQueue:(scope,query={})=>request('/api/v1/resource-feedback?'+new URLSearchParams({scope,...query})),feedbackAction:(path,data,method)=>request('/api/v1/resource-feedback/'+path,data,method),notifications:(query={})=>request('/api/v1/notifications?'+new URLSearchParams(query)),notificationRead:data=>request('/api/v1/notifications/read',data),notificationPreferences:data=>request('/api/v1/notifications/preferences',data,data?'PATCH':'GET'),workspace:(path='',data,method)=>request('/api/v1/admin/workspace'+(path?'/'+path:''),data,method),invitations:()=>request('/api/v1/admin/invitations'),securitySessions:()=>request('/api/v1/admin/sessions'),securityLogs:()=>request('/api/v1/admin/login-events'),revokeSession:id=>request('/api/v1/admin/sessions/'+encodeURIComponent(id),{},'DELETE'),invalidate(){epoch++;folderCache=null;},favorite:(item,saved,folderId=null)=>request('/api/v1/collections',{kind:item.kind,id:item.id,...(saved?{folderId}:{})},saved?'POST':'DELETE'),favorites:data=>request('/api/v1/collections?'+query(data),undefined,undefined,{timeout:10000}),personal:data=>request('/api/v1/personal-resources?'+query(data),undefined,undefined,{timeout:10000}),folders(){if(!folderCache||folderCache.expires<Date.now()){const entry={expires:Date.now()+30000,promise:null};entry.promise=request('/api/v1/collection-folders').catch(error=>{if(folderCache===entry)folderCache=null;throw error;});folderCache=entry;}return folderCache.promise;},saveFolder:(id,data,method)=>request('/api/v1/collection-folders'+(id?'/'+id:''),method==='DELETE'?{version:data.version}:data,method??(id?'PATCH':'POST')).then(result=>{folderCache=null;return result;}),lifecycle:(action,targets,requestKey)=>request('/api/v1/resource-lifecycle',{action,targets,requestKey}).then(value=>{if(value.results?.some(x=>x.ok))window.dispatchEvent?.(new Event('forum-resource-change'));return value;}),lifecycleJobs:()=>request('/api/v1/resource-lifecycle'),accountLifecycle:(scope,options)=>request('/api/v1/account-lifecycle'+(scope?'?scope='+encodeURIComponent(scope):''),undefined,undefined,{timeout:10000,...options}),accountAction:(action,data)=>request('/api/v1/account-lifecycle/'+action,data),members:(cursor=0)=>request('/api/v1/members?limit=50'+(cursor?'&cursor='+encodeURIComponent(cursor):'')),updateMember:(id,data)=>request('/api/v1/members/'+id,data,'PATCH'),legacy:(type,id)=>request('/api/v1/'+type+'/'+id),image,pendingAttachmentUploads:target=>request('/api/v1/attachment-uploads/'+encodeURIComponent(target.kind)+'/'+encodeURIComponent(target.id)),attachmentConfig:()=>request('/api/v1/attachment-config'),attachments:target=>request(attachmentPath(target)),arrangeAttachments:(target,data)=>request(attachmentPath(target),data,'PATCH'),removeAttachment:(target,id,version)=>request(attachmentPath(target)+'/'+encodeURIComponent(id),{version},'DELETE'),startAttachmentUpload:(target,data,options)=>request('/api/v1/attachment-uploads/'+encodeURIComponent(target.kind)+'/'+encodeURIComponent(target.id),data,'POST',options),attachmentUploadStatus:(id,options)=>request(uploadPath(id),undefined,'GET',options),completeAttachmentUpload:(id,options)=>request(uploadPath(id)+'/complete',{},'POST',{...options,timeout:120000}),cancelAttachmentUpload:id=>request(uploadPath(id),{},'DELETE'),putAttachmentPart,compilerConfig:()=>request('/api/v1/ui-previews/config'),testUI:source=>request('/api/v1/ui-previews/test',source),uiSources:id=>request('/api/v1/ui-previews/'+id+'/sources'),uiTicket:(id,options)=>request('/api/v1/ui-previews/'+id+'/ticket',{},'POST',{timeout:18000,retrySessionBusy:true,...options}).catch(error=>{if(sessionBusy(error))error.message='预览服务暂时繁忙，请重试。';else if(error.name==='TimeoutError')error.message='预览连接超时，请重试。';throw error;}),metadata:url=>request('/api/v1/websites/metadata',{url}),related:item=>request('/api/v1/catalog/'+encodeURIComponent(item.kind)+'/'+encodeURIComponent(item.id)+'/related'),categories:kind=>request('/api/v1/catalog/categories?kind='+encodeURIComponent(kind)),saveCategory:(kind,id,data)=>request('/api/v1/catalog/categories'+(id?'/'+id:'')+'?kind='+encodeURIComponent(kind),data,id?'PATCH':'POST'),archiveCategory:(kind,id,version)=>request('/api/v1/catalog/categories/'+id+'?kind='+encodeURIComponent(kind),{version},'DELETE'),duplicate:data=>request('/api/v1/websites/check-duplicate',data),detailResource:item=>request(resourcePath(item.kind,item.id)),saveResource:(kind,id,data)=>request(resourcePath(kind,id),data,id?'PATCH':'POST'),removeResource:item=>request(resourcePath(item.kind,item.id),{version:item.version},'DELETE'),session:()=>request('/api/v1/session'),heartbeat:data=>request('/api/v1/guest/heartbeat',data),leave:data=>request('/api/v1/guest/leave',data),logout:()=>request('/auth/logout',{}),home:()=>request('/api/v1/home'),enter:()=>request('/api/v1/guest/enter',{}),async listAll(kind,q='',options){const rows=[];let page=1,pages=1;do{const result=await request('/api/v1/catalog?kind='+encodeURIComponent(kind)+'&page='+page+(q?'&q='+encodeURIComponent(q):''),undefined,undefined,options);rows.push(...result.items);pages=result.totalPages;page++;}while(page<=pages);return rows;},view:({kind,id})=>request('/api/v1/catalog/'+encodeURIComponent(kind)+'/'+encodeURIComponent(id)+'/views',{})};
 }
 window.createCatalogClient=createCatalogClient;
})();
