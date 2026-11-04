import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {createProjectServer} from './serve.mjs';

const output = resolve(import.meta.dirname, '..', 'output'), capture = process.env.INTERIOR_CAPTURE || 'after';
const before = capture === 'before';
await mkdir(output, {recursive: true});
if (!before) {
  const source = await readFile(resolve(import.meta.dirname, '..', '..', '..', 'shared', 'knowledge-labs', 'anatomy-finishes.js'), 'utf8');
  const offline = await readFile(resolve(output, 'tsinghua-campus-offline.html'), 'utf8');
  for (const line of source.slice(source.indexOf('MIT License'), source.indexOf('*/')).split('\n')
    .map(line => line.trim().replace(/^\* ?/, '').trim()).filter(Boolean)) assert.ok(offline.includes(line), `Missing offline MIT notice: ${line}`);
}
const server = createProjectServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, protocolTimeout: 180000, args: ['--use-gl=angle', '--use-angle=d3d11']});
  const reports = [];
  for (const [width, offline] of [[1600, false], [390, false], ...before ? [] : [[390, true]]]) {
    const page = await browser.newPage(), errors = [], requests = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('request', request => {if (/^https?:/.test(request.url())) requests.push(request.url());});
    await page.setViewport({width, height: width < 800 ? 844 : 1000});
    if (offline) await page.setOfflineMode(true);
    await page.goto(offline ? pathToFileURL(resolve(output, 'tsinghua-campus-offline.html')).href :
      process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`, {waitUntil: 'load', timeout: 90000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    for (const kind of ['shunde', 'jianhua']) {
      await page.evaluate(kind => window.campusApp.visitBuilding(kind), kind);
      await page.waitForFunction(() => window.campusApp.walkthrough.state().phase === 'inside');
      for (const view of kind === 'shunde' ? ['entry', 'oblique', 'neutral', 'grazing', 'markov', 'graph', 'list'] : ['entry', 'oblique']) {
        if (['markov', 'graph', 'list'].includes(view)) {
          await page.click(`[data-hall-lab="${view}"]`);
          await page.waitForFunction(() => window.campusApp.knowledgeHall.state().views.every(view => !view.animating));
        }
        const record = await page.evaluate(({kind, view}) => {
          const app = window.campusApp, camera = app.inspection().camera, scene = app.campus.group.parent;
          let anchor;
          app.campus.group.traverse(object => {if (object.userData.walkthrough?.id === kind) anchor = object;});
          if (['oblique', 'neutral', 'grazing'].includes(view)) {
            const eye = camera.position.clone().set(kind === 'shunde' ? -4.8 : -4.5, kind === 'shunde' ? 2.9 : 2.45, kind === 'shunde' ? .3 : -2.4);
            const target = camera.position.clone().set(0, kind === 'shunde' ? 2.1 : 1.95, kind === 'shunde' ? -3.8 : -6.8);
            camera.position.copy(anchor.localToWorld(eye)); camera.lookAt(anchor.localToWorld(target));
            camera.clearViewOffset(); camera.aspect = innerWidth / innerHeight; camera.fov = 65; camera.updateProjectionMatrix();
          }
          const lights = [];
          scene.traverse(light => {if (light.isLight) lights.push({light, color: light.color.clone(), intensity: light.intensity,
            position: light.position.clone(), quaternion: light.quaternion.clone(), width: light.width, height: light.height,
            target: light.target?.position.clone(), groundColor: light.groundColor?.clone()});});
          if (view === 'neutral' || view === 'grazing') {
            for (const {light} of lights) {
              light.color.set('#ffffff');
              if (light.groundColor) light.groundColor.set('#ffffff');
              if (view === 'grazing') light.intensity *= .12;
            }
            const sun = lights.find(entry => entry.light.isDirectionalLight)?.light;
            if (sun) {
              sun.intensity = view === 'neutral' ? 1.5 : .5;
              if (view === 'grazing') {
                const floor = kind === 'shunde' ? .9 : .45;
                sun.position.copy(sun.parent.worldToLocal(anchor.localToWorld(camera.position.clone().set(-25, floor + 5, 8))));
                const target = anchor.localToWorld(camera.position.clone().set(0, floor, -4));
                sun.target.position.copy(sun.target.parent ? sun.target.parent.worldToLocal(target) : target);
                sun.target.updateMatrixWorld(true);
              }
            }
            if (view === 'grazing') {
              const emitter = lights.find(entry => entry.light.isRectAreaLight)?.light;
              if (emitter) {
                emitter.intensity = 10; emitter.width = .6; emitter.height = .5;
                emitter.position.set(-4.8, kind === 'shunde' ? 1.4 : .95, kind === 'shunde' ? -2.5 : -4.8);
                emitter.lookAt(emitter.parent.localToWorld(camera.position.clone().set(3.5, kind === 'shunde' ? 1.0 : .55, kind === 'shunde' ? -3.7 : -6)));
              }
            }
          }
          app.render(true); app.render();
          const room = scene.getObjectByName('illustrative-teaching-room-finishes'), floor = room?.getObjectByName('inset-teaching-floor');
          const table = scene.getObjectByName('exhibit-table'), uv = table?.geometry.attributes.uv;
          const exhibits = [];
          for (const id of ['graph', 'list', 'markov']) {
            const root = scene.getObjectByName(`knowledge-lab-${id}`);
            if (!root) continue;
            const labels = []; root.traverse(object => {
              if (object.userData.labelRole) labels.push({role: object.userData.labelRole, sprite: Boolean(object.isSprite), visible: object.visible});
            });
            exhibits.push({id, labels});
          }
          const result = {png: document.getElementById('scene').toDataURL(), rendering: app.inspection().rendering,
            hall: app.knowledgeHall.state(), buildingCount: app.campus.buildings.size,
            finishes: room ? {parts: room.children.map(object => object.name), aoChannel: floor.material.aoMap.channel,
              aoSize: floor.material.aoMap.image.width, separateUV: floor.geometry.attributes.uv !== floor.geometry.attributes.uv1,
              mapsReady: ['map', 'normalMap', 'roughnessMap', 'aoMap'].every(key => floor.material[key]?.image?.width > 0),
              roundedTableUV: !table || table.geometry.type === 'RoundedBoxGeometry' && Math.max(...uv.array) - Math.min(...uv.array) > 2,
              localLights: room.children.filter(object => object.isRectAreaLight).map(light => ({
                position: light.position.toArray(), quaternion: light.quaternion.toArray(), intensity: light.intensity})), exhibits} : null};
          for (const {light, color, intensity, position, quaternion, width, height, target, groundColor} of lights) {
            light.color.copy(color); light.intensity = intensity; light.position.copy(position); light.quaternion.copy(quaternion);
            if (light.isRectAreaLight) {light.width = width; light.height = height;}
            if (target) {light.target.position.copy(target); light.target.updateMatrixWorld(true);}
            if (groundColor) light.groundColor.copy(groundColor);
          }
          scene.updateMatrixWorld(true);
          return result;
        }, {kind, view});
        await writeFile(resolve(output, `interior-${capture}-${width}${offline ? '-offline' : ''}-${kind}-${view}.png`),
          Buffer.from(record.png.split(',')[1], 'base64'));
        delete record.png;
        assert.equal(record.buildingCount, 650);
        if (!before) {
          assert.ok(record.hall.room.meshes <= 30 && record.hall.room.triangles < 2000);
          assert.equal(record.hall.room.areaLights, 3);
          for (const part of ['oak-acoustic-slats', 'back-wall-skirting', 'limestone-floor-joints', 'warm-linear-light',
            'teaching-room-wayfinding']) assert.ok(record.finishes.parts.includes(part), `Missing ${part}`);
          assert.equal(record.finishes.aoChannel, 1);
          assert.equal(record.finishes.aoSize, 128);
          assert.equal(record.finishes.separateUV && record.finishes.mapsReady && record.finishes.roundedTableUV, true);
          for (const {id, labels} of record.finishes.exhibits) {
            assert.equal(labels.filter(label => label.role === 'plaque' && !label.sprite).length, 1);
            const details = labels.filter(label => label.role === 'detail');
            assert.ok(details.length > 0);
            assert.ok(details.every(label => label.visible === (id === view)), 'Only the opened exhibit shows detailed labels');
          }
          if (view === 'grazing') assert.ok(record.finishes.localLights[0].position[1] < 1.5);
        }
        if (view === 'entry') await page.screenshot({path: resolve(output, `interior-${capture}-${width}-${kind}-ui.png`)});
        reports.push({width, offline, kind, view, ...record});
        if (['markov', 'graph', 'list'].includes(view)) await page.keyboard.press('Escape');
      }
      await page.click('#exit-building');
    }
    if (offline) assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
    await page.close();
  }
  await writeFile(resolve(output, `interior-${capture}.json`), JSON.stringify(reports, null, 2));
  console.log(`Interior ${capture}: Shunde/Jianhua, desktop/mobile, exhibit close-ups${before ? '' : ' and offline'} passed.`);
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
