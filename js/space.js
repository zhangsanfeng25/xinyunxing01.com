(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const welcome = $('welcome'), workspace = $('workspace'), card = document.querySelector('.login-card'), dialog = $('content-dialog');
  const items = [];
  document.documentElement.classList.add('js');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {card.classList.add('revealed'); observer.disconnect();}
    }, {threshold: .12}); observer.observe(card);
  } else card.classList.add('revealed');
  function concealPassword() {
    $('password').type = 'password'; $('toggle-password').textContent = '显示';
    $('toggle-password').setAttribute('aria-label', '显示密码'); $('toggle-password').setAttribute('aria-pressed', 'false');
  }
  $('toggle-password').addEventListener('click', () => {
    const visible = $('password').type === 'password'; $('password').type = visible ? 'text' : 'password';
    $('toggle-password').textContent = visible ? '隐藏' : '显示';
    $('toggle-password').setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
    $('toggle-password').setAttribute('aria-pressed', String(visible));
  });
  function setView(view, focus = false) {
    const home = view === 'home'; $('page-title').textContent = home ? '首页' : '内容';
    $('page-description').textContent = home ? '在这里浏览与整理你的内容。' : '查看当前页面中的全部临时内容。';
    document.querySelectorAll('[data-view]').forEach(tab => {
      const active = tab.dataset.view === view; tab.classList.toggle('active', active);
      if (active) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
    });
    document.title = `${home ? '首页' : '内容'} · 演示模式 | xinyunxing01.com`;
    if (focus) $('page-title').focus({preventScroll: true});
  }
  $('login-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!$('account').value.trim() || !$('password').value.trim()) {$('login-message').textContent = '请输入任意非空账号和演示密码。'; return;}
    // Only a demo UI transition. Credentials never enter storage, URLs or network requests.
    $('login-form').reset(); concealPassword(); $('login-message').textContent = '';
    welcome.hidden = true; workspace.hidden = false; setView('home');
    window.scrollTo({top: 0, behavior: 'instant'}); $('page-title').focus({preventScroll: true});
  });
  // Disabled in source HTML so script failure cannot submit the form.
  $('enter-space').disabled = false;
  document.querySelectorAll('[data-view]').forEach(tab => tab.addEventListener('click', () => setView(tab.dataset.view, true)));
  $('brand-home').addEventListener('click', event => {event.preventDefault(); setView('home', true);});
  function clearItems() {items.forEach(item => {if (item.image) URL.revokeObjectURL(item.image);}); items.length = 0; $('search').value = ''; render();}
  $('logout').addEventListener('click', () => {
    if (dialog.open) dialog.close(); $('content-form').reset(); clearItems();
    workspace.hidden = true; welcome.hidden = false; window.scrollTo({top: 0, behavior: 'instant'});
    document.querySelector('.nav-login').focus({preventScroll: true}); document.title = '我的空间 | xinyunxing01.com';
  });
  function openComposer() {$('content-form').reset(); $('content-message').textContent = ''; dialog.showModal();}
  $('add-content').addEventListener('click', openComposer); $('empty-add').addEventListener('click', openComposer);
  $('close-dialog').addEventListener('click', () => dialog.close());
  $('content-form').addEventListener('submit', event => {
    event.preventDefault(); const title = $('content-name').value.trim(), file = $('content-image').files[0];
    if (!title) {$('content-message').textContent = '请填写标题。'; return;}
    if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5*1024*1024)) {$('content-message').textContent = '请选择 5 MB 以内的 JPG、PNG 或 WebP 图片。'; return;}
    items.push({title, text: $('content-text').value.trim(), image: file ? URL.createObjectURL(file) : null});
    $('search').value = ''; render(); dialog.close(); $('content-form').reset();
  });
  function render() {
    const query = $('search').value.trim().toLocaleLowerCase();
    const filtered = items.filter(item => `${item.title} ${item.text}`.toLocaleLowerCase().includes(query));
    $('content-grid').replaceChildren();
    filtered.forEach(item => {
      const article = document.createElement('article'); article.className = 'content-item';
      if (item.image) {const img = document.createElement('img'); img.src = item.image; img.alt = item.title; img.loading = 'lazy'; article.append(img);}
      const copy = document.createElement('div'); copy.className = 'item-copy';
      const label = document.createElement('p'); label.className = 'item-label'; label.textContent = '临时预览';
      const heading = document.createElement('h3'); heading.textContent = item.title;
      const text = document.createElement('p'); text.textContent = item.text;
      copy.append(label, heading, text); article.append(copy); $('content-grid').append(article);
    });
    $('empty-state').hidden = filtered.length > 0;
    $('empty-title').textContent = query ? '没有找到相关内容' : '让空间从第一份内容开始';
    $('empty-description').textContent = query ? '换一个关键词试试，或添加一份临时内容。' : '添加一段文字或一张图片，预览你的内容展示。';
    $('empty-add').hidden = !!query;
    $('result-status').textContent = items.length ? `共 ${items.length} 份临时内容${query ? `，找到 ${filtered.length} 份` : ''} · 刷新或退出后清空` : '';
  }
  $('search').addEventListener('input', render); window.addEventListener('pagehide', clearItems);
})();
