import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {questions} from './experiments.js';

const root = path.resolve(import.meta.dirname, '..', '..'), published = path.join(root, 'output', 'pages');
const output = path.join(root, 'projects', 'tsinghua-campus', 'output');
const mime = {'.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary'};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost'), relative = decodeURIComponent(url.pathname).slice(1);
  const file = path.resolve(published, relative, !relative || relative.endsWith('/') ? 'index.html' : '');
  if (!file.startsWith(published + path.sep)) {response.writeHead(403).end(); return;}
  try {
    const content = await readFile(file);
    response.writeHead(200, {'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream'}).end(content);
  }
  catch (error) {if (error.code !== 'ENOENT') throw error; response.writeHead(404).end();}
});
await mkdir(output, {recursive: true});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
const report = {};
try {
  browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, protocolTimeout: 180000, args: ['--use-gl=angle', '--use-angle=d3d11', '--no-proxy-server', '--disable-quic']});
  const base = process.env.PAGES_URL || `http://127.0.0.1:${server.address().port}/`;
  for (const host of ['campus', 'knowledge', 'offline']) {
    for (const width of host === 'offline' ? [390] : [1600, 390]) {
      const page = await browser.newPage(), errors = [], requests = [];
      page.setDefaultTimeout(90000);
      await page.setViewport({width, height: width < 760 ? 844 : 1000, deviceScaleFactor: 1,
        isMobile: width < 760, hasTouch: width < 760});
      page.on('pageerror', error => errors.push(String(error)));
      page.on('requestfailed', request => errors.push(`${request.url()} ${request.failure()?.errorText}`));
      page.on('request', request => {if (/^https?:/.test(request.url())) requests.push(request.url());});
      const campus = host !== 'knowledge';
      await page.goto(host === 'offline' ? pathToFileURL(path.join(output, 'tsinghua-campus-offline.html')).href
        : new URL(`scenes/${host}/`, base).href, {waitUntil: 'load', timeout: 90000});
      await page.waitForFunction(campus ? () => window.campusApp?.ready || window.campusError
        : () => window.__knowledgeReady || window.__sceneError);
      assert.equal(await page.evaluate(() => window.campusError ?? window.__sceneError ?? null), null);
      const read = () => page.evaluate(campus ? () => window.campusApp.knowledgeHall.state().state : () => window.__knowledgeLab().state);
      const settle = () => page.waitForFunction(campus
        ? () => window.campusApp.knowledgeHall.state().views.every(view => !view.animating)
        : () => !window.__knowledgeLab().view?.animating);
      const capture = async name => {
        await settle();
        assert.doesNotMatch(await page.$eval('body', element => element.innerText),
          /教学陈设|虚构教学|非实地|非实测|不是在线用户|不代表认证|初版教学实验/);
        await page.screenshot({path: path.join(output, `labs-${host}-${width}-${name}.png`)});
      };
      const fill = async (selector, value) => {
        await page.$eval(selector, (input, value) => {input.value = value; input.dispatchEvent(new Event('input', {bubbles: true}));}, String(value));
      };
      if (campus) {
        await page.click('#enter-knowledge-hall');
        assert.equal(await page.evaluate(() => window.campusApp.knowledgeHall.state().count), 3);
        assert.equal(await page.evaluate(() => window.campusApp.knowledgeHall.state().surfaces.textures), 6);
        await capture('entry-threshold');
        await page.waitForFunction(() => window.campusApp.walkthrough.state().phase === 'inside');
        assert.ok(Math.abs((await page.evaluate(() => window.campusApp.walkthrough.state().position))[1] - .2) < 1e-8,
          'The entry motion must finish past the actual Shunde doorway');
        await capture('entry-room');
        if (width < 760) {
          const framing = await page.evaluate(() => {
            const camera = window.campusApp.inspection().camera;
            let scene = window.campusApp.campus.layers.building;
            while (scene.parent) scene = scene.parent;
            const pond = scene.getObjectByName('pond-water');
            const positions = pond.geometry.attributes.position;
            const points = Array.from({length: positions.count}, (_, index) => {
              const point = pond.localToWorld(camera.position.clone().fromBufferAttribute(positions, index)).project(camera);
              return {x: (point.x + 1) * innerWidth / 2, y: (1 - point.y) * innerHeight / 2};
            });
            return {points, panelTop: document.getElementById('walk-controls').getBoundingClientRect().top};
          });
          assert.ok(framing.points.every(point => point.x >= 0 && point.x <= width && point.y > 0 && point.y < framing.panelTop),
            'The complete pond must fit above the mobile controls after entering');
        }
        await page.keyboard.down('w'); await new Promise(done => setTimeout(done, 1800)); await page.keyboard.up('w');
        assert.ok((await page.evaluate(() => window.campusApp.walkthrough.state().position))[1] < 1.5);
        await capture('walk-in');
        assert.equal(await page.$eval('#interact-exhibit', button => button.disabled), false);
        await page.keyboard.press('f');
        assert.equal((await read()).kind, 'markov');
        await page.keyboard.press('Escape');
      }
      for (const id of ['markov', 'graph', 'list']) {
        if (campus && id === 'markov' && width === 1600) {
          const target = (await page.evaluate(() => window.campusApp.knowledgeHall.pickTargets())).find(entry => entry.id === id);
          await page.mouse.click(target.x, target.y);
        } else {
          const selector = campus ? `[data-hall-lab="${id}"]` : `.lab-launches [data-lab="${id}"]`;
          if (width < 760) await (await page.$(selector)).tap();
          else await page.click(selector);
        }
        await page.waitForFunction(() => !document.getElementById('knowledge-lab-panel').hidden);
        await settle();
        assert.equal((await read()).kind, id);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const panelOverflow = await page.$eval('#knowledge-lab-panel', node => node.scrollWidth > node.clientWidth + 1);
        assert.equal(panelOverflow, false);
        if (campus) {
          const before = await page.evaluate(() => window.campusApp.walkthrough.state().position);
          await page.keyboard.down('w'); await new Promise(done => setTimeout(done, 150)); await page.keyboard.up('w');
          assert.deepEqual(await page.evaluate(() => window.campusApp.walkthrough.state().position), before);
        }
        if (id === 'graph') {
          await page.select('#lab-algorithm', 'dijkstra');
          for (let i = 0; i < 6; i++) {
            if ((await read()).done) break;
            await page.click('[data-lab-action="step"]');
          }
          assert.deepEqual((await read()).path, ['A', 'B', 'D', 'E', 'F']);
          assert.equal((await read()).distances.F, 7);
        } else if (id === 'list') {
          await page.click('[data-lab-action="insert"]');
          assert.equal((await read()).nodes.length, 4);
          for (let i = 0; i < 4; i++) await page.click('[data-lab-action="reverse"]');
          assert.equal((await read()).head, 'n3');
          assert.equal((await read()).done, true);
        } else {
          await page.click('[data-lab-action="step"]');
          assert.deepEqual((await read()).distribution, [0, .1, .3, .6]);
          await capture('frog-jump');
          await page.click('[data-lab-action="hundred"]');
          assert.equal((await read()).steps, 101);
        }
        await capture(id);
        if (id === 'graph') {
          await fill('#lab-weight', 0); await page.click('[data-lab-action="weight"]');
          assert.equal(await page.$eval('.lab-error', node => node.hidden), false);
          assert.equal((await read()).distances.F, 7, 'Invalid edits must leave the live graph intact');
          await fill('#lab-weight', 1); await page.click('[data-lab-action="weight"]');
          assert.equal((await read()).steps, 0);
          for (let i = 0; i < 6 && !(await read()).done; i++) await page.click('[data-lab-action="step"]');
          assert.equal((await read()).distances.F, 2);
        } else if (id === 'markov') {
          await fill('#lab-probability-3', .9); await page.click('[data-lab-action="probabilities"]');
          assert.equal(await page.$eval('.lab-error', node => node.hidden), false);
          assert.equal((await read()).steps, 101, 'Invalid row sums must not be normalized or reset the experiment');
          for (const [from, row] of [[0, [0, 1, 0, 0]], [1, [0, 0, 0, 1]], [3, [0, 0, 0, 1]]]) {
            await page.select('#lab-row', String(from));
            for (let i = 0; i < 4; i++) await fill(`#lab-probability-${i}`, row[i]);
            await page.click('[data-lab-action="probabilities"]');
          }
          for (const current of [1, 3, 3]) {
            await page.click('[data-lab-action="step"]'); assert.equal((await read()).current, current);
          }
        }
        await page.click('.lab-quiz summary');
        for (const [index, question] of questions(id).entries()) await page.click(`input[name="lab-question-${index}"][value="${question.correct}"]`);
        await page.click('.lab-quiz button[type="submit"]');
        assert.equal(await page.$$eval('.lab-quiz output', nodes => nodes.filter(node => node.textContent.startsWith('判断正确')).length), 3);
        await page.keyboard.press('Escape');
        assert.equal(await page.$eval('#knowledge-lab-panel', panel => panel.hidden), true);
        if (campus) assert.equal(await page.evaluate(() => window.campusApp.walkthrough.state().active), true);
      }
      if (campus) {
        await page.click('#exit-building');
        assert.equal(await page.evaluate(() => window.campusApp.knowledgeHall.state().count), 0);
        await page.select('#visit-building', 'jianhua');
        assert.equal(await page.evaluate(() => window.campusApp.knowledgeHall.state().count), 0);
        await page.waitForFunction(() => window.campusApp.walkthrough.state().phase === 'inside');
        await page.keyboard.press('f');
        assert.equal(await page.evaluate(() => window.campusApp.knowledgeHall.state().active), null,
          'Jianhua finishes must not activate absent Shunde exhibits');
        assert.equal(await page.$eval('#interact-exhibit', button => button.hidden), true);
        await page.click('#exit-building');
        await page.click('#enter-knowledge-hall');
        assert.equal(await page.evaluate(() => window.campusApp.knowledgeHall.state().count), 3);
        await page.click('#exit-building');
        assert.equal(await page.evaluate(() => window.campusApp.stats.buildings), 650);
        const memories = [];
        for (let i = 0; i < 3; i++) {
          for (const kind of ['shunde', 'jianhua']) {
            await page.evaluate(kind => window.campusApp.visitBuilding(kind), kind);
            if (kind === 'shunde') {
              await page.click('[data-hall-lab="markov"]'); await settle(); await page.keyboard.press('Escape');
            } else await page.waitForFunction(() => window.campusApp.walkthrough.state().phase === 'inside');
            assert.equal(await page.evaluate(() => {
              const scene = window.campusApp.campus.group.parent;
              let lights = 0; scene.traverse(object => {if (object.isRectAreaLight) lights++;}); return lights;
            }), 3);
            await page.click('#exit-building');
            assert.equal(await page.evaluate(() => {
              let lights = 0; window.campusApp.campus.group.parent.traverse(object => {if (object.isRectAreaLight) lights++;}); return lights;
            }), 0);
          }
          memories.push(await page.evaluate(() => {
            window.campusApp.render(true);
            const {textures, geometries} = window.campusApp.inspection().rendering; return {textures, geometries};
          }));
        }
        for (const key of ['textures', 'geometries']) assert.ok(memories.at(-1)[key] <= memories[0][key],
          `Re-entering both interiors must not leak ${key}: ${JSON.stringify(memories)}`);
        await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
        await page.click('#enter-knowledge-hall');
        assert.equal(await page.evaluate(() => window.campusApp.walkthrough.state().phase), 'inside');
        assert.equal((await page.evaluate(() => window.campusApp.walkthrough.state().position))[1], 4.5,
          'Reduced-motion entry leaves the visitor in manual control at the threshold');
        await page.click('#exit-building');
      } else {
        await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
        await page.click('.lab-launches [data-lab="markov"]');
        assert.equal(await page.evaluate(() => window.__knowledgeLab().view.animating), false);
        assert.equal(await page.evaluate(() => window.__knowledgeLab().view.lift), .7);
        await page.keyboard.press('Escape');
      }
      if (width === 1600) {
        await page.goto(base, {waitUntil: 'load'});
        await page.goBack({waitUntil: 'load'});
        await page.waitForFunction(campus ? () => window.campusApp?.ready : () => window.__knowledgeReady);
        if (campus) {
          await page.click('#enter-knowledge-hall');
          await page.click('[data-hall-lab="graph"]');
        } else await page.click('.lab-launches [data-lab="graph"]');
        assert.equal((await read()).kind, 'graph', 'Browser Back must retain or rebuild functional lab controls');
        await page.keyboard.press('Escape');
      }
      if (host === 'offline') assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      report[`${host}-${width}`] = {errors, offlineRequests: host === 'offline' ? requests.length : null, graphCost: 7, labs: 3, answeredQuestions: 9};
      await page.close();
      console.log(`Knowledge labs: ${host} ${width}px passed.`);
    }
  }
  await writeFile(path.join(output, 'knowledge-labs-qa.json'), JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
