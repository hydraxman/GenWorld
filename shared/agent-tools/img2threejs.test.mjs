import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {checkInstallation, install} from './img2threejs.mjs';
import source from './img2threejs-source.json' with {type: 'json'};

const required = ['SKILL.md', 'LICENSE', 'forge/stage1_intake/search_specs.py',
  'docs/materials/material-reference.json', 'docs/specs/vocabulary/core_3d.jsonl',
  'grimoire/build/geometry_patterns.md', 'docs/standard-prompts/build.md'];
const hash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

function fixture(extra = []) {
  const files = [...required.map(name => ({path: name, bytes: Buffer.from(`Fixture for ${name}\n`)})), ...extra];
  const entries = files.map(file => ({path: file.path, sha: hash(file.bytes), mode: '100644', type: 'blob'}));
  return {
    entries,
    request(endpoint, input) {
      if (endpoint.includes('/git/trees/')) return {truncated: false, tree: entries};
      if (endpoint.includes('/git/blobs/')) {
        const file = files.find(file => hash(file.bytes) === endpoint.split('/').at(-1));
        return {encoding: 'base64', content: file.bytes.toString('base64')};
      }
      assert.equal(endpoint, 'graphql');
      return {data: {repository: Object.fromEntries([...input.query.matchAll(/(f\d+): object\(expression:("(?:\\.|[^"\\])*")\)/g)].map(match => {
        const name = JSON.parse(match[2]).slice(source.revision.length + 1);
        const file = files.find(file => file.path === name);
        return [match[1], {oid: hash(file.bytes), isBinary: file.binary ?? false,
          text: file.binary ? null : file.bytes.toString('utf8')}];
      }))}};
    },
  };
}

async function temporary(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'genworld-agent-tools-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return {directory, target: path.join(directory, 'img2threejs')};
}

test('installs pinned UTF-8 and binary files without alteration and supports an offline repeat', async t => {
  const {target} = await temporary(t);
  const binary = Buffer.from([0, 128, 255, 13, 10]);
  const upstream = fixture([{path: 'assets/sample.bin', bytes: binary, binary: true},
    ...Array.from({length: 26}, (_, i) => ({path: `docs/part-${i}.md`, bytes: Buffer.from(`part ${i}`)}))]);
  assert.equal((await install(target, upstream.request)).files, required.length + 27);
  assert.deepEqual(await readFile(path.join(target, 'assets', 'sample.bin')), binary);
  assert.equal((await checkInstallation(target)).revision, source.revision);
  const repeat = await install(target, () => assert.fail('Existing verified installs must not use the network'));
  assert.equal(repeat.files, required.length + 27);
});

test('refuses modified or unowned installations rather than overwriting them', async t => {
  const {target} = await temporary(t), upstream = fixture();
  await install(target, upstream.request);
  await writeFile(path.join(target, 'SKILL.md'), 'Keep my local edits');
  await assert.rejects(install(target, () => assert.fail()), /Upstream file changed/);
  assert.equal(await readFile(path.join(target, 'SKILL.md'), 'utf8'), 'Keep my local edits');
  const receipt = path.join(target, '.genworld-source.json');
  await writeFile(receipt, JSON.stringify({...source, revision: '0'.repeat(40), files: upstream.entries}));
  await assert.rejects(checkInstallation(target), /pinned revision/);
});

test('rejects incomplete trees, traversal and symlinks before writing upstream paths', async t => {
  for (const tree of [
    {truncated: true, tree: []},
    {tree: [{path: '../escaped', type: 'blob', mode: '100644'}]},
    {tree: [{path: 'C:\\escaped', type: 'blob', mode: '100644'}]},
    {tree: [{path: 'link', type: 'blob', mode: '120000'}]},
  ]) {
    const {directory, target} = await temporary(t);
    await assert.rejects(install(target, () => tree), /incomplete|Unsafe|Unsupported/);
    assert.deepEqual(await readdir(directory), [], 'Failed installation must clean only its own staging directory');
  }
});

test('corrupt downloads never become a successful-looking installation', async t => {
  for (const corrupt of ['hash', 'graphql', 'missing-file']) {
    const {directory, target} = await temporary(t), upstream = fixture();
    await assert.rejects(install(target, (endpoint, input) => {
      const response = upstream.request(endpoint, input);
      if (corrupt === 'missing-file' && endpoint.includes('/git/trees/')) response.tree = response.tree.slice(0, -1);
      if (endpoint === 'graphql') {
        if (corrupt === 'hash') response.data.repository.f0.text += 'corrupt';
        if (corrupt === 'graphql') return {errors: [{message: 'unavailable'}]};
      }
      return response;
    }), /integrity|could not return|Incomplete/);
    assert.deepEqual(await readdir(directory), []);
  }
});
