import {historyForSite, HISTORY_SOURCES} from './building-history.js';

const sources = new Map(HISTORY_SOURCES.map(source => [source.id, source]));
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function renderKnowledgeCard(container, site) {
  container.replaceChildren();
  container.hidden = false;
  const entry = historyForSite(site);
  container.dataset.historyId = entry?.id || '';
  container.append(element('h3', '校史与建筑'));
  if (!entry) {
    container.append(element('p', '这栋建筑暂未收录经核实的校史资料。地图名称、程序外观和估算楼层不作为历史依据。'));
    return;
  }
  container.append(element('p', entry.summary, 'knowledge-intro'));
  const cited = new Map();
  function citations(node, ids) {
    const links = element('span', null, 'knowledge-citations');
    for (const id of ids) {
      const source = sources.get(id);
      if (!source) throw new Error(`Unknown building-history source: ${id}`);
      if (!cited.has(id)) cited.set(id, cited.size + 1);
      const link = element('a', `[${cited.get(id)}]`);
      link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `来源：${source.title}（新标签页）`);
      links.append(link);
    }
    node.append(links);
  }
  const facts = element('dl', null, 'knowledge-facts');
  for (const fact of entry.facts) {
    const text = element('dd', fact.text);
    citations(text, fact.sourceIds); facts.append(element('dt', fact.label), text);
  }
  container.append(facts);
  if (entry.architecture.length) {
    container.append(element('h4', '看建筑'));
    for (const note of entry.architecture) {
      const text = element('p', note.text); citations(text, note.sourceIds); container.append(text);
    }
  }
  const notes = element('details', null, 'knowledge-sources');
  notes.append(element('summary', `资料来源与范围 · ${cited.size}项`));
  const list = element('ol');
  for (const [id] of cited) {
    const source = sources.get(id), row = element('li'), link = element('a', source.title);
    link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    row.append(link, element('small', source.publisher)); list.append(row);
  }
  notes.append(list);
  for (const limitation of entry.limitations) notes.append(element('p', limitation));
  notes.append(element('p', '史料摘要离线可读；外部来源仅在点击时打开。模型中的推定尺寸与示意空间不等同于史实。'));
  container.append(notes);
}
