import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { buildSite, output } from '../scripts/build.mjs';
import { scenes } from '../src/scenes.js';

before(buildSite);
const read = file => readFile(path.join(output, file), 'utf8');

test('publishes an exact allowlist, with no research media, private files or source maps', async () => {
  const actual = (await readdir(output, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => path.relative(output, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')).sort();
  const expected = [
    '.nojekyll', 'index.html', 'scene.html', 'credits.html', 'site.css', 'preview.js', 'LICENSE', 'LICENSE-three.txt', 'LICENSE-geometry.txt',
    ...['.nojekyll', 'index.html', 'styles.css', 'DESIGN.md', 'LICENSE', 'LICENSE-three.txt', 'assets/scene.js',
      'assets/models/SOURCES.md', 'assets/models/kenney-assistant/character.glb',
      'assets/models/kenney-assistant/Textures/colormap.png', 'assets/models/kenney-fountain/pavement-fountain.glb',
      'assets/models/kenney-fountain/Textures/colormap.png'].map(file => `scenes/knowledge/${file}`),
    ...['index.html', 'style.css', 'assets/scene.js', 'LICENSE-font.txt', 'data/campus.json', 'data/provenance.json',
      'data/gongzi-source.json', 'data/second-gate-anchor.json', 'data/old-library-match.json',
      'data/source-footprint.json', 'data/campus-context.json'].map(file => `scenes/campus/${file}`),
    ...['index.html', 'assets/scene.js', 'assets/leaves/maple-color.png', 'assets/leaves/Normal.png',
      'assets/leaves/Roughness.png', 'assets/leaves/SOURCE.json'].map(file => `scenes/courtyard/${file}`),
    ...['index.html', 'style.css', 'studio.js', 'vendor/p5.min.js', 'vendor/p5.js',
      'vendor/LICENSE.txt'].map(file => `scenes/wind-print/${file}`),
  ].sort();
  assert.deepEqual(actual, expected);
});

test('every entry opens a distinct route under the repository subpath', async () => {
  const home = await read('index.html');
  const preview = await read('scene.html');
  const base = new URL('https://example.test/GenWorld/');
  assert.equal(new Set(scenes.map(scene => scene.id)).size, 5);
  assert.equal(new Set(scenes.map(scene => scene.source)).size, 5);
  for (const scene of scenes) {
    assert.ok(home.includes(`href="scene.html?scene=${scene.id}"`));
    assert.ok(preview.includes(`data-scene="${scene.id}"`));
    const route = new URL(scene.source, base);
    assert.ok(route.pathname.startsWith('/GenWorld/scenes/'));
    await access(path.join(output, route.pathname.slice('/GenWorld/'.length), 'index.html'));
  }
  assert.equal(scenes.find(scene => scene.id === 'shunde').source, 'scenes/campus/?view=shunde');
});

test('all local links and scripts in published HTML resolve', async () => {
  for (const file of ['index.html', 'scene.html', 'credits.html', 'scenes/knowledge/index.html',
    'scenes/campus/index.html', 'scenes/courtyard/index.html', 'scenes/wind-print/index.html']) {
    const base = new URL(file, 'https://example.test/GenWorld/');
    for (const [, link] of (await read(file)).matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = new URL(link, base);
      if (url.origin !== base.origin) continue;
      assert.ok(url.pathname.startsWith('/GenWorld/'), `Root-absolute link in ${file}: ${link}`);
      const target = url.pathname.slice('/GenWorld/'.length);
      await access(path.join(output, target, target.endsWith('/') ? 'index.html' : ''));
    }
  }
});

test('retains third-party attribution and downloadable map databases', async () => {
  assert.match(await read('LICENSE'), /MIT License/);
  assert.match(await read('LICENSE-three.txt'), /Copyright/);
  assert.match(await read('LICENSE-geometry.txt'), /Mike Fogel/);
  assert.match(await read('LICENSE-geometry.txt'), /Alexander Milevski/);
  assert.match(await read('LICENSE-geometry.txt'), /public domain/);
  assert.match(await read('scenes/campus/LICENSE-font.txt'), /SIL OPEN FONT LICENSE/);
  assert.match(await read('scenes/knowledge/assets/models/SOURCES.md'), /CC0/);
  assert.equal(JSON.parse(await read('scenes/courtyard/assets/leaves/SOURCE.json')).license, 'CC0');
  assert.equal(JSON.parse(await read('scenes/campus/data/campus.json')).type, 'FeatureCollection');
  assert.match(await read('credits.html'), /ODbL 1\.0/);
  assert.match(await read('scenes/wind-print/vendor/LICENSE.txt'), /GNU LESSER GENERAL PUBLIC LICENSE/);
  assert.match(await read('credits.html'), /LGPL 2\.1/);
});
