import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {build} from 'esbuild';
import {createProjectServer} from './serve.mjs';
import {checkCampusGroundStability} from './browser-check.mjs';

const output = resolve(import.meta.dirname, '..', 'output'), suffix = process.env.LOOK_CAPTURE || 'after';
await mkdir(output, {recursive: true});
const server = createProjectServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
const reports = {};
const fixture = await build({stdin: {contents: 'export {createMasonryMaterial} from "./src/surface-materials.js";',
  resolveDir: resolve(import.meta.dirname, '..')}, bundle: true, write: false, format: 'iife', globalName: 'SurfaceFixture'});
try {
  for (const [device, width] of [['desktop', 1600], ['mobile', 390]]) {
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      headless: true, protocolTimeout: 240000,
      args: ['--use-gl=angle', '--use-angle=d3d11', '--no-proxy-server', '--disable-quic'],
    });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    await page.setViewport({width, height: 1000, deviceScaleFactor: 1});
    await page.goto(process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`, {waitUntil: 'load', timeout: 90000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    await page.addScriptTag({content: fixture.outputFiles[0].text});
    const surfaceLifecycle = await page.evaluate(() => {
      const create = SurfaceFixture.createMasonryMaterial;
      const a = create('first', [160, 90, 70]), b = create('second', [210, 150, 120]);
      const stone = create('stone', [180, 180, 160], true), old = a.map;
      let releases = 0;
      for (const key of ['map', 'normalMap', 'roughnessMap']) a[key].addEventListener('dispose', () => releases++);
      const shared = a.map === b.map && a.normalMap === b.normalMap && a.roughnessMap === b.roughnessMap;
      const distinct = a.color.getHex() !== b.color.getHex() && stone.map !== a.map;
      a.dispose(); const whileOwned = releases; b.dispose(); const afterLastOwner = releases;
      const fresh = create('fresh', [160, 90, 70]), recreated = fresh.map !== old;
      fresh.dispose(); stone.dispose();
      return {shared, distinct, whileOwned, afterLastOwner, recreated};
    });
    assert.deepEqual(surfaceLifecycle, {shared: true, distinct: true, whileOwned: 0, afterLastOwner: 3, recreated: true});
    const startup = await page.evaluate(() => ({
      readyMs: performance.getEntriesByName('campus-ready')[0].startTime,
      mapMs: performance.getEntriesByName('campus-map-visible')[0].startTime,
      rendering: window.campusApp.inspection().rendering,
    }));
    await page.$eval('#view-biology-north', button => button.click());
    const views = [
      ['north', [21, 11, -36], [0, 5.4, -9]],
      ['portal', [6, 6, -23], [0, 5.7, -9]],
      ['water', [-12, 13, -70], [0, 2, -23]],
    ];
    for (const [name, eye, target] of views) for (const lighting of name === 'portal' ? ['presentation', 'neutral', 'grazing'] : ['presentation']) {
      const capture = await page.evaluate(({eye, target, lighting}) => {
        const app = window.campusApp, camera = app.inspection().camera, scene = app.campus.group.parent;
        const root = app.campus.buildings.get('building:geometry:3ee05663e8212b498a33a67b');
        const source = root.children.find(child => child.userData.campusDetail).children[0];
        source.updateWorldMatrix(true, true);
        camera.position.set(...eye).applyMatrix4(source.matrixWorld);
        const at = camera.position.clone().set(...target).applyMatrix4(source.matrixWorld);
        camera.lookAt(at); camera.updateMatrixWorld(true);
        const sun = scene.children.find(o => o.isDirectionalLight), fill = scene.children.find(o => o.isHemisphereLight);
        const previous = {position: sun.position.clone(), color: sun.color.clone(), sun: sun.intensity, fill: fill.intensity};
        try {
          if (lighting !== 'presentation') {
            sun.color.set('#ffffff'); sun.intensity = 3; fill.intensity = lighting === 'neutral' ? 1.2 : .65;
            sun.position.copy(at).add(at.clone().set(...(lighting === 'neutral' ? [0, 90, -50] : [65, 12, -35])));
          }
          app.render(true);
          return {png: document.getElementById('scene').toDataURL('image/png'), rendering: app.inspection().rendering};
        } finally {
          sun.position.copy(previous.position); sun.color.copy(previous.color); sun.intensity = previous.sun; fill.intensity = previous.fill;
        }
      }, {eye, target, lighting});
      await writeFile(resolve(output, `look-${suffix}-${device}-${name}-${lighting}.png`), Buffer.from(capture.png.split(',')[1], 'base64'));
    }
    const reflection = await page.evaluate(() => {
      const app = window.campusApp, scene = app.campus.group.parent;
      const water = app.campus.layers.water.children.find(mesh => mesh.userData.campusPlanarWater);
      if (!water) return null;
      app.render(true);
      const canvas = document.getElementById('scene'), copy = document.createElement('canvas');
      copy.width = canvas.width; copy.height = canvas.height;
      const context = copy.getContext('2d', {willReadFrequently: true});
      const pixels = () => {context.drawImage(canvas, 0, 0); return context.getImageData(0, 0, copy.width, copy.height).data;};
      const on = pixels(), before = structuredClone(app.inspection().rendering.reflections);
      water.material.uniforms.reflectionEnabled.value = 0; app.render();
      const off = pixels();
      let changed = 0;
      for (let i = 0; i < on.length; i += 4) {
        if (Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]) > 20) changed++;
      }
      water.material.uniforms.reflectionEnabled.value = 1;
      const samples = [];
      for (let i = 0; i < 10; i++) {const start = performance.now(); app.render(); samples.push(performance.now() - start);}
      const after = structuredClone(app.inspection().rendering.reflections);
      const glass = new Set(), surfaces = new Set(), maps = new Set();
      scene.traverse(mesh => {
        if (!mesh.isMesh) return;
        for (const material of [].concat(mesh.material)) {
          if (material.userData.liveReflection) glass.add(material);
          if (material.userData.courtyardSurface) {
            surfaces.add(material);
            for (const key of ['map', 'normalMap', 'roughnessMap']) if (material[key]) maps.add(material[key]);
          }
        }
      });
      return {before, after, changedWaterPixels: changed, drawMs: samples, liveGlassMaterials: glass.size,
        glassProbes: new Set([...glass].map(m => m.envMap)).size,
        cubeSizes: [...new Set([...glass].map(m => m.envMap.image[0].width))],
        dielectric: [...glass].every(m => m.metalness === 0), surfaces: surfaces.size, surfaceMaps: maps.size,
        waterTriangles: (water.geometry.index?.count ?? water.geometry.attributes.position.count) / 3};
    });
    if (suffix !== 'before') {
      assert.ok(reflection); assert.ok(reflection.changedWaterPixels > 50, JSON.stringify(reflection));
      assert.equal(reflection.before.waterCaptures, reflection.after.waterCaptures, 'Stationary water must reuse its target');
      assert.equal(reflection.before.glass.captures, reflection.after.glass.captures, 'Stationary glass must reuse its probe');
      assert.equal(reflection.glassProbes, 1); assert.ok(reflection.dielectric);
      assert.ok(reflection.liveGlassMaterials >= 15 && reflection.surfaces >= 25);
      assert.ok(reflection.surfaceMaps <= 45, 'Shared maps must not grow with window count');
      assert.deepEqual(reflection.cubeSizes, [device === 'desktop' ? 128 : 64]);
      assert.equal(reflection.after.waterTargets, 1);
      assert.equal(reflection.after.waterResolution, device === 'desktop' ? 512 : 256);
      await page.$eval('#view-biology-north', button => button.click());
      await page.evaluate(() => new Promise(done => setTimeout(done, 1200)));
      const captures = await page.evaluate(() => window.campusApp.inspection().rendering.reflections.glass.captures);
      await page.$eval('#only-refined', input => {input.checked = true; input.dispatchEvent(new Event('change'));});
      await page.waitForFunction(previous => window.campusApp.inspection().rendering.reflections.glass.captures > previous,
        {timeout: 10000}, captures);
      await page.$eval('#only-refined', input => {input.checked = false; input.dispatchEvent(new Event('change'));});
    }
    await page.$eval('#view-all', button => button.click());
    const flicker = await checkCampusGroundStability(page);
    assert.deepEqual(errors, []);
    reports[device] = {startup, reflection, surfaceLifecycle, flicker, errors};
    await browser.close(); browser = undefined;
    console.log(JSON.stringify({device, ...reports[device]}));
  }
  await writeFile(resolve(output, `look-${suffix}.json`), JSON.stringify(reports, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
