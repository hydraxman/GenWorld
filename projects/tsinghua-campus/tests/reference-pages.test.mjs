import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {writeReferencePage} from '../scripts/reference-pages.mjs';

const bytes = Buffer.from('local-only reference fixture');
const image = {
  path: 'references\\example.jpg', width: 12, height: 8,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  pageUrl: 'https://example.org/source?a=1&b=2', imageUrl: 'https://example.org/photo.jpg',
  license: 'Local reference only', view: 'Front <unmeasured>',
};
const catalog = {sites: [{
  id: 'example', name: 'Example hall', images: [image],
  observations: ['Open entrance'], unknowns: ['Rear elevation'],
}]};
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'campus-reference-pages-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  return root;
}

test('default reference source page needs no photos and does not claim byte verification', async t => {
  const root = await fixture(t);
  await writeReferencePage(root, catalog);
  const html = await readFile(join(root, 'output', 'reference-photos.html'), 'utf8');
  assert.match(html, /id="example"/);
  assert.match(html, /https:\/\/example.org\/source\?a=1&amp;b=2/);
  assert.match(html, /https:\/\/example.org\/photo.jpg/);
  assert.match(html, /Front &lt;unmeasured&gt;/);
  assert.ok(html.includes(image.sha256));
  assert.match(html, /未打包.*未校验/);
  assert.doesNotMatch(html, /<img\b|图像字节已校验/);
  assert.deepEqual(await readdir(join(root, 'output')), ['reference-photos.html']);
});

test('explicit local gallery fails on missing or changed bytes and copies only hash-verified images', async t => {
  const root = await fixture(t);
  await assert.rejects(writeReferencePage(root, catalog, {includeImages: true}), {code: 'ENOENT'});
  await mkdir(join(root, 'references'));
  await writeFile(join(root, 'references', 'example.jpg'), 'changed bytes');
  await assert.rejects(writeReferencePage(root, catalog, {includeImages: true}), /Reference image hash mismatch/);
  await writeFile(join(root, 'references', 'example.jpg'), bytes);
  await writeReferencePage(root, catalog, {includeImages: true});
  const html = await readFile(join(root, 'output', 'reference-photos.html'), 'utf8');
  assert.match(html, /<img\b[^>]*src="references\/example.jpg"/);
  assert.match(html, /图像字节已校验/);
  assert.doesNotMatch(html, /图像字节未校验/);
  assert.deepEqual(await readFile(join(root, 'output', 'references', 'example.jpg')), bytes);
  await assert.rejects(writeReferencePage(root, {sites: [{
    ...catalog.sites[0], images: [{...image, path: '..\\outside.jpg'}],
  }]}, {includeImages: true}), /Invalid photo path/);
});
