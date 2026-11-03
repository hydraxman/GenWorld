import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {build} from 'esbuild';
import {createProjectServer} from './serve.mjs';

const output = resolve(import.meta.dirname, '..', 'output'), suffix = process.env.ENVELOPE_CAPTURE || 'after';
await mkdir(output, {recursive: true});
const server = createProjectServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
const fixture = await build({stdin: {contents: 'export {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";',
  resolveDir: resolve(import.meta.dirname, '..')}, bundle: true, write: false, format: 'iife', globalName: 'EnvelopeFixture'});
try {
  browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, protocolTimeout: 180000, args: ['--use-gl=angle', '--use-angle=d3d11']});
  const reports = [];
  for (const width of [1600, 390]) {
    const page = await browser.newPage(), errors = [];
    let ceramicMaps;
    page.on('pageerror', error => errors.push(String(error)));
    await page.setViewport({width, height: 1000});
    await page.goto(process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`, {waitUntil: 'load', timeout: 90000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    if (width === 1600) {
      await page.addScriptTag({content: fixture.outputFiles[0].text});
      await (await page.createCDPSession()).send('Browser.setDownloadBehavior', {behavior: 'deny'});
    }
    for (const view of ['academic', 'residential', 'zijing-1', 'zijing-14', 'zijing-23']) {
      for (const light of view === 'residential' ? ['presentation', 'neutral', 'grazing'] : ['presentation']) {
        const result = await page.evaluate(({view, light}) => {
          const app = window.campusApp, camera = app.inspection().camera, scene = app.campus.group.parent;
          let root, source;
          if (view.startsWith('zijing-')) {
            const number = Number(view.slice(7));
            app.selectApartment(number, true);
            root = [...app.campus.buildings.values()].find(root => root.userData.apartmentNumbers?.includes(number));
            source = root.children.find(child => child.userData.campusDetail).children.find(child => child.userData.apartmentNumber === number);
          } else {
            root = [...app.campus.buildings.values()].find(root => root.userData.architectureFamily === view &&
              !root.userData.appearanceProfileId && root.userData.estimatedFloors >= 3);
            app.select(root.userData.featureId, true);
            source = root.children.find(child => child.userData.architectureLOD);
          }
          const d = source.userData, probe = (d.windowProbes || d.windowOpenings)[0];
          const target = camera.position.clone().fromArray(probe.center);
          target.y = view === 'zijing-14' ? d.eaveHeight + .3 : target.y + 3.2;
          source.updateWorldMatrix(true, true);
          const eye = target.clone().add(camera.position.clone().set(probe.normal[0] * 13, 2.1, probe.normal[2] * 13));
          camera.position.copy(source.localToWorld(eye)); camera.lookAt(source.localToWorld(target));
          camera.fov = 48; camera.aspect = innerWidth / innerHeight; camera.clearViewOffset(); camera.updateProjectionMatrix();
          camera.updateMatrixWorld(true);
          const sun = scene.children.find(object => object.isDirectionalLight);
          const original = {position: sun.position.clone(), color: sun.color.clone(), intensity: sun.intensity};
          if (light !== 'presentation') {
            sun.position.copy(camera.position).add(camera.position.clone().set(15, light === 'grazing' ? 1 : 30, -10));
            sun.color.set('#ffffff'); sun.intensity = 3;
          }
          app.render(true);
          const materials = new Set(), maps = new Set();
          source.traverse(mesh => {for (const material of [].concat(mesh.material || [])) {
            materials.add(material);
            for (const key of ['map', 'normalMap', 'roughnessMap']) if (material[key]) maps.add(material[key]);
          }});
          const result = {id: root.userData.featureId, materials: materials.size, maps: maps.size,
            ceramicMaps: [...maps].filter(map => map.name.includes('generated Shunde')).map(map => map.uuid).sort(),
            rendering: app.inspection().rendering, png: document.getElementById('scene').toDataURL()};
          sun.position.copy(original.position); sun.color.copy(original.color); sun.intensity = original.intensity;
          return result;
        }, {view, light});
        await writeFile(resolve(output, `envelope-${suffix}-${width}-${view}-${light}.png`), Buffer.from(result.png.split(',')[1], 'base64'));
        delete result.png;
        assert.ok(result.maps >= 3, `${view} must have actual surface maps`);
        if (suffix !== 'before' && view !== 'academic') {
          assert.equal(result.ceramicMaps.length, 3);
          ceramicMaps ??= result.ceramicMaps;
          assert.deepEqual(result.ceramicMaps, ceramicMaps, 'Campus buildings must reuse the same three ceramic maps');
        }
        if (suffix !== 'before' && width === 1600 && view === 'residential' && light === 'presentation') {
          result.export = await page.evaluate(async () => {
            const original = URL.createObjectURL;
            let blob;
            URL.createObjectURL = value => {if (value.type === 'model/gltf-binary') blob = value; return original.call(URL, value);};
            try {await window.campusApp.exportSelectedModel();} finally {URL.createObjectURL = original;}
            if (!blob) throw new Error('The refined residential building did not export.');
            const {scene} = await new EnvelopeFixture.GLTFLoader().parseAsync(await blob.arrayBuffer(), '');
            const resources = new Set(), identities = [], ceramic = [];
            scene.traverse(mesh => {
              if (mesh.userData.featureId) identities.push(mesh.userData.featureId);
              if (!mesh.isMesh) return;
              resources.add(mesh.geometry);
              for (const material of [].concat(mesh.material)) {
                resources.add(material);
                for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
                if (material.map?.name.includes('generated Shunde')) ceramic.push(Boolean(
                  material.normalMap && material.roughnessMap && mesh.geometry.attributes.uv));
              }
            });
            for (const resource of resources) resource.dispose();
            return {bytes: blob.size, identities, ceramic};
          });
          assert.deepEqual(result.export.identities, [result.id]);
          assert.ok(result.export.ceramic.length && result.export.ceramic.every(Boolean),
            'Reloaded GLB must retain ceramic color, normals, roughness and UVs');
        }
        reports.push({width, view, light, ...result});
      }
    }
    assert.deepEqual(errors, []); await page.close();
  }
  await writeFile(resolve(output, `envelope-${suffix}.json`), JSON.stringify(reports, null, 2));
  console.log(`Campus envelope ${suffix}: five building views, desktop/mobile and three material lighting views passed.`);
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
