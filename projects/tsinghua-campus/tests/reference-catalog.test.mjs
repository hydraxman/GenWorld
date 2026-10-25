import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import catalog from '../reference-catalog.json' with {type: 'json'};
import {referenceTest} from './reference-mode.mjs';

test('all reference sites retain distributable provenance without requiring local photographs', () => {
  assert.equal(catalog.sites.length, 16);
  assert.equal(new Set(catalog.sites.map(site => site.id)).size, 16);
  assert.equal(catalog.sites.flatMap(site => site.images).length, 28);
  for (const site of catalog.sites) {
    assert.ok(site.name && site.observations.length && site.unknowns.length);
    for (const image of site.images) {
      assert.match(image.path, /^references\\/);
      assert.match(image.sha256, /^[a-f0-9]{64}$/);
      assert.ok(image.width > 0 && image.height > 0 && image.license);
      assert.equal(new URL(image.pageUrl).protocol, 'https:');
      assert.equal(new URL(image.imageUrl).protocol, 'https:');
    }
  }
});

referenceTest('all catalog images retain their original published hashes', () => {
  for (const image of catalog.sites.flatMap(site => site.images)) {
    const bytes = readFileSync(new URL(`../${image.path.replaceAll('\\', '/')}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), image.sha256, image.path);
  }
});
