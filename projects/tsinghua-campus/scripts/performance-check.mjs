import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {createProjectServer} from './serve.mjs';
import {checkCampusGroundStability} from './browser-check.mjs';

const output = resolve(import.meta.dirname, '..', 'output');
await mkdir(output, {recursive: true});
const server = createProjectServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
const launchBrowser = () => puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, protocolTimeout: 180000, args: ['--use-gl=angle', '--use-angle=d3d11', '--no-proxy-server', '--disable-quic'],
});
try {
  const report = {};
  for (const [device, viewport] of Object.entries({
    desktop: {width: 1600, height: 1000, deviceScaleFactor: 1},
    mobile: {width: 390, height: 844, deviceScaleFactor: 2},
  })) {
    browser = await launchBrowser();
    const context = await browser.createBrowserContext(), page = await context.newPage(), errors = [], requests = [];
    await page.setViewport(viewport);
    page.on('pageerror', error => errors.push(String(error)));
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('request', request => requests.push(request.url()));
    await page.evaluateOnNewDocument(() => {
      window.campusLongTasks = [];
      new PerformanceObserver(list => window.campusLongTasks.push(...list.getEntries().map(entry =>
        ({start: entry.startTime, duration: entry.duration})))).observe({type: 'longtask', buffered: true});
    });
    await page.goto(process.env.CAMPUS_QA_URL || `http://127.0.0.1:${server.address().port}`, {waitUntil: 'load', timeout: 90000});
    await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
    assert.equal(await page.evaluate(() => window.campusError), undefined);
    assert.ok(!requests.some(url => /GLTFExporter-[A-Z0-9]+\.js/.test(url)), 'The exporter must not be downloaded during startup');
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const startup = await page.evaluate(() => {
      const app = window.campusApp;
      const mark = name => performance.getEntriesByName(name)[0]?.startTime ?? null;
      const tasks = window.campusLongTasks.filter(task => task.start < mark('campus-ready'));
      return {readyMs: mark('campus-ready'), mapVisibleMs: mark('campus-map-visible'),
        firstContentfulPaintMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
        longestTaskMs: Math.max(0, ...tasks.map(task => task.duration)), longTasks: tasks,
        rendering: app.inspection().rendering, landscape: app.stats.landscape,
        nearBuilt: [...app.campus.buildings.values()].filter(root =>
          root.children.some(child => child.userData.architectureLOD && !child.userData.architectureNearPending)).length,
        canvas: [document.getElementById('scene').width, document.getElementById('scene').height],
        heapBytes: performance.memory?.usedJSHeapSize ?? null};
    });
    const drawTimes = await page.evaluate(() => {
      const samples = [];
      for (let i = 0; i < 12; i++) {const start = performance.now(); window.campusApp.render(); samples.push(performance.now() - start);}
      return samples;
    });
    console.log(JSON.stringify({device, startup, drawTimes}));
    await page.$eval('#message', element => {element.hidden = true;});
    await page.screenshot({path: resolve(output, `performance-after-${device}.png`)});
    const flicker = await checkCampusGroundStability(page);
    const grounds = [];
    for (const id of ['osm:way:32954674', 'osm:way:32954848', 'osm:way:32954864']) {
      await page.evaluate(id => window.campusApp.selectGround(id), id);
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      await page.screenshot({path: resolve(output, `playground-${id.split(':').at(-1)}-${device}.png`)});
      grounds.push(await page.evaluate(() => ({name: document.getElementById('selection-name').textContent,
        rendering: window.campusApp.inspection().rendering})));
    }
    const lighting = await page.evaluate(() => {
      const scene = window.campusApp.campus.group.parent;
      const sun = scene.children.find(object => object.isDirectionalLight), fill = scene.children.find(object => object.isHemisphereLight);
      return {position: sun.position.toArray(), color: sun.color.getHex(), sun: sun.intensity, fill: fill.intensity,
        environment: scene.environmentIntensity};
    });
    try {
      for (const mode of ['presentation', 'neutral', 'grazing']) {
        await page.evaluate(mode => {
          const scene = window.campusApp.campus.group.parent;
          const sun = scene.children.find(object => object.isDirectionalLight), fill = scene.children.find(object => object.isHemisphereLight);
          if (mode !== 'presentation') {
            sun.color.set('#ffffff'); sun.intensity = mode === 'neutral' ? 2.5 : 3;
            fill.intensity = mode === 'neutral' ? 1.2 : .65;
            sun.position.copy(sun.target.position).add(sun.position.clone().set(...(mode === 'neutral' ? [0, 300, 150] : [250, 40, 130])));
          }
          window.campusApp.render();
        }, mode);
        await page.screenshot({path: resolve(output, `landscape-lighting-${mode}-${device}.png`)});
      }
    } finally {
      await page.evaluate(lighting => {
        const scene = window.campusApp.campus.group.parent;
        const sun = scene.children.find(object => object.isDirectionalLight), fill = scene.children.find(object => object.isHemisphereLight);
        sun.position.set(...lighting.position); sun.color.setHex(lighting.color); sun.intensity = lighting.sun;
        fill.intensity = lighting.fill; scene.environmentIntensity = lighting.environment; window.campusApp.render();
      }, lighting);
    }
    const focusedFlicker = await checkCampusGroundStability(page);
    await page.evaluate(() => window.campusApp.select([...window.campusApp.campus.landmarks.keys()][0], true));
    assert.match(await page.$eval('#selection-name', element => element.textContent), /二校门/);
    const cdp = await page.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', {behavior: 'deny'});
    const exportedBytes = await page.evaluate(() => window.campusApp.exportModel(false));
    assert.ok(exportedBytes > 10000, 'A first-click landmark export must produce real geometry');
    const moduleRuntime = await page.$('script[type="module"]') !== null;
    if (moduleRuntime) assert.equal(requests.filter(url => /GLTFExporter-[A-Z0-9]+\.js/.test(url)).length, 1);
    assert.deepEqual(errors, []);
    report[device] = {startup, drawTimes, flicker, focusedFlicker, grounds, firstExportBytes: exportedBytes, errors};
    console.log(JSON.stringify({device, startup, flicker, focusedFlicker, errors}));
    await context.close();
    await browser.close();
    browser = undefined;
  }
  await writeFile(resolve(output, 'performance-after.json'), JSON.stringify(report, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
