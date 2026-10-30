import assert from 'node:assert/strict';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {createProjectServer} from './serve.mjs';
import {REFINEMENT_SITES, REFINEMENT_VIEWS} from '../src/refinements.js';
import {LANDMARK_SITES} from '../src/landmarks.js';
import {checkCampusInspection, checkCampusExpansion, checkCampusZijing, checkCampusArchitecture, checkCampusPhotoAppearances, checkCampusLandscape} from './browser-check.mjs';

const root = resolve(import.meta.dirname, '..'), output = join(root, 'output');
await mkdir(output, {recursive: true});
const server = createProjectServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, protocolTimeout: 240000, args: ['--use-gl=angle', '--use-angle=d3d11'],
  });
  const page = await browser.newPage();
  await page.setViewport({width: 1600, height: 1000, deviceScaleFactor: 1});
  const errors = [], network = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  await page.goto(`http://127.0.0.1:${server.address().port}`, {waitUntil: 'load'});
  await page.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
  assert.equal(await page.evaluate(() => window.campusError), undefined);
  const stats = await page.evaluate(() => {
    const app = window.campusApp;
    let invalid = 0;
    app.campus.group.traverse(object => {
      const positions = object.geometry?.attributes.position?.array;
      if (positions && !positions.every(Number.isFinite)) invalid++;
    });
    document.getElementById('message').hidden = true;
    return {...app.stats, invalid};
  });
  assert.ok(stats.buildings > 100, 'A campus should contain more than a small landmark cluster');
  assert.equal(stats.invalid, 0);
  assert.equal(stats.refined, REFINEMENT_SITES.length);
  assert.equal(stats.landmarks, LANDMARK_SITES.length);
  const landscape = await checkCampusLandscape({page, frame: page, screenshots: output});
  await checkCampusInspection({page, frame: page, screenshots: output});
  const appearance = await checkCampusExpansion({page, frame: page, screenshots: output});
  const zijing = await checkCampusZijing({page, frame: page, screenshots: output});
  const architecture = await checkCampusArchitecture({page, frame: page, screenshots: output});
  const photoAppearances = await checkCampusPhotoAppearances({page, frame: page, screenshots: output});
  const coverage = await page.evaluate(() => window.campusApp.coverage);
  assert.equal(coverage.counts.mapBuildingObjects, stats.buildings);
  assert.equal(coverage.counts.photoModelBuildingObjects, stats.refined);
  assert.equal(coverage.counts.architectureModelBuildingObjects, stats.buildings);
  assert.equal(coverage.counts.proceduralArchitectureBuildingObjects, stats.procedural);
  assert.equal(coverage.counts.remainingBaseBuildingObjects, 0);
  assert.equal(coverage.completeFaithfulReplication, false);
  const pendingId = await page.evaluate(() =>
    [...window.campusApp.campus.buildings.values()].find(object => object.userData.refinementStatus === 'procedural')?.userData.featureId);
  if (pendingId) await page.evaluate(id => window.campusApp.select(id), pendingId);
  await page.click('#only-refined');
  const filteredIds = [];
  do {
    filteredIds.push(...await page.$$eval('#results button small', rows => rows.map(row => row.textContent)));
    if (await page.$eval('#results-next', button => button.disabled)) break;
    await page.click('#results-next');
  } while (true);
  assert.equal(filteredIds.length, stats.refined + stats.landmarks);
  assert.equal(new Set(filteredIds).size, filteredIds.length, 'Photo-model pagination must expose every root once');
  assert.equal(await page.evaluate(() => [...window.campusApp.campus.buildings.values()].filter(object => object.visible).length),
    stats.refined);
  if (pendingId) assert.equal(await page.$eval('#export-building', button => button.hidden), true);
  await page.click('#only-refined');
  assert.equal(await page.evaluate(() => [...window.campusApp.campus.buildings.values()].filter(object => object.visible).length),
    stats.buildings);
  await page.screenshot({path: join(output, 'campus-overview.png')});
  await page.click('#view-plan');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({path: join(output, 'campus-plan.png')});
  await page.click('#view-shunde');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({path: join(output, 'shunde-pilot.png')});
  for (const site of [...REFINEMENT_VIEWS, ...LANDMARK_SITES].filter(site => site.buttonId !== 'view-shunde')) {
    const button = `#${site.buttonId}`, filename = `${site.buttonId.replace('view-', '')}-reconstruction.png`;
    await page.click(button);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({path: join(output, filename)});
    const selection = await page.evaluate(() => document.getElementById('selection-fields').textContent);
    assert.ok(selection.includes('照片参照重建'));
    assert.equal(await page.$eval('#selected-references', link => link.hidden), false);
  }
  const reconstructionIndex = await page.evaluate(() =>
    [...window.campusApp.campus.objects.values()].filter(building => building.userData.refinementStatus === 'detailed')
      .map(building => ({
        featureId: building.userData.featureId, name: building.userData.name, kind: building.userData.kind,
        exportFilename: building.userData.exportFilename,
        heightSource: building.userData.heightSource, renderHeight: building.userData.renderHeight,
        localOriginMeters: building.userData.localOriginMeters,
        summary: building.userData.refinementSummary, referenceSite: building.userData.referenceSite,
        reconstructionExtent: building.userData.reconstructionExtent,
        referencePages: building.userData.referencePages || [],
        mapSource: building.userData.mapSource,
      })));
  const architectureIndex = await page.evaluate(() => [...window.campusApp.campus.buildings.values()]
    .filter(root => root.userData.refinementStatus === 'procedural').map(root => ({
      featureId: root.userData.featureId, name: root.userData.name, kind: 'building',
      family: root.userData.architectureFamily, exportFilename: root.userData.exportFilename,
      source: root.userData.architectureSource,
      appearanceProfileId: root.userData.appearanceProfileId || null,
      appearanceReferenceSite: root.userData.appearanceReferenceSite || null,
      appearanceReferencePages: root.userData.appearanceReferencePages || [],
      limitations: root.userData.refinementSummary,
    })));
  await page.type('#search', '二校门');
  await page.click('#results button');
  assert.equal(await page.$eval('#selection-name', element => element.textContent), '二校门');
  await page.click('[data-layer="landmark"]');
  assert.equal(await page.evaluate(() => window.campusApp.campus.layers.landmark.visible), false);
  await page.click('[data-layer="landmark"]');
  await page.$eval('#search', element => { element.value = ''; element.dispatchEvent(new Event('input')); });
  const firstId = await page.evaluate(() => [...window.campusApp.campus.buildings.keys()][0]);
  await page.type('#search', firstId);
  assert.ok(await page.locator('#results button').waitHandle());
  await page.click('#results button');
  const selected = await page.$eval('#selection-fields', element => element.textContent);
  assert.ok(selected.includes(firstId));
  const cdp = await page.createCDPSession();
  await page.click('#view-all');
  async function downloadModel(whole, directory = output) {
    await cdp.send('Browser.setDownloadBehavior', {behavior: 'allowAndName', downloadPath: directory, eventsEnabled: true});
    let timer, onProgress, onBegin, started;
    const completed = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('GLB download timed out')), 120000);
      onBegin = event => { started = event; };
      onProgress = event => {
        if (event.guid !== started?.guid) return;
        if (event.state === 'completed') resolve(started);
        if (event.state === 'canceled') reject(new Error('GLB download canceled'));
      };
      cdp.on('Browser.downloadWillBegin', onBegin);
      cdp.on('Browser.downloadProgress', onProgress);
    });
    try {
      const [, result] = await Promise.all([
        page.evaluate(full => window.campusApp.exportModel(full), whole),
        completed,
      ]);
      assert.match(result.suggestedFilename, /^tsinghua-[a-z0-9_-]+\.glb$/i);
      // GUID downloads avoid Chrome's "(1)" suffix and stale-file validation on repeated builds.
      await rename(join(directory, result.guid), join(directory, result.suggestedFilename));
    } finally {
      clearTimeout(timer);
      cdp.off('Browser.downloadWillBegin', onBegin);
      cdp.off('Browser.downloadProgress', onProgress);
    }
  }
  await downloadModel(true);
  const glb = await readFile(join(output, 'tsinghua-campus-refined.glb'));
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  assert.equal(glb.readUInt32LE(8), glb.length);
  const gltf = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)).trim());
  assert.ok(!gltf.nodes.some(node => node.extras?.campusTreeDisplayOnly), 'Do not export camera-selected close-up leaves');
  const canopy = gltf.nodes.find(node => node.extras?.campusTreeCanopy);
  assert.ok(canopy, 'The full-campus GLB must retain all canonical tree canopies');
  const instance = canopy.extensions?.EXT_mesh_gpu_instancing;
  assert.ok(instance);
  assert.equal(gltf.accessors[instance.attributes.TRANSLATION].count, stats.landscape.trees);
  assert.ok(gltf.materials.find(material => material.name === 'Mapped green space; original non-photographic lawn surface')
    ?.pbrMetallicRoughness.metallicRoughnessTexture, 'The generated lawn ORM texture must survive actual GLB export');
  const addressable = gltf.nodes.filter(node => node.extras?.featureId);
  assert.equal(addressable.length, stats.buildings + stats.landmarks);
  assert.equal(new Set(addressable.map(node => node.extras.featureId)).size, addressable.length);
  const frozenBuildingIds = await page.evaluate(() => [...window.campusApp.campus.buildings.keys()].sort());
  assert.deepEqual(addressable.filter(node => node.extras.kind === 'building').map(node => node.extras.featureId).sort(),
    frozenBuildingIds, 'All frozen map building identities must survive unchanged');
  assert.equal(addressable.filter(node => node.extras.kind === 'landmark').length, LANDMARK_SITES.length);
  for (const record of reconstructionIndex) {
    const node = gltf.nodes.find(item => item.extras?.featureId === record.featureId);
    assert.equal(node.extras.refinementStatus, 'detailed');
    assert.ok(!node.children?.some(index => gltf.nodes[index].name === 'base'), 'Hidden base must not be exported behind the replacement');
  }
  for (const record of architectureIndex) {
    const node = gltf.nodes.find(item => item.extras?.featureId === record.featureId);
    assert.equal(node.extras.refinementStatus, 'procedural');
    assert.equal(node.extras.referenceSite, undefined);
    assert.ok(!node.children?.some(index => gltf.nodes[index].name === 'base'));
    const detail = gltf.nodes.find(item => item.extras?.architectureLOD && item.extras.sourceEvidence?.featureId === record.featureId);
    assert.ok(detail, `Full architecture missing from whole-campus export: ${record.featureId}`);
    assert.ok(detail.children.some(index => gltf.nodes[index].extras?.architectureNear));
    assert.ok(!detail.children.some(index => gltf.nodes[index].extras?.architectureFar), 'Do not export the far shell instead of actual window openings');
  }
  const buildingOutput = join(output, 'buildings');
  const landmarkOutput = join(output, 'landmarks');
  await mkdir(buildingOutput, {recursive: true});
  await mkdir(landmarkOutput, {recursive: true});
  const architectureOutput = join(output, 'architecture');
  await mkdir(architectureOutput, {recursive: true});
  for (const record of [...reconstructionIndex, ...architectureIndex]) {
    await page.evaluate(id => window.campusApp.select(id), record.featureId);
    const directory = record.family ? architectureOutput : record.kind === 'landmark' ? landmarkOutput : buildingOutput;
    await downloadModel(false, directory);
    const filename = record.exportFilename || `tsinghua-${record.featureId.replace(/[^a-z0-9_-]/gi, '-')}.glb`;
    record.glbFile = `${record.family ? 'architecture' : record.kind === 'landmark' ? 'landmarks' : 'buildings'}\\${filename}`;
    const model = await readFile(join(output, record.glbFile));
    assert.equal(model.toString('ascii', 0, 4), 'glTF');
    assert.equal(model.readUInt32LE(8), model.length);
    const single = JSON.parse(model.toString('utf8', 20, 20 + model.readUInt32LE(12)).trim());
    const rootNode = single.nodes.find(node => node.extras?.featureId === record.featureId);
    assert.ok(rootNode);
    assert.equal(single.nodes.filter(node => node.extras?.featureId).length, 1);
    if (record.family) {
      assert.ok(single.nodes.some(node => node.extras?.architectureNear));
      assert.ok(!single.nodes.some(node => node.extras?.architectureFar));
      assert.equal(rootNode.extras.refinementStatus, 'procedural');
    }
    assert.deepEqual(rootNode.translation || [0, 0, 0], [0, 0, 0], 'Standalone geometry must export at its local origin');
    record.glbBytes = model.length;
  }
  const apartmentOutput = join(output, 'apartments');
  await mkdir(apartmentOutput, {recursive: true});
  for (let number = 1; number <= 23; number++) {
    await page.evaluate(number => window.campusApp.selectApartment(number), number);
    await downloadModel(false, apartmentOutput);
    const bytes = await readFile(join(apartmentOutput, `tsinghua-zijing-${number}.glb`));
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const single = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim());
    const identities = single.nodes.filter(node => node.extras?.featureId);
    assert.equal(identities.length, 1, 'A logical-apartment export retains exactly one original frozen root');
    assert.equal(identities[0].extras.selectedApartmentNumber, number);
    const apartmentNodes = single.nodes.filter(node => node.extras?.apartmentNumber);
    assert.deepEqual(apartmentNodes.map(node => node.extras.apartmentNumber), [number],
      'A per-apartment export must not contain siblings from the W group');
    assert.deepEqual(identities[0].translation || [0, 0, 0], [0, 0, 0]);
  }
  const offline = await browser.newPage();
  await offline.setViewport({width: 1440, height: 900});
  const external = [];
  offline.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
  offline.on('pageerror', error => errors.push(String(error)));
  await offline.goto(pathToFileURL(join(output, 'tsinghua-campus-offline.html')).href + '?view=old-library', {waitUntil: 'load'});
  await offline.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
  assert.equal(await offline.evaluate(() => window.campusError), undefined);
  assert.ok((await offline.$eval('#selection-name', element => element.textContent)).includes('老图书馆'));
  assert.equal(await offline.$eval('#selected-references', link => link.getAttribute('href')), 'reference-photos.html#old-library');
  assert.deepEqual(external, [], 'Offline viewer must not request network assets');
  await offline.goto(pathToFileURL(join(output, 'tsinghua-campus-offline.html')).href + '?view=zijing-17', {waitUntil: 'load'});
  await offline.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
  assert.equal(await offline.evaluate(() => window.campusApp.selectedApartment()), 17);
  assert.deepEqual(external, [], 'A direct W-apartment deep link must remain entirely offline');
  await offline.goto(pathToFileURL(join(output, 'tsinghua-campus-offline.html')).href
    + `?building=${encodeURIComponent(architectureIndex[0].featureId)}`, {waitUntil: 'load'});
  await offline.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
  assert.equal(await offline.evaluate(() => window.campusError), undefined);
  assert.match(await offline.$eval('#selection-fields', element => element.textContent), /程序建筑估算/);
  assert.equal(await offline.evaluate(() => window.campusApp.coverage.allFootprintsHaveArchitecture), true);
  assert.deepEqual(external, [], 'Arbitrary building deep links must remain entirely offline');
  const photoId = photoAppearances.buildings[0].featureId;
  await offline.goto(pathToFileURL(join(output, 'tsinghua-campus-offline.html')).href
    + `?building=${encodeURIComponent(photoId)}`, {waitUntil: 'load'});
  await offline.waitForFunction(() => window.campusApp?.ready || window.campusError, {timeout: 90000});
  assert.equal(await offline.evaluate(() => window.campusError), undefined);
  assert.equal(await offline.$eval('#appearance-building', element => element.value), photoAppearances.buildings[0].id);
  assert.match(await offline.$eval('#selection-fields', element => element.textContent), /对应照片配色/);
  assert.deepEqual(external, [], 'Photo-guided appearance must not download or depend on the reference photograph');
  assert.deepEqual(errors, []);
  const report = {stats, glbBytes: glb.length, singleBuildingExports: reconstructionIndex.length + architectureIndex.length,
    offlineNetworkRequests: external.length, errors, appearance, zijing, architecture, photoAppearances, landscape};
  await writeFile(join(output, 'smoke-check.json'), JSON.stringify(report, null, 2));
  await writeFile(join(output, 'campus-coverage.json'), JSON.stringify(coverage, null, 2));
  const csv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  await writeFile(join(output, 'campus-backlog.csv'), '\uFEFFfeatureId,name,stage,mapHeight,mapHeightSource\r\n'
    + coverage.buildings.filter(record => record.stage !== 'photo-informed-estimate').map(record =>
      [record.featureId, record.name, record.stage, record.mapHeight, record.mapHeightSource].map(csv).join(',')
    ).join('\r\n') + '\r\n');
  const escape = value => String(value).replace(/[&<>"']/g, character =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
  const cards = [...REFINEMENT_VIEWS, ...LANDMARK_SITES].map(view => {
    const screenshot = view.buttonId === 'view-shunde' ? 'shunde-pilot.png'
      : `${view.buttonId.replace('view-', '')}-reconstruction.png`;
    const record = coverage.buildings.find(record => record.featureId === view.featureId);
    const stage = record?.stage === 'photo-informed-partial' ? '局部重建 · 其他区域仍待完善' : '照片参照估算 · 非测绘';
    const source = reconstructionIndex.find(record => record.featureId === view.featureId);
    assert.ok(source?.referenceSite, `${view.label} gallery view must have a reference-site identity`);
    return `<article class="card"><a class="model" href="tsinghua-campus-offline.html?view=${encodeURIComponent(view.buttonId.replace('view-', ''))}">
      <img loading="lazy" src="${screenshot}" alt="${escape(view.label)}模型截图"><h2>${escape(view.label)}</h2></a>
      <p>${stage} · <a href="reference-photos.html#${encodeURIComponent(source.referenceSite)}">对照实景照片</a></p></article>`;
  });
  for (const record of photoAppearances.buildings) cards.push(`<article class="card"><a class="model"
    href="tsinghua-campus-offline.html?building=${encodeURIComponent(record.featureId)}">
    <img loading="lazy" src="campus-photo-${record.id}-desktop.png" alt="${escape(record.name)}照片配色估算截图">
    <h2>${escape(record.name)}</h2></a><p>程序估算 · 对应照片配色／局部特征，非逐面复原 ·
    <a href="reference-photos.html#${record.source}">查看照片依据与未知项</a></p></article>`);
  await writeFile(join(output, 'campus-reconstruction-gallery.html'), `<!doctype html><html lang="zh-CN">
    <meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>清华校园 · 已重建建筑</title>
    <style>body{font:15px/1.7 "Microsoft YaHei",sans-serif;background:#f1f3ee;color:#2a3d35;max-width:1500px;margin:35px auto;padding:0 24px}h1{margin:0}a{color:inherit}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;margin-top:24px}.card{display:block;background:white;border:1px solid #d8dfd3;border-radius:12px;overflow:hidden}.model{display:block;text-decoration:none}.card:hover{border-color:#866b96}.card img{display:block;width:100%;aspect-ratio:8/5;object-fit:contain}.card h2{font-size:18px;margin:12px 18px 0}.card p{font-size:12px;color:#6f7c6d;margin:3px 18px 17px}.note{font-size:12px;color:#75806f}</style>
    <h1>清华校园 · 已重建建筑与地标</h1><p>当前 ${stats.reconstructedSites} 处地点，${stats.refined} 个地图轮廓及 ${stats.landmarks} 个独立地标。点击图片打开该处三维视角。</p>
    <p class="note">全部${stats.buildings}个冻结轮廓已有建筑结构，其中${stats.procedural}个为程序估算，单列${photoAppearances.count}个对应照片配色／局部特征；还有${coverage.counts.partialPhotoModelBuildingObjects}个照片模型仅做了局部。覆盖不等于完整复刻。截图来自实际工作台，具体限制见模型说明与参考图库。</p>
    <p><a href="tsinghua-campus-offline.html">打开全校园工作台</a> · <a href="reference-photos.html">本地参考照片</a> · <a href="campus-backlog.csv">剩余建筑清单</a></p>
    <div class="grid">${cards.join('')}</div></html>`);
  await writeFile(join(output, 'reconstruction-index.json'), JSON.stringify({
    batch: 6, storage: 'current project only; no OneDrive delivery',
    limitations: 'Photo-informed estimates, not surveyed geometry. Reference photos are not model textures.',
    buildings: reconstructionIndex.filter(record => record.kind === 'building'),
    proceduralArchitecture: architectureIndex,
    landmarks: reconstructionIndex.filter(record => record.kind === 'landmark'),
  }, null, 2));
  await page.bringToFront();
  await page.goto(`http://127.0.0.1:${server.address().port}/output/campus-reconstruction-gallery.html`, {waitUntil: 'load'});
  assert.equal(await page.$$eval('.card', elements => elements.length), cards.length);
  await page.$$eval('.card img', images => images.forEach(image => { image.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.querySelectorAll('.card img')]
    .every(image => image.complete && image.naturalWidth > 0), {timeout: 30000, polling: 100});
  await page.screenshot({path: join(output, 'campus-reconstruction-gallery.png'), fullPage: true});
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
