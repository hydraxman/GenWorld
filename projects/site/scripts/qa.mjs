import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { output } from './build.mjs';
import { scenes } from '../src/scenes.js';

const screenshots = path.resolve(import.meta.dirname, '..', 'qa');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname.slice('/GenWorld/'.length);
  const file = path.resolve(output, relative, relative.endsWith('/') || !relative ? 'index.html' : '');
  if (!pathname.startsWith('/GenWorld/') || !file.startsWith(output + path.sep)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'text/plain; charset=utf-8' })
      .end(data);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    response.writeHead(404).end();
  }
});
let browser;
try {
  const candidates = [process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);
  let executablePath;
  for (const candidate of candidates) {
    try { await access(candidate); executablePath = candidate; break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  assert.ok(executablePath, 'Set CHROME_PATH to a Chrome or Edge executable');
  await mkdir(screenshots, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.PAGES_URL ?? `http://127.0.0.1:${server.address().port}/GenWorld/`;
  browser = await puppeteer.launch({ executablePath, headless: true, protocolTimeout: 180000,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`); });
  await page.setViewport({ width: 1440, height: 1000 });
  assert.equal((await page.goto(base, { waitUntil: 'networkidle0' })).status(), 200);
  assert.equal(await page.$$eval('.scene-card', cards => cards.length), 4);
  await page.screenshot({ path: path.join(screenshots, 'home-desktop.png'), fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewport({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Homepage overflows at ${width}px`);
  }
  await page.screenshot({ path: path.join(screenshots, 'home-mobile.png'), fullPage: true });
  await page.setViewport({ width: 1440, height: 1000 });
  for (const scene of scenes) {
    await page.goto(new URL(`scene.html?scene=${scene.id}`, base).href, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.getElementById('preview-status').hidden
      || document.getElementById('preview-status').getAttribute('role') === 'alert');
    assert.equal(await page.$eval('#preview-status', element => element.hidden), true, `${scene.id} did not initialize`);
    const frame = await (await page.$('#scene-frame')).contentFrame();
    assert.ok(frame.url().startsWith(new URL(scene.source, base).href));
    assert.equal(await page.$eval(`[data-scene="${scene.id}"]`, element => element.getAttribute('aria-current')), 'page');
    if (scene.id === 'knowledge') {
      assert.equal(await frame.evaluate(() => window.__knowledgeStats.rooms), 64);
      await frame.click('#floor-nav [data-floor="16"]');
      assert.equal(await frame.evaluate(() => window.__knowledgeState.floor), 16);
      await frame.click('#open-plan');
      await frame.waitForFunction(() => document.querySelector('#plan-text').textContent.includes('16 层'));
      await frame.click('#close-plan');
    } else if (scene.id === 'campus') {
      assert.ok(await frame.evaluate(() => window.campusApp.stats.buildings > 100));
      assert.equal(await frame.$eval('#references', element => element.hidden), true);
      await frame.click('#view-plan');
      assert.equal(await frame.$eval('#view-plan', element => element.getAttribute('aria-pressed')), 'true');
      await frame.click('#view-shunde');
      assert.match(await frame.$eval('#selection-name', element => element.textContent), /舜德/);
    } else if (scene.id === 'shunde') {
      assert.match(await frame.$eval('#selection-name', element => element.textContent), /舜德/);
      assert.equal(await frame.$eval('#selected-references', element => element.hidden), true);
    } else {
      assert.ok(await frame.evaluate(() => window.__modelStats.triangles > 0));
      await frame.click('[data-shot="40.5"]');
      assert.equal(await frame.evaluate(() => window.__getExplosionState().active), true);
    }
    await page.screenshot({ path: path.join(screenshots, `${scene.id}.png`) });
    await page.setViewport({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${scene.id} shell overflows on mobile`);
    assert.ok(await page.$eval('#scene-frame', element => element.getBoundingClientRect().height > 400));
    await page.screenshot({ path: path.join(screenshots, `${scene.id}-mobile.png`) });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.click('.preview-home');
    await page.waitForSelector('.scene-grid');
  }
  await page.goto(new URL('scene.html?scene=unknown', base).href);
  assert.equal(await page.$eval('#preview-status', element => element.getAttribute('role')), 'alert');
  assert.equal(await page.$eval('#scene-frame', element => element.hasAttribute('src')), false);
  await page.goto(new URL('credits.html', base).href, { waitUntil: 'networkidle0' });
  assert.match(await page.$eval('main', element => element.textContent), /ODbL/);
  assert.deepEqual(errors, []);
  console.log('Pages browser checks passed: all four entries, real 3D interactions, subpath assets, mobile navigation, unknown route and credits.');
} finally {
  if (browser) await browser.close();
  if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
