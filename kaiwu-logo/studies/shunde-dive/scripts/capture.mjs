import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, join, extname, sep} from 'node:path';

const project = resolve(import.meta.dirname, '..');
const studies = resolve(project, '..');
const output = join(project, 'output', 'v3-source-proof');
await mkdir(output, {recursive: true});
const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.wav': 'audio/wav'};
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
    const file = resolve(studies, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(studies + sep)) { res.writeHead(403).end(); return; }
    const bytes = await readFile(file);
    res.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream'});
    res.end(bytes);
  } catch (error) {
    console.error(`HTTP ${req.url}: ${error.message}`);
    if (!res.headersSent) res.writeHead(404);
    res.end();
  }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, args: ['--use-gl=angle', '--use-angle=d3d11'],
  });
  const page = await browser.newPage();
  await page.setViewport({width: 1920, height: 1080, deviceScaleFactor: 1});
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(base + '/')) {
      errors.push('External request: ' + request.url());
      request.abort();
    } else request.continue();
  });
  await page.goto(`${base}/shunde-dive/passes/scene.html`, {waitUntil: 'load'});
  await page.waitForFunction(() => window.animationReady || window.__sceneError, {timeout: 120000});
  assert.equal(await page.evaluate(() => window.__sceneError), undefined);
  const report = [];
  const render = async time => page.evaluate(t => {
    window.__timelines['kaiwu-shunde-source'].seek(t, false);
    window.renderAt(t);
    const {camera, scene} = window.__sceneDebug.background;
    return {metrics: window.sceneMetrics, camera: camera.matrixWorld.toArray(),
      world: scene.matrixWorld.toArray(), rgba: null};
  }, time);
  for (const time of [0, .6, 1.0, 1.35, 1.7, 2.1, 2.5, 2.9, 3.4, 119 / 30, 4]) {
    const state = await render(time);
    const file = `dive-${time.toFixed(2)}.png`;
    await page.screenshot({path: join(output, file)});
    report.push({time, file, ...state});
  }
  for (const time of [1.35, 2.5, 4]) {
    const first = await render(time);
    const pixels = await page.evaluate(() => {
      const {renderer} = window.__sceneDebug, gl = renderer.getContext();
      const data = new Uint8Array(1920 * 1080 * 4);
      gl.readPixels(0, 0, 1920, 1080, gl.RGBA, gl.UNSIGNED_BYTE, data);
      window.__proofPixels = data;
      return data.length;
    });
    assert.equal(pixels, 8294400);
    await render(.2);
    const second = await render(time);
    assert.deepEqual(first, second, 'nonsequential seek must reproduce scene/camera metrics');
    const difference = await page.evaluate(() => {
      const gl = window.__sceneDebug.renderer.getContext();
      const actual = new Uint8Array(window.__proofPixels.length);
      gl.readPixels(0, 0, 1920, 1080, gl.RGBA, gl.UNSIGNED_BYTE, actual);
      let maximum = 0, changed = 0;
      for (let i = 0; i < actual.length; i++) {
        const d = Math.abs(actual[i] - window.__proofPixels[i]);
        maximum = Math.max(maximum, d);
        if (d) changed++;
      }
      return {maximum, changed};
    });
    assert.ok(difference.maximum <= 1 && difference.changed < 256, JSON.stringify(difference));
  }
  const proof = await page.evaluate(() => {
    const {THREE, camera, badge, background} = window.__sceneDebug;
    const box = new THREE.Box3().setFromObject(badge);
    const badgePoints = [box.min, box.max].map(v => v.clone().project(camera).toArray());
    const façade = background.built.portico;
    const roofPoints = [-33.28, 0, 33.28].map(x =>
      façade.localToWorld(new THREE.Vector3(x, 22.1, 5)).project(background.camera).toArray());
    const signs = [];
    façade.traverse(o => {
      if (o.userData.role === 'sign') signs.push({
        text: o.userData.text,
        screen: o.localToWorld(new THREE.Vector3(0, o.userData.height, 2.8)).project(background.camera).toArray(),
      });
    });
    const root = document.querySelector('[data-composition-id]');
    const hardscapeHits = [];
    for (const x of [-.6, 0, .6]) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(x, -.97), background.camera);
      const hits = ray.intersectObjects([background.built.group, background.campus.group, background.forecourt.group], true);
      hardscapeHits.push({x, firstMaterial: hits[0]?.object.material.name, point: hits[0]?.point.toArray()});
    }
    const corridor = background.sem.corridor;
    const corridorVisibility = [.25, .5, .75].map(u => {
      const target = corridor.group.localToWorld(new THREE.Vector3(corridor.length * u, 14.8, -1.72));
      const projected = target.clone().project(background.camera);
      const ray = new THREE.Raycaster(background.camera.position, target.clone().sub(background.camera.position).normalize());
      const hit = ray.intersectObject(background.scene, true)[0];
      let parent = hit?.object;
      while (parent && parent !== corridor.group) parent = parent.parent;
      return {u, screen: projected.toArray(), visible: parent === corridor.group, firstMaterial: hit?.object.material.name};
    });
    const redProbe = new THREE.Vector3(-64.1, 19, -5);
    const redScreen = redProbe.clone().project(background.camera).toArray();
    const sceneGroups = [];
    background.scene.traverse(o => { if (o.userData.osmWay === background.sem.stats.osmWay) sceneGroups.push(o.name); });
    return {badgePoints, roofPoints, signs, duration: Number(root.dataset.duration),
      timelineDuration: window.__timelines['kaiwu-shunde-source'].duration(),
      year: window.sceneMetrics.badgeYear,
      hardscapeHits, forecourtTrees: background.forecourt.stats.trees, corridorVisibility,
      redScreen, redSourceOccurrences: sceneGroups.length, sem: background.sem.stats};
  });
  assert.equal(proof.duration, 4);
  assert.equal(proof.timelineDuration, 4);
  assert.equal(proof.year, 2026);
  assert.ok(proof.badgePoints.flatMap(p => p.slice(0, 2)).every(v => Math.abs(v) < .94), 'badge is inside frame');
  const badgeBottom = Math.min(...proof.badgePoints.map(p => p[1]));
  assert.ok(badgeBottom > Math.max(...proof.signs.map(s => s.screen[1])) + .15,
    'the larger, lower badge may overlap the roof but must leave the entrance plaques clear');
  assert.ok(Math.max(...proof.badgePoints.map(p => p[1])) -
    badgeBottom > .65, 'final badge should be at least 35% larger than version 2');
  assert.equal(proof.signs.length, 2);
  assert.ok(proof.signs.every(s => s.screen.slice(0, 2).every(v => Math.abs(v) < .9)));
  assert.ok(proof.signs.every(s => Math.abs(s.screen[0]) < .03), 'entrance must be centered horizontally');
  assert.ok(proof.forecourtTrees >= 10);
  for (const hit of proof.hardscapeHits) assert.match(hit.firstMaterial, /paving|concrete|stone/i,
    'the final visible foreground must be hardscape, not featureless green grass');
  assert.equal(proof.sem.corridor.storeyClearance, 4);
  assert.equal(proof.redSourceOccurrences, 1, 'replace the gray placeholder, do not overlay duplicate buildings');
  assert.ok(proof.redScreen[0] > .3, 'SEM remains geographically screen right; doorway framing takes priority');
  assert.ok(proof.corridorVisibility.some(p => p.visible && Math.abs(p.screen[0]) < 1),
    'at least part of the sky corridor remains visible beside the centered entrance');
  const passOverride = await page.evaluateOnNewDocument(() => {
    window.__hyperframes = {getVariables: () => ({renderPass: 'badge'})};
  });
  await page.goto(`${base}/shunde-dive/passes/scene.html`, {waitUntil: 'load'});
  await page.waitForFunction(() => window.animationReady || window.__sceneError, {timeout: 120000});
  assert.equal(await page.evaluate(() => window.__sceneError), undefined);
  for (const sample of report) {
    const pose = await page.evaluate(t => {
      window.renderAt(t);
      return window.sceneMetrics.pose;
    }, sample.time);
    assert.equal(pose.renderPass, 'badge');
    for (const key of ['lighting', 'glyphTrace', 'book', 'layers', 'badgeLayout', 'sweepStrength']) {
      assert.deepEqual(pose[key], sample.metrics.pose[key], `isolating the badge changed ${key}`);
    }
  }
  const isolation = await page.evaluate(async () => {
    const canvas = document.getElementById('three-layer');
    const bitmap = await createImageBitmap(await (await fetch('output/v3-source-proof/dive-4.00.png')).blob());
    const surface = new OffscreenCanvas(1920, 1080), context = surface.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const reference = context.getImageData(0, 0, 1920, 1080).data;
    context.clearRect(0, 0, 1920, 1080);
    context.drawImage(canvas, 0, 0);
    const badgePixels = context.getImageData(0, 0, 1920, 1080).data;
    let transparent = 0, opaque = 0, maximumOpaqueDifference = 0;
    for (let i = 0; i < badgePixels.length; i += 4) {
      if (badgePixels[i + 3] === 0) transparent++;
      if (badgePixels[i + 3] === 255) {
        opaque++;
        for (let c = 0; c < 3; c++) maximumOpaqueDifference = Math.max(maximumOpaqueDifference,
          Math.abs(reference[i + c] - badgePixels[i + c]));
      }
    }
    return {transparent, opaque, maximumOpaqueDifference};
  });
  assert.ok(isolation.transparent > 1920 * 1080 * .9, 'background must be genuinely transparent');
  assert.ok(isolation.opaque > 15000, 'the metallic badge must not disappear');
  assert.ok(isolation.maximumOpaqueDifference <= 1, 'opaque badge color must not change between passes');
  await page.screenshot({path: join(output, 'badge-alpha-4.png'), omitBackground: true});
  await page.removeScriptToEvaluateOnNewDocument(passOverride.identifier);
  await page.goto(`${base}/sky-fusion/index.html`, {waitUntil: 'load'});
  await page.waitForFunction(() => window.animationReady || window.__sceneError, {timeout: 120000});
  assert.equal(await page.evaluate(() => window.__sceneError), undefined);
  for (const t of [0, .6]) {
    await page.evaluate(time => window.renderAt(time), t);
    await page.screenshot({path: join(output, `sky-reference-${t.toFixed(2)}.png`)});
  }
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'proof.json'), JSON.stringify({report, proof, isolation, errors}, null, 2));
  console.log(JSON.stringify({frames: report.length, proof, isolation, errors}, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
