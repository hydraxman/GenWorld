import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import {startServer} from './server.mjs';

const output = path.resolve(import.meta.dirname, '..', 'qa'), suffix = process.env.TOWER_LOOK || 'after';
const server = await startServer({port: 0});
let browser;
try {
  browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, args: ['--use-gl=angle', '--use-angle=d3d11']});
  await mkdir(output, {recursive: true});
  const report = {};
  for (const width of [1600, 390]) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.setViewport({width, height: 1000, deviceScaleFactor: 1});
    await page.goto(`http://127.0.0.1:${server.address().port}`, {waitUntil: 'networkidle0'});
    await page.waitForFunction(() => window.__knowledgeReady && window.__publicAssetsReady);
    await page.screenshot({path: path.join(output, `look-${suffix}-${width}-whole.png`), fullPage: true});
    await page.evaluate(() => {
      const {camera, tower, render} = window.__knowledgeInspection();
      const target = tower.getFloorPosition(6); target.x = -10.75; target.y += 3.3; target.z = -4;
      camera.position.copy(target); camera.position.x -= 14; camera.position.y += .6; camera.position.z += 7;
      camera.clearViewOffset(); camera.lookAt(target); camera.updateMatrixWorld(true); render();
    });
    await page.screenshot({path: path.join(output, `look-${suffix}-${width}-joints.png`), fullPage: true});
    await page.click('#floor-nav [data-floor="4"]');
    await page.screenshot({path: path.join(output, `look-${suffix}-${width}-gallery.png`), fullPage: true});
    report[width] = await page.evaluate(() => {
      const {tower, surfaces} = window.__knowledgeInspection(), materials = new Set(), textures = new Set();
      tower.group.traverse(object => {
        for (const material of [].concat(object.material ?? [])) {
          materials.add(material);
          for (const key of ['map', 'normalMap', 'roughnessMap']) if (material[key]) textures.add(material[key]);
        }
      });
      const deck = tower.group.getObjectByName('floor-4').getObjectByName('gallery-deck'), uv = deck.geometry.getAttribute('uv');
      const values = Array.from({length: uv.count}, (_, index) => uv.getX(index));
      return {materials: materials.size, textures: textures.size, surfaces,
        deckUSpan: Math.max(...values) - Math.min(...values)};
    });
    if (suffix !== 'before') {
      assert.equal(report[width].surfaces.textures, 6);
      assert.ok(report[width].surfaces.uvGeometries < 160);
      assert.ok(Math.abs(report[width].deckUSpan - 7.6 / 2.4) < .00001, 'Wood must use real metres, not stretched unit-box UVs');
      for (const lighting of ['presentation', 'neutral', 'grazing']) {
        await page.evaluate(lighting => {
          const {camera, tower, scene, render} = window.__knowledgeInspection();
          const target = tower.getFloorPosition(4); target.set(5.8, target.y + .65, 4.5);
          camera.position.copy(target); camera.position.x += 6; camera.position.y += 3; camera.position.z += 8;
          camera.lookAt(target); camera.clearViewOffset(); camera.updateMatrixWorld(true);
          if (lighting !== 'presentation') {
            const sun = scene.children.find(object => object.isDirectionalLight);
            sun.position.set(lighting === 'grazing' ? -16 : 12, lighting === 'grazing' ? 3 : 30, 16);
            sun.target.position.copy(target); sun.intensity = 2.2; sun.color.set('#ffffff');
          }
          render();
        }, lighting);
        await page.screenshot({path: path.join(output, `look-${suffix}-${width}-${lighting}.png`), fullPage: true});
      }
    }
    assert.deepEqual(errors, []); await page.close();
  }
  await writeFile(path.join(output, `look-${suffix}.json`), JSON.stringify(report, null, 2));
  console.log(`Tower ${suffix}: joint/whole/gallery desktop and mobile captures saved.`);
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
