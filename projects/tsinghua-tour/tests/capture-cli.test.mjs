import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const timing = JSON.parse(await readFile(new URL('../timing.json', import.meta.url)));
test('CLI uses exclusive global frame bounds and mode-specific output roots without shell assumptions', async () => {
  const { parseArgs, selectFrames } = await import('../tools/capture-core.mjs');
  assert.equal(typeof parseArgs, 'function', 'CLI parser exists');
  let opts = parseArgs(['--basemap', 'standard', '--from', '48', '--to', '50', '--out', 'a directory']);
  assert.equal(opts.basemap, 'standard'); assert.equal(opts.out, 'a directory');
  assert.deepEqual(selectFrames(timing, opts), [48, 49]);
  assert.equal(parseArgs([]).basemap, 'satellite');
  assert.equal(parseArgs([]).out, 'output/satellite');
  assert.equal(parseArgs(['--basemap', 'standard']).out, 'output/standard');
  assert.equal(parseArgs(['--serve']).serve, true);
  assert.equal(selectFrames(timing, parseArgs([])).length, 8525);
  const preview = selectFrames(timing, parseArgs(['--preview']));
  assert.equal(preview[0], 0); assert.equal(preview.at(-1), 8524);
  assert.equal(new Set(preview).size, preview.length);
  assert.ok(preview.includes(408));
  for (const args of [['--unknown'], ['--basemap', 'bad'], ['--from', '-1'], ['--from', '2.5'], ['--to', '1e3'], ['--out'], ['--preview', '--serve']]) assert.throws(() => parseArgs(args), undefined, args.join(' '));
  for (const args of [['--from', '50', '--to', '48'], ['--to', '8526'], ['--from', '8525']]) assert.throws(() => selectFrames(timing, parseArgs(args)), /frame|range/);
});

test('CHROME_PATH takes priority and invalid explicit paths fail instead of silently changing browser', async t => {
  const { findBrowser } = await import('../tools/capture-core.mjs');
  assert.equal(typeof findBrowser, 'function', 'portable browser detection exists');
  const dir = await mkdtemp(path.join(tmpdir(), 'tour-browser-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'browser');
  await writeFile(file, '#!/bin/sh\nexit 0\n'); await chmod(file, 0o755);
  assert.equal(await findBrowser({ CHROME_PATH: file, PATH: '' }), file);
  await assert.rejects(findBrowser({ CHROME_PATH: path.join(dir, 'missing'), PATH: '' }), /CHROME_PATH/);
});
