import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const coreURL = new URL('../tools/capture-core.mjs', import.meta.url);
async function core() { return import(coreURL).catch(e => e.code === 'ERR_MODULE_NOT_FOUND' ? {} : Promise.reject(e)); }

test('basemap defaults to satellite and rejects values outside the exact whitelist', async () => {
  const { resolveBasemap } = await core();
  assert.equal(typeof resolveBasemap, 'function', 'basemap boundary is implemented');
  assert.equal(resolveBasemap(), 'satellite');
  assert.equal(resolveBasemap(null), 'satellite');
  for (const mode of ['standard', 'satellite']) assert.equal(resolveBasemap(mode), mode);
  for (const mode of ['', 'STANDARD', '../standard', 'https://evil.test/style', 'standard&x=1']) {
    assert.throws(() => resolveBasemap(mode), /basemap/);
  }
});

test('retiming uses every exact approved intro source frame, not JS half-frame rounding', async () => {
  const { sourceFrame } = await core();
  assert.equal(typeof sourceFrame, 'function', 'retiming boundary is implemented');
  const remap = JSON.parse(await readFile(new URL('../intro-remap.json', import.meta.url)));
  assert.equal(remap.length, 409);
  for (let frame = 0; frame < remap.length; frame++) assert.equal(sourceFrame(frame, remap), remap[frame]);
  for (const frame of [409, 481, 8524]) assert.equal(sourceFrame(frame, remap), frame);
  for (const frame of [-1, NaN, Infinity, 1.5]) assert.throws(() => sourceFrame(frame, remap), /frame/);
  assert.throws(() => sourceFrame(0, []), /remap/);
});
