import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {createProjectServer} from './serve.mjs';

const output = resolve(import.meta.dirname, '..', 'output'), report = {};
await mkdir(output, {recursive: true});
const server = createProjectServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  for (const [device, width] of [['desktop', 1600], ['mobile', 390], ['offline', 390]]) {
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      headless: true, protocolTimeout: 180000,
      args: ['--use-gl=angle', '--use-angle=d3d11', '--no-proxy-server', '--disable-quic'],
    });
    const page = await browser.newPage(), errors = [], requests = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('request', request => {if (/^https?:/.test(request.url())) requests.push(request.url());});
    await page.setViewport({width, height: 1000, deviceScaleFactor: 1});
    const base = device === 'offline' ? pathToFileURL(resolve(output, 'tsinghua-campus-offline.html')).href
      : process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`;
    const url = new URL(base); url.searchParams.set('view', 'riverside');
    await page.goto(url.href, {waitUntil: 'load', timeout: 90000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    assert.equal(await page.$('#export-all'), null);
    assert.equal(await page.evaluate(() => typeof window.campusApp.exportModel), 'undefined');
    assert.ok(!requests.some(url => /GLTFExporter-[A-Z0-9]+\.js/.test(url)));
    const captures = [];
    for (const view of ['riverside', 'campus-life']) {
      await page.$eval(`#view-${view}`, button => button.click());
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      await page.$eval('#message', element => {element.hidden = true;});
      const state = await page.evaluate(() => {
        const app = window.campusApp;
        app.render(true);
        const canvas = document.getElementById('scene'), copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext('2d', {willReadFrequently: true});
        ctx.drawImage(canvas, 0, 0);
        const full = ctx.getImageData(0, 0, copy.width, copy.height).data;
        const image = canvas.toDataURL(), stats = app.inspection().rendering;
        app.campus.layers.riverbanks.visible = false; app.campus.layers.streetscape.visible = false;
        app.render(true); ctx.drawImage(canvas, 0, 0);
        const bare = ctx.getImageData(0, 0, copy.width, copy.height).data;
        let changedPixels = 0;
        for (let i = 0; i < full.length; i += 4) {
          if (Math.abs(full[i] - bare[i]) + Math.abs(full[i + 1] - bare[i + 1]) + Math.abs(full[i + 2] - bare[i + 2]) > 25) changedPixels++;
        }
        app.campus.layers.riverbanks.visible = true; app.campus.layers.streetscape.visible = true; app.render(true);
        return {image, stats, changedPixels, startupMs: performance.getEntriesByName('campus-ready')[0].startTime};
      });
      assert.ok(state.changedPixels > 100, `${device}/${view}: scenery must be visible in actual pixels`);
      assert.ok(state.stats.scenery.drawCalls <= 12);
      assert.ok(state.stats.scenery.visible.people <= (device === 'desktop' ? 72 : 36));
      assert.equal(state.stats.reflections.waterTargets, 1);
      assert.equal(state.stats.reflections.waterTime, 0);
      if (view === 'riverside') assert.ok(state.stats.scenery.visible.banks > 0);
      else assert.ok(state.stats.scenery.visible.people > 0);
      await writeFile(resolve(output, `scenery-${device}-${view}.png`), Buffer.from(state.image.split(',')[1], 'base64'));
      delete state.image;
      captures.push({view, ...state});
      await page.screenshot({path: resolve(output, `scenery-${device}-${view}-ui.png`)});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    for (const name of ['streetscape', 'riverbanks']) {
      await page.$eval(`[data-layer="${name}"]`, checkbox => checkbox.click());
      const visible = await page.evaluate(() => {window.campusApp.render(); return window.campusApp.campus.scenery.stats().visible;});
      const kinds = name === 'streetscape' ? ['people', 'bicycles', 'benches', 'lamps'] : ['banks', 'reeds', 'willows'];
      assert.ok(kinds.every(key => visible[key] === 0));
      await page.$eval(`[data-layer="${name}"]`, checkbox => checkbox.click());
    }
    await page.$eval('#view-riverside', button => button.click());
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const motion = await page.evaluate(() => {
      const app = window.campusApp, canvas = document.getElementById('scene'), copy = document.createElement('canvas');
      copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext('2d', {willReadFrequently: true});
      const capture = time => {
        app.setSceneTime(time); app.render(true); ctx.drawImage(canvas, 0, 0);
        return ctx.getImageData(0, 0, copy.width, copy.height).data;
      };
      const first = capture(0), later = capture(3), replay = capture(0);
      let changed = 0, unreproducible = 0;
      for (let i = 0; i < first.length; i += 4) {
        if (Math.abs(first[i] - later[i]) + Math.abs(first[i + 1] - later[i + 1]) + Math.abs(first[i + 2] - later[i + 2]) > 12) changed++;
        if (Math.abs(first[i] - replay[i]) + Math.abs(first[i + 1] - replay[i + 1]) + Math.abs(first[i + 2] - replay[i + 2]) > 3) unreproducible++;
      }
      return {changed, unreproducible, targets: app.inspection().rendering.reflections.waterTargets};
    });
    assert.ok(motion.changed > 30, `${device}: adapted waves/breeze must change visible pixels`);
    assert.equal(motion.unreproducible, 0, 'Fixed-time replay must reproduce visible geometry and shading');
    assert.equal(motion.targets, 1);
    await page.$eval('#scene-motion', checkbox => checkbox.click());
    await page.waitForFunction(() => window.campusApp.inspection().rendering.reflections.waterTime > .4);
    await page.$eval('#scene-motion', checkbox => checkbox.click());
    const paused = await page.evaluate(() => window.campusApp.inspection().rendering.reflections.waterTime);
    await new Promise(done => setTimeout(done, 250));
    assert.equal(await page.evaluate(() => window.campusApp.inspection().rendering.reflections.waterTime), paused);
    await page.evaluate(() => window.campusApp.setSceneTime(0));
    await page.$eval('#view-all', button => button.click());
    assert.ok(await page.evaluate(() => {window.campusApp.render(); return Object.values(window.campusApp.campus.scenery.stats().visible).every(n => n === 0);}));
    const cdp = await page.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', {behavior: 'deny'});
    const exports = [];
    for (const kind of ['building', 'landmark', 'apartment']) {
      const exported = await page.evaluate(async kind => {
        const app = window.campusApp, createURL = URL.createObjectURL;
        if (kind === 'building') app.select([...app.campus.buildings.keys()].find(id =>
          app.campus.buildings.get(id).userData.refinementStatus === 'procedural'));
        else if (kind === 'landmark') app.select([...app.campus.landmarks.keys()][0]);
        else app.selectApartment(14);
        let blob;
        URL.createObjectURL = value => {if (value.type === 'model/gltf-binary') blob = value; return createURL.call(URL, value);};
        try {
          const bytes = await app.exportSelectedModel(), array = await blob.arrayBuffer(), view = new DataView(array);
          const json = JSON.parse(new TextDecoder().decode(new Uint8Array(array, 20, view.getUint32(12, true))).trim());
          return {bytes, magic: view.getUint32(0, true), nodes: json.nodes.filter(node => node.extras?.featureId).map(node => node.extras.featureId),
            scenery: json.nodes.some(node => node.extras?.sceneryKind), apartment: json.nodes.find(node => node.extras?.selectedApartmentNumber)?.extras.selectedApartmentNumber,
            disabled: document.getElementById('export-building').disabled};
        } finally {URL.createObjectURL = createURL;}
      }, kind);
      assert.ok(exported.bytes > 10000); assert.equal(exported.magic, 0x46546c67);
      assert.equal(exported.nodes.length, 1); assert.equal(exported.scenery, false); assert.equal(exported.disabled, false);
      if (kind === 'apartment') assert.equal(exported.apartment, 14);
      exports.push({kind, ...exported});
    }
    assert.deepEqual(errors, []);
    if (device === 'offline') assert.deepEqual(requests, []);
    report[device] = {captures, motion, exports, errors, requests: requests.length};
    await browser.close(); browser = undefined;
  }
  await writeFile(resolve(output, 'scenery-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
