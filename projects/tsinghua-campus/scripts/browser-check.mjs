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

export async function measureCampusAppearance(frame, site, apartmentNumber = null) {
  return frame.evaluate(({site, apartmentNumber}) => {
    const app = window.campusApp, {camera} = app.inspection();
    const roots = [...app.campus.buildings.values()];
    const root = roots.find(object => object.userData.referenceSite === site &&
      (apartmentNumber === null || object.userData.apartmentNumbers?.includes(apartmentNumber)));
    const completeDetail = root.children.find(child => child.userData.campusDetail);
    const detail = apartmentNumber === null ? completeDetail
      : completeDetail.children.find(child => child.userData.apartmentNumber === apartmentNumber);
    const p = detail.userData.estimatedDimensionsMeters;
    let glazing, masonry;
    if (site === 'zijing-dormitories') {
      ({glazing, masonry} = detail.userData.facadeSample);
    } else if (site === 'art-museum') {
      glazing = [7, 7, -6.65]; masonry = [-50, 7, .02];
    } else if (site === 'sports-center') {
      const angle = Math.PI / 64, x = p.radiusX * Math.sin(angle), z = p.arenaCenterZ + p.radiusZ * Math.cos(angle);
      glazing = [x, (p.upperBandBottom + p.eave) / 2, z + .04];
      masonry = [x, (p.lowerBandTop + p.upperBandBottom) / 2, z + .04];
    } else if (site === 'music-hall') {
      const x = p.windowCenters[8], y = p.windowHead - (p.windowHead - p.windowTip) * .2;
      glazing = [x, y, -1.04]; masonry = [(x + p.windowCenters[9]) / 2, y, .02];
    } else throw new Error(`No facade meter for ${site}`);
    app.render();
    const canvas = document.getElementById('scene'), copy = document.createElement('canvas');
    copy.width = canvas.width; copy.height = canvas.height;
    const context = copy.getContext('2d', {willReadFrequently: true});
    context.drawImage(canvas, 0, 0);
    function luminance(local) {
      const point = camera.position.clone().set(...local).applyMatrix4(detail.matrixWorld).project(camera);
      const x = Math.round((point.x + 1) / 2 * canvas.width), y = Math.round((1 - point.y) / 2 * canvas.height);
      if (x < 2 || y < 2 || x >= canvas.width - 2 || y >= canvas.height - 2) throw new Error('Facade sample outside canvas');
      const pixels = context.getImageData(x - 1, y - 1, 3, 3).data;
      let total = 0;
      for (let i = 0; i < pixels.length; i += 4) total += .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
      return +(total / 9).toFixed(2);
    }
    const baseMeshes = roots.filter(object => object.getObjectByName('base').visible)
      .flatMap(object => object.getObjectByName('base').children.filter(mesh => mesh.isMesh && Array.isArray(mesh.material)));
    return {glazing: luminance(glazing), masonry: luminance(masonry), rendering: app.inspection().rendering,
      baseMeshes: baseMeshes.length, windowlessBases: baseMeshes.filter(mesh => !mesh.material[1].map).length};
  }, {site, apartmentNumber});
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

async function flatRoofLuminanceRange(frame) {
  return frame.evaluate(() => {
    const app = window.campusApp, {camera} = app.inspection();
    const root = [...app.campus.buildings.values()].find(object => object.name === '西体育馆');
    let roof;
    root.traverse(object => {
      if (object.isMesh && !Array.isArray(object.material) && object.material.name.includes('inferred addition roof')) roof = object;
    });
    if (!roof || !roof.receiveShadow) throw new Error('Flat-roof regression requires real receive shadows');
    const positions = roof.geometry.attributes.position, index = roof.geometry.index;
    let largest = 0, center;
    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
      const vertices = [0, 1, 2].map(j => camera.position.clone().fromBufferAttribute(positions, index ? index.getX(i + j) : i + j));
      const area = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).lengthSq();
      if (area > largest) {
        largest = area;
        center = vertices[0].add(vertices[1]).add(vertices[2]).divideScalar(3);
      }
    }
    if (!center) throw new Error('Flat-roof regression requires a triangulated surface');
    center.applyMatrix4(roof.matrixWorld).project(camera);
    app.render();
    const canvas = document.getElementById('scene'), copy = document.createElement('canvas');
    copy.width = canvas.width; copy.height = canvas.height;
    const context = copy.getContext('2d', {willReadFrequently: true});
    context.drawImage(canvas, 0, 0);
    const x = Math.round((center.x + 1) / 2 * canvas.width), y = Math.round((1 - center.y) / 2 * canvas.height);
    const pixels = context.getImageData(x - 20, y - 10, 40, 20).data, values = [];
    for (let i = 0; i < pixels.length; i += 4) values.push(.2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2]);
    return Math.max(...values) - Math.min(...values);
  });
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
  await frame.click('#view-west-gym');
  await snapshot(frame);
  assert.ok(await flatRoofLuminanceRange(frame) < 3, 'Uniform roof must not develop self-shadow ripple patterns');
  await page.screenshot({path: path.join(screenshots, 'campus-flat-roof-shadow-detail.png')});
  await frame.click('#view-auditorium');
  assertFramed(await snapshot(frame));
}

