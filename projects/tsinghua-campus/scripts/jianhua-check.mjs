import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {createProjectServer} from './serve.mjs';

const output = resolve(import.meta.dirname, '..', 'output');
const suffix = process.env.JIANHUA_CAPTURE || 'after', reports = {};
await mkdir(output, {recursive: true});
const server = createProjectServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
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
    await page.$eval('#view-sem', button => button.click());
    const views = [
      ['whole', [-2, 59, -136], [-135, 12, -5]],
      ['north', [-160, 13, -87], [-160, 11, -35]],
      ['wing', [-119, 22, 67], [-83, 14, 41]],
    ];
    const captures = [];
    for (const [name, eye, target] of views) {
      for (const lighting of name === 'north' ? ['presentation', 'neutral', 'grazing'] : ['presentation']) {
        const capture = await page.evaluate(({eye, target, lighting, name, mobile}) => {
          const app = window.campusApp, camera = app.inspection().camera, scene = app.campus.group.parent;
          const root = app.campus.buildings.get('building:geometry:62d3ed181227f777a3fc0e1f');
          const source = root.children.find(child => child.userData.campusDetail);
          source.updateWorldMatrix(true, true);
          const at = camera.position.clone().set(...target).applyMatrix4(source.matrixWorld);
          camera.position.set(...eye).applyMatrix4(source.matrixWorld);
          if (mobile) camera.position.sub(at).multiplyScalar(name === 'north' ? 1.65 : 2.1).add(at);
          camera.lookAt(at); camera.updateMatrixWorld(true);
          const sun = scene.children.find(o => o.isDirectionalLight), fill = scene.children.find(o => o.isHemisphereLight);
          const previous = {position: sun.position.clone(), color: sun.color.clone(), sun: sun.intensity, fill: fill.intensity};
          try {
            if (lighting !== 'presentation') {
              sun.color.set('#ffffff'); sun.intensity = 3; fill.intensity = lighting === 'neutral' ? 1.2 : .65;
              sun.position.copy(at).add(at.clone().set(...(lighting === 'neutral' ? [0, 90, -50] : [65, 12, -35])));
            }
            app.render(true);
            const canvas = document.getElementById('scene');
            let archPixels;
            const portal = source.getObjectByName('Jianhua north glazed entrance and interior arch');
            if (name === 'north' && portal) {
              const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
              const ctx = copy.getContext('2d', {willReadFrequently: true}); ctx.drawImage(canvas, 0, 0);
              const sample = (x, y, z) => {
                const p = portal.localToWorld(camera.position.clone().set(x, y, z)).project(camera);
                const u = Math.round((p.x + 1) * canvas.width / 2), v = Math.round((1 - p.y) * canvas.height / 2);
                const rgb = [...ctx.getImageData(u, v, 1, 1).data].slice(0, 3);
                return {u, v, luminance: rgb.reduce((a, b) => a + b, 0) / 3, inFrame: u > 0 && u < canvas.width && v > 0 && v < canvas.height};
              };
              archPixels = {pier: sample(6.05, 8, -1.45), opening: sample(.4, 12, -1.45),
                crown: sample(0, 17.25, -1.45)};
            }
            let meshes = 0, triangles = 0;
            const textures = new Set();
            source.traverse(o => {
              if (!o.isMesh) return;
              meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
              for (const material of [].concat(o.material)) for (const key of ['map', 'normalMap', 'roughnessMap']) {
                if (material[key]) textures.add(material[key]);
              }
            });
            return {png: canvas.toDataURL('image/png'), meshes, triangles, textures: textures.size, archPixels,
              stats: source.userData.meshStats, rendering: app.inspection().rendering};
          } finally {
            sun.position.copy(previous.position); sun.color.copy(previous.color); sun.intensity = previous.sun; fill.intensity = previous.fill;
          }
        }, {eye, target, lighting, name, mobile: device === 'mobile'});
        await writeFile(resolve(output, `jianhua-${suffix}-${device}-${name}-${lighting}.png`),
          Buffer.from(capture.png.split(',')[1], 'base64'));
        delete capture.png;
        if (suffix !== 'before') {
          assert.equal(capture.stats.northAtrium.archHeight, 17);
          assert.ok(capture.meshes < 180 && capture.triangles < 90000, 'SEM detail must remain batched and bounded');
          assert.ok(capture.textures <= 18, 'No textures allocated per window');
          if (name === 'north') {
            const {pier, opening, crown} = capture.archPixels;
            assert.ok([pier, opening, crown].every(p => p.inFrame), 'The arch must fit the actual desktop/mobile image');
            assert.ok(pier.luminance > opening.luminance + 15 && crown.luminance > opening.luminance + 15,
              `White arch must remain visible through real rendered glass: ${JSON.stringify(capture.archPixels)}`);
          }
        }
        captures.push({name, lighting, ...capture});
      }
    }
    if (suffix !== 'before') {
      await page.$eval('#view-jianhua', button => button.click());
      await page.screenshot({path: resolve(output, `jianhua-${suffix}-${device}-navigation.png`)});
    }
    assert.deepEqual(errors, []);
    reports[device] = {errors, captures};
    console.log(JSON.stringify({device, errors, meshes: captures[0].meshes, triangles: captures[0].triangles, textures: captures[0].textures}));
    await browser.close(); browser = undefined;
  }
  await writeFile(resolve(output, `jianhua-${suffix}.json`), JSON.stringify(reports, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
