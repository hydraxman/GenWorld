import assert from 'node:assert/strict';
import path from 'node:path';
import modernSources from '../data/modern-building-sources.json' with {type: 'json'};

async function snapshot(frame) {
  await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return frame.evaluate(() => {
    const {camera, bounds, region, shadowTexelMeters} = window.campusApp.inspection();
    const {clientWidth: width, clientHeight: height} = document.getElementById('workspace');
    const points = [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y =>
      [bounds.min.z, bounds.max.z].map(z => {
        const point = bounds.min.clone().set(x, y, z).project(camera);
        return [(point.x + 1) * width / 2, (1 - point.y) * height / 2];
      })));
    return {width, height, region, points, shadowTexelMeters,
      direction: bounds.min.clone().set(0, 0, -1).applyQuaternion(camera.quaternion).toArray(),
      inspector: !document.getElementById('sidebar').hidden,
      layers: !document.getElementById('layers').hidden};
  });
}

function assertFramed(state) {
  const {region, points, width, height} = state;
  assert.ok(region.width > width / 2 && region.height > height / 4, 'Controls must leave a usable model viewport');
  assert.ok(region.x >= 0 && region.y >= 0 && region.x + region.width <= width &&
    region.y + region.height <= height, 'Inspection region must remain inside the canvas');
  for (const [x, y] of points) {
    assert.ok(x >= region.x - 1 && x <= region.x + region.width + 1 &&
      y >= region.y - 1 && y <= region.y + region.height + 1,
    `Focus clipped by viewport or controls: ${JSON.stringify({x, y, region})}`);
  }
}

export async function checkCampusInspection({page, frame, screenshots}) {
  const viewport = page.viewport();
  await frame.click('#view-all');
  const overview = await snapshot(frame);
  await frame.click('#view-auditorium');
  const closeup = await snapshot(frame);
  assertFramed(closeup);
  assert.ok(closeup.shadowTexelMeters < .03 && closeup.shadowTexelMeters < overview.shadowTexelMeters / 20);
  assert.equal(await frame.evaluate(() => {
    const building = [...window.campusApp.campus.buildings.values()].find(object => object.name === '大礼堂');
    return Boolean(building.getObjectByName('south gable tripartite segmental window'));
  }), true);
  await frame.$eval('#message', element => { element.hidden = true; });
  await page.screenshot({path: path.join(screenshots, 'campus-auditorium-detail.png')});
  await frame.click('#toggle-inspector');
  const expanded = await snapshot(frame);
  assert.equal(expanded.inspector, false);
  assert.ok(expanded.region.width > closeup.region.width);
  assertFramed(expanded);
  await frame.click('#toggle-inspector');
  await frame.click('#view-plan');
  assertFramed(await snapshot(frame));
  await frame.click('#view-auditorium');
  for (const dimensions of [{width: 390, height: 844}, {width: 320, height: 568}, {width: 844, height: 550}]) {
    await page.setViewport(dimensions);
    const mobile = await snapshot(frame);
    assert.equal(mobile.inspector, false);
    assert.equal(mobile.layers, false);
    assertFramed(mobile);
    assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await frame.click('#toggle-inspector');
    assert.equal(await frame.$eval('#toggle-inspector', element => element.getAttribute('aria-expanded')), 'true');
    await frame.$eval('#search', element => { element.value = '大礼堂'; element.dispatchEvent(new Event('input')); });
    await frame.click('#results button');
    assert.equal((await snapshot(frame)).inspector, false, 'Selecting a result should dismiss the mobile inspector');
    await frame.click('#toggle-layers');
    await frame.click('[data-layer="water"]');
    assert.equal(await frame.evaluate(() => window.campusApp.campus.layers.water.visible), false);
    await frame.click('[data-layer="water"]');
    await frame.click('#toggle-layers');
    assertFramed(await snapshot(frame));
    if (dimensions.width === 390) {
      await page.screenshot({path: path.join(screenshots, 'campus-auditorium-mobile-detail.png')});
    }
  }
  await page.setViewport(viewport);
  await snapshot(frame);
  await frame.$eval('#search', element => { element.value = ''; element.dispatchEvent(new Event('input')); });
  await frame.click('#view-auditorium');
  assertFramed(await snapshot(frame));
}

export async function checkCampusExpansion({page, frame, screenshots}) {
  const viewport = page.viewport();
  for (const source of modernSources.buildings) {
    await frame.goto(new URL(`?view=${source.referenceSite}`, frame.url()).href, {waitUntil: 'load'});
    await frame.waitForFunction(() => window.campusApp?.ready || window.campusError);
    assert.equal(await frame.evaluate(() => window.campusError), undefined);
    assert.equal(await frame.$eval('#selection-name', element => element.textContent), source.name);
    const model = await frame.evaluate(id => {
      const app = window.campusApp, root = app.campus.buildings.get(id);
      let meshes = 0;
      root.children.find(child => child.userData.campusDetail).traverse(object => {if (object.isMesh) meshes++;});
      return {buildings: app.stats.buildings, status: root.userData.refinementStatus, meshes,
        site: root.userData.referenceSite, hiddenBase: !root.getObjectByName('base').visible,
        uniqueIdentity: [...app.campus.objects.keys()].filter(key => key === id).length,
        exportAvailable: !document.getElementById('export-building').hidden};
    }, source.featureId);
    assert.equal(model.buildings, 650);
    assert.equal(model.status, 'detailed');
    assert.equal(model.site, source.referenceSite);
    assert.equal(model.hiddenBase, true);
    assert.equal(model.exportAvailable, true);
    assert.equal(model.uniqueIdentity, 1);
    assert.ok(model.meshes >= 5 && model.meshes <= 24);
    await frame.$eval('#message', element => {element.hidden = true;});
    const initial = await snapshot(frame);
    assertFramed(initial);
    await page.screenshot({path: path.join(screenshots, `campus-${source.referenceSite}-desktop.png`)});
    await page.setViewport({width: 390, height: 844});
    assertFramed(await snapshot(frame));
    await frame.click('#toggle-inspector');
    await frame.$eval('#search', (element, name) => {
      element.value = name; element.dispatchEvent(new Event('input'));
    }, source.name);
    assert.equal(await frame.$$eval('#results button', buttons => buttons.length), 1);
    await frame.click('#results button');
    assert.equal((await snapshot(frame)).inspector, false);
    const refocused = await snapshot(frame);
    assertFramed(refocused);
    assert.ok(initial.direction.reduce((sum, value, axis) => sum + value * refocused.direction[axis], 0) > .999,
      'Search focus must retain the registered facade view instead of switching to a roof-heavy generic camera');
    await page.screenshot({path: path.join(screenshots, `campus-${source.referenceSite}-mobile.png`)});
    await page.setViewport(viewport);
    await snapshot(frame);
  }
  await frame.$eval('#search', element => {element.value = ''; element.dispatchEvent(new Event('input'));});
}
