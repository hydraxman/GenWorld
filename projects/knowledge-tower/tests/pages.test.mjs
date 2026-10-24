import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test('Pages contains only the public demo, its licensed models and license notices', async () => {
  await import('../scripts/build-pages.mjs');
  const root = new URL('../../../output/pages/', import.meta.url);
  const files = (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => path.relative(fileURLToPath(root), path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
  assert.deepEqual(files, [
    '.nojekyll', 'DESIGN.md', 'LICENSE', 'LICENSE-three.txt',
    'assets/models/SOURCES.md',
    'assets/models/kenney-assistant/Textures/colormap.png',
    'assets/models/kenney-assistant/character.glb',
    'assets/models/kenney-fountain/Textures/colormap.png',
    'assets/models/kenney-fountain/pavement-fountain.glb',
    'assets/scene.js', 'index.html', 'styles.css',
  ].sort());
  assert.match(await readFile(new URL('LICENSE', root), 'utf8'), /MIT License/);
  assert.match(await readFile(new URL('LICENSE-three.txt', root), 'utf8'), /Copyright/);
});
