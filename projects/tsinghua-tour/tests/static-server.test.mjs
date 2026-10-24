import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';

function request(url, rawPath, options = {}) {
  return new Promise((resolve, reject) => {
    const q = http.request(url, { path: rawPath, ...options }, r => {
      let body = ''; r.on('data', b => body += b); r.on('end', () => resolve({ status: r.statusCode, body, headers: r.headers }));
    }); q.on('error', reject); q.end();
  });
}

test('static server binds loopback and serves only public assets with exact Host/Origin and path boundaries', async t => {
  const { startServer } = await import('../tools/capture-core.mjs');
  assert.equal(typeof startServer, 'function', 'secure static server exists');
  const root = await mkdtemp(path.join(tmpdir(), 'tour-server-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'tour-private-'));
  t.after(() => Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]));
  for (const dir of ['photos', 'fonts', 'audio', 'node_modules/maplibre-gl/dist']) await mkdir(path.join(root, dir), { recursive: true });
  for (const [file, body] of Object.entries({ 'map.html': '<h1>tour</h1>', 'stars.svg': '<svg/>', 'timing.json': '{}', 'photos/all-manifest.json': '[{"local_filename":"public.jpg"},{"local_filename":"link.jpg"}]', 'photos/public.jpg': 'image', 'photos/private.jpg': 'secret', 'fonts/linked.ttf': '', 'audio/intro.json': 'voice secret', '.env': 'credential', 'node_modules/maplibre-gl/package.json': 'private package', 'node_modules/maplibre-gl/dist/maplibre-gl.mjs': 'export {}' })) await writeFile(path.join(root, file), body);
  await writeFile(path.join(outside, 'secret'), 'outside secret');
  await symlink(path.join(outside, 'secret'), path.join(root, 'photos/link.jpg'));
  await rm(path.join(root, 'fonts/linked.ttf'));
  await symlink(path.join(outside, 'secret'), path.join(root, 'fonts/linked.ttf'));
  const server = await startServer(root);
  t.after(() => server.close());
  assert.equal(server.address().address, '127.0.0.1');
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const p of ['/map.html?basemap=standard', '/stars.svg', '/photos/public.jpg', '/node_modules/maplibre-gl/dist/maplibre-gl.mjs']) {
    assert.equal((await request(origin, p)).status, 200, p);
    assert.equal((await request(origin, p, { headers: { Origin: origin } })).status, 200, p);
  }
  const head = await request(origin, '/map.html', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(head.body, '');
  assert.match(head.headers['content-type'], /text\/html/);
  for (const p of ['/.env', '/audio/intro.json', '/node_modules/maplibre-gl/package.json', '/photos/private.jpg', '/photos/link.jpg', '/fonts/linked.ttf', '/photos/../map.html', '/photos/%2e%2e/map.html', '/photos/%252e%252e/map.html', '/photos%2fpublic.jpg', '//map.html', '/photos\\public.jpg', '/%00', '/%ZZ']) assert.notEqual((await request(origin, p)).status, 200, p);
  for (const headers of [{ Host: 'evil.test' }, { Host: 'localhost:123' }, { Origin: 'http://localhost:123' }, { Origin: 'null' }, { Origin: origin + '/' }, { Origin: 'https://evil.test' }]) assert.equal((await request(origin, '/map.html', { headers })).status, 403);
  assert.equal((await request(origin, '/map.html', { method: 'POST' })).status, 405);
});

test('installed MapLibre ESM entry, shared chunk and worker are served without exposing dev sources', async t => {
  const { startServer } = await import('../tools/capture-core.mjs');
  const { fileURLToPath } = await import('node:url');
  const server = await startServer(fileURLToPath(new URL('..', import.meta.url)));
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const file of ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css']) {
    assert.equal((await request(origin, '/node_modules/maplibre-gl/dist/' + file)).status, 200, file);
  }
  assert.equal((await request(origin, '/node_modules/maplibre-gl/dist/maplibre-gl-dev.mjs')).status, 404);
  assert.match((await request(origin, '/map.html')).body, /rel="icon" href="data:/, 'no implicit favicon 404 during capture');
});