export async function checkCampusExpansion({page, frame, screenshots}) {
  const viewport = page.viewport(), report = [];
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
    const appearance = await measureCampusAppearance(frame, source.referenceSite);
    assert.ok(appearance.rendering?.environment, 'Exterior glazing needs an actual reflection environment');
    assert.equal(appearance.rendering.contactShadows, true, 'Desktop detailed views should receive contact shadows');
    assert.ok(appearance.baseMeshes > 600 && appearance.windowlessBases === 0, 'Baseline walls must not be featureless blocks');
    assert.ok(appearance.glazing >= 35 && appearance.glazing <= 110,
      `Glazing is crushed black or washed out at ${source.referenceSite}: ${JSON.stringify(appearance)}`);
    assert.ok(appearance.masonry - appearance.glazing >= 25,
      `Windows must remain distinct from masonry at ${source.referenceSite}: ${JSON.stringify(appearance)}`);
    await frame.$eval('#contact-shadows', element => {element.checked = false; element.dispatchEvent(new Event('change'));});
    const withoutAO = await measureCampusAppearance(frame, source.referenceSite);
    assert.equal(withoutAO.rendering.contactShadows, false);
    assert.ok(Math.abs(withoutAO.glazing - appearance.glazing) < 25, 'Contact shadows must not darken entire windows');
    report.push({site: source.referenceSite, ...appearance, glazingWithoutAO: withoutAO.glazing});
    await frame.$eval('#contact-shadows', element => {element.checked = true; element.dispatchEvent(new Event('change'));});
    await frame.$eval('#base-facades', element => {element.checked = false; element.dispatchEvent(new Event('change'));});
    const plain = await measureCampusAppearance(frame, source.referenceSite);
    assert.equal(plain.windowlessBases, plain.baseMeshes);
    await frame.$eval('#base-facades', element => {element.checked = true; element.dispatchEvent(new Event('change'));});
    await snapshot(frame);
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
    assert.equal((await measureCampusAppearance(frame, source.referenceSite)).rendering.contactShadows, false,
      'Mobile must default to the lighter raster path');
    const refocused = await snapshot(frame);
    assertFramed(refocused);
    assert.ok(initial.direction.reduce((sum, value, axis) => sum + value * refocused.direction[axis], 0) > .999,
      'Search focus must retain the registered facade view instead of switching to a roof-heavy generic camera');
    await page.screenshot({path: path.join(screenshots, `campus-${source.referenceSite}-mobile.png`)});
    await page.setViewport(viewport);
    await snapshot(frame);
  }
  await frame.$eval('#search', element => {element.value = ''; element.dispatchEvent(new Event('input'));});
  assert.equal(await frame.evaluate(() => {
    const root = [...window.campusApp.campus.buildings.values()].find(object =>
      object.userData.refinementStatus !== 'detailed' && object.userData.renderHeight >= 20);
    if (!root) throw new Error('Missing baseline building to inspect');
    const material = root.getObjectByName('base').children.find(mesh => mesh.isMesh).material;
    const before = material[1].map;
    window.campusApp.select(root.userData.featureId, true);
    const after = root.getObjectByName('base').children.find(mesh => mesh.isMesh).material;
    return Array.isArray(after) && after[1].map === before;
  }), true, 'Selecting a base building must preserve the visible window material');
  assert.match(await frame.$eval('#selection-help', element => element.textContent), /窗格示意.*非照片/);
  await snapshot(frame);
  await page.mouse.move(viewport.width - 5, viewport.height - 5);
  await page.screenshot({path: path.join(screenshots, 'campus-baseline-windows-desktop.png')});
  return report;
}

