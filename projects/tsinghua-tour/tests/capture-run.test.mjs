import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { openCapture } from '../tools/capture-core.mjs';

async function captureModule() { return import('../tools/capture.mjs').catch(e => e.code === 'ERR_MODULE_NOT_FOUND' ? {} : Promise.reject(e)); }

test('single-page capture reuses stable poses, checkpoints on failure and resumes global frame numbers', async t => {
  const { renderFrames } = await captureModule();
  assert.equal(typeof renderFrames, 'function', 'capture loop exists');
  const out = await mkdtemp(path.join(tmpdir(), 'tour-loop-'));
  t.after(() => rm(out, { recursive: true, force: true }));
  const spec = { basemap: 'standard', fingerprint: 'f'.repeat(64) };
  let cache = await openCapture(out, spec, 8525, false);
  let shots = 0, tileChecks = 0, fail = false;
  const window = { basemap: 'standard', mapErrors: [], visiblePoemText: '', map: { loaded: () => true, areTilesLoaded: () => true }, setTime(t) { this.outputTime = t; this.currentTime = t; this.sourceFrame = Math.round(t * 24); return this.pose = { cacheKey: t < 2.1 ? 'still' : 'move-' + t }; } };
  const ctx = vm.createContext({ window, document: { querySelector: () => null, body: {} }, getComputedStyle: () => ({ backgroundImage: 'url(stars.svg)' }), requestAnimationFrame: cb => cb() });
  const page = {
    async evaluate(fn, ...args) { ctx.args = args; return vm.runInContext(`(${fn.toString()})(...args)`, ctx); },
    async waitForFunction(fn) { tileChecks++; assert.equal(await this.evaluate(fn), true); },
    async screenshot() { if (fail) throw new Error('test screenshot failure'); shots++; return Buffer.from('test image ' + shots); }
  };
  await renderFrames(page, cache, [48, 49, 50], 24);
  assert.equal(shots, 1); assert.equal(tileChecks, 1);
  assert.equal(cache.report.frames_done, 3); assert.equal(cache.report.complete, false);
  assert.equal(cache.byFrame.get(50).source_frame, 50);
  assert.equal(cache.byFrame.get(49).reused_from, 48);
  cache = await openCapture(out, spec, 8525, false);
  await renderFrames(page, cache, [48, 49, 50], 24);
  assert.equal(shots, 1);
  fail = true;
  await assert.rejects(renderFrames(page, cache, [51], 24), /test screenshot failure/);
  const report = JSON.parse(await readFile(path.join(out, 'capture-report.json')));
  assert.equal(report.frames_done, 3); assert.equal(report.errors.length, 1); assert.equal(report.complete, false);
  fail = false; cache = await openCapture(out, spec, 8525, false);
  await renderFrames(page, cache, [51], 24);
  assert.equal(cache.report.frames_done, 4); assert.equal(cache.report.errors.length, 0);
});

test('serve CLI starts the real allowlisted loopback server and prints the selected preview URL', async t => {
  const { renderFrames } = await captureModule();
  assert.equal(typeof renderFrames, 'function', 'capture CLI exists');
  const child = spawn(process.execPath, ['tools/capture.mjs', '--serve', '--basemap', 'standard'], { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { child.kill('SIGTERM'); });
  const url = await new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const timer = setTimeout(() => reject(new Error('serve URL timeout: ' + stderr)), 10000);
    child.stderr.on('data', b => stderr += b);
    child.stdout.on('data', b => { stdout += b; const match = stdout.match(/http:\/\/127\.0\.0\.1:\d+\/map\.html\?basemap=standard/); if (match) { clearTimeout(timer); resolve(match[0]); } });
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`serve exited ${code}: ${stderr}`)); });
  });
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /window\.setTime/);
  assert.equal((await fetch(new URL('/audio/intro.json', url))).status, 404);
});
