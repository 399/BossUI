/* Small deliberately limited Markdown renderer. Raw HTML is always text. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BossMarkdown = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safeURL(raw) {
    const value = String(raw).trim();
    if (/[\u0000-\u0020\u007f\\]/.test(value) || value.startsWith('//')) return null;
    if (/^(https?:\/\/|mailto:|#)/i.test(value)) return value;
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
    if (/^\//.test(value)) return null;
    return value || null;
  }
  function inline(text, resolveLink = value => value, depth = 0) {
    if (depth > 4) return escape(text);
    const pattern = /(`+)([^`\n]+)\1|\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*/g;
    let html = '', position = 0, match;
    while ((match = pattern.exec(text))) {
      html += escape(text.slice(position, match.index));
      if (match[1]) html += `<code>${escape(match[2])}</code>`;
      else if (match[3]) {
        const initial = safeURL(match[4]);
        const url = initial === null ? null : safeURL(resolveLink(initial));
        html += url === null ? `<span class="invalid-link" title="不支持或不存在的链接">${escape(match[3])}</span>` : `<a href="${escape(url)}"${/^https?:/i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${inline(match[3], resolveLink, depth + 1)}</a>`;
      } else html += `<strong>${inline(match[5], resolveLink, depth + 1)}</strong>`;
      position = pattern.lastIndex;
    }
    return html + escape(text.slice(position));
  }
  function render(markdown, options = {}) {
    const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
    const headings = [], out = [], used = new Map();
    const inside = text => inline(text, options.resolveLink);
    const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(x => x.trim());
    const isTableRule = line => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line || '');
    const isBlock = (line, next) => !line.trim() || /^(#{1,6}\s|\s*```|\s*[-*+]\s|\s*\d+\.\s|>\s|---+$)/.test(line) || (line.includes('|') && isTableRule(next));
    for (let i = 0; i < lines.length;) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      const fence = line.match(/^\s*```([\w-]*)\s*$/);
      if (fence) {
        const code = []; i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
        if (i < lines.length) i++;
        out.push(`<pre><code${fence[1] ? ` class="language-${escape(fence[1])}"` : ''}>${escape(code.join('\n'))}</code></pre>`); continue;
      }
      const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
      if (heading) {
        const title = heading[2].replace(/[`*]/g, '');
        const slug = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
        const count = (used.get(slug) || 0) + 1; used.set(slug, count);
        const id = 'md-' + slug + (count > 1 ? '-' + count : '');
        const level = Math.min(6, heading[1].length);
        headings.push({id, title, level});
        out.push(`<h${level} id="${escape(id)}">${inside(heading[2])}</h${level}>`); i++; continue;
      }
      if (line.includes('|') && isTableRule(lines[i + 1])) {
        const header = cells(line); i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
        out.push('<div class="markdown-table" tabindex="0" role="region" aria-label="规范表格"><table><thead><tr>' + header.map(c => `<th scope="col">${inside(c)}</th>`).join('') + '</tr></thead><tbody>' + rows.map(row => '<tr>' + header.map((_, n) => `<td>${inside(row[n] || '')}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>'); continue;
      }
      const list = line.match(/^\s*([-*+]|\d+\.)\s+(.+)/);
      if (list) {
        const ordered = /\d/.test(list[1]), tag = ordered ? 'ol' : 'ul', items = [];
        while (i < lines.length) {
          const item = lines[i].match(/^\s*([-*+]|\d+\.)\s+(.+)/);
          if (!item || /\d/.test(item[1]) !== ordered) break;
          items.push(`<li>${inside(item[2])}</li>`); i++;
        }
        out.push(`<${tag}>${items.join('')}</${tag}>`); continue;
      }
      if (/^>\s?/.test(line)) {
        const quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
        out.push(`<blockquote>${inside(quote.join(' '))}</blockquote>`); continue;
      }
      if (/^---+$/.test(line.trim())) { out.push('<hr>'); i++; continue; }
      const paragraph = [line]; i++;
      while (i < lines.length && !isBlock(lines[i], lines[i + 1])) paragraph.push(lines[i++]);
      out.push(`<p>${inside(paragraph.join(' '))}</p>`);
    }
    return {html: out.join('\n'), headings};
  }
  return {escape, safeURL, inline, render};
});
