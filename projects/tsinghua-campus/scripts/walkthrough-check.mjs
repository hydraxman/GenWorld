import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {build} from 'esbuild';
import {createProjectServer} from './serve.mjs';

const output = resolve(import.meta.dirname, '..', 'output'), report = {};
const fixture = await build({stdin: {contents: `
  export {Vector3, Raycaster, DoubleSide} from 'three';
  export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
`, resolveDir: resolve(import.meta.dirname, '..')}, bundle: true, write: false, format: 'iife', globalName: 'VisitorFixture'});
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
    const page = await browser.newPage(), errors = [], external = [], visits = [], exports = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('request', request => {if (/^https?:/.test(request.url())) external.push(request.url());});
    await page.setViewport({width, height: 1000, deviceScaleFactor: 1});
    const base = device === 'offline' ? pathToFileURL(resolve(output, 'tsinghua-campus-offline.html')).href
      : process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`;
    const url = new URL(base); url.searchParams.set('visit', 'shunde');
    await page.goto(url.href, {waitUntil: 'load', timeout: 90000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    if (device === 'desktop') {
      await page.addScriptTag({content: fixture.outputFiles[0].text});
      const cdp = await page.createCDPSession();
      await cdp.send('Browser.setDownloadBehavior', {behavior: 'deny'});
    }
    for (const kind of ['shunde', 'jianhua']) {
      if (kind === 'jianhua') {
        await page.evaluate(() => window.campusApp.mode(true));
        await page.$eval('[data-layer="building"]', checkbox => checkbox.click());
        await page.select('#visit-building', kind);
      }
      assert.equal(await page.evaluate(() => window.campusApp.walkthrough.state().active), true);
      assert.equal(await page.evaluate(() => window.campusApp.campus.layers.building.visible), true, 'Entering must restore the building layer');
      assert.equal(await page.evaluate(() => window.campusApp.walkthrough.state().id), kind);
      assert.equal(await page.evaluate(() => window.campusApp.inspection().camera.view?.enabled), false, 'Walking must clear orbit inspection view offsets');
      assert.equal(await page.$eval('#walk-controls', element => element.hidden), false);
      assert.match(await page.$eval('#walk-note', element => element.textContent), /示意/);
      await page.screenshot({path: resolve(output, `walk-${device}-${kind}-entry.png`)});
      if (device === 'desktop') await page.keyboard.down('w');
      else {
        const rect = await (await page.$('[data-walk="forward"]')).boundingBox();
        await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
      }
      // The new central teaching table stops a straight Shunde walk before z=-3.
      const interiorLimit = kind === 'shunde' ? -2.75 : -3;
      await page.waitForFunction(limit => window.campusApp.walkthrough.state().position[1] < limit, {timeout: 15000}, interiorLimit);
      if (device === 'desktop') await page.keyboard.up('w'); else await page.mouse.up();
      const state = await page.evaluate(() => {
        const app = window.campusApp; app.render(true);
        const canvas = document.getElementById('scene');
        return {...app.walkthrough.state(), camera: app.inspection().camera.position.toArray(), image: canvas.toDataURL()};
      });
      assert.ok(state.position[1] < interiorLimit);
      if (kind === 'shunde') assert.ok(state.position[1] > -3, 'Visitor must stop before the pond table');
      await writeFile(resolve(output, `walk-${device}-${kind}-interior.png`), Buffer.from(state.image.split(',')[1], 'base64'));
      delete state.image;
      await page.screenshot({path: resolve(output, `walk-${device}-${kind}-interior-ui.png`)});
      const look = async (dx, dy = 0) => {
        const x = dx < 0 ? 270 : 70;
        await page.mouse.move(x, 260); await page.mouse.down();
        await page.mouse.move(x + dx, 260 + dy, {steps: 12}); await page.mouse.up();
      };
      for (let i = 0; i < 3; i++) await look(200, 8);
      assert.ok(Math.abs((await page.evaluate(() => window.campusApp.walkthrough.state().yaw)) - state.yaw + 3) < .02);
      await page.evaluate(() => window.campusApp.render(true));
      await page.screenshot({path: resolve(output, `walk-${device}-${kind}-interior-looking-out.png`)});
      for (let i = 0; i < 3; i++) await look(-200, -8);
      if (device === 'mobile') {
        await page.setViewport({width: 430, height: 932});
        assert.equal(await page.evaluate(() => window.campusApp.walkthrough.state().active), true, 'Resize must not exit walking');
      }
      await page.keyboard.down('s');
      await page.waitForFunction(() => window.campusApp.walkthrough.state().position[1] > 4, {timeout: 15000});
      await page.keyboard.up('s');
      if (device === 'desktop') await page.keyboard.press('Escape');
      else await page.click('#exit-building');
      assert.equal(await page.evaluate(() => window.campusApp.walkthrough.state().active), false);
      assert.equal(await page.$eval('#walk-controls', element => element.hidden), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      visits.push(state);
      if (device === 'desktop') {
        exports.push(await page.evaluate(async kind => {
          const T = VisitorFixture, app = window.campusApp, createURL = URL.createObjectURL;
          let blob;
          URL.createObjectURL = value => {if (value.type === 'model/gltf-binary') blob = value; return createURL.call(URL, value);};
          try {await app.exportSelectedModel();} finally {URL.createObjectURL = createURL;}
          if (!blob) throw new Error('Selected visitor building was not exported.');
          const {scene} = await new T.GLTFLoader().parseAsync(await blob.arrayBuffer(), '');
          const geometries = new Set(), materials = new Set(), textures = new Set(), identities = [];
          let anchor;
          scene.traverse(object => {
            if (object.userData.walkthrough?.id === kind) anchor = object;
            if (object.userData.featureId) identities.push(object.userData.featureId);
            if (!object.isMesh) return;
            geometries.add(object.geometry);
            for (const material of [].concat(object.material)) {
              materials.add(material); material.side = T.DoubleSide;
              for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
            }
          });
          try {
            if (!anchor || identities.length !== 1) throw new Error('Exported lobby identity or source anchor is missing.');
            scene.updateMatrixWorld(true);
            const floor = anchor.userData.walkthrough.zones.at(-1).floor;
            for (const x of [-.4, 0, .4]) {
              const start = anchor.localToWorld(new T.Vector3(x, floor + 1.65, 4.5));
              const end = anchor.localToWorld(new T.Vector3(x, floor + 1.65, -3.2));
              const ray = new T.Raycaster(start, end.clone().sub(start).normalize(), 0, start.distanceTo(end));
              if (ray.intersectObject(scene, true).length) throw new Error('Exported lobby door is obstructed.');
            }
            const origin = anchor.localToWorld(new T.Vector3(0, floor + 1.5, -3));
            const hit = new T.Raycaster(origin, new T.Vector3(0, -1, 0), 0, 3).intersectObject(scene, true)[0];
            if (!hit || Math.abs(anchor.worldToLocal(hit.point.clone()).y - floor) > .02) throw new Error('Exported lobby has no supporting floor.');
            const notice = [...materials].find(material => material.name === 'Illustrative visitor lobby notice');
            if (!notice?.map) throw new Error('The rendered lobby limitation notice was not exported.');
            return {kind, bytes: blob.size, identities, doorwayRays: 3};
          } finally {
            geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
            textures.forEach(texture => texture.dispose());
          }
        }, kind));
      }
    }
    assert.equal(await page.$('#export-all'), null);
    assert.deepEqual(errors, []);
    if (device === 'offline') assert.deepEqual(external, []);
    report[device] = {visits, exports, errors, requests: external.length};
    await browser.close(); browser = undefined;
  }
  await writeFile(resolve(output, 'walkthrough-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
