'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '..');
const md = require('../assets/markdown.js');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const contentContext = {window:{}};
vm.runInNewContext(read('assets/content.js'),contentContext);
const content = contentContext.window.BOSSUI_CONTENT;

test('Markdown raw HTML and code are escaped',()=>{const html=md.render('<img src=x onerror=alert(1)>\n\n```html\n<script>alert(1)</script>\n```').html; assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);});
test('Markdown dangerous protocols never become links',()=>{for(const url of ['javascript:alert','data:text/html,test','vbscript:msgbox','//example.com','/absolute','file:///secret']) {assert.equal(md.safeURL(url),null);assert.ok(!md.inline(`[click](${url})`).includes('<a '));}});
test('Markdown safe links escape attribute content',()=>{const html=md.inline('[external](https://example.com?q="x")');assert.match(html,/&quot;/);assert.match(html,/noopener noreferrer/);});
test('Markdown links to the retained document are supported',()=>assert.match(md.inline('[时间](#/doc/time)'),/href="#\/doc\/time"/));
test('Markdown supports table and inline text',()=>{const html=md.render('# 标题\n\n正文 **重要** 与 `code`。\n\n| 名称 | 值 |\n| --- | --- |\n| 内容 | 1 |').html; for(const tag of ['h1','p','strong','code','table','th','td']) assert.ok(html.includes('<'+tag),tag);});
test('Markdown heading ids are stable and unique',()=>assert.deepEqual(md.render('## 时间\n## 时间').headings.map(x=>x.id),['md-时间','md-时间-2']));
test('code text is not parsed as markup',()=>assert.equal(md.inline('`**raw**`'),'<code>**raw**</code>'));
test('manifest and bundle contain exactly the two authorized display sources',()=>{
  const manifest=JSON.parse(read('docs/manifest.json'));
  assert.deepEqual(manifest.documents.map(doc=>doc.id),['time','search']);
  assert.equal(content.documents.length,2);
  for (const [index, doc] of manifest.documents.entries()) assert.deepEqual(JSON.parse(JSON.stringify(content.documents[index])),{...doc,markdown:read(doc.file)});
  assert.equal(content.documents[1].sourceFile,'docs/后台列表搜索能力设计标准.md');
});
test('original attachment remains byte-identical and is not a third article',()=>{
  const original=fs.readFileSync(path.join(root,'docs/后台列表搜索能力设计标准.md'));
  assert.equal(original.length,7675);
  assert.equal(createHash('sha256').update(original).digest('hex'),'e75307ed2b05615356115adbd892f3f7f1ede790070d98941d5057b9665f0eb5');
  assert.ok(content.documents.every(doc=>doc.file !== 'docs/后台列表搜索能力设计标准.md'));
  assert.doesNotMatch(content.documents[1].markdown,/## 7\. Agent 执行流程|## 6\. 已确认的页面决策样例/);
});
test('time source is exactly the confirmed table and calculation paragraph without provenance',()=>{
  const expected = '# 通知时间展示规则\n\n' + [
    '| 实际时间差 | 展示形式 | 示例 |',
    '| --- | --- | --- |',
    '| 不足 1 分钟 | 刚刚 | 刚刚 |',
    '| 1 分钟至不足 1 小时 | N 分钟前 | 25 分钟前 |',
    '| 1 小时至不足 24 小时 | N 小时前 | 3 小时前 |',
    '| 24 小时至不足 7×24 小时 | N 天前 | 2 天前 |',
    '| 达到 7×24 小时，且在本年 | MM-DD | 09-08 |',
    '| 达到 7×24 小时，且跨年 | YYYY-MM-DD | 2025-12-30 |'
  ].join('\n') + '\n\n按实际时间差计算并向下取整；刚好满 24 小时显示“1 天前”，刚好满 7×24 小时显示具体日期；页面重新进入或数据重新加载后重新计算。\n';
  assert.equal(read('docs/time.md'),expected);
});

// In-memory DOM stubs exercise routing output, not a rendered browser or layout.
function appAt(hash, documents = content.documents) {
  const elements = new Map(), events = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id,{innerHTML:'',textContent:'',value:'',hidden:false,open:false,addEventListener(type,fn){events.set(id+':'+type,fn);},setAttribute(){},removeAttribute(){},focus(){},showModal(){this.open=true;},querySelector(){return element(id+':pre');}});
    return elements.get(id);
  }
  const document = {getElementById:element,querySelectorAll:()=>[],addEventListener(){},querySelector:()=>null};
  vm.runInNewContext(read('assets/app.js'),{window:{BOSSUI_CONTENT:{documents},scrollTo(){},addEventListener(){}},document,location:{hash},BossMarkdown:md});
  return {elements,events,html:element('main-content').innerHTML};
}
test('home keeps three entries and exactly two rule links without previews',()=>{
  const {html}=appAt('#home');
  for (const key of ['foundations','guidelines','templates']) assert.match(html,new RegExp('href="#'+key+'"'));
  assert.equal((html.match(/href="#\/doc\/time"/g)||[]).length,1);
  assert.equal((html.match(/href="#\/doc\/search"/g)||[]).length,1);
  assert.equal((html.match(/class="entry-card"/g)||[]).length,3);
  assert.equal((html.match(/class="overview-item"/g)||[]).length,2);
  assert.doesNotMatch(html,/<table|<input|<form|<button/);
});
test('empty sections contain only their title, navigation and simple empty state',()=>{
  for(const key of ['foundations','templates']) {
    const {html}=appAt('#'+key);
    const article=html.match(/<article[^>]*>([\s\S]*?)<\/article>/)[1];
    assert.match(article,/<p class="empty-content">暂无内容<\/p>/);
    assert.doesNotMatch(article,/<ul|<ol|<table|<form|<input|overview-item/);
  }
});
test('guidelines and sidebar each expose exactly two articles',()=>{
  const html=appAt('#guidelines').html;
  const article=html.match(/<article[^>]*>([\s\S]*?)<\/article>/)[1];
  const sidebar=html.match(/<aside[^>]*>([\s\S]*?)<\/aside>/)[1];
  for (const area of [article,sidebar]) {
    assert.equal((area.match(/href="#\/doc\//g)||[]).length,2);
    assert.match(area,/通知时间展示规则/);
    assert.match(area,/搜索框/);
  }
});
test('time page renders the source table with source controls, without execution UI',()=>{
  const {html}=appAt('#/doc/time');
  assert.match(html,/<h1>通知时间展示规则<\/h1>/);
  assert.equal((html.match(/<table>/g)||[]).length,1);
  for (const action of ['copy','download','source']) assert.match(html,new RegExp('data-doc-'+action+'="time"'));
  assert.doesNotMatch(html,/<input|<form|<select|来源：|读取：|revision/i);
});
test('search page renders only the summary and a direct relative original link',()=>{
  const {html}=appAt('#/doc/search');
  const body=html.split('<div class="prose" id="document-body">')[1].split('</article>')[0];
  assert.match(html,/<h1>搜索框<\/h1>/);
  assert.equal((body.match(/<table>/g)||[]).length,2);
  assert.doesNotMatch(body,/<input|<form|<select|Agent 执行流程|来源：|读取：|revision/i);
  const href=body.match(/href="([^"]+\.md)"/)[1];
  assert.equal(href,'./docs/后台列表搜索能力设计标准.md');
  assert.ok(fs.existsSync(path.join(root,href)));
  for (const base of ['http://localhost:8000/BossUI/index.html#/doc/search',pathToFileURL(path.join(root,'index.html')).href+'#/doc/search']) {
    const url=new URL(href,base);
    assert.equal(url.protocol,new URL(base).protocol);
    assert.equal(url.hash,'');
    assert.ok(decodeURIComponent(url.pathname).endsWith('/BossUI/docs/后台列表搜索能力设计标准.md'));
  }
});
test('local original link permission rejects unregistered files and traversal',()=>{
  const searchDoc=content.documents.find(doc=>doc.id==='search');
  for (const target of ['./unknown.md','../docs/后台列表搜索能力设计标准.md','./%2e%2e/docs/后台列表搜索能力设计标准.md','/docs/后台列表搜索能力设计标准.md','https://example.com/后台列表搜索能力设计标准.md','./后台列表搜索能力设计标准.md?download=1','file:///private.md']) {
    const {html}=appAt('#/doc/search',[{...searchDoc,markdown:`# 搜索框\n\n[original](${target})`}]);
    assert.ok(!html.includes('href="'+target+'"'),target);
    assert.doesNotMatch(html,/href="\.\/docs\/后台列表搜索能力设计标准\.md"/);
  }
  const {html}=appAt('#/doc/time',[{...content.documents[0],markdown:'# 时间\n\n[original](./后台列表搜索能力设计标准.md)'}]);
  assert.match(html,/href="#\/not-found"/);
});
test('registered Markdown links still resolve as document routes',()=>{
  const {html}=appAt('#/doc/search',content.documents.map(doc=>doc.id==='search'?{...doc,markdown:'# 搜索框\n\n[时间](./time.md)'}:doc));
  assert.match(html,/href="#\/doc\/time">时间<\/a>/);
});
test('unregistered routes return missing instead of old documents',()=>{
  for(const id of ['foundations','table','filters','forms','feedback','template-list','template-detail','template-form','unknown']) {
    const {html}=appAt('#/doc/'+id);
    assert.match(html,/<h1>页面不存在<\/h1>/);
    assert.doesNotMatch(html,/document-body|<table/);
  }
});
test('search and Markdown index expose two summaries, not the full attachment',()=>{
  const app=appAt('#home');
  app.events.get('open-search:click')();
  assert.equal((app.elements.get('search-results').innerHTML.match(/class="search-result"/g)||[]).length,2);
  for (const term of ['搜索框','精确匹配']) {
    app.elements.get('search-input').value=term;
    app.events.get('search-input:input')();
    const results=app.elements.get('search-results').innerHTML;
    assert.equal((results.match(/class="search-result"/g)||[]).length,1);
    assert.match(results,/href="#\/doc\/search"/);
  }
  for (const term of ['不存在的关键词','Agent 执行流程']) {
    app.elements.get('search-input').value=term;
    app.events.get('search-input:input')();
    assert.match(app.elements.get('search-results').innerHTML,/没有找到相关规范/);
  }
  app.events.get('open-markdown:click')();
  assert.equal((app.elements.get('markdown-body').innerHTML.match(/data-doc-source=/g)||[]).length,2);
});
test('asset inventory and live site have no withdrawn implementations or rule markers',()=>{
  assert.deepEqual(fs.readdirSync(path.join(root,'assets')).sort(),['app.js','content.js','markdown.js','site.css']);
  // Inspect indexed/display sources only; the preserved attachment is archival data.
  const live=['index.html','assets/app.js','assets/site.css'].map(read).concat(content.documents.map(doc=>doc.markdown)).join('\n');
  assert.doesNotMatch(live,/BossDemos|BossTime|activeDemo|demo-frame|time-output|detail-dialog|STYLE-\d|TABLE-\d|FILTER-\d|FORM-\d|STATE-\d|COPY-TIME-\d/);
  assert.doesNotMatch(live,/首版草案|评审草案|先读这几篇|虚构记录|Asia\/Shanghai|文案与时间/);
  for(const id of ['foundations','table','filters','forms','feedback','template-list','template-detail','template-form']) {
    assert.ok(!live.includes('docs/'+id+'.md'));
    assert.ok(!live.includes('#/doc/'+id));
  }
});
