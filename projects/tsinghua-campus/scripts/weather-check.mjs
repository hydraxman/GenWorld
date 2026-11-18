import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {build} from 'esbuild';
import {createProjectServer} from './serve.mjs';
import {CAMPUS_WEATHER} from '../src/campus-weather.js';

const output = resolve(import.meta.dirname, '..', 'output'), tag = process.env.WEATHER_CAPTURE || 'after';
const before = tag.endsWith('before'), server = createProjectServer();
const loader = await build({stdin: {contents: "export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';",
  resolveDir: resolve(import.meta.dirname, '..')}, bundle: true, write: false, format: 'iife', globalName: 'WeatherFixture'});
await mkdir(output, {recursive: true});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  for (const [device, width] of before ? [['desktop', 1440]] : [['desktop', 1440], ['offline', 390]]) {
    browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      headless: true, protocolTimeout: 240000, args: ['--use-gl=angle', '--use-angle=d3d11', '--disable-quic']});
    const page = await browser.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
    page.on('request', r => {if (/^https?:/.test(r.url())) requests.push(r.url());});
    await page.setViewport({width, height: device === 'desktop' ? 900 : 844});
    const url = new URL(device === 'offline' ? pathToFileURL(resolve(output, 'tsinghua-campus-offline.html'))
      : process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`);
    url.searchParams.set('view', 'music-hall');
    if (!before) url.searchParams.set('weather', 'sunset');
    await page.goto(url.href, {waitUntil: 'load', timeout: 150000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 150000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    const click = id => page.$eval(`#${id}`, e => e.click());
    const settle = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const capture = async name => {
      await settle();
      const png = await page.evaluate(() => {
        window.campusApp.render(true);
        return document.querySelector('#scene').toDataURL();
      });
      await writeFile(resolve(output, `weather-${tag}-${device}-${name}.png`), Buffer.from(png.split(',')[1], 'base64'));
    };
    if (!before) {
      assert.equal(await page.$eval('#campus-weather', e => e.value), 'sunset');
      await page.select('#campus-weather', 'clear');
    }
    for (const id of ['art-museum', 'music-hall', 'sports-center', 'old-library', 'tongfang', 'zijing-8', 'zijing-23']) {
      if (id.startsWith('zijing-')) await page.select('#zijing-apartment', id.slice(7));
      else await click(`view-${id}`);
      await capture(id);
      if (!before && device === 'desktop' && ['art-museum', 'music-hall'].includes(id)) {
        for (const light of ['overcast', 'sunset']) {
          await page.select('#campus-weather', light); await capture(`${id}-${light}`);
        }
        await page.select('#campus-weather', 'clear');
      }
    }
    const cached = await page.evaluate(() => {
      const app = window.campusApp, counts = () => {
        const r = app.inspection().rendering.reflections; return [r.waterCaptures, r.glass.captures];
      };
      const a = counts(); for (let i = 0; i < 5; i++) app.render(); return [a, counts()];
    });
    assert.deepEqual(cached[0], cached[1], 'A stationary camera must not recapture weather reflections');
    if (!before) {
      await click('view-riverside');
      const state = () => page.evaluate(() => {
        const app = window.campusApp, scene = app.campus.group.parent, camera = app.inspection().camera;
        const sun = scene.children.find(o => o.isDirectionalLight), water = app.campus.layers.water.children[0].material.uniforms;
        const sky = scene.getObjectByName('Campus blue sky and white clouds').material.uniforms.campusSky.value;
        return {position: camera.position.toArray(), facing: camera.quaternion.toArray(), textures: app.inspection().rendering.textures,
          sun: sun.position.clone().sub(sun.target.position).normalize().toArray(), waterSun: water.campusSunDirection.value.toArray(),
          sky: sky.uuid, shared: sky === water.campusSky.value, preset: sky.userData.weather, environment: scene.environment.uuid,
          roughness: app.campus.layers.road.children[0].material.roughness, name: document.querySelector('#selection-name').textContent};
      });
      await capture('river-clear'); const initial = await state();
      for (const id of ['sunset', 'overcast', 'after-rain', 'clear']) {
        await page.select('#campus-weather', id); await capture(`river-${id}`);
        const s = await state(), p = CAMPUS_WEATHER[id];
        assert.deepEqual(s.position, initial.position); assert.deepEqual(s.facing, initial.facing);
        assert.equal(s.name, initial.name); assert.ok(s.shared); assert.equal(s.preset, id);
        assert.equal(s.sky, initial.sky); assert.equal(s.environment, initial.environment);
        assert.deepEqual(s.waterSun, s.sun);
        p.direction.forEach((v, i) => assert.ok(Math.abs(s.sun[i] - v / Math.hypot(...p.direction)) < 1e-8));
        if (p.wet) assert.ok(s.roughness < .40); else assert.equal(s.roughness, initial.roughness);
        assert.ok(s.textures <= initial.textures + 1, 'Switching weather must reuse sky, probes and PMREM targets');
      }
      await page.select('#campus-weather', 'sunset'); await click('view-old-library'); await settle();
      let s = await state(); assert.ok(s.sun[0] < -.8, 'Refocusing must preserve the setting sun');
      await click('view-plan'); await settle(); s = await state(); assert.equal(s.preset, 'clear');
      assert.ok(await page.$eval('#campus-weather', e => e.disabled));
      await click('view-3d'); await settle(); assert.equal((await state()).preset, 'sunset');
      await click('view-art-museum');
      if (device === 'desktop') {
        await page.addScriptTag({content: loader.outputFiles[0].text});
        const result = await page.evaluate(async () => {
          let blob; const original = URL.createObjectURL;
          URL.createObjectURL = function(value) {if (value.type === 'model/gltf-binary') blob = value; return original.call(URL, value);};
          try {await window.campusApp.exportSelectedModel();} finally {URL.createObjectURL = original;}
          const gltf = await new WeatherFixture.GLTFLoader().parseAsync(await blob.arrayBuffer(), '');
          let museum = false, courses = false, sky = false;
          gltf.scene.traverse(o => {
            museum ||= o.userData.referenceSite === 'art-museum';
            courses ||= Boolean(o.material?.name?.includes('banded sandstone') && o.material.map && o.material.normalMap);
            sky ||= Boolean(o.isLight || o.material?.envMap || o.userData.campusPlanarWater);
          });
          return {museum, courses, sky};
        });
        assert.deepEqual(result, {museum: true, courses: true, sky: false});
      }
      await page.evaluate(() => window.campusApp.visitBuilding('shunde')); await settle();
      assert.ok(await page.$eval('#walk-controls', e => !e.hidden));
      assert.ok(await page.$eval('.weather-picker', e => e.getClientRects().length === 0));
      await click('exit-building'); await settle();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (device === 'offline') assert.deepEqual(requests, []);
      await page.screenshot({path: resolve(output, `weather-${tag}-${device}-ui.png`)});
    }
    assert.deepEqual(errors, []);
    console.log(`${tag}: ${device} campus captures complete`);
    await browser.close(); browser = undefined;
  }
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
