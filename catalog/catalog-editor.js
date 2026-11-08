(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={website:'网站',ui:'UI',prompt:'提示词'};
 const split=value=>String(value??'').split(/[,，\n]/).map(v=>v.trim()).filter(Boolean);
 function catalogMetadataPatch(form,metadata,requestedUrl){const patch={};if(form.url?.trim()!==requestedUrl)return patch;for(const key of ['title','description','logoUrl'])if(!String(form[key]??'').trim()&&typeof metadata[key]==='string'&&metadata[key].trim())patch[key]=metadata[key];return patch;}
 function catalogPayload(form,current=null,status='published'){
  const common={description:form.description,...(form.catalogCategoryId?{catalogCategoryId:Number(form.catalogCategoryId)}:{categoryId:Number(form.categoryId)}),tags:split(form.tags),visibility:form.visibility,resourceStatus:status,...(current?{version:current.version}:{})};
  if(form.kind==='website')return {...common,name:form.title,url:form.url,...(current?{kind:current.kind,projectStack:current.projectStack,coverUrl:current.coverUrl,githubUrl:current.githubUrl}:{}),logoUrl:form.logoUrl??current?.logoUrl??null};
  const kind=form.kind==='prompt'?'prompt':'code',materials=(current?.materials??[]).filter(m=>m.kind!==kind).map(m=>({kind:m.kind,title:m.title,body:m.body,url:m.url,language:m.language}));
  if(form.body)materials.push({kind,body:form.body,...(kind==='code'?{language:'html'}:{})});
  const previews=form.previewUrl?[{url:form.previewUrl}]:current?.previews??[];
  return {...common,...(form.kind==='ui'&&form.uiSource!==undefined?{uiSource:form.uiSource}:{}),title:form.title,resourceKind:form.kind,models:form.models===undefined?(current?.models??[]):split(form.models),materials,previews:previews.map(p=>p.fileId?{fileId:p.fileId}:{url:p.url,animated:!!p.animated})};
 }
 async function publishCatalogResource({form,current=null,files=[],client,status='published',upload=window.createCatalogAttachmentUpload,onStaged=()=>{},onProgress=()=>{}}){
  if(status==='draft'&&current&&current.resourceStatus!=='draft')throw new Error('只有未发布资源可以保存为草稿');
  const currentKind=current?.resourceKind??current?._publicationKind??(current?.url?'website':null);if(currentKind&&currentKind!==form.kind)throw new Error('已创建资源不能更换类型，请重新添加');
  let staged=current;
  if(files.length&&(!staged||form.visibility==='private'&&staged.visibility!=='private')){const status=staged?.resourceStatus??'draft';staged={...await client.saveResource(form.kind,staged?.id,catalogPayload(form,staged,status)),_publicationKind:form.kind,resourceStatus:status,visibility:form.visibility};onStaged(staged);}
  for(const job of files){if(job.saved)continue;job.model??=upload({file:job.file,target:{kind:form.kind,id:staged.id},client,onProgress:value=>{job.progress=value;onProgress(job,value);}});let result;try{result=await job.model.run();}catch(error){if(![502,503,504].includes(error.status)&&!['TimeoutError','TypeError'].includes(error.name))throw error;result=await job.model.run();}if(result.previousVersion!==staged.version)throw Object.assign(new Error('资源已被修改，请重新载入后核对'),{status:409});job.saved=true;staged={...staged,version:result.version};onStaged(staged);}
  return client.saveResource(form.kind,staged?.id,catalogPayload(form,staged,status));
 }
 function renderCatalogEditor({form:f,categories,editing=false,canDraft=!editing}){
  const typed=categories.some(c=>c.kind===f.kind),categoryField=typed?'catalogCategoryId':'categoryId';
  return `<div class="page-heading"><h1>${editing?'编辑资源':'添加资源'}</h1></div><form id="resource-form" class="panel resource-publish-form" novalidate><p data-editor-errors class="editor-error-summary" role="alert" tabindex="-1" hidden></p><fieldset class="type-picker"><legend>资源类型</legend>${Object.entries(labels).map(([kind,name])=>'<label class="type-choice '+(f.kind===kind?'selected':'')+'"><input type="radio" name="kind" value="'+kind+'" '+(f.kind===kind?'checked':'')+' '+(editing?'disabled':'')+'>'+name+'</label>').join('')}</fieldset><label class="field">名称<input name="title" required maxlength="60" value="${esc(f.title)}"></label><label class="field">简介<textarea name="description" rows="2" maxlength="${f.kind==='website'?160:300}" ${f.kind==='website'?'required':''}>${esc(f.description)}</textarea></label><label class="field">搜索分类<input type="search" data-editor-category-search placeholder="输入分类名称"></label><label class="field">分类<select name="${categoryField}" data-editor-category required>${categoryOptions(categories,f[categoryField],'',f.kind)}</select></label>${f.kind==='website'?'<label class="field">网站链接<input name="url" type="url" required maxlength="2048" value="'+esc(f.url)+'" placeholder="https://example.com"></label><button type="button" class="secondary" data-action="fetch-metadata">读取网站信息</button><p data-metadata-message role="status"></p><label class="field">图标链接（可选）<input name="logoUrl" type="url" value="'+esc(f.logoUrl)+'"></label>':'<label class="field">'+(f.kind==='prompt'?'提示词正文':'参考说明（可选）')+'<textarea name="body" rows="10" '+(f.kind==='prompt'?'required':'')+'>'+esc(f.body)+'</textarea></label>'}${f.kind==='ui'?'<section id="native-source-editor" class="ui-source-editor"></section>':''}<label class="field">可见范围<select name="visibility"><option value="shared" ${f.visibility!=='private'?'selected':''}>共享</option><option value="private" ${f.visibility==='private'?'selected':''}>仅自己可见</option></select></label><section class="publication-files"><label class="publication-drop" data-publication-drop><input type="file" multiple data-publication-files disabled aria-describedby="publication-file-limits"><strong>拖拽文件到这里，或点击选择</strong></label><p id="publication-file-limits" class="muted" data-publication-limits>正在读取站点上传限额…</p><div data-selected-files></div></section><section id="catalog-attachment-editor" aria-label="已有附件"></section><details class="publish-options"><summary>更多选项</summary><label class="field">标签<input name="tags" value="${esc(f.tags)}" placeholder="用逗号分隔"></label>${f.kind==='website'?'':'<label class="field">效果图链接（可选）<input name="previewUrl" type="url" value="'+esc(f.previewUrl)+'"></label>'}</details><div class="form-actions"><button type="button" class="secondary" data-action="cancel-publication">返回</button>${canDraft?'<button type="button" class="secondary" data-action="save-draft">保存草稿</button>':''}<button class="primary" type="submit">${editing?'保存修改':'发布'}</button></div><p data-editor-message role="status"></p></form>`;
 }
 function categoryOptions(categories,selected,query='',kind){
  if(kind){
   categories=categories.filter(c=>!c.kind||c.kind===kind);
   if(kind==='ui'&&categories.some(c=>c.origin==='seed'||c.origin==='managed')){
    categories=categories.filter(c=>c.origin!=='legacy'||Number(selected)===c.id||categories.some(child=>child.parentId===c.id));
   }
  }
  const needle=query.trim().toLowerCase();
  const matches=value=>value.toLowerCase().includes(needle);
  const option=c=>'<option value="'+c.id+'" '+(Number(selected)===c.id?'selected':'')+'>'+esc(c.name)+'</option>';
  const roots=categories.filter(c=>c.parentId==null);
  return '<option value="">选择分类</option>'+roots.map(root=>{
   const children=categories.filter(c=>c.parentId===root.id);
   if(!children.length)return matches(root.name)?option(root):'';
   const filtered=children.filter(c=>matches(root.name)||matches(c.name)||Number(selected)===c.id);
   const existing=Number(selected)===root.id?option(root):'';
   return existing+(filtered.length?'<optgroup label="'+esc(root.name)+'">'+filtered.map(option).join('')+'</optgroup>':'');
  }).join('');
 }
 function validateCatalogEditor(form,{draft=false}={}){
  const labels={title:'名称',description:'简介',catalogCategoryId:'分类',categoryId:'分类',url:'网站链接',body:'提示词正文',logoUrl:'图标链接',previewUrl:'效果图链接'};
  const summary=form.querySelector('[data-editor-errors]'),errors=[];
  form.querySelectorAll('[data-field-error]').forEach(el=>el.remove());
  for(const field of form.querySelectorAll('[name]')){
   const label=labels[field.name];if(!label||field.disabled)continue;
   field.removeAttribute('aria-invalid');
   field.removeAttribute('aria-describedby');
   const blank=!field.value.trim();
   let issue='';
   if(!draft&&field.required&&blank)issue='请填写'+label;
   else if(!blank&&field.type==='url'&&(!field.value.trim().toLowerCase().startsWith('https://')||field.validity.typeMismatch))issue='请输入以 https:// 开头的完整链接';
   if(!issue)continue;
   const message=form.ownerDocument.createElement('span');message.className='editor-field-error';message.dataset.fieldError='';message.id='editor-error-'+field.name;message.textContent=issue;
   field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',message.id);field.after(message);
   const details=field.closest('details');if(details)details.open=true;
   errors.push(label);
  }
  summary.hidden=!errors.length;summary.textContent=errors.length?'请检查以下项目：'+errors.join('、'):'';
  if(errors.length)summary.focus();
  return !errors.length;
 }
 window.catalogCategoryOptions=categoryOptions;window.validateCatalogEditor=validateCatalogEditor;window.publishCatalogResource=publishCatalogResource;window.catalogPayload=catalogPayload;window.renderCatalogEditor=renderCatalogEditor;window.catalogMetadataPatch=catalogMetadataPatch;
})();
