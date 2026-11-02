(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const count=v=>Number.isFinite(v)?new Intl.NumberFormat('zh-CN').format(v):'不可用',date=v=>v?new Date(v).toLocaleString('zh-CN'):'尚未采集';
 const states={ok:'正常',normal:'正常',critical:'严重告警',warning:'容量提醒',limited:'已保护',manual_paused:'手动暂停',monitoring_error:'监控异常',stale:'过期',unavailable:'不可用',running:'处理中',error:'失败'};
 function mountCatalogOperations({root,client,onError=()=>{}}){
  let alive=true,busy=false,saving=false,epoch=0,timer=null,data=null,error='',dirty=false;
  function render(){
   if(!alive)return;
   if(dirty){const note=root.querySelector('[data-ops-status]');if(note)note.textContent=(error?'读取失败：'+error+'。':'')+'有未保存修改，暂缓更新显示；指标仍为上次读取值。可先保存或放弃修改。';return;}
   if(!data){root.innerHTML=`<p role="status">${error?esc(error):'正在读取监控快照…'}</p><button class="secondary" data-ops-refresh>重新读取</button>`;return;}
   const {capacity,usage,r2}=data,c=r2.config,p=c.sitePolicy,u=r2.usage;
   const card=(label,value,note='')=>`<article class="admin-widget"><span>${label}</span><strong>${count(value)}</strong><small>${esc(note)}</small></article>`;
   root.innerHTML=`<div class="section-heading"><h3>监控与容量</h3><button class="secondary" data-ops-refresh ${busy?'disabled':''}>刷新快照</button></div>
    <p class="muted">${esc(data.source)} · 本次读取 ${date(data.collectedAt)}。页面可见时每5分钟刷新。</p>
    <p role="status" class="ops-status ${error?'ops-stale':''}" data-ops-status>${error?'读取失败，上次数据已过期：'+esc(error):'读取完成；各指标新鲜度和来源分别列于下方。'}</p>
    <h3>本站业务计数</h3><div class="admin-widgets">${card('启用成员',capacity.memberActive,'来源：本站数据库')}${card('有效游客',capacity.guestOnline,'固定容量 '+capacity.guestLimit)}</div>
    <h3>Workers 与 D1</h3><p class="muted">${esc(states[usage.status]??usage.status)} · 采集 ${date(usage.collectedAt)} · 范围 ${usage.scope==='account'?'全账号':usage.scope==='site'?'本站':'未确认'}。${esc(usage.note)}。</p>
    <div class="admin-widgets">${card('Workers 请求',usage.values?.requests,'UTC当日分析快照')}${card('D1 读取行数',usage.values?.rowsRead,'含数据库扫描')}${card('D1 写入行数',usage.values?.rowsWritten,'含索引影响')}${card('本站数据库字节',usage.values?.databaseBytes,'账号数据库总存储未核实')}</div>
    <p class="muted">CPU、内存与错误率：未接入实际指标。配置存在不代表套餐和共享剩余额度已核实。</p>
    <h3>R2 存储与操作</h3><p class="muted">${r2.configured?'文件服务配置存在':'文件服务未配置'} · ${esc(states[u.status]??u.status)} · ${esc(states[r2.decision.state]??r2.decision.state)} · 采集 ${date(u.collectedAt)}。官方分析可能延迟；保守估计包含本地增量与预留。</p>
    <div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>指标</th><th>本站观察</th><th>全账号观察</th><th>本站保守估计</th><th>站点上限</th></tr></thead><tbody>${[['storageBytes','存储字节'],['classA','A类操作'],['classB','B类操作']].map(([key,label])=>`<tr><th>${label}</th><td>${count(u.official?.[key])}</td><td>${count(u.account?.[key])}</td><td>${count(u.protectionEstimate?.[key])}</td><td>${count(c.limits[key])}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted">存储按字节控制；官方计费含 GB-month 和账号其他应用，不保证零账单。${p.enabled?'已启用新版容量策略。':'当前保留旧保护线；保存以下表单后启用新版容量策略。'}</p>
    <details><summary>配置全站容量策略</summary><form data-storage-policy data-version="${p.version}">
     <label class="field">全站存储上限（字节）<input name="storageLimit" type="number" required min="1" max="10000000000" value="${c.limits.storageBytes}"></label>
     <div class="ops-form-grid"><label class="field">提醒阈值（%）<input name="warningPercent" type="number" min="1" max="98" required value="${p.warningPercent}"></label><label class="field">严重阈值（%）<input name="criticalPercent" type="number" min="2" max="99" required value="${p.criticalPercent}"></label></div>
     <label class="field">站点满额时<select name="fullPolicy"><option value="all" ${p.fullPolicy==='all'?'selected':''}>所有角色停止新增上传（默认）</option><option value="members" ${p.fullPolicy==='members'?'selected':''}>仅普通成员停止新增上传</option></select></label>
     <label class="field">每日文件操作保护值<input name="dailyOperationLimit" type="number" min="1" max="1000000" required value="${p.dailyOperationLimit}"></label>
     <p class="muted">100%为站点满额。保留读取、非增量编辑和删除；管理员仍受账号额度、监控、权限和人工开关限制。每日操作值是应用保护，不是官方配额，未核实余量前不要提高。</p>
     <button class="primary" type="submit" ${saving?'disabled':''}>保存容量策略</button><button class="secondary" type="button" data-ops-reset>放弃未保存修改并刷新</button></form></details>
    <h3>定时维护</h3>${data.jobs.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>工作组</th><th>状态</th><th>最近成功</th></tr></thead><tbody>${data.jobs.map(j=>`<tr><th>${esc(({security:'安全撤销与安全通知',notifications:'站内与业务通知',metrics:'官方用量与状态',cleanup:'有界清理'})[j.name]??j.name)}</th><td>${esc(states[j.status]??j.status)}</td><td>${date(j.lastSuccess)}</td></tr>`).join('')}</tbody></table></div>`:'<p>尚无任务执行记录。</p>'}
    <h3>异常与恢复</h3>${(data.alerts??[]).map(a=>`<p>${date(a.createdAt)} · ${esc(a.summary)}</p>`).join('')||'<p>暂无已记录异常。</p>'}
    <p class="muted">${esc(data.externalMonitor.status)}。本站定时任务不能保证在完全停站时发出通知。</p>`;
  }
  async function load(){if(!alive||busy||saving||document.hidden)return;busy=true;const own=++epoch;try{const value=await client.operations();if(!alive||own!==epoch)return;data=value;error='';}catch(e){if(!alive||own!==epoch)return;error=e.message;onError(e);}finally{busy=false;if(alive&&own===epoch)render();}}
  function visible(){clearInterval(timer);timer=null;if(alive&&!document.hidden){load();timer=setInterval(load,300000);}}
  function changed(e){if(e.target.closest('[data-storage-policy]'))dirty=true;}
  function click(e){if(e.target.closest('[data-ops-reset]')){e.preventDefault();dirty=false;render();load();return;}if(e.target.closest('[data-ops-refresh]')){e.preventDefault();load();}}
  async function submit(e){if(!e.target.matches('[data-storage-policy]'))return;e.preventDefault();e.stopPropagation();if(saving||busy||!data)return;const f=e.target,version=Number(f.dataset.version),payload={version,...Object.fromEntries(['storageLimit','warningPercent','criticalPercent','dailyOperationLimit'].map(k=>[k,Number(f.elements[k].value)])),fullPolicy:f.elements.fullPolicy.value};saving=true;const own=epoch;f.querySelector('button[type=submit]').disabled=true;try{await client.saveStoragePolicy(payload);if(!alive||own!==epoch)return;error='';dirty=false;}catch(e){if(alive&&own===epoch){error=e.message;onError(e);}}finally{saving=false;if(alive&&own===epoch){f.querySelector('button[type=submit]').disabled=false;if(error)render();else await load();}}}
  root.addEventListener('input',changed);root.addEventListener('change',changed);root.addEventListener('click',click);root.addEventListener('submit',submit);document.addEventListener('visibilitychange',visible);render();visible();
  return {destroy(){alive=false;epoch++;clearInterval(timer);root.removeEventListener('input',changed);root.removeEventListener('change',changed);root.removeEventListener('click',click);root.removeEventListener('submit',submit);document.removeEventListener('visibilitychange',visible);root.replaceChildren();data=null;}};
 }
 window.mountCatalogOperations=mountCatalogOperations;
})();
