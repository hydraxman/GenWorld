import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {build} from 'esbuild';
import {createProjectServer} from './serve.mjs';

const output = resolve(import.meta.dirname, '..', 'output');
const suffix = process.env.JIANHUA_CAPTURE || 'after', reports = {};
const before = suffix === 'before' || suffix.endsWith('-before');
const fixture = await build({stdin: {contents: `
  export {Mesh, PlaneGeometry, MeshBasicMaterial, Vector3, Raycaster, DoubleSide} from 'three';
  export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
`, resolveDir: resolve(import.meta.dirname, '..')}, bundle: true, write: false, format: 'iife', globalName: 'PassageFixture'});
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
    const page = await browser.newPage(), errors = [], network = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('request', request => {if (/^https?:/.test(request.url())) network.push(request.url());});
    await page.setViewport({width, height: 1000, deviceScaleFactor: 1});
    await page.goto(process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`, {waitUntil: 'load', timeout: 90000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    await page.addScriptTag({content: fixture.outputFiles[0].text});
    await page.$eval('#view-sem', button => button.click());
    const views = [
      ['whole', [-2, 59, -136], [-135, 12, -5]],
      ['north', [-160, 13, -87], [-160, 11, -35]],
      ['wing', [-119, 22, 67], [-83, 14, 41]],
      ['passage', [-137, 9, 20], [-81, 7.5, 20]],
      ['passage-east', [-47, 5.5, 20], [-110, 4.8, 20]],
    ];
    const captures = [];
    for (const [name, eye, target] of views) {
      if (device === 'mobile' && name === 'passage-east') continue;
      for (const lighting of name === 'north' ? ['presentation', 'neutral', 'grazing'] : ['presentation']) {
        const capture = await page.evaluate(({eye, target, lighting, name, mobile}) => {
          const app = window.campusApp, camera = app.inspection().camera, scene = app.campus.group.parent;
          const root = app.campus.buildings.get('building:geometry:62d3ed181227f777a3fc0e1f');
          const source = root.children.find(child => child.userData.campusDetail);
          source.updateWorldMatrix(true, true);
          const at = camera.position.clone().set(...target).applyMatrix4(source.matrixWorld);
          camera.position.set(...eye).applyMatrix4(source.matrixWorld);
          if (mobile) camera.position.sub(at).multiplyScalar(name === 'north' ? 1.65 : name === 'passage' ? 1.3 : 2.1).add(at);
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
        if (!before) {
          assert.equal(capture.stats.northAtrium.archHeight, 17);
          assert.ok(capture.meshes < 180 && capture.triangles < 90000, 'SEM detail must remain batched and bounded');
          assert.ok(capture.textures <= 18, 'No textures allocated per window');
          assert.equal(capture.stats.passage.width, 17);
          assert.equal(capture.stats.passage.clearHeight, 9.76);
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
    let passageVisibility, exported;
    if (!before) {
      await page.$eval('#view-jianhua', button => button.click());
      await page.screenshot({path: resolve(output, `jianhua-${suffix}-${device}-navigation.png`)});
      await page.$eval('#view-jianhua-passage', button => button.click());
      await page.screenshot({path: resolve(output, `jianhua-${suffix}-${device}-passage-navigation.png`)});
      passageVisibility = await page.evaluate(() => {
        const T = PassageFixture, app = window.campusApp, camera = app.inspection().camera;
        const scene = app.campus.group.parent, root = app.campus.buildings.get('building:geometry:62d3ed181227f777a3fc0e1f');
        const source = root.children.find(c => c.userData.campusDetail), passage = source.userData.meshStats.passage;
        const marker = new T.Mesh(new T.PlaneGeometry(3, 3), new T.MeshBasicMaterial({color: '#00ff00',
          toneMapped: false, fog: false, side: T.DoubleSide}));
        marker.name = 'Temporary far-exit visibility diagnostic';
        marker.rotation.y = Math.PI / 2;
        scene.add(marker);
        const saved = {position: camera.position.clone(), quaternion: camera.quaternion.clone()};
        const results = [];
        try {
          for (const direction of [-1, 1]) {
            const start = direction === 1 ? passage.west[0] - 18 : passage.east[0] + 8;
            const end = direction === 1 ? passage.east[0] + 4 : passage.west[0] - 4;
            camera.position.set(start, 4, 20).applyMatrix4(source.matrixWorld);
            marker.position.set(end, 4, 20).applyMatrix4(source.matrixWorld);
            camera.lookAt(marker.position); camera.updateMatrixWorld(true);
            const canvas = document.getElementById('scene'), copy = document.createElement('canvas');
            copy.width = canvas.width; copy.height = canvas.height;
            const ctx = copy.getContext('2d', {willReadFrequently: true});
            const read = () => {
              app.render(true); ctx.drawImage(canvas, 0, 0);
              const p = marker.position.clone().project(camera);
              return [...ctx.getImageData(Math.round((p.x + 1) * canvas.width / 2),
                Math.round((1 - p.y) * canvas.height / 2), 1, 1).data].slice(0, 3);
            };
            const rgb = read();
            marker.visible = false;
            const background = read();
            marker.visible = true;
            // Calibrate through the same postprocessing path instead of assuming raw sRGB output.
            marker.position.set(start + direction * 2, 4, 20).applyMatrix4(source.matrixWorld);
            const unobstructed = read();
            results.push({direction, rgb, background, unobstructed});
          }
        } finally {
          scene.remove(marker); marker.geometry.dispose(); marker.material.dispose();
          camera.position.copy(saved.position); camera.quaternion.copy(saved.quaternion); camera.updateMatrixWorld(true);
          app.render(true);
        }
        return results;
      });
      for (const {direction, rgb, background, unobstructed} of passageVisibility) {
        assert.ok(rgb.every((value, i) => Math.abs(value - unobstructed[i]) < 6)
          && rgb.reduce((sum, value, i) => sum + Math.abs(value - background[i]), 0) > 80,
        `Far-exit diagnostic must match unobstructed output, not the wall (${direction}): ${JSON.stringify({rgb, background, unobstructed})}`);
      }
      if (device === 'desktop') {
        const result = await page.evaluate(async () => {
          const T = PassageFixture, app = window.campusApp;
          const id = 'building:geometry:62d3ed181227f777a3fc0e1f', original = URL.createObjectURL;
          let blob;
          try {
            URL.createObjectURL = function (value) {
              if (value instanceof Blob && value.type === 'model/gltf-binary') blob = value;
              return original.call(URL, value);
            };
            app.select(id); await app.exportModel(false);
          } finally {URL.createObjectURL = original;}
          if (!blob) throw new Error('Actual selected-building GLB was not captured.');
          const loaded = await new T.GLTFLoader().parseAsync(await blob.arrayBuffer(), '');
          let detail;
          loaded.scene.traverse(o => {if (o.userData.referenceSite === 'sem-complex' && o.userData.meshStats?.passage) detail = o;});
          if (!detail?.userData.meshStats?.passage) throw new Error('The exported passage metadata is missing.');
          loaded.scene.updateMatrixWorld(true);
          const materials = new Set(), geometries = new Set(), textures = new Set(), ids = [];
          loaded.scene.traverse(o => {
            if (o.userData.featureId) ids.push(o.userData.featureId);
            if (!o.isMesh) return;
            geometries.add(o.geometry);
            for (const m of [].concat(o.material)) {
              if (m.userData.liveReflection) throw new Error('Live reflection leaked into the exported GLB.');
              materials.add(m); m.side = T.DoubleSide;
              for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
            }
          });
          let rays = 0;
          try {
            if (ids.length !== 1 || ids[0] !== id) throw new Error('The exported frozen building identity changed.');
            for (const z of [12, 16, 20, 24, 28]) for (const y of [.15, 1.7, 5, 9.5]) for (const direction of [-1, 1]) {
              const start = new T.Vector3(direction === 1 ? -138 : -45, y, z).applyMatrix4(detail.matrixWorld);
              const end = new T.Vector3(direction === 1 ? -45 : -138, y, z).applyMatrix4(detail.matrixWorld);
              const ray = new T.Raycaster(start, end.clone().sub(start).normalize(), 0, start.distanceTo(end));
              if (ray.intersectObject(loaded.scene, true).length) throw new Error(`Exported passage blocked: ${z}/${y}/${direction}`);
              rays++;
            }
            const base = new T.Vector3(-82, 2, 20).applyMatrix4(detail.matrixWorld);
            const ceiling = new T.Raycaster(base, new T.Vector3(0, 1, 0)).intersectObject(loaded.scene, true)[0];
            if (!ceiling || Math.abs(detail.worldToLocal(ceiling.point.clone()).y - 9.84) > .001) {
              throw new Error('The exported glazed bridge lost its supporting soffit.');
            }
          } finally {
            geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
          }
          const dataURL = await new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
          });
          return {dataURL, bytes: blob.size, rays, identities: ids};
        });
        await writeFile(resolve(output, `jianhua-${suffix}-passage.glb`), Buffer.from(result.dataURL.split(',')[1], 'base64'));
        delete result.dataURL;
        exported = result;
      }
    }
    assert.deepEqual(errors, []);
    const offlineNetworkRequests = page.url().startsWith('file:') ? network.length : undefined;
    if (offlineNetworkRequests !== undefined) assert.equal(offlineNetworkRequests, 0);
    reports[device] = {errors, captures, passageVisibility, exported, offlineNetworkRequests};
    console.log(JSON.stringify({device, errors, meshes: captures[0].meshes, triangles: captures[0].triangles,
      textures: captures[0].textures, passageVisibility, exported, offlineNetworkRequests}));
    await browser.close(); browser = undefined;
  }
  await writeFile(resolve(output, `jianhua-${suffix}.json`), JSON.stringify(reports, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
