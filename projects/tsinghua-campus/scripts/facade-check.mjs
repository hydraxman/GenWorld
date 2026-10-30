import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {createProjectServer} from './serve.mjs';
import {PHOTO_APPEARANCES} from '../src/photo-appearance.js';

const ids = ['teaching-2', 'teaching-3-12', 'teaching-3-3', 'new-hydraulic', 'mingli'];
const suffix = process.env.FACADE_CAPTURE || 'after', output = resolve(import.meta.dirname, '..', 'output');
await mkdir(output, {recursive: true});
const server = createProjectServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, protocolTimeout: 180000, args: ['--use-gl=angle', '--use-angle=d3d11', '--no-proxy-server', '--disable-quic'],
  });
  const page = await browser.newPage(), errors = [], report = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.setViewport({width: 1600, height: 1000});
  await page.goto(process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`, {waitUntil: 'load', timeout: 90000});
  await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
  assert.equal(await page.evaluate(() => window.campusError), undefined);
  for (const id of ids) {
    const profile = PHOTO_APPEARANCES.find(profile => profile.id === id);
    await page.evaluate(({featureId, id}) => {
      const app = window.campusApp, root = app.campus.buildings.get(featureId);
      if (id === 'mingli') root.userData.viewDirection = [1.1, .35, -.2];
      app.select(featureId, true); document.getElementById('message').hidden = true;
    }, profile);
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.screenshot({path: resolve(output, `facade-${id}-${suffix}-desktop.png`)});
    if (suffix === 'before') continue;
    assert.equal(await page.$eval('#focus-facade', button => button.hidden), false);
    await page.click('#focus-facade');
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.screenshot({path: resolve(output, `facade-${id}-${suffix}-entry.png`)});
    const state = await page.evaluate(featureId => {
      const app = window.campusApp, root = app.campus.buildings.get(featureId);
      const detail = root.children.find(child => child.userData.architectureLOD);
      return {id: root.userData.appearanceProfileId, facade: detail.userData.photoFacade, buildings: app.campus.buildings.size,
        rendering: app.inspection().rendering};
    }, profile.featureId);
    assert.ok(state.facade?.openingProbes.length >= 3);
    assert.equal(state.buildings, 650);
    for (const width of [390, 320]) {
      await page.setViewport({width, height: 844});
      await page.click('#focus-facade');
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({path: resolve(output, `facade-${id}-${suffix}-mobile-${width}.png`)});
    }
    await page.setViewport({width: 1600, height: 1000});
    await page.click('#focus-facade');
    report.push(state);
  }
  if (suffix !== 'before') for (const view of ['biology-hall', 'biology-north']) {
    for (const width of [1600, 390, 320]) {
      await page.setViewport({width, height: width === 1600 ? 1000 : 844});
      await page.$eval(`#view-${view}`, button => button.click());
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      await page.screenshot({path: resolve(output, `${view}-${suffix}-${width}.png`)});
      const state = await page.evaluate(() => {
        const root = window.campusApp.campus.buildings.get('building:geometry:3ee05663e8212b498a33a67b');
        return {name: document.getElementById('selection-name').textContent, site: root.userData.referenceSite,
          width: document.documentElement.scrollWidth, viewport: innerWidth,
          stats: root.children.find(child => child.userData.campusDetail).userData.sourceStats};
      });
      assert.equal(state.site, 'biology-hall'); assert.equal(state.stats.basins, 3); assert.ok(state.width <= state.viewport);
      report.push({view, width, ...state});
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, `facade-${suffix}.json`), JSON.stringify({report, errors}, null, 2) + '\n');
  console.log(JSON.stringify({profiles: ids, observed: report.length, errors}));
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
