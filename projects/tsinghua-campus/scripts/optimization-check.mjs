import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {createProjectServer} from './serve.mjs';

const output = resolve(import.meta.dirname, '..', 'output'), report = {};
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
    const page = await browser.newPage(), errors = [], requests = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('request', request => {if (/^https?:/.test(request.url())) requests.push(request.url());});
    await page.setViewport({width, height: device === 'desktop' ? 1000 : 844});
    await page.goto(device === 'offline' ? pathToFileURL(resolve(output, 'tsinghua-campus-offline.html')).href
      : process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`, {waitUntil: 'load', timeout: 90000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    const comparisons = [];
    for (const view of device === 'desktop' ? ['all', 'shunde', 'second-gate', 'biology-north', 'sem', 'zijing', 'riverside'] : ['all', 'sem']) {
      await page.$eval(`#view-${view}`, button => button.click());
      await page.waitForFunction(() => !window.campusApp.campus.architecturePending);
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      const comparison = await page.evaluate(() => {
        const app = window.campusApp, canvas = document.getElementById('scene'), copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext('2d', {willReadFrequently: true});
        function capture() {
          ctx.drawImage(canvas, 0, 0);
          return ctx.getImageData(0, 0, copy.width, copy.height).data;
        }
        app.detailedDisplay.setEnabled(false); app.render(true); app.render();
        const canonical = {stats: app.inspection().rendering, pixels: capture()};
        app.detailedDisplay.setEnabled(true); app.render(true); app.render();
        const optimized = {stats: app.inspection().rendering, pixels: capture()};
        let changed = 0, difference = 0;
        for (let i = 0; i < canonical.pixels.length; i += 4) {
          const d = Math.abs(canonical.pixels[i] - optimized.pixels[i]) +
            Math.abs(canonical.pixels[i + 1] - optimized.pixels[i + 1]) + Math.abs(canonical.pixels[i + 2] - optimized.pixels[i + 2]);
          if (d > 30) changed++;
          difference += d;
        }
        const water = app.campus.layers.water.children[0], scene = app.campus.group.parent;
        const sun = scene.children.find(object => object.isDirectionalLight);
        const expected = sun.position.clone().sub(sun.target.position).normalize();
        const reflectionFraming = {samples: 0, maxError: 0, horizontalError: 0, verticalError: 0};
        if (water.material.uniforms.reflectionEnabled.value) {
          const point = sun.position.clone(), position = water.geometry.attributes.position;
          const textureMatrix = water.material.uniforms.textureMatrix.value;
          for (let i = 0; i < position.count; i++) {
            point.fromBufferAttribute(position, i);
            const uv = point.clone().applyMatrix4(textureMatrix);
            const projected = point.clone().applyMatrix4(water.matrixWorld).project(app.inspection().camera);
            if (Math.abs(projected.x) > .95 || Math.abs(projected.y) > .95 || Math.abs(projected.z) > 1) continue;
            // Frozen river strips sit 1 cm below polygons; reflect across the actual capture plane.
            point.z *= -1;
            const reflected = point.applyMatrix4(water.matrixWorld).project(app.inspection().camera);
            reflectionFraming.samples++;
            reflectionFraming.horizontalError = Math.max(reflectionFraming.horizontalError, Math.abs(uv.x - (1 - reflected.x) / 2));
            reflectionFraming.verticalError = Math.max(reflectionFraming.verticalError, Math.abs(uv.y - (1 + reflected.y) / 2));
            reflectionFraming.maxError = Math.max(reflectionFraming.horizontalError, reflectionFraming.verticalError);
          }
        }
        return {canonical: canonical.stats, optimized: optimized.stats, changedFraction: changed / (canonical.pixels.length / 4),
          meanChannelDifference: difference / (canonical.pixels.length / 4 * 3),
          sunDirectionError: expected.distanceTo(water.material.uniforms.campusSunDirection.value),
          reflectionFraming, image: copy.toDataURL()};
      });
      await writeFile(resolve(output, `optimization-${device}-${view}.png`), Buffer.from(comparison.image.split(',')[1], 'base64'));
      delete comparison.image;
      assert.ok(comparison.sunDirectionError < 1e-8);
      if (view === 'riverside') assert.ok(comparison.reflectionFraming.samples > 10);
      assert.ok(comparison.reflectionFraming.maxError < 1e-6,
        `${device}/${view}: off-axis reflection does not cover the visible water: ${JSON.stringify(comparison.reflectionFraming)}`);
      assert.ok(comparison.changedFraction < .035, `${device}/${view}: display changed too many pixels: ${comparison.changedFraction}`);
      if (view === 'all' && comparison.optimized.detailedDisplay.batching) {
        assert.ok(comparison.optimized.calls < 600);
        assert.ok(comparison.optimized.calls < comparison.canonical.calls * .4);
        assert.ok(comparison.optimized.triangles < comparison.canonical.triangles * .6);
        assert.ok(comparison.optimized.detailedDisplay.batchGeometryBytes < 12 * 1024 ** 2);
      }
      comparisons.push({view, ...comparison});
    }
    const history = await page.evaluate(() => {
      const app = window.campusApp, visited = new Map(), sites = new Set();
      for (const [id, root] of app.campus.objects) {
        const site = root.userData.referenceSite || root.userData.appearanceReferenceSite;
        if (!site || sites.has(site)) continue;
        sites.add(site); app.select(id);
        const card = document.getElementById('building-knowledge');
        if (card.dataset.historyId) visited.set(card.dataset.historyId, {site,
          citations: card.querySelectorAll('.knowledge-citations a').length, textLength: card.textContent.length});
      }
      const unknown = [...app.campus.buildings].find(([, root]) =>
        !root.userData.referenceSite && !root.userData.appearanceReferenceSite);
      app.select(unknown[0]);
      const blank = document.getElementById('building-knowledge');
      const clearsPrevious = !blank.dataset.historyId && blank.textContent.includes('暂无校史资料') && !blank.querySelector('a');
      document.getElementById('view-auditorium').click();
      return {entries: [...visited], clearsPrevious};
    });
    assert.ok(history.entries.length >= 15, `${device}: insufficient addressable building histories`);
    assert.ok(history.entries.every(([, entry]) => entry.citations > 0 && entry.textLength > 80));
    assert.ok(history.clearsPrevious);
    await page.focus('#open-knowledge'); await page.keyboard.press('Enter');
    const card = await page.evaluate(() => {
      const sidebar = document.getElementById('sidebar'), knowledge = document.getElementById('building-knowledge');
      return {visible: !sidebar.hidden && !knowledge.hidden, width: knowledge.clientWidth, scrollWidth: knowledge.scrollWidth,
        top: knowledge.getBoundingClientRect().top, bottom: sidebar.getBoundingClientRect().bottom,
        title: document.getElementById('selection-name').textContent};
    });
    assert.ok(card.visible && card.width > 150 && card.scrollWidth <= card.width + 2 && card.top < card.bottom);
    await page.$eval('#message', element => {element.hidden = true;});
    await page.screenshot({path: resolve(output, `knowledge-card-${device}.png`)});
    if (device === 'offline') assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
    report[device] = {comparisons, history, card, errors, offlineRequests: device === 'offline' ? requests : undefined};
    console.log(JSON.stringify({device, overview: comparisons[0], historyEntries: history.entries.length, card}));
    await browser.close(); browser = undefined;
  }
  await writeFile(resolve(output, 'optimization-acceptance.json'), JSON.stringify(report, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
