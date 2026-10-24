import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {access, readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, join, extname, sep} from 'node:path';
import * as THREE from '../../../latest/tsinghua-mem-five-effects-cloud/vendor/three/build/three.module.js';
import {withYear2026} from './year-2026.js';

const project = resolve(import.meta.dirname, '..');
const logoParent = resolve(project, '../../..');
const output = join(project, 'output');
const sourceGeometry = JSON.parse(await readFile(join(logoParent, 'kaiwu-logo',
  'latest', 'tsinghua-mem-five-effects-cloud', 'inputs', 'semantic-geometry.json')));
const revisedGeometry = withYear2026(sourceGeometry, THREE);
const expectedGroups = Object.fromEntries(Object.entries(revisedGeometry).map(([name, polygons]) =>
  [name, {meshes: polygons.length, holes: polygons.reduce((sum, polygon) => sum + polygon.holes.length, 0)}]));
for (const asset of ['scene.bundle.js', 'gsap.min.js', 'study-music.wav']) {
  try { await access(join(project, 'assets', asset)); }
  catch { throw new Error(`Missing proof asset: assets/${asset}. Run npm run build and npm run music first.`); }
}
await mkdir(output, {recursive: true});
const executablePath = process.env.CHROME_PATH || [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);
if (!executablePath) throw new Error('Set CHROME_PATH to an installed Chromium browser.');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.wav': 'audio/wav'};
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '');
    const file = resolve(logoParent, relative);
    if (!file.startsWith(join(logoParent, 'kaiwu-logo') + sep)) {
      res.writeHead(403).end(); return;
    }
    const bytes = await readFile(file);
    res.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream'});
    res.end(bytes);
  } catch (error) {
    console.error(`HTTP ${req.url}: ${error.message}`);
    res.writeHead(404).end();
  }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
