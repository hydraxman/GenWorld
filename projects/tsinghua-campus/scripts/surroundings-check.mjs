import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {createProjectServer} from './serve.mjs';

const output = resolve(import.meta.dirname, '..', 'output');
const capture = process.env.SURROUNDINGS_CAPTURE || 'after', before = capture === 'before';
await mkdir(output, {recursive: true});
const server = createProjectServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, protocolTimeout: 180000, args: ['--use-gl=angle', '--use-angle=d3d11'],
  });
  const reports = [];
  for (const [width, offline] of [[1600, false], [390, false], ...before ? [] : [[390, true]]]) {
    const page = await browser.newPage(), errors = [], requests = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    page.on('request', request => {if (/^https?:/.test(request.url())) requests.push(request.url());});
    await page.setViewport({width, height: 1000});
    if (offline) await page.setOfflineMode(true);
    await page.goto(offline ? pathToFileURL(resolve(output, 'tsinghua-campus-offline.html')).href
      : process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`, {waitUntil: 'load', timeout: 90000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    for (const view of ['overview', 'zijing', 'roof', 'plan']) {
      const result = await page.evaluate(({view, before}) => {
        const app = window.campusApp;
        if (view === 'zijing') document.getElementById('view-zijing').click();
        if (view === 'plan') app.mode(true);
        if (view === 'roof') {
          app.selectApartment(14, true);
          const camera = app.inspection().camera;
          const root = [...app.campus.buildings.values()].find(root => root.userData.apartmentNumbers?.includes(14));
          const detail = root.children.find(child => child.userData.campusDetail).children.find(child => child.userData.apartmentNumber === 14);
          const probe = detail.userData.windowOpenings[0];
          const target = camera.position.clone().fromArray(probe.center); target.y = detail.userData.eaveHeight + .3;
          const eye = target.clone().add(camera.position.clone().set(probe.normal[0] * 13, 2.1, probe.normal[2] * 13));
          detail.updateWorldMatrix(true, true);
          camera.position.copy(detail.localToWorld(eye)); camera.lookAt(detail.localToWorld(target));
          camera.fov = 48; camera.aspect = innerWidth / innerHeight; camera.clearViewOffset();
          camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        }
        for (let i = 0; i < 4; i++) app.render();
        const canvas = document.getElementById('scene'), rendering = app.inspection().rendering;
        const png = canvas.toDataURL(), stats = app.surroundings?.stats;
        let changedFraction = 0, addedCalls = 0, addedTriangles = 0;
        if (!before) {
          const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
          const ctx = copy.getContext('2d', {willReadFrequently: true});
          ctx.drawImage(canvas, 0, 0); const on = ctx.getImageData(0, 0, copy.width, copy.height).data;
          app.surroundings.group.visible = false; app.render();
          ctx.drawImage(canvas, 0, 0); const off = ctx.getImageData(0, 0, copy.width, copy.height).data;
          const disabled = app.inspection().rendering;
          addedCalls = rendering.calls - disabled.calls; addedTriangles = rendering.triangles - disabled.triangles;
          let changed = 0;
          for (let i = 0; i < on.length; i += 4) {
            if (Math.max(...[0, 1, 2].map(c => Math.abs(on[i + c] - off[i + c]))) > 8) changed++;
          }
          changedFraction = changed / (on.length / 4);
          app.surroundings.group.visible = true; app.render();
        }
        return {png, stats, changedFraction, addedCalls, addedTriangles, rendering,
          buildings: app.campus.buildings.size, camera: app.inspection().camera.position.toArray()};
      }, {view, before});
      await writeFile(resolve(output, `surroundings-${capture}-${width}${offline ? '-offline' : ''}-${view}.png`),
        Buffer.from(result.png.split(',')[1], 'base64'));
      delete result.png;
      assert.equal(result.buildings, 650);
      if (!before) {
        assert.ok(result.stats.buildings > 1000 && result.stats.trees > 1000);
        const passes = result.rendering.contactShadows ? 2 : 1;
        assert.ok(result.addedCalls > 0 && result.addedCalls <= 20 * passes, `${view}: extra draw calls ${result.addedCalls}`);
        assert.ok(result.addedTriangles <= 260000 * passes, `${view}: extra triangles ${result.addedTriangles}`);
        assert.ok(result.changedFraction > .04, `${view}: environment must visibly fill the background`);
      }
      reports.push({width, offline, view, ...result});
    }
    if (!before) {
      const resources = await page.evaluate(() => {
        const app = window.campusApp, uuid = app.surroundings.group.uuid;
        app.render(); const textures = app.inspection().rendering.textures;
        for (let i = 0; i < 10; i++) app.render();
        return {uuid, afterUUID: app.surroundings.group.uuid, textures, afterTextures: app.inspection().rendering.textures};
      });
      assert.equal(resources.uuid, resources.afterUUID);
      assert.equal(resources.textures, resources.afterTextures);
      await page.evaluate(() => {window.campusApp.mode(false); window.campusApp.selectApartment(14, true);});
      assert.equal(await page.evaluate(() => window.campusApp.selectedApartment()), 14);
      await page.evaluate(() => window.campusApp.visitBuilding('shunde'));
      assert.equal(await page.evaluate(() => window.campusApp.walkthrough.state().active), true);
      await page.evaluate(() => window.campusApp.walkthrough.exit());
    }
    assert.deepEqual(errors, []);
    if (offline) assert.deepEqual(requests, []);
    await page.close();
  }
  await writeFile(resolve(output, `surroundings-${capture}.json`), JSON.stringify(reports, null, 2));
  console.log(`Surroundings ${capture}: desktop/mobile, overview, Zijing, roof and plan${before ? '' : ', offline and entry'} passed.`);
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
