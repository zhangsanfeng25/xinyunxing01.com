(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const count=v=>Number.isFinite(v)?new Intl.NumberFormat('zh-CN').format(v):'不可用',date=v=>v?new Date(v).toLocaleString('zh-CN'):'尚未采集';
 const states={ok:'正常',normal:'正常',critical:'严重告警',warning:'容量提醒',limited:'已保护',manual_paused:'手动暂停',monitoring_error:'监控异常',stale:'过期',unavailable:'不可用',running:'处理中',error:'失败'};
 const jobNames={security:'安全撤销与安全通知',notifications:'站内与业务通知',metrics:'官方用量与状态',cleanup:'例行清理'};
 const number=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1});
 function bytes(value){
  if(!Number.isFinite(value))return '不可用';
  if(value>=1e9)return number.format(value/1e9)+' GB';
  if(value>=1e6)return number.format(value/1e6)+' MB';
  if(value>=1e3)return number.format(value/1e3)+' KB';
  return count(value)+' B';
 }
 const ratio=(value,limit)=>Number.isFinite(value)&&value>=0&&Number.isFinite(limit)&&limit>0?Math.round(1000*value/limit)/10:null;
 function mark(state){
  const tone=['ok','normal'].includes(state)?'ok':['critical','monitoring_error','error'].includes(state)?'danger':['warning','stale','limited'].includes(state)?'warning':'neutral';
  return `<span class="admin-state admin-state--${tone}">${esc(states[state]??state??'不可用')}</span>`;
 }
 function meter(label,value,limit,accent,format){
  const percent=ratio(value,limit);
  return `<div class="ops-meter" data-accent="${accent}"><div class="ops-meter-label"><strong>${label}</strong><span>${percent===null?'暂无估算':format(value)+' / '+format(limit)+' · '+percent+'%'}</span></div>
   ${percent===null?'':'<div class="ops-meter-track" aria-hidden="true"><span style="--meter-fill:'+Math.min(percent,100)+'%"></span></div>'}</div>`;
 }
 function mountCatalogOperations({root,client,onError=()=>{}}){
  let alive=true,busy=false,saving=false,epoch=0,timer=null,data=null,error='',saveError='',dirty=false,shown=false;
  function render(){
   if(!alive)return;
   if(dirty){
    const note=root.querySelector('[data-ops-status]');
    if(note)note.textContent=(saveError?'保存失败：'+saveError+'。':error?'读取失败：'+error+'。':'')+'有未保存修改，指标保留在编辑前的快照。';
    return;
   }
   if(!data){
    root.innerHTML=error?`<section class="admin-surface admin-surface--padded"><p role="status">${esc(error)}</p><button type="button" class="secondary" data-ops-refresh>重试</button></section>`:'<div class="ui-skeleton admin-loading" role="status"><span class="ui-visually-hidden">正在读取监控快照…</span></div>';
    return;
   }
   const policyOpen=root.querySelector('[data-storage-details]')?.open;
   const evidenceOpen=root.querySelector('[data-ops-evidence]')?.open;
   const {capacity,usage,r2}=data,c=r2.config,p=c.sitePolicy,u=r2.usage;
   const scope=usage.scope==='account'?'全账号':usage.scope==='site'?'本站':'范围未确认';
   const storage=ratio(u.protectionEstimate?.storageBytes,c.limits.storageBytes);
   const value=(key,n)=>key==='storageBytes'?bytes(n):count(n);
   const resources=[['storageBytes','存储空间','blue'],['classA','A 类操作','violet'],['classB','B 类操作','green']];
   const metrics=[
    ['启用成员',count(capacity.memberActive),'本站数据库','blue'],
    ['有效游客',count(capacity.guestOnline)+' / '+count(capacity.guestLimit),'本站固定容量','green'],
    ['Workers 请求',count(usage.values?.requests),scope+' · UTC 当日','violet'],
    ['R2 站点用量',storage===null?'不可用':storage+'%','存储保护估算 / 站点上限','amber']
   ];
   const workers=[['requests','Workers 请求',scope],['rowsRead','D1 读取行数',scope],['rowsWritten','D1 写入行数',scope],['databaseBytes','数据库存储','本站数据库']];
   const animate=shown?'':'data-ops-enter';
   shown=true;
   root.innerHTML=`<div class="ops-snapshot"><p>${esc(data.source)} · 读取 ${date(data.collectedAt)}</p><button type="button" class="secondary" data-ops-refresh>刷新快照</button></div>
    <p role="status" class="ops-status ${error?'ops-stale':''}" data-ops-status>${error?'读取失败，显示上次快照（过期）：'+esc(error):''}</p>
    <div class="admin-kpis">${metrics.map(([label,value,note,accent])=>`<article class="admin-kpi" data-accent="${accent}"><h3>${label}</h3><strong>${value}</strong><small>${note}</small></article>`).join('')}</div>
    <div class="admin-analysis">
     <section class="admin-surface admin-surface--padded"><div class="ops-panel-heading"><h3>R2 容量与保护线</h3>${mark(r2.decision.state)}</div>
      <p class="admin-caption">本站保护估算 · ${mark(u.status)} · 采集 ${date(u.collectedAt)}</p>
      <div class="ops-meters" ${animate}>${resources.map(([key,label,accent])=>meter(label,u.protectionEstimate?.[key],c.limits[key],accent,n=>value(key,n))).join('')}</div>
      ${p.enabled?`<p class="admin-caption">提醒线 ${count(p.warningPercent)}% · 严重阈值 ${count(p.criticalPercent)}%</p>`:''}
      <details data-ops-evidence ${evidenceOpen?'open':''}><summary>查看观测数据与上限</summary><div class="admin-table-region" role="region" aria-label="R2 观测数据" tabindex="0"><table class="admin-data-table"><thead><tr><th scope="col">指标</th><th scope="col">本站观察</th><th scope="col">全账号观察</th><th scope="col">本站保守估计</th><th scope="col">站点上限</th></tr></thead><tbody>${resources.map(([key,label])=>`<tr><th scope="row">${label}</th><td>${value(key,u.official?.[key])}</td><td>${value(key,u.account?.[key])}</td><td>${value(key,u.protectionEstimate?.[key])}</td><td>${value(key,c.limits[key])}</td></tr>`).join('')}</tbody></table></div><p class="admin-caption">官方分析可能延迟。保护估算包含本地增量和预留。计费用量以 Cloudflare 账单为准。</p></details>
    <details class="ops-policy" data-storage-details ${policyOpen?'open':''}><summary>全站容量策略</summary>
     <p class="admin-caption">${r2.configured?'文件服务已配置':'文件服务未配置'} · ${p.enabled?'新版容量策略已启用':'当前使用旧保护线，保存后启用新版容量策略'}</p>
     <form data-storage-policy data-version="${p.version}">
     <label class="field">全站存储上限（字节）<input name="storageLimit" type="number" required min="1" max="10000000000" value="${c.limits.storageBytes}"></label>
     <div class="ops-form-grid"><label class="field">提醒阈值（%）<input name="warningPercent" type="number" min="1" max="98" required value="${p.warningPercent}"></label><label class="field">严重阈值（%）<input name="criticalPercent" type="number" min="2" max="99" required value="${p.criticalPercent}"></label></div>
     <label class="field">站点满额时<select name="fullPolicy"><option value="all" ${p.fullPolicy==='all'?'selected':''}>所有角色停止新增上传（默认）</option><option value="members" ${p.fullPolicy==='members'?'selected':''}>仅普通成员停止新增上传</option></select></label>
     <label class="field">每日文件操作保护值<input name="dailyOperationLimit" type="number" min="1" max="1000000" required value="${p.dailyOperationLimit}"></label>
     <p class="muted">100%为站点满额。保留读取、非增量编辑和删除；管理员仍受账号额度、监控、权限和人工开关限制。每日操作值是应用保护，不是官方配额，未核实余量前不要提高。</p>
     <div class="form-actions"><button class="primary" type="submit" ${saving?'disabled':''}>保存容量策略</button><button class="secondary" type="button" data-ops-reset>放弃修改</button></div></form></details>
     </section>
     <section class="admin-surface"><div class="ops-panel-heading admin-surface--padded"><div><h3>Workers 与 D1</h3><p class="admin-caption">采集 ${date(usage.collectedAt)}</p></div>${mark(usage.status)}</div>
      <div class="admin-table-region" role="region" aria-label="Workers 与 D1 指标" tabindex="0"><table class="admin-data-table"><thead><tr><th scope="col">指标</th><th scope="col">读数</th><th scope="col">统计范围</th></tr></thead><tbody>${workers.map(([key,label,source])=>`<tr><th scope="row">${label}</th><td>${key==='databaseBytes'?bytes(usage.values?.[key]):count(usage.values?.[key])}</td><td>${source}</td></tr>`).join('')}</tbody></table></div>
      <p class="admin-caption admin-table-note">${esc(usage.note)}</p></section></div>
    <section class="admin-surface admin-surface--padded"><h3>运行状态</h3>
     ${data.jobs.length?`<ul class="ops-job-grid">${data.jobs.map(job=>`<li><strong>${esc(jobNames[job.name]??job.name)}</strong>${mark(job.status)}<small>最近成功 ${date(job.lastSuccess)}</small></li>`).join('')}</ul>`:'<p class="admin-empty">尚无任务执行记录。</p>'}
     <p class="admin-caption">${esc(data.externalMonitor.status)}</p>
     ${data.alerts?.length?`<details><summary>异常与恢复（${data.alerts.length}）</summary><ul class="ops-alerts">${data.alerts.map(alert=>`<li><time>${date(alert.createdAt)}</time> ${esc(alert.summary)}</li>`).join('')}</ul></details>`:''}</section>
    `;
  }
  async function load(){if(!alive||busy||saving||document.hidden)return;busy=true;const own=++epoch;try{const value=await client.operations();if(!alive||own!==epoch)return;data=value;error='';}catch(e){if(!alive||own!==epoch)return;error=e.message;onError(e);}finally{busy=false;if(alive&&own===epoch)render();}}
  function visible(){clearInterval(timer);timer=null;if(alive&&!document.hidden){load();timer=setInterval(load,300000);}}
  function changed(e){if(e.target.closest('[data-storage-policy]'))dirty=true;}
  function click(e){if(e.target.closest('[data-ops-reset]')){e.preventDefault();dirty=false;render();load();return;}if(e.target.closest('[data-ops-refresh]')){e.preventDefault();load();}}
  async function submit(e){if(!e.target.matches('[data-storage-policy]'))return;e.preventDefault();e.stopPropagation();if(saving||!data)return;if(busy){const status=root.querySelector('[data-ops-status]');if(status)status.textContent='正在刷新，请稍后保存。';return;}const f=e.target,version=Number(f.dataset.version),payload={version,...Object.fromEntries(['storageLimit','warningPercent','criticalPercent','dailyOperationLimit'].map(k=>[k,Number(f.elements[k].value)])),fullPolicy:f.elements.fullPolicy.value};saving=true;saveError='';const own=epoch;f.querySelector('button[type=submit]').disabled=true;try{await client.saveStoragePolicy(payload);if(!alive||own!==epoch)return;error='';dirty=false;}catch(e){if(alive&&own===epoch){saveError=e.message;onError(e);}}finally{saving=false;if(alive&&own===epoch){f.querySelector('button[type=submit]').disabled=false;if(saveError)render();else await load();}}}
  root.addEventListener('input',changed);root.addEventListener('change',changed);root.addEventListener('click',click);root.addEventListener('submit',submit);document.addEventListener('visibilitychange',visible);render();visible();
  return {destroy(){alive=false;epoch++;clearInterval(timer);root.removeEventListener('input',changed);root.removeEventListener('change',changed);root.removeEventListener('click',click);root.removeEventListener('submit',submit);document.removeEventListener('visibilitychange',visible);root.replaceChildren();data=null;}};
 }
 window.mountCatalogOperations=mountCatalogOperations;
})();
