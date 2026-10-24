import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startServer } from './server.mjs';
import { FLOORS } from '../src/curriculum.js';
import { getFloorAssessment } from '../src/assessments.js';
import { STORAGE_KEY } from '../src/learning.js';

const root = fileURLToPath(new URL('..', import.meta.url));
async function browserPath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error('No browser found. Set CHROME_PATH to a Chrome or Edge executable.');
}

const server = await startServer({ port: 0 });
let browser;
const results = {};
try {
  await mkdir(path.join(root, 'qa'), { recursive: true });
  browser = await puppeteer.launch({
    executablePath: await browserPath(), headless: true, protocolTimeout: 120000,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1040, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__knowledgeReady || window.__sceneError);
  assert.equal(await page.evaluate(() => window.__sceneError ?? null), null);
  results.model = await page.evaluate(() => window.__knowledgeStats);
  assert.equal(results.model.floors, 16);
  assert.equal(results.model.rooms, 64);
  assert.equal(results.model.topics, 192);
  await page.waitForFunction(() => window.__publicAssetsReady || window.__publicAssetsError);
  assert.equal(await page.evaluate(() => window.__publicAssetsError ?? null), null);
  results.publicModels = true;
  assert.equal(await page.evaluate(() => window.__learningState.summary.known), 0, 'New profiles must not invent prior knowledge');
  await page.screenshot({ path: path.join(root, 'qa', '01-overview.png'), fullPage: true });
  await page.click('[data-mode="exploded"]');
  assert.equal(await page.evaluate(() => window.__knowledgeState.mode), 'exploded');
  await page.screenshot({ path: path.join(root, 'qa', '02-exploded.png'), fullPage: true });

  const visited = [];
  for (const floor of FLOORS) {
    await page.click(`#floor-nav [data-floor="${floor.number}"]`);
    assert.equal(await page.$eval('#floor-title', element => element.textContent), floor.title);
    assert.equal(await page.evaluate(() => window.__knowledgeState.mode), 'floor');
    for (const room of floor.rooms) {
      await page.click(`#room-nav [data-room="${room.id}"]`);
      assert.equal(await page.$eval('#room-question', element => element.textContent), room.question);
      assert.equal(await page.$$eval('#topic-tabs button', elements => elements.length), 3);
      visited.push(room.id);
    }
  }
  results.visitedRooms = visited.length;
  await page.click('#floor-nav [data-floor="14"]');
  await page.click('#room-nav [data-room="14-1"]');
  await page.screenshot({ path: path.join(root, 'qa', '03-mathematics.png'), fullPage: true });
  await page.focus('#topic-tabs [data-topic-index="2"]');
  await page.keyboard.press('Enter');
  assert.equal(await page.$eval('#topic-title', element => element.textContent), '投影与变换');
  results.keyboardTopics = true;

  await page.type('#search', 'MVCC');
  await page.click('#search-results [data-room="8-3"]');
  assert.equal(await page.$eval('#topic-title', element => element.textContent), '隔离与 MVCC');
  assert.equal(await page.evaluate(() => window.__knowledgeState.floor), 8);
  await page.click('#prerequisites [data-room="6-3"]');
  assert.equal(await page.evaluate(() => window.__knowledgeState.roomId), '6-3');
  results.searchAndPrerequisites = true;
  await page.$eval('#search', element => { element.value = ''; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.select('#route', 'algorithms');
  const routeFloors = [];
  for (let index = 0; index < 6; index++) {
    routeFloors.push(await page.evaluate(() => window.__knowledgeState.floor));
    if (index < 5) await page.click('#route-next');
  }
  assert.deepEqual(routeFloors, [1, 13, 3, 4, 15, 5]);
  assert.equal(await page.$eval('#route-next', element => element.disabled), true);
  await page.click('#route-prev');
  assert.equal(await page.evaluate(() => window.__knowledgeState.floor), 15);
  await page.click('#floor-nav [data-floor="16"]');
  assert.equal(await page.$eval('#route-position', element => element.textContent), '路线之外');
  await page.click('#route-next');
  assert.equal(await page.evaluate(() => window.__knowledgeState.floor), 1);
  results.routeFloors = routeFloors;
  await page.select('#route', '');

  await page.click('#floor-nav [data-floor="4"]');
  const pickTargets = await page.evaluate(() => window.__knowledgePickTargets());
  const target = pickTargets.find(entry => entry.roomId === '4-4');
  assert.ok(target, 'Expected a visible room pick target');
  const bounds = await page.$eval('#scene', element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y }; });
  await page.mouse.click(bounds.x + target.x, bounds.y + target.y);
  assert.equal(await page.evaluate(() => window.__knowledgeState.roomId), '4-4', '3D picking must select the exact clicked gallery');
  results.picking = true;
  const before = await page.evaluate(() => window.__knowledgeCamera().position);
  await page.mouse.move(bounds.x + 400, bounds.y + 390);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 530, bounds.y + 420, { steps: 8 });
  await page.mouse.up();
  const after = await page.evaluate(() => window.__knowledgeCamera().position);
  assert.notDeepEqual(before, after);
  assert.equal(await page.evaluate(() => window.__knowledgeState.roomId), '4-4', 'Orbit drag must not trigger room selection');
  await page.click('#reset-view');
  assert.deepEqual(await page.evaluate(() => window.__knowledgeCamera().position), before);
  results.orbitAndReset = true;
  await page.screenshot({ path: path.join(root, 'qa', '04-algorithms.png'), fullPage: true });

  await page.click('#open-plan');
  await page.waitForFunction(() => document.getElementById('plan-text').textContent.includes('192'));
  assert.equal(await page.$eval('#plan-dialog', element => element.open), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#plan-dialog', element => element.open), false);
  results.planDocument = true;

  await page.click('#floor-nav [data-floor="1"]');
  await page.click('#room-nav [data-room="1-1"]');
  await page.select('#self-rating', '0');
  await page.click('#floor-nav [data-floor="16"]');
  await page.click('#room-nav [data-room="16-1"]');
  await page.select('#self-rating', '100');
  await page.click('#heatmap-toggle');
  const ownMastery = await page.evaluate(() => window.__learningState.mastery);
  assert.equal(ownMastery['1-1'], 0);
  assert.equal(ownMastery['16-1'], 100);
  assert.equal(ownMastery['1-2'], null, 'Visiting does not manufacture mastery');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__knowledgeReady && window.__publicAssetsReady);
  assert.equal(await page.evaluate(() => window.__learningState.mastery['1-1']), 0);
  assert.equal(await page.evaluate(() => window.__learningState.mastery['16-1']), 100);
  const ownBeforeDemo = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.click('[data-profile="demo"]');
  assert.equal(await page.evaluate(() => window.__learningState.profileId), 'demo');
  assert.equal(await page.evaluate(() => window.__learningState.heatmap), true);
  await page.click('#floor-nav [data-floor="14"]');
  await page.click('#room-nav [data-room="14-1"]');
  await page.select('#self-rating', '25');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), ownBeforeDemo, 'Demo must not contaminate personal records');
  await page.click('#open-learning');
  assert.equal(await page.$eval('#learning-dialog', entry => entry.open), true);
  assert.equal(await page.$$eval('.mastery-cell', entries => entries.length), 64);
  await page.screenshot({ path: path.join(root, 'qa', '06-learning-map.png'), fullPage: true });
  await page.click('#mastery-grid [data-map-room="16-1"]');
  assert.equal(await page.evaluate(() => window.__knowledgeState.roomId), '16-1');
  await page.screenshot({ path: path.join(root, 'qa', '07-heatmap.png'), fullPage: true });
  await page.click('[data-profile="own"]');
  assert.equal(await page.evaluate(() => window.__learningState.mastery['16-1']), 100);
  await page.click('#floor-nav [data-floor="4"]');
  await page.click('#start-exam');
  const questions = getFloorAssessment(4);
  for (let index = 0; index < 4; index++) {
    const option = index === 3 ? (questions[index].correctIndex + 1) % 4 : questions[index].correctIndex;
    await page.click(`input[name="question-${index}"][value="${option}"]`);
  }
  await page.click('#submit-exam');
  assert.match(await page.$eval('#exam-result', entry => entry.textContent), /75 分/);
  assert.ok((await page.evaluate(() => window.__learningState.summary.passedFloors)).includes(4));
  assert.equal(await page.evaluate(() => window.__learningState.mastery['4-4']), 0);
  assert.equal(await page.evaluate(() => window.__learningState.mastery['4-1']), 100);
  await page.screenshot({ path: path.join(root, 'qa', '08-checkpoint.png'), fullPage: true });
  await page.click('#next-floor');
  assert.equal(await page.evaluate(() => window.__knowledgeState.floor), 5);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__knowledgeReady && window.__publicAssetsReady);
  assert.ok((await page.evaluate(() => window.__learningState.summary.passedFloors)).includes(4));
  results.personalLearning = { independentMastery: true, persistedReload: true, demoIsolated: true, exactExamScore: 75, checkpointBadge: true };

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.waitForFunction(() => window.__knowledgeCamera().aspect < 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile page must not overflow horizontally');
  await page.click('#floor-nav [data-floor="13"]');
  await page.click('#room-nav [data-room="13-1"]');
  assert.equal(await page.$eval('#room-question', element => element.textContent), FLOORS[12].rooms[0].question);
  await page.screenshot({ path: path.join(root, 'qa', '05-mobile.png'), fullPage: true });
  results.mobile = true;
  assert.equal(await page.$eval('#ui-error', element => element.hidden), true);
  assert.equal(await page.$eval('#scene-error', element => element.hidden), true);
  assert.deepEqual(errors, []);
  results.errors = errors;
  const invalidStorage = await browser.newPage();
  await invalidStorage.setViewport({ width: 1280, height: 900 });
  const invalidErrors = [];
  invalidStorage.on('console', entry => { if (entry.type() === 'error') invalidErrors.push(entry.text()); });
  await invalidStorage.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle0' });
  await invalidStorage.evaluate(key => localStorage.setItem(key, '{broken-profile'), STORAGE_KEY);
  await invalidStorage.reload({ waitUntil: 'networkidle0' });
  await invalidStorage.waitForFunction(() => window.__knowledgeReady);
  assert.equal(await invalidStorage.$eval('#storage-warning', entry => entry.hidden), false, 'Corrupt storage must be visible, not silently reset');
  await invalidStorage.click('#floor-nav [data-floor="1"]');
  await invalidStorage.click('#room-nav [data-room="1-1"]');
  await invalidStorage.select('#self-rating', '75');
  assert.equal(await invalidStorage.evaluate(key => localStorage.getItem(key), STORAGE_KEY), '{broken-profile', 'Temporary state must not overwrite corrupt original');
  assert.equal(await invalidStorage.evaluate(() => window.__learningState.mastery['1-1']), 75);
  assert.ok(invalidErrors.length > 0, 'Corrupt storage should be logged');
  invalidStorage.once('dialog', dialog => dialog.dismiss());
  await invalidStorage.click('#open-learning');
  await invalidStorage.click('#reset-profile');
  assert.equal(await invalidStorage.evaluate(key => localStorage.getItem(key), STORAGE_KEY), '{broken-profile', 'Cancel reset preserves data');
  invalidStorage.once('dialog', dialog => dialog.accept());
  await invalidStorage.click('#reset-profile');
  assert.equal(await invalidStorage.$eval('#storage-warning', entry => entry.hidden), true);
  assert.equal(await invalidStorage.evaluate(() => window.__learningState.summary.known), 0);
  await invalidStorage.close();
  results.storageRecovery = { corruptRecordPreserved: true, temporaryLearning: true, explicitResetOnly: true };
  await writeFile(path.join(root, 'qa', 'browser-check.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