export async function checkCampusZijing({page, frame, screenshots}) {
  const viewport = page.viewport(), report = [];
  assert.equal(await frame.$$eval('#zijing-apartment option', options => options.length), 24);
  assert.deepEqual(await frame.evaluate(() => window.campusApp.coverage.logicalApartmentNumbers),
    Array.from({length: 23}, (_, i) => i + 1));
  assert.equal(await frame.evaluate(() => window.campusApp.coverage.counts.groupTypologyBuildingObjects), 20);
  await frame.click('#view-zijing');
  assertFramed(await snapshot(frame));
  await frame.$eval('#message', element => {element.hidden = true;});
  await page.screenshot({path: path.join(screenshots, 'campus-zijing-group-desktop.png')});
  for (let number = 1; number <= 23; number++) {
    await frame.select('#zijing-apartment', String(number));
    const state = await snapshot(frame);
    assertFramed(state);
    assert.equal(await frame.evaluate(() => window.campusApp.selectedApartment()), number);
    assert.equal(await frame.$eval('#selection-name', element => element.textContent), `紫荆学生公寓${number}号楼`);
    assert.match(await frame.$eval('#selection-fields', element => element.textContent), /组团类型推定/);
    assert.equal(await frame.$eval('#export-building', element => element.hidden), false);
    const model = await frame.evaluate(number => {
      const root = [...window.campusApp.campus.buildings.values()].find(root => root.userData.apartmentNumbers?.includes(number));
      const part = root.children.find(child => child.userData.campusDetail).children.find(child => child.userData.apartmentNumber === number);
      return {rootId: root.userData.featureId, family: part.userData.family,
        windows: part.userData.windowCount, height: root.userData.renderHeight};
    }, number);
    const appearance = [1, 8, 14, 18, 23].includes(number)
      ? await measureCampusAppearance(frame, 'zijing-dormitories', number) : null;
    if (appearance) {
      assert.ok(appearance.glazing >= 25 && appearance.glazing <= 130,
        `Dormitory glazing must remain readable in the actual canvas: ${JSON.stringify({number, appearance})}`);
      assert.ok(appearance.masonry - appearance.glazing >= 20,
        `Dormitory windows must contrast with their surrounding masonry: ${JSON.stringify({number, appearance})}`);
    }
    report.push({number, ...model, ...(appearance ? {appearance} : {})});
    await page.screenshot({path: path.join(screenshots, `campus-zijing-${number}-desktop.png`)});
  }
  for (const number of [1, 14, 17, 23]) {
    await frame.select('#zijing-apartment', String(number));
    await snapshot(frame);
    const point = await frame.evaluate(number => {
      const app = window.campusApp, {camera} = app.inspection();
      const root = [...app.campus.buildings.values()].find(root => root.userData.apartmentNumbers?.includes(number));
      const part = root.children.find(child => child.userData.campusDetail).children.find(child => child.userData.apartmentNumber === number);
      const point = camera.position.clone().set(...part.userData.facadeSample.glazing).applyMatrix4(part.matrixWorld).project(camera);
      const canvas = document.getElementById('scene'), rect = canvas.getBoundingClientRect();
      app.select([...app.campus.buildings.keys()].find(id => id !== root.userData.featureId));
      return {x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2};
    }, number);
    const offset = frame === page ? {x: 0, y: 0} : await (await frame.frameElement()).boundingBox();
    assert.ok(offset, 'The embedded scene must have a visible frame for real pointer input');
    await page.mouse.click(point.x + offset.x, point.y + offset.y);
    assert.equal(await frame.evaluate(() => window.campusApp.selectedApartment()), number,
      `Actual scene ray picking must identify logical apartment ${number}, including W sub-buildings`);
  }
  await frame.$eval('#search', element => {element.value = '紫荆14号楼'; element.dispatchEvent(new Event('input'));});
  assert.equal(await frame.$$eval('#results button', buttons => buttons.length), 1);
  await frame.click('#results button');
  assert.equal(await frame.evaluate(() => window.campusApp.selectedApartment()), 14);
  await frame.$eval('#search', element => {element.value = ''; element.dispatchEvent(new Event('input'));});
  for (const dimensions of [{width: 390, height: 844}, {width: 320, height: 568}]) {
    await page.setViewport(dimensions);
    for (const number of [1, 14, 23]) {
      await frame.select('#zijing-apartment', String(number));
      assertFramed(await snapshot(frame));
      assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({path: path.join(screenshots, `campus-zijing-${number}-mobile-${dimensions.width}.png`)});
    }
  }
  await page.setViewport(viewport);
  await snapshot(frame);
  for (const view of ['zijing-dining', 'taoli-dining']) {
    await frame.click(`#view-${view}`);
    assertFramed(await snapshot(frame));
    await page.screenshot({path: path.join(screenshots, `campus-${view}-desktop.png`)});
  }
  return report;
}
