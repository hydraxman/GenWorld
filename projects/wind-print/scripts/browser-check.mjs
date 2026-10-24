import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export async function checkWindPrint({ page, frame, browser, screenshots }) {
  const settled = () => frame.waitForFunction(() => {
    const state = window.windPrint.getState();
    return !state.growing && state.displacement === 0;
  });
  const state = () => frame.evaluate(() => window.windPrint.getState());
  const image = async () => createHash('sha256').update(await frame.$eval('canvas', canvas => canvas.toDataURL())).digest('hex');
  await settled();
  assert.equal((await state()).width, 1000);
  assert.equal((await state()).height, 1000);
  const initial = await image();
  const initialSeed = (await state()).seed;
  await frame.click('#seed-lock');
  await frame.click('#regenerate');
  await settled();
  assert.equal((await state()).seed, initialSeed);
  assert.equal(await image(), initial, 'Locked regeneration must reproduce the exact poster pixels');

  let bounds = await (await frame.$('canvas')).boundingBox();
  const at = (x, y) => [bounds.x + bounds.width * x / 1000, bounds.y + bounds.height * y / 1000];
  await page.mouse.move(...at(270, 275));
  await frame.waitForFunction(() => window.windPrint.getState().displacement > 3);
  const repelled = await image();
  assert.notEqual(repelled, initial, 'Push mode must visibly move WIND lines');
  await frame.click('[data-mode="attract"]');
  await page.mouse.move(...at(270, 275));
  await frame.waitForFunction(() => window.windPrint.getState().displacement > 3);
  assert.notEqual(await image(), repelled, 'Attract mode must produce different field motion');
  await frame.click('[data-mode="restore"]');
  await settled();
  assert.equal(await image(), initial, 'Restore must return the original print exactly');

  const initialLeaves = (await state()).leafCount;
  await frame.$eval('#density', element => { element.value = '100'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await settled();
  assert.ok((await state()).leafCount > initialLeaves);
  await frame.$eval('#density', element => { element.value = '60'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await settled();
  assert.equal(await image(), initial);
  await frame.click('[data-palette="coral"]');
  await settled();
  assert.equal((await state()).palette, 'coral');
  assert.notEqual(await image(), initial);
  await frame.click('[data-palette="teal"]');
  await settled();
  assert.equal(await image(), initial, 'Palette switching must not mutate the composition');

  await page.mouse.move(...at(270, 720));
  await page.mouse.down();
  await page.mouse.move(...at(630, 570), { steps: 25 });
  await page.mouse.up();
  await settled();
  assert.equal((await state()).strokes.length, 1);
  assert.ok((await state()).leafCount > initialLeaves);
  await frame.click('#undo');
  await settled();
  assert.equal((await state()).strokes.length, 0);
  assert.equal(await image(), initial);
  await frame.focus('#add-branch');
  await page.keyboard.press('Enter');
  await settled();
  assert.equal((await state()).strokes.length, 1);
  await frame.click('#clear');
  await settled();
  assert.equal(await image(), initial);

  await frame.click('#seed-lock');
  await frame.click('#regenerate');
  await settled();
  assert.notEqual((await state()).seed, initialSeed);
  assert.notEqual(await image(), initial);
  await frame.$eval('#seed', element => { element.value = '0'; element.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.equal(await frame.$eval('#status', element => element.getAttribute('role')), 'alert');
  await frame.$eval('#seed', (element, value) => { element.value = String(value); element.dispatchEvent(new Event('change', { bubbles: true })); }, initialSeed);
  await settled();
  assert.equal(await image(), initial);

  const inkCoverage = await frame.$eval('canvas', canvas => {
    const context = canvas.getContext('2d');
    return [[60, 185, 880, 225], [75, 485, 850, 360]].map(([x, y, w, h]) => {
      const data = context.getImageData(x, y, w, h).data;
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 220 && data[i + 1] < 220) ink++;
      return ink;
    });
  });
  assert.ok(inkCoverage[0] > 30000, 'The export must contain the complete WIND letter field');
  assert.ok(inkCoverage[1] > 6000, 'The export must contain a substantial botanical composition');
  const poster = await frame.$eval('canvas', canvas => canvas.toDataURL().split(',')[1]);
  await writeFile(path.join(screenshots, 'wind-print-poster.png'), Buffer.from(poster, 'base64'));

  const cdp = await browser.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: screenshots, eventsEnabled: true });
  let timer;
  const download = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('PNG download did not finish')), 15000);
    cdp.on('Browser.downloadProgress', event => {
      if (event.state === 'completed') resolve(event.guid);
      if (event.state === 'canceled') reject(new Error('PNG download canceled'));
    });
  });
  try {
    await frame.click('#export');
    const guid = await download;
    const png = await readFile(path.join(screenshots, guid));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1000);
    assert.equal(png.readUInt32BE(20), 1000);
    await writeFile(path.join(screenshots, 'wind-print-export.png'), png);
    await unlink(path.join(screenshots, guid));
    await frame.waitForFunction(() => document.querySelector('#status').textContent.includes('已导出 PNG'));
  } finally {
    clearTimeout(timer);
    await cdp.detach();
  }

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await frame.$eval('canvas', canvas => canvas.scrollIntoView({ block: 'center' }));
  bounds = await (await frame.$('canvas')).boundingBox();
  const touch = await page.createCDPSession();
  const touches = (x, y) => [{ x, y, radiusX: 2, radiusY: 2 }];
  try {
    await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(...at(230, 735)) });
    for (let i = 1; i <= 12; i++) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(...at(230 + i * 30, 735 - i * 9)) });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settled();
    assert.equal((await state()).strokes.length, 1, 'Actual touchscreen drawing must add a branch');
    assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Print studio must not overflow on mobile');
    assert.equal((await state()).width, 1000, 'High-DPI mobile must preserve exact export resolution');
  } finally {
    await touch.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await touch.detach();
  }
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await frame.evaluate(() => window.scrollTo(0, 0));
}
