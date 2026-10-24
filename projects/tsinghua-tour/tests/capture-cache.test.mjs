import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'tour-cache-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['photos', 'fonts', 'styles', 'tools', 'node_modules/maplibre-gl/dist']) await mkdir(path.join(root, dir), { recursive: true });
  const files = ['map.html', 'route.json', 'timing.json', 'intro-remap.json', 'stars.svg', 'tools/capture.mjs', 'tools/capture-core.mjs', 'package.json', 'package-lock.json', 'styles/standard.json', 'styles/satellite.json', 'fonts/test.ttf', 'photos/test.jpg', 'node_modules/maplibre-gl/dist/maplibre-gl.mjs', 'node_modules/maplibre-gl/dist/maplibre-gl.css'];
  for (const file of files) await writeFile(path.join(root, file), 'original');
  for (const name of ['maplibre-gl-shared.mjs', 'maplibre-gl-worker.mjs']) {
    const file = 'node_modules/maplibre-gl/dist/' + name;
    await writeFile(path.join(root, file), 'original'); files.push(file);
  }
  await writeFile(path.join(root, 'photos/all-manifest.json'), '[{"local_filename":"test.jpg","sha256":"do-not-trust-manifest-hash"}]');
  return { root, files };
}

test('fingerprint binds mode, render settings and actual bytes of all render inputs, independent of mtime or root', async t => {
  const { computeFingerprint } = await import('../tools/capture-core.mjs');
  assert.equal(typeof computeFingerprint, 'function', 'fingerprinting exists');
  const { root, files } = await fixture(t);
  const base = await computeFingerprint(root, 'satellite');
  assert.match(base.fingerprint, /^[a-f0-9]{64}$/);
  assert.notEqual((await computeFingerprint(root, 'standard')).fingerprint, base.fingerprint);
  assert.notEqual((await computeFingerprint(root, 'satellite', { quality: 80 })).fingerprint, base.fingerprint);
  const other = await fixture(t);
  assert.equal((await computeFingerprint(other.root, 'satellite')).fingerprint, base.fingerprint);
  for (const file of files.filter(p => p !== 'styles/standard.json').concat('photos/all-manifest.json')) {
    const p = path.join(root, file), bytes = await readFile(p);
    await writeFile(p, Buffer.concat([bytes, Buffer.from(' ')]));
    await utimes(p, 1, 1);
    assert.notEqual((await computeFingerprint(root, 'satellite')).fingerprint, base.fingerprint, file);
    await writeFile(p, bytes);
  }
  assert.equal((await computeFingerprint(root, 'satellite')).fingerprint, base.fingerprint);
});

test('resume trusts only fingerprint-bound report entries with verified image hashes; partial stays partial', async t => {
  const { openCapture, commitFrame, saveReport, framePath } = await import('../tools/capture-core.mjs');
  assert.equal(typeof openCapture, 'function', 'resume cache exists');
  const { root } = await fixture(t), out = path.join(root, 'output');
  const spec = { fingerprint: 'a'.repeat(64), basemap: 'satellite' };
  let cache = await openCapture(out, spec, 8525, false);
  assert.equal(cache.report.total_frames, 8525);
  const info = { frame: 48, source_frame: 48, output_time: 2, source_time: 2, loaded: true, poseKey: 'still-pose' };
  await commitFrame(cache, 48, Buffer.from('real-test-image'), info);
  await saveReport(cache);
  const report = JSON.parse(await readFile(path.join(out, 'capture-report.json')));
  assert.equal(report.frames_done, 1); assert.equal(report.complete, false);
  assert.equal(report.views[0].frame, 48);
  assert.equal(framePath(cache, 48), path.join(out, 'frames/frame-00048.jpg'));
  cache = await openCapture(out, spec, 8525, false);
  assert.equal(cache.report.frames_done, 1);
  assert.equal(cache.poses.get('still-pose'), 48);
  await assert.rejects(openCapture(out, { ...spec, fingerprint: 'b'.repeat(64) }, 8525, false), /fingerprint/);
  await assert.rejects(openCapture(out, { ...spec, basemap: 'standard' }, 8525, false), /fingerprint|basemap/);
  await writeFile(framePath(cache, 48), 'tampered');
  await utimes(framePath(cache, 48), 1, 1);
  cache = await openCapture(out, spec, 8525, false);
  assert.equal(cache.report.frames_done, 0);
  assert.equal(cache.poses.size, 0);
  await writeFile(framePath(cache, 49), 'unreported-crash-leftover');
  cache = await openCapture(out, spec, 8525, false);
  assert.equal(cache.report.frames_done, 0);
  assert.equal((await readdir(out)).some(n => n.endsWith('.part')), false);
  const unbound = path.join(root, 'unbound');
  await mkdir(path.join(unbound, 'frames'), { recursive: true });
  await writeFile(path.join(unbound, 'frames/frame-00000.jpg'), 'unknown');
  await assert.rejects(openCapture(unbound, spec, 8525, false), /unbound|report/);
});
