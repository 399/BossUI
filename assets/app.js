(() => {
  'use strict';
  const docs = (window.BOSSUI_CONTENT || {documents:[]}).documents;
  const e = BossMarkdown.escape;
  const sections = {foundations:'基础样式',guidelines:'设计规范',templates:'模板'};
  const main = document.getElementById('main-content');
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${({arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',chevron:'<path d="m9 5 7 7-7 7"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',file:'<path d="M14 3H5v18h14V8zM14 3v6h5M8 13h8M8 17h6"/>'})[name] || ''}</svg>`;
  let currentDoc = null, toastTimer, searchIndex = -1;
  const toast = text => {const target = document.getElementById('toast'); clearTimeout(toastTimer); target.textContent = text; target.hidden = false; toastTimer = setTimeout(() => target.hidden = true,4000);};
  function docLink(doc) {return '#/doc/' + doc.id;}
  function groups(current = '') {
    return Object.entries(sections).map(([key,title]) => `<section class="sidebar-group"><h2><a href="#${key}"${current === key ? ' aria-current="page"' : ''}>${title}</a></h2>${docs.filter(doc=>doc.section === key).map(doc => `<a href="${docLink(doc)}"${current === 'doc:' + doc.id ? ' aria-current="page"' : ''}>${e(doc.title)}</a>`).join('')}</section>`).join('');
  }
  function sidebar(current) {return `<aside class="docs-sidebar" aria-label="文档目录"><nav>${groups(current)}</nav></aside>`;}
  function updateTop(section) {
    document.querySelectorAll('.top-nav a').forEach(link => {if (link.dataset.section === section) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');});
    document.getElementById('mobile-menu').innerHTML = '<a href="#home">首页</a>' + groups(currentDoc ? 'doc:' + currentDoc.id : section);
    document.getElementById('mobile-menu').hidden = true;
    document.getElementById('mobile-menu-trigger').setAttribute('aria-expanded','false');
  }
  function home() {
    currentDoc = null; updateTop('home'); document.title = 'BossUI · 内部 SaaS 设计规范';
    main.innerHTML = `<div class="home"><header class="hero"><h1>BossUI</h1><p>内部 SaaS 设计规范</p></header><nav class="entry-grid" aria-label="内容入口">${Object.entries(sections).map(([key,title])=>`<a class="entry-card" href="#${key}"><span>${title}</span>${icon('arrow')}</a>`).join('')}</nav><section class="home-docs" aria-label="设计规范">${docs.map(doc=>`<a class="overview-item" href="${docLink(doc)}"><h2>${e(doc.title)}</h2>${icon('arrow')}</a>`).join('')}</section></div>`;
  }
  function overview(key) {
    const items = docs.filter(doc=>doc.section===key);
    currentDoc = null; updateTop(key); document.title = sections[key] + ' · BossUI';
    main.innerHTML = `<div class="docs-shell">${sidebar(key)}<article class="doc-main"><nav class="breadcrumb" aria-label="面包屑"><a href="#home">首页</a>${icon('chevron')}<span>${sections[key]}</span></nav><header class="doc-header"><h1>${sections[key]}</h1></header>${items.length ? `<div class="overview-list">${items.map(doc=>`<a class="overview-item" href="${docLink(doc)}"><h2>${e(doc.title)}</h2>${icon('arrow')}</a>`).join('')}</div>` : '<p class="empty-content">暂无内容</p>'}</article></div>`;
  }
  function resolveLink(link, doc) {
    if (link.startsWith('#/doc/')) return link;
    if (link.startsWith('#') && !['#home','#foundations','#guidelines','#templates'].includes(link)) return `${docLink(doc)}?section=${encodeURIComponent(link.slice(1).replace(/^md-/,''))}`;
    if (/\.md(?:#.*)?$/i.test(link)) {
      const [path,anchor] = link.split('#');
      if (/^[a-z][a-z0-9+.-]*:|^\/|[\\%?\u0000-\u0020\u007f]/i.test(path) || path.split('/').includes('..')) return '#/not-found';
      const parts = doc.file.split('/').slice(0,-1);
      for (const part of path.split('/')) {if (part && part !== '.') parts.push(part);}
      const resolved = parts.join('/');
      const match = docs.find(item => item.file === resolved || item.file === path);
      if (match) return docLink(match) + (anchor ? '?section=' + encodeURIComponent(anchor.replace(/^md-/,'')) : '');
      // Only this document's explicitly registered original is a local resource, not a route.
      if (doc.sourceFile && resolved === doc.sourceFile && /^docs\//.test(resolved)) return './' + resolved + (anchor ? '#' + encodeURIComponent(anchor) : '');
      return '#/not-found';
    }
    return /^(https?:|mailto:|#)/i.test(link) ? link : '#/not-found';
  }
  function documentPage(doc, anchor) {
    currentDoc = doc; updateTop(doc.section); document.title = doc.title + ' · BossUI';
    const rendered = BossMarkdown.render(doc.markdown,{resolveLink:link=>resolveLink(link,doc)});
    const body = rendered.html.replace(/^<h1\b[^>]*>[\s\S]*?<\/h1>\s*/, '');
    main.innerHTML = `<div class="docs-shell">${sidebar('doc:' + doc.id)}<article class="doc-main"><nav class="breadcrumb" aria-label="面包屑"><a href="#${doc.section}">${sections[doc.section]}</a>${icon('chevron')}<span>${e(doc.title)}</span></nav><header class="doc-header"><h1>${e(doc.title)}</h1><div class="doc-actions"><button class="button" data-doc-copy="${doc.id}">${icon('copy')} 复制 Markdown</button><button class="button" data-doc-download="${doc.id}">${icon('download')} 下载 Markdown</button><button class="button quiet" data-doc-source="${doc.id}">查看源码 ↗</button></div></header><div class="prose" id="document-body">${body}</div></article></div>`;
    if (anchor) scrollToSection(anchor);
  }
  function scrollToSection(anchor) {
    const target = document.getElementById(anchor) || document.getElementById('md-' + anchor);
    if (!target) {toast('未找到该章节，已保留文档页面。'); return;}
    requestAnimationFrame(()=>{target.scrollIntoView({block:'start'}); target.setAttribute('tabindex','-1'); target.focus({preventScroll:true});});
  }
  function missing() {
    currentDoc = null; updateTop(''); document.title = '页面不存在 · BossUI';
    main.innerHTML = '<section class="not-found"><h1>页面不存在</h1><p>可以返回首页，或搜索需要的规范。</p><div class="row centered"><a class="button primary" href="#home">返回首页</a><button class="button" data-open-search>搜索规范</button></div></section>';
  }
  function route() {
    const hash = location.hash || '#home';
    if (hash === '#main-content') {main.focus(); return;}
    const match = hash.match(/^#\/doc\/([a-z0-9-]+)(?:\?section=(.*))?$/);
    let anchor = '';
    try {anchor = match?.[2] ? decodeURIComponent(match[2]) : '';} catch (_) {missing(); return;}
    if (hash === '#home' || hash === '#/' || hash === '#') home();
    else if (Object.hasOwn(sections,hash.slice(1))) overview(hash.slice(1));
    else if (match) {const doc = docs.find(item=>item.id === match[1]); doc ? documentPage(doc,anchor) : missing();}
    else missing();
    if (!anchor) window.scrollTo(0,0);
  }
  async function copyDoc(doc) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(doc.markdown);
      else throw new Error('Clipboard API unavailable');
      toast('已复制完整 Markdown。');
    } catch (_) {
      const textarea = document.createElement('textarea'); textarea.value = doc.markdown; textarea.setAttribute('aria-label','待复制的 Markdown');
      textarea.style.cssText='position:fixed;left:-9999px;top:0';
      const previous = document.activeElement, host = document.querySelector('dialog[open]') || document.body;
      host.append(textarea); textarea.select(); let success = false;
      try {success = document.execCommand('copy');} catch (_) {success = false;}
      textarea.remove(); previous?.focus();
      if (success) toast('已复制完整 Markdown。');
      else {showMarkdown(doc); toast('浏览器未允许复制，请在源码区手动选择复制。');}
    }
  }
  function downloadDoc(doc) {
    const url = URL.createObjectURL(new Blob([doc.markdown],{type:'text/markdown;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = doc.file.split('/').pop(); document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('已创建 Markdown 下载。');
  }
  function showMarkdown(doc = null) {
    const dialog = document.getElementById('markdown-dialog'), body = document.getElementById('markdown-body');
    document.getElementById('markdown-title').textContent = doc ? doc.title + ' · Markdown' : 'Markdown 源文档';
    if (doc) {
      body.innerHTML = `<p class="muted">${e(doc.file)}</p><div class="doc-actions"><button class="button primary" data-doc-copy="${doc.id}">${icon('copy')} 复制全文</button><button class="button" data-doc-download="${doc.id}">${icon('download')} 下载 .md</button><button class="button quiet" data-source-index>全部文档</button></div><pre class="markdown-source" tabindex="0"></pre>`;
      body.querySelector('pre').textContent = doc.markdown;
    } else body.innerHTML = `<div class="markdown-file-list">${docs.map(item=>`<div class="markdown-file-item"><div><button class="button quiet small" data-doc-source="${item.id}">${e(item.title)}</button><small>${e(item.file)}</small></div><button class="button small" data-doc-download="${item.id}" aria-label="下载${e(item.title)} Markdown">${icon('download')} .md</button></div>`).join('')}</div>`;
    if (!dialog.open) dialog.showModal();
  }
  const search = document.getElementById('search-dialog');
  const searchInput = document.getElementById('search-input');
  function renderSearch() {
    const term = searchInput.value.trim().toLocaleLowerCase();
    const found = docs.filter(doc => !term || (doc.title + ' ' + doc.markdown).toLocaleLowerCase().includes(term));
    document.getElementById('search-results').innerHTML = found.length ? `<p class="search-group-label">${term ? `找到 ${found.length} 篇文档` : '设计规范'}</p>${found.map(doc=>`<a class="search-result" href="${docLink(doc)}">${icon('file')}<strong>${e(doc.title)}</strong><span aria-hidden="true">↵</span></a>`).join('')}` : '<div class="search-empty" role="status">没有找到相关规范</div>';
    searchIndex = -1;
  }
  function openSearch() {searchInput.value=''; renderSearch(); if(!search.open) search.showModal(); searchInput.focus();}
  searchInput.addEventListener('input',renderSearch);
  search.addEventListener('keydown',event => {
    const links = Array.from(search.querySelectorAll('.search-result'));
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!links.length) return; event.preventDefault(); searchIndex = (searchIndex + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((link,index)=>link.classList.toggle('focused',index === searchIndex)); links[searchIndex].scrollIntoView({block:'nearest'});
    } else if (event.key === 'Enter' && event.target === searchInput && links.length) {event.preventDefault(); links[Math.max(0,searchIndex)].click();}
  });
  search.addEventListener('click',event => {if(event.target.closest('.search-result')) search.close();});
  document.addEventListener('keydown',event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {event.preventDefault(); if (!document.querySelector('dialog[open]') || search.open) openSearch();}
  });
  document.addEventListener('click',event => {
    const close = event.target.closest('[data-close-dialog]'); if(close) close.closest('dialog').close();
    const button = event.target.closest('[data-doc-copy],[data-doc-download],[data-doc-source],[data-source-index],[data-open-search]');
    if(button) {
      if(button.hasAttribute('data-source-index')) showMarkdown();
      else if(button.hasAttribute('data-open-search')) openSearch();
      else {const id = button.dataset.docCopy || button.dataset.docDownload || button.dataset.docSource, doc = docs.find(item=>item.id === id); if(!doc) {toast('未找到文档。'); return;}
        if(button.hasAttribute('data-doc-copy')) copyDoc(doc); else if(button.hasAttribute('data-doc-download')) downloadDoc(doc); else showMarkdown(doc);}
    }
  });
  document.getElementById('open-search').addEventListener('click',openSearch);
  document.getElementById('open-markdown').addEventListener('click',()=>showMarkdown(currentDoc));
  document.getElementById('mobile-menu-trigger').addEventListener('click',event => {const menu = document.getElementById('mobile-menu'); menu.hidden = !menu.hidden; event.currentTarget.setAttribute('aria-expanded',String(!menu.hidden));});
  document.getElementById('mobile-menu').addEventListener('click',event=>{if(event.target.closest('a')) {document.getElementById('mobile-menu').hidden=true; document.getElementById('mobile-menu-trigger').setAttribute('aria-expanded','false');}});
  window.addEventListener('hashchange',route);
  route();
})();
