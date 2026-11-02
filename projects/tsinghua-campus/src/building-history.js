import data from '../data/building-history.json' with {type: 'json'};

const plain = value => typeof value === 'string' && value.trim().length > 0 &&
  !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value);
const identifier = value => plain(value) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const fail = message => { throw new Error(`Invalid building history: ${message}`); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names, context) => {
  if (!object(value) || Object.keys(value).some(key => !names.includes(key)) ||
      names.some(key => !Object.hasOwn(value, key))) fail(`${context} fields`);
};
const text = (value, context) => { if (!plain(value)) fail(`${context} must be plain text`); };

// No geometry, DOM, fetch or fallback catches: invalid known data must fail loudly.
export function validateBuildingHistory(value, {knownSites} = {}) {
  keys(value, ['schemaVersion', 'reviewedAt', 'sources', 'entries'], 'document');
  if (value.schemaVersion !== 1 || !date(value.reviewedAt)) fail('schemaVersion/reviewedAt');
  if (!Array.isArray(value.sources) || !value.sources.length ||
      !Array.isArray(value.entries) || !value.entries.length) fail('sources/entries');
  const sourceIds = new Set(), entryIds = new Set(), siteIds = new Set();
  for (const source of value.sources) {
    keys(source, ['id', 'title', 'url', 'publisher', 'accessedAt'], 'source');
    if (!identifier(source.id) || sourceIds.has(source.id)) fail('duplicate/invalid source id');
    sourceIds.add(source.id);
    text(source.title, 'source title'); text(source.publisher, 'publisher');
    if (!plain(source.url)) fail('source URL');
    const url = new URL(source.url); // malformed URL intentionally throws
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('source URL protocol/credentials');
    if (!date(source.accessedAt) || source.accessedAt > value.reviewedAt) fail('access date');
  }
  const cited = (record, label) => {
    keys(record, label ? ['label', 'text', 'sourceIds'] : ['text', 'sourceIds'], 'claim');
    if (label) text(record.label, 'fact label');
    text(record.text, 'claim');
    if (!Array.isArray(record.sourceIds) || !record.sourceIds.length ||
        new Set(record.sourceIds).size !== record.sourceIds.length ||
        record.sourceIds.some(id => !sourceIds.has(id))) fail('unresolved/duplicate claim sourceIds');
  };
  for (const entry of value.entries) {
    keys(entry, ['id', 'referenceSites', 'name', 'summary', 'facts', 'architecture', 'limitations'], 'entry');
    if (!identifier(entry.id) || entryIds.has(entry.id)) fail('duplicate/invalid entry id');
    entryIds.add(entry.id);
    text(entry.name, 'entry name'); text(entry.summary, 'summary');
    if (!Array.isArray(entry.referenceSites) || !entry.referenceSites.length) fail('referenceSites');
    for (const site of entry.referenceSites) {
      if (!identifier(site) || siteIds.has(site) || (knownSites && !knownSites.has(site))) fail(`duplicate/unknown site ${site}`);
      siteIds.add(site);
    }
    if (!Array.isArray(entry.facts) || entry.facts.length < 1 || entry.facts.length > 3) fail('facts length');
    if (!Array.isArray(entry.architecture) || entry.architecture.length > 2) fail('architecture length');
    if (!Array.isArray(entry.limitations) || !entry.limitations.length) fail('limitations');
    entry.facts.forEach(fact => cited(fact, true));
    entry.architecture.forEach(note => cited(note, false));
    entry.limitations.forEach(note => text(note, 'limitation'));
  }
  return value;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const history = freeze(validateBuildingHistory(data));
export const sources = history.sources;
export const HISTORY_SOURCES = sources;
export const entries = history.entries;
export const reviewedAt = history.reviewedAt;
const bySite = new Map(entries.flatMap(entry => entry.referenceSites.map(site => [site, entry])));

/** Exact referenceSite/appearanceReferenceSite ID only; unknown/absent site deliberately returns null. */
export function historyForSite(site) {
  if (site == null) return null;
  if (typeof site !== 'string') throw new TypeError('historyForSite expects a reference-site string');
  return bySite.get(site) ?? null;
}
