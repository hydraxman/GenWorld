import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {historyForSite, validateBuildingHistory, HISTORY_SOURCES, sources, entries, reviewedAt} from '../src/building-history.js';
import history from '../data/building-history.json' with {type: 'json'};
import catalog from '../reference-catalog.json' with {type: 'json'};
import appearances from '../data/appearance-profiles.json' with {type: 'json'};
import {historyMarkdown} from '../scripts/reference-library.mjs';

const knownSites = new Set([...catalog.sites, ...appearances.sites].map(site => site.id));

test('bounded primary-source corpus is valid and maps exact registered site IDs', () => {
  assert.equal(validateBuildingHistory(history, {knownSites}), history);
  assert.equal(reviewedAt, '2026-11-02');
  assert.equal(entries.length, 19);
  assert.equal(sources.length, 13);
  assert.equal(HISTORY_SOURCES, sources);
  assert.equal(new Set(entries.flatMap(e => e.referenceSites)).size, 19);
  for (const entry of entries) {
    for (const site of entry.referenceSites) assert.equal(historyForSite(site), entry);
    for (const fact of [...entry.facts, ...entry.architecture]) {
      for (const id of fact.sourceIds) assert.ok(sources.some(source => source.id === id));
    }
  }
  for (const source of sources) {
    assert.ok(new URL(source.url).hostname.endsWith('.tsinghua.edu.cn'));
    assert.equal(source.accessedAt, reviewedAt);
  }
});

test('unknowns are intentional nulls, never fuzzy matches or swallowed schema errors', () => {
  for (const site of [null, undefined, '', 'not-in-corpus', '大礼堂', 'we ilun', 'appearance-teaching-6']) {
    assert.equal(historyForSite(site), null);
  }
  assert.throws(() => historyForSite({referenceSite: 'auditorium'}), TypeError);
  assert.equal(historyForSite('biology-hall').name, '老生物学馆');
  assert.equal(historyForSite('life-hall'), null);
  assert.equal(historyForSite('biology-hall').facts.find(f => f.label === '建成').text.includes('1930年夏'), true);
});

test('historic buildings and modern combined roots keep explicit scope', () => {
  assert.match(historyForSite('old-library').limitations.join(''), /连通组团/);
  assert.match(historyForSite('main-building').facts.find(f => f.label === '中央楼建成').text, /1966年5月/);
  assert.match(historyForSite('shunde-building').facts[0].text, /2000年奠基、2003年投入使用/);
  assert.match(historyForSite('second-gate').facts[2].text, /1991年4月/);
  assert.match(historyForSite('taoli-dining').facts[0].text, /2004年8月6日/);
  assert.match(historyForSite('zijing-dining').architecture[0].text, /其中一层地下/);
  assert.deepEqual(historyForSite('chemistry-hall').architecture, []);
});

test('invalid known records fail loudly', () => {
  const mutations = [
    h => { h.schemaVersion = 2; },
    h => { h.reviewedAt = '2026-02-30'; },
    h => { h.sources[0].accessedAt = '2026-11-03'; },
    h => { h.sources[0].url = 'javascript:alert(1)'; },
    h => { h.sources[0].title = '<b>title</b>'; },
    h => { h.sources.push({...h.sources[0]}); },
    h => { h.entries[0].facts[0].sourceIds = ['missing']; },
    h => { h.entries[0].facts[0].sourceIds = []; },
    h => { h.entries[0].referenceSites = ['missing-site']; },
    h => { h.entries[1].referenceSites = [...h.entries[0].referenceSites]; },
    h => { h.entries[0].summary = ''; },
    h => { h.entries[0].facts = []; },
    h => { h.entries[0].facts[0].unexpected = true; },
    h => { h.entries[0].limitations = []; },
    h => { h.entries[0].architecture = [null]; },
    h => { h.entries[0] = null; },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(history);
    mutate(invalid);
    assert.throws(() => validateBuildingHistory(invalid, {knownSites}));
  }
});

test('public data is immutable and documentation matches frozen JSON', async () => {
  assert.ok(Object.isFrozen(entries));
  assert.ok(Object.isFrozen(sources[0]));
  assert.ok(Object.isFrozen(historyForSite('auditorium').facts[0].sourceIds));
  assert.throws(() => { entries[0].facts[0].text = 'changed'; }, TypeError);
  assert.equal(await readFile(new URL('../docs/BUILDING-HISTORY.md', import.meta.url), 'utf8'), historyMarkdown(history));
  const moduleText = await readFile(new URL('../src/building-history.js', import.meta.url), 'utf8');
  assert.doesNotMatch(moduleText, /from ['"]three|fetch\s*\(|import\s*\(/);
});
