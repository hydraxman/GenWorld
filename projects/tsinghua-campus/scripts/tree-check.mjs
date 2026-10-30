import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {createProjectServer} from './serve.mjs';
import {checkCampusGroundStability} from './browser-check.mjs';

const output = resolve(import.meta.dirname, '..', 'output'), phase = process.env.TREE_CAPTURE || 'after';
await mkdir(output, {recursive: true});
const server = createProjectServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, protocolTimeout: 180000, args: ['--use-gl=angle', '--use-angle=d3d11', '--no-proxy-server', '--disable-quic'],
  });
  const report = {};
  for (const [device, viewport] of Object.entries({desktop: {width: 1600, height: 1000}, mobile: {width: 390, height: 844}})) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.setViewport(viewport);
    await page.goto(process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`, {waitUntil: 'load', timeout: 90000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    const overview = await page.evaluate(() => {
      const app = window.campusApp; app.render();
      return {...app.inspection().rendering, stats: app.stats.landscape,
        trees: app.campus.layers.trees.userData.treeLOD || null};
    });
    const views = [];
    for (const mode of ['context', 'isolated', 'neutral', 'grazing']) {
      const capture = await page.evaluate(({mode, phase}) => {
        const app = window.campusApp, layer = app.campus.layers.trees, {camera} = app.inspection();
        const visibility = new Map(Object.values(app.campus.layers).map(l => [l, l.visible]));
        const scene = app.campus.group.parent, sun = scene.children.find(o => o.isDirectionalLight);
        const fill = scene.children.find(o => o.isHemisphereLight);
        const saved = {sun: sun.intensity, fill: fill.intensity, position: sun.position.clone(), color: sun.color.clone()};
        const tree = [...layer.userData.trees].sort((a, b) =>
          Math.hypot(a.position[0] + 550, a.position[1] - 25) - Math.hypot(b.position[0] + 550, b.position[1] - 25))[0];
        const target = camera.position.clone().set(tree.position[0], 4.8, tree.position[1]);
        camera.position.copy(target).add(target.clone().set(10, 5, 13));
        camera.lookAt(target); camera.updateMatrixWorld(true);
        try {
          if (mode !== 'context') for (const [l] of visibility) if (l !== layer && l !== app.campus.layers.green) l.visible = false;
          if (mode === 'neutral' || mode === 'grazing') {
            sun.color.set('#ffffff'); sun.intensity = 2.8; fill.intensity = mode === 'neutral' ? 1.2 : .65;
            sun.position.copy(target).add(target.clone().set(...(mode === 'neutral' ? [0, 60, 35] : [60, 8, 35])));
          }
          const samples = [];
          for (let i = 0; i < 12; i++) {const start = performance.now(); app.render(); samples.push(performance.now() - start);}
          const canvas = document.getElementById('scene'), copy = document.createElement('canvas');
          copy.width = canvas.width; copy.height = canvas.height; copy.getContext('2d').drawImage(canvas, 0, 0);
          const lod = layer.userData.treeLOD || null;
          if (phase !== 'before' && (!lod || lod.nearTrees < 1)) throw new Error('Close-up did not activate original courtyard leaves.');
          return {image: copy.toDataURL(), rendering: app.inspection().rendering, samples, lod, tree};
        } finally {
          for (const [l, visible] of visibility) l.visible = visible;
          sun.intensity = saved.sun; fill.intensity = saved.fill; sun.position.copy(saved.position); sun.color.copy(saved.color);
        }
      }, {mode, phase});
      await writeFile(resolve(output, `trees-${phase}-${device}-${mode}.png`), Buffer.from(capture.image.split(',')[1], 'base64'));
      delete capture.image; views.push({mode, ...capture});
    }
    await page.$eval('#view-all', b => b.click());
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const flicker = await checkCampusGroundStability(page);
    assert.deepEqual(errors, []);
    report[device] = {overview, views, flicker, errors};
    console.log(JSON.stringify({device, overview, near: views[0].lod, errors}));
    await page.close();
  }
  await writeFile(resolve(output, `trees-${phase}.json`), JSON.stringify(report, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
