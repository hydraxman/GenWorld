import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../scripts/server.mjs';

test('standalone server serves the app and planning text without leaking parent files', async () => {
  const server = await startServer({ port: 0 });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /知识大楼/);
    const plan = await fetch(`${base}/DESIGN.md`);
    assert.equal(plan.status, 200);
    assert.match(await plan.text(), /16 层/);
    assert.equal((await fetch(`${base}/missing.txt`)).status, 404);
    assert.equal((await fetch(`${base}/%2e%2e%5cpackage.json`)).status, 403);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    const head = await fetch(`${base}/styles.css`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
