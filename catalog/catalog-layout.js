'use strict';
function reviewedCatalogTree(kind){
 const group=(key,title,children)=>({key,title,children});
 const leaf=(key,title,values)=>({key,title,values});
 if(kind==='website')return [
  group('tools','工具',[leaf('tools-media','图文与文件',[1,4,5,6,8,9,11,15]),leaf('tools-study','开发与学习',[2,3,13]),leaf('tools-general','综合工具',[7,10,12,14,16])]),
  group('ai','AI',[leaf('ai-chat','对话助手',[17,18,20,22]),leaf('ai-creative','图像与视频',[19,21,25]),leaf('ai-work','编程与智能体',[23,24,26,27,28])]),
  group('assets','素材',[leaf('assets-photo','图片与摄影',[29,30,31,32,33]),leaf('assets-icons','图标与免抠',[34,36]),leaf('assets-inspiration','资源与设计灵感',[35,37,38,39,40,41])])
 ];
 if(kind==='ui')return [
  group('ui-nav','导航与菜单',[leaf('ui-menu','下拉菜单',['hover-dropdown','animated-submenu']),leaf('ui-tabs','导航切换',['sliding-tabs'])]),
  group('ui-panels','面板与布局',[leaf('ui-drawer','侧滑抽屉',['drawer-left']),leaf('ui-accordion','折叠面板',['accordion-menu'])]),
  group('ui-controls','控件与反馈',[leaf('ui-switch','开关',['slider-switch']),leaf('ui-button','按钮',['lift-button']),leaf('ui-loading','加载动画',['orbit-loader'])])
 ];
 return [];
}
function catalogTree(kind){
 const groups=reviewedCatalogTree(kind);if(typeof state==='undefined'||!state.backendMode)return groups;
 const categories=state.categories?.[kind]??[];
 if(categories.some(c=>c.kind===kind)){
  const node=c=>({key:'category-'+c.id,title:c.name,catalogCategoryId:c.id,children:[]});
  return categories.filter(c=>c.parentId==null).map(c=>({...node(c),origin:c.origin,children:categories.filter(x=>x.parentId===c.id).map(node)})).filter(g=>g.origin!=='legacy'||g.children.length||state.items.some(x=>x.kind===kind&&x.catalogCategoryId===g.catalogCategoryId));
 }
 for(const category of categories){const matching=groups.find(g=>g.title===category.name);if(matching){matching.categoryId=category.id;continue;}const values=state.items.filter(x=>x.kind===kind&&x.categoryId===category.id&&!x.seedKey.startsWith('v12-'));if(kind==='prompt'||values.length)groups.push({key:'category-'+category.id,title:category.name,children:[],categoryId:category.id,newOnly:kind!=='prompt'});}return groups;
}
function folderNode(kind,key){if(key==='uncategorized')return {key,title:'未分类',values:[]};return catalogTree(kind).flatMap(x=>[x,...x.children]).find(x=>x.key===key);}
function inFolder(item,node){
 if(!node)return true;
 if(node.key==='uncategorized')return !catalogTree(item.kind).some(group=>inFolder(item,group));
 if(node.catalogCategoryId!==undefined)return item.catalogCategoryId===node.catalogCategoryId||node.children?.some(c=>inFolder(item,c))||false;
 if(node.categoryId!==undefined&&(!node.newOnly||!item.seedKey.startsWith('v12-')))return item.categoryId===node.categoryId;
 if(node.children)return node.children.some(child=>inFolder(item,child));
 return node.values.some(value=>typeof value==='number'?item.source?.bookmarkIndex===value:item.seedKey.endsWith('-'+value));
}
function folderCount(kind,node){return state.items.filter(x=>x.kind===kind&&inFolder(x,node)).length;}
function categoryTree(kind){
 const all='全部'+label(kind),selected=state.folder;
 return `<div class="catalog-tree"><div class="tree-title">${icon(kind==='website'?'globe':kind==='ui'?'layout-grid':'message-square')}<span>${label(kind)}分类</span></div>${state.backendMode&&(state.role==='admin'||kind==='website'&&state.role==='member')?'<button class="text-button" data-action="manage-categories">管理分类</button>':''}<button class="tree-item tree-all ${selected==='all'?'active':''}" data-folder="all" aria-pressed="${selected==='all'}"><span>${all}</span><small>${folderCount(kind)}</small></button>${catalogTree(kind).map(g=>`<div class="tree-group"><div class="tree-group-head"><button class="tree-item ${selected===g.key?'active':''}" data-folder="${g.key}" aria-pressed="${selected===g.key}"><span>${esc(g.title)}</span><small>${folderCount(kind,g)}</small></button>${g.children.length?`<button class="tree-expand" data-expand="${g.key}" aria-label="展开或收起${esc(g.title)}子分类" aria-expanded="${!state.collapsedGroups.has(g.key)}" aria-controls="branch-${g.key}">${icon('chevron-down')}</button>`:``}</div><div id="branch-${g.key}" class="tree-children" ${state.collapsedGroups.has(g.key)?'hidden':''}>${g.children.map(c=>`<button class="tree-item ${selected===c.key?'active':''}" data-folder="${c.key}" aria-pressed="${selected===c.key}"><span>${esc(c.title)}</span><small>${folderCount(kind,c)}</small></button>`).join('')}</div></div>`).join('')}${folderCount(kind,folderNode(kind,'uncategorized'))?`<button class="tree-item ${selected==='uncategorized'?'active':''}" data-folder="uncategorized"><span>未分类</span><small>${folderCount(kind,folderNode(kind,'uncategorized'))}</small></button>`:''}</div>`;
}
function siteLogo(item){return `<span class="site-logo"><img data-site-logo src="${esc(item.logo||'assets/icons/globe.svg')}" alt="" loading="lazy"><span class="logo-fallback" hidden>${icon('globe')}</span></span>`;}
function websiteCard(item){return `<article class="site-card"><button class="site-main" data-open="${esc(item.seedKey)}" aria-label="查看${esc(item.title)}详情">${siteLogo(item)}<span class="site-copy"><strong>${esc(item.title)}</strong><small>${esc(item.description)}</small><span class="site-tags">${badge('website')}${item.linkStatus&&item.linkStatus!=='normal'?`<span class="link-state">${item.linkStatus==='invalid'?'链接失效':'链接待核实'}</span>`:''}<span>${esc(item.category)}</span></span></span></button><div class="site-actions"><button class="save-btn ${state.saved.has(item.seedKey)?'saved':''}" data-save="${esc(item.seedKey)}" aria-label="${state.saved.has(item.seedKey)?'取消收藏':'收藏'}${esc(item.title)}" aria-pressed="${state.saved.has(item.seedKey)}">${icon('bookmark')}</button><a class="icon-btn" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="访问${esc(item.title)}网站">${icon('external-link')}</a></div></article>`;}
function previewCard(item){return `<article class="resource-card interactive-card"><div class="live-preview" data-live-preview ${item.hasRuntime?'data-preview-resource-id="'+esc(item.id)+'"':'data-preview-src="'+esc(item.sample)+'"'} data-preview-title="${esc(item.title)}"><div class="live-preview-stage" style="background:${esc(item.defaultBackground||item.preview?.background||'var(--canvas)')}">${item.thumbnail||item.cover?'<img class="preview-poster" src="'+esc(item.thumbnail||item.cover)+'" alt="'+esc(item.title)+'效果" loading="lazy">':'<div class="preview-poster preview-placeholder">组件预览</div>'}</div><button type="button" class="preview-reset secondary" data-reset-preview aria-label="重置${esc(item.title)}预览">重置</button></div><div class="card-body"><button class="card-info" data-open="${esc(item.seedKey)}" aria-label="查看${esc(item.title)}详情"><span class="card-info-title">${esc(item.title)}</span><span class="card-description">${esc(item.description)}</span>${badge('ui')}</button><button class="save-btn ${state.saved.has(item.seedKey)?'saved':''}" data-save="${esc(item.seedKey)}" aria-label="${state.saved.has(item.seedKey)?'取消收藏':'收藏'}${esc(item.title)}" aria-pressed="${state.saved.has(item.seedKey)}">${icon('bookmark')}</button></div></article>`;}
function catalogResults(kind,items){
 if(!items.length)return empty(kind==='prompt'&&!state.listQuery?'还没有提示词':'没有找到匹配的资源','',kind==='prompt'&&!state.listQuery?'<a href="#/add/prompt" class="primary">添加第一条提示词</a>':'<button class="secondary" data-action="clear-filters">清除筛选</button>');
 const node=folderNode(kind,state.folder),groups=state.folder==='all'?catalogTree(kind):node?.children;
 if(groups?.length){const sections=groups.map(g=>{const values=items.filter(x=>inFolder(x,g));return values.length?`<section class="directory-group"><div class="section-heading"><h2>${esc(g.title)} <span class="group-count">${values.length}</span></h2><button class="text-button" data-folder="${g.key}">查看分类</button></div><div class="${kind==='website'?'website-grid':'cards-grid'}">${values.map(x=>card(x)).join('')}</div></section>`:'';}).join('');const ungrouped=items.filter(x=>!groups.some(g=>inFolder(x,g)));return sections+(ungrouped.length?`<section class="directory-group"><div class="section-heading"><h2>${esc(node?.title||'未分类')} <span class="group-count">${ungrouped.length}</span></h2></div><div class="${kind==='website'?'website-grid':'cards-grid'}">${ungrouped.map(x=>card(x)).join('')}</div></section>`:'');}
 return `<div class="${kind==='website'?'website-grid':'cards-grid'}">${items.map(x=>card(x)).join('')}</div>`;
}
function filtered(kind){
 const node=folderNode(kind,state.folder),query=state.listQuery.trim().toLowerCase(),service=state.backendMode&&state.serviceListSearch?.kind===kind&&state.serviceListSearch.q===query;let items=(service?state.serviceListSearch.items:state.items).filter(x=>x.kind===kind&&inFolder(x,node));
 if(kind==='ui'){if(['web','app'].includes(state.platform))items=items.filter(x=>x.platform===state.platform);if(['interactive','reference'].includes(state.view))items=items.filter(x=>x.displayType===state.view);}
 if(query&&!service)items=items.filter(x=>[x.title,x.description,...x.tags].join(' ').toLowerCase().includes(query));
 if(state.sort==='name')items.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
 return items;
}
function paginateCatalog(kind,items,requested=1){
 const size={website:24,ui:12,prompt:20}[kind]||24;
 const pages=Math.max(1,Math.ceil(items.length/size));
 const page=Math.min(pages,Math.max(1,Math.trunc(Number(requested))||1));
 const offset=(page-1)*size;
 return {items:items.slice(offset,offset+size),page,pages,total:items.length,start:items.length?offset+1:0,end:Math.min(offset+size,items.length)};
}
function catalogHash(page=state.page){
 const params=new URLSearchParams();
 if(state.folder!=='all')params.set('category',state.folder);
 if(state.listQuery.trim())params.set('q',state.listQuery.trim());
 if(state.route==='ui'){if(['web','app'].includes(state.platform))params.set('platform',state.platform);if(['interactive','reference'].includes(state.view))params.set('type',state.view);}
 if(state.sort==='name')params.set('sort','name');
 if(page>1)params.set('page',String(page));
 return '#/'+state.route+(params.size?'?'+params.toString():'');
}
function catalogCount(page){return page.total+' 个资源'+(page.pages>1?' · '+page.start+'–'+page.end:'');}
function catalogSearchPending(kind){const q=state.listQuery.trim().toLowerCase();return !!(state.backendMode&&q&&!(state.serviceListSearch?.kind===kind&&state.serviceListSearch.q===q));}
function catalogPageResults(kind,items){
 if(catalogSearchPending(kind))return '<p role="status">正在搜索完整资源…</p>';
 if(state.serviceListSearch?.kind===kind&&state.serviceListSearch.q===state.listQuery.trim().toLowerCase()&&state.serviceListSearch.error)return empty('搜索暂时不可用',state.serviceListSearch.error,'<button class="secondary" data-action="reload">重新载入</button>');
 const page=paginateCatalog(kind,items,state.page);state.page=page.page;
 return catalogResults(kind,page.items)+(page.pages>1?`<nav class="catalog-pagination" aria-label="资源分页"><button class="secondary" data-page="${page.page-1}" ${page.page===1?'disabled':''}>上一页</button><div>${Array.from({length:page.pages},(_,index)=>index+1).filter(n=>n===1||n===page.pages||Math.abs(n-page.page)<=1).map((n,index,values)=>(index&&n-values[index-1]>1?'<span class="page-gap" aria-hidden="true">…</span>':'')+`<button data-page="${n}" ${n===page.page?'aria-current="page"':''} aria-label="第 ${n} 页">${n}</button>`).join('')}</div><button class="secondary" data-page="${page.page+1}" ${page.page===page.pages?'disabled':''}>下一页</button></nav>`:'');
}
function listing(kind){
 const items=filtered(kind),node=folderNode(kind,state.folder),name=node?.title||label(kind),page=paginateCatalog(kind,items,state.page);if(!catalogSearchPending(kind))state.page=page.page;
 return `<div class="catalog-layout"><aside class="catalog-sidebar" aria-label="${label(kind)}分类导航">${categoryTree(kind)}</aside><section class="catalog-content">${node?`<nav class="catalog-breadcrumb" aria-label="分类路径"><button data-folder="all">${label(kind)}</button>${icon('chevron-right')}<span>${esc(node.title)}</span></nav>`:''}${heading(name,{website:'实用工具、AI 平台与素材入口，有序收纳。',ui:'导航、抽屉与控件，收集交互灵感。',prompt:'整理自己的提示词，留住有效的方法。'}[kind])}<div class="catalog-toolbar"><button class="secondary mobile-categories" data-action="categories">${icon('menu')}分类 ${icon('chevron-down')}</button><label class="catalog-search">${icon('search')}<input id="list-search" type="search" aria-label="在当前分类中搜索" value="${esc(state.listQuery)}" placeholder="在当前分类中搜索"></label>${kind==='ui'?'<label class="sort-label ui-filter"><select id="ui-platform-filter" aria-label="UI平台">'+[['全部','全部平台'],['app','APP'],['web','网页']].map(([value,name])=>'<option value="'+value+'" '+(state.platform===value?'selected':'')+'>'+name+'</option>').join('')+'</select></label><label class="sort-label ui-filter"><select id="ui-type-filter" aria-label="UI展示类型">'+[['全部','全部展示类型'],['interactive','可交互'],['reference','设计参考']].map(([value,name])=>'<option value="'+value+'" '+(state.view===value?'selected':'')+'>'+name+'</option>').join('')+'</select></label>':''}<label class="sort-label"><select id="sort-select" aria-label="资源排序"><option value="default" ${state.sort==='default'?'selected':''}>默认顺序</option><option value="name" ${state.sort==='name'?'selected':''}>名称排序</option></select></label></div><div class="results-meta"><span id="result-count" hidden>${catalogSearchPending(kind)?'正在搜索…':catalogCount(page)}</span>${node?'<button class="text-button" data-folder="all">查看全部分类</button>':''}</div><div id="listing-results">${catalogPageResults(kind,items)}</div></section></div>`;
}
function openCategoryDrawer(){
 const el=document.querySelector('#category-drawer');liveDeck.suspend();
 const body=state.route==='saved'?`<nav class="collection-drawer-menu">${['全部收藏','网站','UI','我的发布','私人资源','草稿','回收站'].map(t=>`<button data-collection="${t}" class="tree-item ${state.collection===t?'active':''}">${t}</button>`).join('')}</nav>`:categoryTree({websites:'website',ui:'ui',prompts:'prompt'}[state.route]);
 el.innerHTML=`<div class="dialog-head"><h2>选择分类</h2><button class="icon-btn" data-close="category-drawer" aria-label="关闭分类">${icon('x')}</button></div>${body}${state.route==='saved'?'':`<label class="drawer-sort">排序<select id="drawer-sort" aria-label="分类抽屉中的资源排序"><option value="default" ${state.sort==='default'?'selected':''}>默认顺序</option><option value="name" ${state.sort==='name'?'selected':''}>名称排序</option></select></label>`}`;el.showModal();
}