const report = [];
const seekComparisons = [];
async function comparePixels(page, first, repeated) {
  if (first.equals(repeated)) return {maximum: 0, changedPixels: 0};
  return page.evaluate(async images => {
    const pixels = [];
    for (const image of images) {
      const bytes = Uint8Array.from(atob(image), char => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      pixels.push(context.getImageData(0, 0, bitmap.width, bitmap.height).data);
      bitmap.close();
    }
    if (pixels[0].length !== pixels[1].length) throw new Error('Capture dimensions changed');
    let maximum = 0, changedPixels = 0;
    for (let i = 0; i < pixels[0].length; i += 4) {
      let changed = false;
      for (let channel = 0; channel < 4; channel++) {
        const delta = Math.abs(pixels[0][i + channel] - pixels[1][i + channel]);
        maximum = Math.max(maximum, delta);
        changed ||= delta !== 0;
      }
      if (changed) changedPixels++;
    }
    return {maximum, changedPixels};
  }, [first.toString('base64'), repeated.toString('base64')]);
}
async function sceneState(page) {
  return page.evaluate(() => {
    const {badge, camera} = window.__sceneDebug;
    const matrices = [];
    badge.traverse(object => matrices.push({id: object.id, matrix: object.matrixWorld.toArray()}));
    return {matrices, camera: camera.matrixWorld.toArray(), pose: window.sceneMetrics.pose};
  });
}
try {
  browser = await puppeteer.launch({executablePath, headless: true,
    args: ['--use-gl=angle', '--use-angle=d3d11']});
  const page = await browser.newPage();
  await page.setViewport({width: 1920, height: 1080, deviceScaleFactor: 1});
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setRequestInterception(true);
  const base = `http://127.0.0.1:${server.address().port}`;
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(base + '/')) {
      errors.push(`Unexpected external request: ${request.url()}`);
      request.abort();
    } else request.continue();
  });
  async function captureCurrentStudy() {
    const name = 'study', entry = 'studies/sky-fusion/index.html';
    await page.goto(`${base}/kaiwu-logo/${entry}`, {waitUntil: 'load'});
    await page.waitForFunction(() => window.animationReady || window.__sceneError, {timeout: 90000});
    const error = await page.evaluate(() => window.__sceneError);
    assert.ok(!error, error);
    const times =
      [0, .4, .8, 1.2, 1.4, 1.47, 1.54, 1.58, 1.6, 1.7, 1.83, 2.1,
        2.31, 2.52, 2.6, 2.73, 2.94, 3.08, 3.2, 3.4, 3.6, 3.75, 119 / 30, 4];
    for (const time of times) {
      await page.evaluate(t => {
        Object.values(window.__timelines)[0].seek(t);
        window.renderAt(t);
      }, time);
      const image = await page.screenshot({type: 'png'});
      const file = `study-2026-4s-${time.toFixed(2)}.png`;
      await writeFile(join(output, file), image);
      report.push({name, time, file, sha256: createHash('sha256').update(image).digest('hex'),
        metrics: await page.evaluate(() => window.sceneMetrics)});
    }
    {
      const contract = await page.evaluate(() => {
        const root = document.querySelector('[data-composition-id]');
        const audio = document.getElementById('rhythm-study');
        return {duration: Number(root.dataset.duration),
          canvasDuration: Number(document.getElementById('three-layer').dataset.duration),
          timelineDuration: Object.values(window.__timelines)[0].duration(),
          audioDuration: Number(audio.dataset.duration), audioStart: Number(audio.dataset.mediaStart),
          audioRate: Number(audio.dataset.playbackRate), preservesPitch: audio.preservesPitch,
          audioAutomation: JSON.parse(audio.dataset.automation)};
      });
      assert.equal(contract.duration, 4);
      assert.equal(contract.canvasDuration, 4);
      assert.equal(contract.timelineDuration, 4);
      assert.equal(contract.audioDuration, 4);
      assert.equal(contract.audioStart, 0);
      assert.equal(contract.audioRate, 2);
      assert.equal(contract.audioStart + contract.audioDuration * contract.audioRate, 8,
        'Music must include the final chord and its release, compressed into four seconds');
      assert.equal(contract.preservesPitch, true);
      const volumePoints = contract.audioAutomation.lanes[0].points;
      assert.deepEqual(volumePoints[1], {t: 3.275, v: 1},
        'Fade must follow the final chord at source time 6.55 / playback rate 2');
      assert.ok(volumePoints.slice(2).every((point, index) =>
        point.t > volumePoints[index + 1].t && point.v <= volumePoints[index + 1].v),
      'The final chord must fade progressively without another swell');
      assert.deepEqual(volumePoints.at(-2), {t: 3.98, v: 0},
        'Reach silence before the last sample instead of hard-cutting the release');
      assert.deepEqual(contract.audioAutomation.lanes[0].points.at(-1), {t: 4, v: 0});
      await page.evaluate(() => {
        const timeline = Object.values(window.__timelines)[0];
        timeline.seek(0, false);
        timeline.seek(4, false);
      });
      assert.equal(await page.evaluate(() => window.sceneMetrics.pose.sourceTime), 8,
        'The framework timeline must reach the full original ending, not truncate at source second four');
      for (const time of [1.2, 1.58, 2.73, 119 / 30]) {
        await page.evaluate(t => window.renderAt(t), time);
        const firstState = await sceneState(page);
        const first = await page.screenshot({type: 'png'});
        await page.evaluate(t => {window.renderAt(3.95); window.renderAt(.15); window.renderAt(t);}, time);
        assert.deepEqual(await sceneState(page), firstState, `Nonsequential seek changed scene state at ${time}`);
        const repeated = await page.screenshot({type: 'png'});
        const difference = await comparePixels(page, first, repeated);
        seekComparisons.push({time, ...difference, sceneStateExact: true});
        // Static, unchanged ANGLE/MSAA frames can differ in a few 8-bit rounding values.
        const matches = difference.maximum <= 1 && difference.changedPixels <= 64;
        if (!matches) {
          await writeFile(join(output, 'seek-first.png'), first);
          await writeFile(join(output, 'seek-repeated.png'), repeated);
        }
        assert.ok(matches, `Nonsequential seek changed pixels at ${time}: ${JSON.stringify(difference)}`);
      }
      const bookSamples = await page.evaluate(() => {
        const badge = window.__sceneDebug.badge;
        return [1.395, 1.47, 1.58, 1.7, 1.83, 3.95].map(time => {
          window.renderAt(time);
          const left = badge.getObjectByName('leftPage'), right = badge.getObjectByName('rightPage');
          const hingeGap = Math.max(...[-1.2, 0, 1.2].map(y =>
            left.localToWorld(new window.__sceneDebug.THREE.Vector3(0, y, 0)).distanceTo(
              right.localToWorld(new window.__sceneDebug.THREE.Vector3(0, y, 0)))));
          return {time, hingeGap, groups: Object.fromEntries(['leftPage', 'rightPage', 'circuits'].map(name => {
            const group = badge.getObjectByName(name);
            return [name, {position: group.position.toArray(), rotation: group.rotation.toArray().slice(0, 3)}];
          }))};
        });
      });
      for (const sample of bookSamples) {
        assert.ok(sample.hingeGap < 1e-12, 'Both book leaves must stay attached to the same spine axis');
        assert.deepEqual(sample.groups.circuits.position, [0, 0, 0], 'Book action must not displace the circuits');
        assert.deepEqual(sample.groups.circuits.rotation, [0, 0, 0], 'Book action must not fold the circuits');
        for (const name of ['leftPage', 'rightPage']) {
          const group = sample.groups[name];
          assert.ok(group.position.every(value => Math.abs(value) < 1e-12),
            'Book leaves must never translate away from the spine');
          if (sample.time < 1.45 || sample.time >= 1.755) {
            assert.ok([...group.position, ...group.rotation].every(value => Math.abs(value) < 1e-12),
              `Book page must restore its exact original pose at ${sample.time}`);
          }
        }
      }
      const peak = bookSamples.find(sample => sample.time === 1.58).groups;
      assert.ok(peak.leftPage.rotation[1] > 1 && peak.rightPage.rotation[1] < -1,
        'Book must hinge both leaves, not just translate or rotate as one object');
      const closing = bookSamples.find(sample => sample.time === 1.7).groups;
      assert.ok(closing.leftPage.rotation[1] > 0 && closing.leftPage.rotation[1] < peak.leftPage.rotation[1] * .3,
        'Pages must visibly unfold around the fixed spine');
      await page.evaluate(() => window.renderAt(119 / 30));
      const metrics = await page.evaluate(() => window.sceneMetrics);
      assert.equal(metrics.badgeYear, 2026);
      const yearSurfaces = await page.evaluate(() => {
        const {THREE, badge} = window.__sceneDebug;
        const meshes = badge.getObjectByName('circuits').children.filter(child => child.isMesh);
        return [[358.5, 490], [364.4, 494.7], [370.5, 485]].map(([x, y]) => {
          const ray = new THREE.Raycaster(
            new THREE.Vector3((x - 319.3) * .01, (319.5 - y) * .01, 2),
            new THREE.Vector3(0, 0, -1));
          return ray.intersectObjects(meshes, false).length > 0;
        });
      });
      assert.deepEqual(yearSurfaces, [false, true, true],
        '2026 must be real cutout geometry: open left stroke, solid lower counter, open upper terminal');
      assert.equal(metrics.duration, 4);
      assert.equal(metrics.visualRate, 2);
      assert.equal(metrics.pose.stage, 'readable hero hold');
      assert.ok(metrics.pose.glyphTrace.every(glyph => glyph.progress === 1 && !glyph.active),
        'All four glyph traces must finish before the last encoded frame');
      assert.ok(metrics.pose.sweepStrength < 1e-9, 'The metallic sweep must finish before the last encoded frame');
      assert.deepEqual(metrics.semanticGroups, expectedGroups);
      assert.equal(metrics.sourcePaths, Object.values(expectedGroups).reduce((sum, group) => sum + group.meshes, 0));
      assert.equal(metrics.sourceHoles, Object.values(expectedGroups).reduce((sum, group) => sum + group.holes, 0));
      assert.ok(metrics.particleCount > 1000, 'Formation must contain real surface-targeted particles');
      assert.ok(metrics.pose.assemblyErrorSourcePixels < .001);
      assert.equal(metrics.faceNormalPerturbation, false);
      assert.equal(metrics.pose.lighting.holdBlend, 1);
      assert.ok(Math.abs(metrics.pose.lighting.keyIntensity - metrics.pose.lighting.fillIntensity) < 1e-12,
        'Final hold must have balanced key and fill lights');
      assert.equal(metrics.pose.lighting.environmentYaw, -.12, 'Do not park the bright panel on the left book leaf');
      assert.deepEqual(metrics.glyphTrace.map(glyph => glyph.name), ['清', '工', '開', '悟']);
      assert.deepEqual(metrics.glyphTrace.map(glyph => glyph.contours), [7, 1, 8, 6]);
      assert.ok(metrics.glyphTrace.every(glyph => glyph.start >= 2.2 && glyph.finish <= 3.275),
        'Glyph lights must wait for the book and rings, then finish before the metallic sweep');
      const traceParents = await page.evaluate(() => window.__sceneDebug.glyphTrace.nodes.map(node => node.parent.name));
      assert.deepEqual(traceParents, ['rightPage', 'rightPage', 'leftPage', 'leftPage']);
      for (const time of [2.1, 2.31, 2.52, 2.73, 2.94]) {
        await page.evaluate(t => window.renderAt(t), time);
        const lit = await page.screenshot({type: 'png'});
        await page.evaluate(t => {
          window.__sceneDebug.glyphTrace.nodes.forEach(node => {node.visible = false;});
          window.renderAt(t);
        }, time);
        const unlit = await page.screenshot({type: 'png'});
        await page.evaluate(t => {
          window.__sceneDebug.glyphTrace.nodes.forEach(node => {node.visible = true;});
          window.renderAt(t);
        }, time);
        const difference = await comparePixels(page, lit, unlit);
        if (time < 2.225) {
          assert.ok(difference.maximum <= 1 && difference.changedPixels <= 64, 'Glyph lights appeared too early');
        } else {
          assert.ok(difference.maximum > 20 && difference.changedPixels > 500, 'Glyph lights are not visibly drawing');
        }
      }
      assert.deepEqual(Object.keys(metrics.pose.layers), ['inner', 'middle', 'outer']);
      for (const layer of Object.values(metrics.pose.layers)) {
        assert.ok(layer.rotationDegrees.every(angle => Math.abs(angle) < .001), 'Layers must settle exactly');
        assert.ok(layer.position.every(value => Math.abs(value) < .001), 'Layer depths must close exactly');
        assert.equal(layer.particleClouds, 1, 'Particles must inherit their own layer transform');
      }
      await page.evaluate(() => window.renderAt(1.2));
      const turning = await page.evaluate(() => window.sceneMetrics.pose.layers);
      assert.ok(turning.inner.rotationDegrees[1] > 50, 'Inner layer must turn in 3D');
      assert.ok(turning.middle.rotationDegrees[2] < -90, 'Middle ring must rotate clockwise');
      assert.ok(turning.outer.rotationDegrees[2] > 150, 'Outer ring must rotate in the opposite direction');
      const isAncestor = await page.evaluate(() => {
        const {layers} = window.__sceneDebug;
        return ['leftPage', 'rightPage', 'circuits'].every(name =>
          layers.inner.children.some(child => child.name === name)) &&
          layers.middle.children.some(child => child.name === 'letterBand') &&
          layers.outer.children.some(child => child.name === 'braidedRim');
      });
      assert.ok(isAncestor, 'Actual scene hierarchy must contain three semantic layers');
    }
    console.log(`Captured ${name}: ${times.length} actual GPU frames`);
  }
  await captureCurrentStudy();
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'proof.json'),
    JSON.stringify({ok: true, executablePath, errors, seekComparisons, report}, null, 2));
} catch (error) {
  await writeFile(join(output, 'proof.json'), JSON.stringify({ok: false, error: String(error.message)}, null, 2));
  throw error;
} finally {
  if (browser) await browser.close();
  server.close();
}
