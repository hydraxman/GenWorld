import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {build} from 'esbuild';
import {createProjectServer} from './serve.mjs';

const output = resolve(import.meta.dirname, '..', 'output'), suffix = process.env.NORTH_WATER_CAPTURE || 'after';
const before = suffix.endsWith('before'), report = {};
const fixture = await build({stdin: {contents: "export {Raycaster, Vector3, DoubleSide} from 'three';",
  resolveDir: resolve(import.meta.dirname, '..')}, bundle: true, write: false, format: 'iife', globalName: 'NorthWaterFixture'});
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
    const page = await browser.newPage(), errors = [], requests = [], captures = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('request', request => {if (/^https?:/.test(request.url())) requests.push(request.url());});
    await page.setViewport({width, height: 1000, deviceScaleFactor: 1});
    await page.goto(device === 'offline' ? pathToFileURL(resolve(output, 'tsinghua-campus-offline.html')).href
      : process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`, {waitUntil: 'load', timeout: 90000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    await page.addScriptTag({content: fixture.outputFiles[0].text});
    for (const [name, eye, target] of [
      ['north-overall', [20, 20, -155], [-114, 13, -10]],
      ['north-opening', [-104, 7, -79], [-108, 6, -8]],
      ['north-column', [-56, 6, -58], [-82, 5, -26]],
    ]) {
      await page.$eval('#view-sem', button => button.click());
      const capture = await page.evaluate(({eye, target, mobile}) => {
        const app = window.campusApp, camera = app.inspection().camera;
        const source = app.campus.buildings.get('building:geometry:62d3ed181227f777a3fc0e1f')
          .children.find(child => child.userData.campusDetail);
        source.updateWorldMatrix(true, true);
        const at = new NorthWaterFixture.Vector3(...target).applyMatrix4(source.matrixWorld);
        camera.position.set(...eye).applyMatrix4(source.matrixWorld);
        if (mobile) camera.position.sub(at).multiplyScalar(2.5).add(at);
        camera.clearViewOffset(); camera.lookAt(at); camera.updateMatrixWorld(true);
        app.render(true);
        const support = source.getObjectByName('Jianhua north silver cylindrical support');
        const metal = support?.children.find(mesh => mesh.material?.userData.campusMetalReflection)?.material;
        return {image: document.getElementById('scene').toDataURL(), stats: source.userData.meshStats,
          silver: metal ? {metalness: metal.metalness, roughness: metal.roughness,
            sharedEnvironment: metal.envMap === app.campus.group.parent.environment,
            borrowedTexture: metal.envMap?.userData.sharedCampusSurface === true} : null};
      }, {eye, target, mobile: device !== 'desktop'});
      await writeFile(resolve(output, `north-water-${suffix}-${device}-${name}.png`), Buffer.from(capture.image.split(',')[1], 'base64'));
      delete capture.image; captures.push({name, ...capture});
      if (!before) {
        assert.ok(capture.silver?.metalness >= .8 && capture.silver.sharedEnvironment && capture.silver.borrowedTexture,
          'Silver must use the existing environment without owning its texture or creating another probe');
      }
    }
    const water = [];
    for (const [name, eye, target, nearView, plan] of [
      ['near', [-555, 22, 275], [-585, 0, 220], true, false],
      ['aerial', [-560, 320, 420], [-585, 0, 220], false, false],
      ['distant', [-400, 900, 1100], [-585, 0, 220], false, false],
      ['fade-below', [-560, 379.9, 420], [-585, 0, 220], true, false],
      ['fade-above', [-560, 380.3, 420], [-585, 0, 220], true, false],
      ['plan', null, null, false, true],
    ]) {
      if (plan) await page.$eval('#view-plan', button => button.click());
      else {
        await page.$eval('#view-3d', button => button.click());
        await page.$eval(nearView ? '#view-riverside' : '#view-all', button => button.click());
      }
      const sample = await page.evaluate(({eye, target, plan}) => {
        const app = window.campusApp, camera = app.inspection().camera;
        if (!plan) {camera.position.set(...eye); camera.lookAt(new NorthWaterFixture.Vector3(...target));}
        camera.clearViewOffset(); camera.updateMatrixWorld(true); app.render(true);
        const canvas = document.getElementById('scene'), copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext('2d', {willReadFrequently: true});
        ctx.drawImage(canvas, 0, 0);
        const surface = app.campus.layers.water.children[0], geometry = surface.geometry, p = geometry.attributes.position;
        const colors = [], ray = new NorthWaterFixture.Raycaster(), point = new NorthWaterFixture.Vector3();
        const scene = app.campus.group.parent;
        for (let i = 0; i < (geometry.index?.count ?? p.count); i += 3) {
          point.set(0, 0, 0);
          for (let j = 0; j < 3; j++) point.add(new NorthWaterFixture.Vector3().fromBufferAttribute(p, geometry.index ? geometry.index.getX(i + j) : i + j));
          point.multiplyScalar(1 / 3).applyMatrix4(surface.matrixWorld);
          const projected = point.clone().project(camera);
          if (Math.abs(projected.x) > .94 || Math.abs(projected.y) > .94 || Math.abs(projected.z) > 1) continue;
          const x = Math.floor((projected.x + 1) * canvas.width / 2), y = Math.floor((1 - projected.y) * canvas.height / 2);
          const interior = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => {
            ray.setFromCamera({x: (x + dx + .5) / canvas.width * 2 - 1, y: 1 - (y + dy + .5) / canvas.height * 2}, camera);
            const hit = ray.intersectObject(scene, true).find(hit => {
              for (let object = hit.object; object; object = object.parent) if (!object.visible) return false;
              return hit.object.isMesh;
            });
            return hit?.object === surface;
          });
          if (!interior) continue;
          colors.push([...ctx.getImageData(x, y, 1, 1).data].slice(0, 3));
        }
        colors.sort((a, b) => a[1] - b[1]);
        return {image: canvas.toDataURL(), count: colors.length, median: colors[Math.floor(colors.length / 2)],
          dark: colors.filter(rgb => rgb[1] < 125 || rgb[2] < rgb[1] - 12).length,
          reflections: app.inspection().rendering.reflections};
      }, {eye, target, plan});
      await writeFile(resolve(output, `north-water-${suffix}-${device}-water-${name}.png`), Buffer.from(sample.image.split(',')[1], 'base64'));
      assert.ok(sample.count >= (nearView ? 3 : 8), `${device}/${name} needs visible mapped water samples, got ${sample.count}`);
      if (!before && name !== 'near') {
        assert.ok(sample.median[1] >= 130 && sample.median[2] >= sample.median[1], `${device}/${name} dark/green fallback: ${sample.median}`);
        assert.ok(sample.dark / sample.count < .1, `${device}/${name} still contains dark fallback water: ${sample.dark}/${sample.count}`);
      }
      delete sample.image; water.push({name, ...sample});
    }
    if (!before) {
      const below = water.find(sample => sample.name === 'fade-below'), above = water.find(sample => sample.name === 'fade-above');
      assert.equal(below.reflections.waterEnabled, true);
      assert.equal(above.reflections.waterEnabled, false);
      assert.ok(below.median.every((value, i) => Math.abs(value - above.median[i]) < 3),
        'Turning off the high-altitude reflection must not produce a color step');
      assert.ok(water.every(sample => sample.reflections.waterTargets === 1));
    }
    assert.deepEqual(errors, []);
    if (device === 'offline') assert.deepEqual(requests, []);
    report[device] = {captures, water, errors, requests: requests.length};
    await writeFile(resolve(output, `north-water-${suffix}.json`), JSON.stringify(report, null, 2));
    await browser.close(); browser = undefined;
  }
  await writeFile(resolve(output, `north-water-${suffix}.json`), JSON.stringify(report, null, 2));
  console.log(Object.fromEntries(Object.entries(report).map(([device, result]) => [device, result.water.map(({name, median, count, dark}) => ({name, median, count, dark}))])));
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
