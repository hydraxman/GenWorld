import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..', 'knowledge-atlas');
const read = file => readFile(path.join(root, file), 'utf8');

async function knowledge() {
  const context = { window: {} };
  vm.runInNewContext(await read('knowledge-prototype/data.js'), context);
  return JSON.parse(JSON.stringify(context.window.KNOWLEDGE));
}

test('preserves the complete original knowledge payload, not just counts or an empty visualization shell', async () => {
  const data = await knowledge();
  for (const source of Object.values(data.sources)) delete source.file;
  for (const project of data.projects) delete project.image;
  // Fingerprint of the original curated payload, excluding only file paths and preview filenames.
  const digest = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  assert.equal(digest, 'd1117ca650d08411a60948e9c41b5eab2462fbdcd9d36f1c8401f91fbf392f2a');
  assert.equal(data.nodes.length, 24);
  assert.equal(data.nodes.reduce((sum, node) => sum + node.prereqs.length, 0), 30);
  assert.equal(data.transfers.length, 5);
  assert.equal(data.projects.length, 3);
  assert.equal(data.projects.reduce((sum, project) => sum + project.cells.length, 0), 18);
  assert.equal(data.capabilities.length, 6);
});

test('every source citation and project illustration has a public destination', async () => {
  const data = await knowledge();
  const html = await read('sources.html');
  const ids = new Set(data.nodes.map(node => node.id));
  for (const [id, source] of Object.entries(data.sources)) {
    assert.ok(html.includes(`id="${id}"`), `Missing bibliography entry ${id}`);
    assert.equal(source.file, undefined, 'Do not publish private file paths');
    assert.ok(source.title && source.note && source.kind);
  }
  for (const node of data.nodes) {
    for (const prerequisite of node.prereqs) assert.ok(ids.has(prerequisite));
    for (const [source] of node.refs) assert.ok(data.sources[source]);
  }
  for (const project of data.projects) {
    assert.match(project.image, /\.svg$/);
    assert.match(await read(`knowledge-prototype/${project.image}`), /<svg/);
    for (const cell of project.cells) {
      for (const [source] of cell.refs) assert.ok(data.sources[source]);
    }
  }
  for (const script of ['knowledge-prototype/app.js', 'knowledge-experiments/gallery.js']) {
    const text = await read(script);
    assert.match(text, /new URL\("sources\.html", location\.href\)/);
    assert.doesNotMatch(text, /source\.file|sources\[key\]\.file/);
  }
});

test('source tree excludes original media and keeps all nine independently selectable views', async () => {
  const files = await readdir(root, { recursive: true });
  assert.ok(files.every(file => !/\.(?:pdf|mp4|mp3|wav|jpe?g|png)$/i.test(file)));
  const prototype = await read('knowledge-prototype/app.js');
  const gallery = await read('knowledge-experiments/gallery.js');
  assert.match(prototype, /A: "知识星图", B: "目标学习路线", C: "项目能力矩阵"/);
  for (const view of ['cosmos', 'city', 'metro', 'radial', 'river', 'lab']) {
    assert.ok(gallery.includes(`    ${view}: {`));
  }
  assert.match(gallery, /window\.__sceneReady = true/);
  assert.match(await read('index.html'), /knowledge-prototype\.html/);
  assert.match(await read('sources.html'), /论文全文|论文或复制论文插图/);
});
