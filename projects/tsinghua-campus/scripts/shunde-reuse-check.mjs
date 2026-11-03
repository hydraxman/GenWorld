import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import puppeteer from 'puppeteer-core';
import {createProjectServer} from './serve.mjs';

const output = resolve(import.meta.dirname, '..', 'output'), suffix = process.env.SHUNDE_REUSE_CAPTURE || 'after';
const before = suffix === 'before', report = {};
const fixture = await build({stdin: {contents: `
  export * as THREE from 'three';
  export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
  export {createShundeModel} from '../../shunde/src/model.js';
  export {disposeOwnedDetail} from '../src/model.js';
`, resolveDir: resolve(import.meta.dirname, '..', 'scripts')}, bundle: true, write: false,
format: 'iife', globalName: 'ShundeReuseFixture'});
await mkdir(output, {recursive: true});
const server = createProjectServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, protocolTimeout: 240000,
    args: ['--use-gl=angle', '--use-angle=d3d11', '--no-proxy-server', '--disable-quic'],
  });
  for (const [device, width] of [['desktop', 1600], ['mobile', 390], ['offline', 390]]) {
    const page = await browser.newPage(), errors = [], requests = [], captures = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('request', request => {if (/^https?:/.test(request.url())) requests.push(request.url());});
    await page.setViewport({width, height: 1000, deviceScaleFactor: 1});
    await page.goto(device === 'offline' ? pathToFileURL(resolve(output, 'tsinghua-campus-offline.html')).href
      : process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`, {waitUntil: 'load', timeout: 90000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    await page.addScriptTag({content: fixture.outputFiles[0].text});
    for (const [name, eye, target] of [
      ['whole', [110, 72, -145], [10, 10, 17]],
      ['entry', [0, 9, 31], [0, 6, 3]],
      ['wall', [11, 11, 22], [11, 11, 5]],
      ['court', [70, 24, 66], [2, 11, 22]],
    ]) {
      for (const lighting of name === 'entry' ? ['presentation', 'neutral', 'grazing'] : ['presentation']) {
        await page.$eval('#view-shunde', button => button.click());
        const capture = await page.evaluate(({name, eye, target, lighting, mobile}) => {
          const {THREE: T} = ShundeReuseFixture, app = window.campusApp, camera = app.inspection().camera;
          const detail = app.campus.buildings.get('building:geometry:6bd0154b26cfe7cf654cdd3b')
            .children.find(child => child.userData.campusDetail);
          let front;
          detail.traverse(o => {if (o.userData.role === 'north-entry') front = o;});
          const frame = ['entry', 'wall'].includes(name) ? front : detail;
          const at = frame.localToWorld(new T.Vector3(...target));
          camera.position.copy(frame.localToWorld(new T.Vector3(...eye)));
          if (mobile) camera.position.sub(at).multiplyScalar(name === 'whole' ? 3.2 : name === 'wall' ? 1.1 : 1.9).add(at);
          camera.clearViewOffset(); camera.lookAt(at); camera.updateMatrixWorld(true);
          const scene = app.campus.group.parent, sun = scene.children.find(o => o.isDirectionalLight);
          const saved = {position: sun.position.clone(), intensity: sun.intensity, color: sun.color.clone()};
          try {
            if (lighting !== 'presentation') {
              sun.color.set('#ffffff'); sun.intensity = 3;
              sun.position.copy(at).add(new T.Vector3(...(lighting === 'neutral' ? [0, 90, -50] : [65, 12, -35])));
            }
            app.render(true);
            const textures = new Set(), materials = new Set();
            let meshes = 0, triangles = 0;
            detail.traverse(o => {
              if (!o.isMesh) return;
              meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
              for (const material of [].concat(o.material)) {
                materials.add(material);
                for (const key of ['map', 'normalMap', 'roughnessMap']) if (material[key]) textures.add(material[key]);
              }
            });
            return {image: document.getElementById('scene').toDataURL(), meshes, triangles, textures: textures.size,
              ceramic: [...materials].filter(m => /ceramic|spandrel/i.test(m.name)).map(m => ({name: m.name,
                channels: ['map', 'normalMap', 'roughnessMap'].map(key => Boolean(m[key]))}))};
          } finally {sun.position.copy(saved.position); sun.intensity = saved.intensity; sun.color.copy(saved.color);}
        }, {name, eye, target, lighting, mobile: device !== 'desktop'});
        await writeFile(resolve(output, `shunde-reuse-${suffix}-${device}-${name}-${lighting}.png`),
          Buffer.from(capture.image.split(',')[1], 'base64'));
        delete capture.image;
        if (!before) {
          assert.ok(capture.ceramic.length >= 4);
          assert.ok(capture.ceramic.every(m => m.channels.every(Boolean)), 'Keep all three original ceramic PBR channels');
          assert.ok(capture.meshes < 650 && capture.triangles < 150000 && capture.textures <= 40);
        }
        captures.push({name, lighting, ...capture});
      }
    }
    let reuse;
    if (!before && device === 'desktop') {
      reuse = await page.evaluate(async () => {
        const {THREE: T, createShundeModel, GLTFLoader, disposeOwnedDetail} = ShundeReuseFixture;
        const app = window.campusApp, id = 'building:geometry:6bd0154b26cfe7cf654cdd3b';
        const detail = app.campus.buildings.get(id).children.find(child => child.userData.campusDetail);
        const actual = detail.getObjectByName('Architecture — continuous open courtyard boundary');
        const source = createShundeModel(T, {textured: true, foliage: false, refinedFront: true, visitorLabels: true});
        const collect = root => {const list = []; root.traverse(o => {if (o.isMesh) list.push(o);}); return list;};
        const expected = collect(source.building), meshes = collect(actual);
        const digest = async array => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
          new Uint8Array(array.buffer, array.byteOffset, array.byteLength)))].join(',');
        let comparisons = 0;
        try {
          if (meshes.length !== expected.length) throw new Error('Original architecture mesh count changed.');
          for (let i = 0; i < meshes.length; i++) {
            if (meshes[i].name !== expected[i].name) throw new Error('Original component order changed.');
            for (const attribute of ['position', 'normal', 'uv', 'index']) {
              const a = attribute === 'index' ? meshes[i].geometry.index : meshes[i].geometry.attributes[attribute];
              const b = attribute === 'index' ? expected[i].geometry.index : expected[i].geometry.attributes[attribute];
              if (await digest(a.array) !== await digest(b.array)) throw new Error(`Changed source ${attribute}: ${meshes[i].name}`);
              comparisons++;
            }
          }
          for (const material of new Set(meshes.map(o => o.material))) {
            if (!/ceramic|spandrel|mottled entrance stone/i.test(material.name)) continue;
            const original = expected.find(o => o.material.name === material.name).material;
            for (const key of ['map', 'normalMap', 'roughnessMap']) {
              const read = map => map.image.getContext('2d').getImageData(0, 0, map.image.width, map.image.height).data;
              if (await digest(read(material[key])) !== await digest(read(original[key]))) {
                throw new Error(`Original procedural texture changed: ${material.name}/${key}`);
              }
            }
          }
        } finally {disposeOwnedDetail(source.group);}
        let blob;
        const originalURL = URL.createObjectURL;
        try {
          URL.createObjectURL = function(value) {
            if (value instanceof Blob && value.type === 'model/gltf-binary') blob = value;
            return originalURL.call(URL, value);
          };
          app.select(id); await app.exportSelectedModel();
        } finally {URL.createObjectURL = originalURL;}
        if (!blob) throw new Error('Selected Shunde export was not produced.');
        const loaded = await new GLTFLoader().parseAsync(await blob.arrayBuffer(), '');
        try {
          const ids = [];
          loaded.scene.traverse(o => {if (o.userData.featureId) ids.push(o.userData.featureId);});
          if (ids.length !== 1 || ids[0] !== id) throw new Error('Export changed the frozen building identity.');
          let exportedPBR = 0;
          for (const mesh of collect(loaded.scene)) {
            const m = mesh.material;
            if (/ceramic|spandrel|mottled entrance stone/i.test(m.name)) {
              if (!m.map || !m.normalMap || !m.roughnessMap) throw new Error(`Export lost PBR: ${m.name}`);
              exportedPBR++;
            }
          }
          if (!exportedPBR) throw new Error('Export has no original ceramic/stone surfaces.');
          return {comparisons, meshes: meshes.length, exportedPBR, exportBytes: blob.size, identities: ids};
        } finally {disposeOwnedDetail(loaded.scene);}
      });
    }
    assert.deepEqual(errors, []);
    if (device === 'offline') assert.equal(requests.length, 0);
    report[device] = {captures, reuse, requests, errors};
    await page.close();
  }
  await writeFile(resolve(output, `shunde-reuse-${suffix}.json`), JSON.stringify(report, null, 2));
  console.log(`Shunde reuse ${suffix}: desktop/mobile/offline evidence saved.`);
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
