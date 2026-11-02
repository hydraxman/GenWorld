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
      ['north-red-joint', [-83, 34, -66], [-120, 21, -32]],
      ['north-wall-sign', [-99, 13.5, -40], [-120.3, 10.8, -32.85]],
      ['north-opening', [-104, 7, -79], [-108, 6, -8]],
      ['north-column', [-56, 6, -58], [-82, 5, -26]],
      ['bridge-north', [-50, 18, -67], [-53, 12, -8]],
      ['bridge-shunde-joint', [-54, 16, -24], [-43, 12, -4]],
      ['blue-sky', [-56, 6, -58], [-56, 65, -140]],
    ]) {
      await page.$eval('#view-sem', button => button.click());
      const capture = await page.evaluate(async ({name, eye, target, mobile}) => {
        const app = window.campusApp, camera = app.inspection().camera;
        const source = app.campus.buildings.get('building:geometry:62d3ed181227f777a3fc0e1f')
          .children.find(child => child.userData.campusDetail);
        source.updateWorldMatrix(true, true);
        const at = new NorthWaterFixture.Vector3(...target).applyMatrix4(source.matrixWorld);
        camera.position.set(...eye).applyMatrix4(source.matrixWorld);
        if (mobile && name !== 'blue-sky') camera.position.sub(at).multiplyScalar(name === 'north-wall-sign' ? 1.35 : 2.5).add(at);
        camera.clearViewOffset(); camera.lookAt(at); camera.updateMatrixWorld(true);
        app.render(true);
        const image = document.getElementById('scene').toDataURL();
        const support = source.getObjectByName('Jianhua north silver cylindrical support');
        const metal = support?.children.find(mesh => mesh.material?.userData.campusMetalReflection)?.material;
        const sign = source.getObjectByName('Jianhua north red wall bilingual raised lettering');
        let lettering;
        if (name === 'north-wall-sign' && sign) {
          const canvas = document.getElementById('scene'), copy = document.createElement('canvas');
          copy.width = canvas.width; copy.height = canvas.height;
          const ctx = copy.getContext('2d', {willReadFrequently: true});
          ctx.drawImage(canvas, 0, 0);
          const pixels = () => ctx.getImageData(0, 0, copy.width, copy.height).data;
          const original = pixels();
          sign.visible = false;
          try {
            app.render(true); ctx.drawImage(canvas, 0, 0);
            const hidden = pixels();
            let changed = 0;
            for (let i = 0; i < original.length; i += 4) {
              if (Math.abs(original[i] - hidden[i]) + Math.abs(original[i + 1] - hidden[i + 1]) +
                  Math.abs(original[i + 2] - hidden[i + 2]) > 25) changed++;
            }
            lettering = {lines: sign.userData.lines, changedPixels: changed};
          } finally {sign.visible = true; app.render(true);}
        }
        let sky;
        if (name === 'blue-sky') {
          const canvas = document.getElementById('scene'), copy = document.createElement('canvas');
          copy.width = canvas.width; copy.height = canvas.height;
          const ctx = copy.getContext('2d', {willReadFrequently: true});
          const snapshot = new Image(); snapshot.src = image; await snapshot.decode();
          ctx.drawImage(snapshot, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let blue = 0, white = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 2] > pixels[i] + 45 && pixels[i + 2] > pixels[i + 1] + 10) blue++;
            if (pixels[i] > 190 && pixels[i + 1] > 190 && pixels[i + 2] - pixels[i] < 25) white++;
          }
          const background = app.campus.group.parent.getObjectByName('Campus blue sky and white clouds');
          sky = {blue: blue / (pixels.length / 4), white: white / (pixels.length / 4),
            shared: background?.material.uniforms.campusSky.value ===
              app.campus.layers.water.children[0].material.uniforms.campusSky?.value};
        }
        return {image, stats: source.userData.meshStats,
          sky, lettering,
          silver: metal ? {metalness: metal.metalness, roughness: metal.roughness,
            sharedEnvironment: metal.envMap === app.campus.group.parent.environment,
            borrowedTexture: metal.envMap?.userData.sharedCampusSurface === true} : null};
      }, {name, eye, target, mobile: device !== 'desktop'});
      await writeFile(resolve(output, `north-water-${suffix}-${device}-${name}.png`), Buffer.from(capture.image.split(',')[1], 'base64'));
      delete capture.image; captures.push({name, ...capture});
      if (!before) {
        if (name === 'blue-sky') assert.ok(capture.sky.shared && capture.sky.blue > .1 && capture.sky.white > .03,
          `${device}: expected visible blue sky AND white clouds sharing the water's panorama: ${JSON.stringify(capture.sky)}`);
        if (name === 'north-wall-sign') {
          assert.deepEqual(capture.lettering?.lines,
            ['清华大学', '经济管理学院', 'SCHOOL OF ECONOMICS AND MANAGEMENT', 'TSINGHUA UNIVERSITY']);
          assert.ok(capture.lettering.changedPixels > (device === 'desktop' ? 600 : 100),
            `${device}: raised wall text must be visible in actual pixels`);
        }
        assert.ok(capture.silver?.metalness >= .8 && capture.silver.sharedEnvironment && capture.silver.borrowedTexture,
          'Silver must use the existing environment without owning its texture or creating another probe');
      }
    }
    let junctions;
    if (!before) {
      junctions = await page.evaluate(() => {
        const T = NorthWaterFixture, app = window.campusApp;
        const detail = id => app.campus.buildings.get(id).children.find(child => child.userData.campusDetail);
        const sem = detail('building:geometry:62d3ed181227f777a3fc0e1f');
        const shunde = detail('building:geometry:6bd0154b26cfe7cf654cdd3b');
        const architecture = sem.getObjectByName('SEM red podium and glazed upper wing');
        const corridor = sem.getObjectByName('Gray enclosed elevated corridor between SEM and Shunde');
        const column = sem.getObjectByName('Jianhua north silver cylindrical support'), face = column.parent;
        const length = Math.hypot(...corridor.userData.end.map((value, i) => value - corridor.userData.start[i]));
        const sides = new Map(), contacts = [], obstructions = [], redReturn = [];
        for (const host of [architecture, shunde]) {
          host.updateWorldMatrix(true, true);
          host.traverse(o => {
            if (!o.isMesh) return;
            for (const material of [].concat(o.material)) if (!sides.has(material)) {
              sides.set(material, material.side); material.side = T.DoubleSide;
            }
          });
        }
        try {
          for (const [host, x, direction] of [[architecture, 0, -1], [shunde, length, 1]]) {
            for (const z of [-1.88, 0, 1.88]) for (const y of [9.9, 10.25, 12, 14.8, 15.1]) {
              const start = corridor.localToWorld(new T.Vector3(x - direction * 3, y, z));
              const end = corridor.localToWorld(new T.Vector3(x, y, z));
              const hit = new T.Raycaster(start, end.clone().sub(start).normalize(), 0, start.distanceTo(end))
                .intersectObject(host, true)[0];
              contacts.push({host: host === shunde ? 'shunde' : 'jianhua', y, z, distance: hit?.distance ?? null});
            }
          }
          const [a, b] = face.userData.sourceEdge, span = Math.hypot(b[0] - a[0], b[1] - a[1]);
          for (const z of [-1, -3.8, -5.7]) for (const y of [1.7, 4, 8.5]) {
            const start = face.localToWorld(new T.Vector3(-2, y, z));
            const end = face.localToWorld(new T.Vector3(span + 2, y, z));
            const hits = new T.Raycaster(start, end.clone().sub(start).normalize(), 0, start.distanceTo(end))
              .intersectObject(architecture, true).filter(hit => hit.object.parent !== column);
            obstructions.push(hits.length);
          }
          for (const z of [-36, -34, -32, -30]) for (const y of [12, 18, 21, 24, 26, 29]) {
            const start = sem.localToWorld(new T.Vector3(-116, y, z));
            const end = sem.localToWorld(new T.Vector3(-124, y, z));
            const hits = new T.Raycaster(start, end.clone().sub(start).normalize(), 0, start.distanceTo(end))
              .intersectObject(architecture, true);
            redReturn.push({y, z, hits: hits.length, material: hits[0]?.object.material.name || ''});
          }
          return {contacts, obstructions, redReturn};
        } finally {for (const [material, side] of sides) material.side = side;}
      });
      assert.ok(junctions.contacts.every(hit => hit.distance !== null && hit.distance > .5 && hit.distance <= 3),
        `Actual rendered host must meet every bridge edge: ${JSON.stringify(junctions.contacts)}`);
      assert.deepEqual(junctions.obstructions, Array(9).fill(0));
      for (const sample of junctions.redReturn) {
        if (sample.y < 22.7) assert.match(sample.material, /terracotta/i, 'The red return must have no window row');
        else assert.equal(sample.hits, 0, `Unexpected tall return window or trim: ${JSON.stringify(sample)}`);
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
          greenRange: colors.length ? [colors[Math.floor(colors.length * .1)][1], colors[Math.floor(colors.length * .9)][1]] : [],
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
      for (const sample of water.filter(sample => ['aerial', 'distant'].includes(sample.name))) {
        assert.ok(sample.greenRange[1] - sample.greenRange[0] > 10,
          `${device}/${sample.name} must show sky/cloud variation instead of a uniform fill: ${sample.greenRange}`);
        assert.equal(sample.reflections.waterEnabled, false);
      }
    }
    assert.deepEqual(errors, []);
    if (device === 'offline') assert.deepEqual(requests, []);
    report[device] = {captures, junctions, water, errors, requests: requests.length};
    await writeFile(resolve(output, `north-water-${suffix}.json`), JSON.stringify(report, null, 2));
    await browser.close(); browser = undefined;
  }
  await writeFile(resolve(output, `north-water-${suffix}.json`), JSON.stringify(report, null, 2));
  console.log(Object.fromEntries(Object.entries(report).map(([device, result]) => [device, result.water.map(({name, median, count, dark}) => ({name, median, count, dark}))])));
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
