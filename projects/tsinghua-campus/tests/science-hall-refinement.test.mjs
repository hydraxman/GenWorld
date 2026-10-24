import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {referenceTest} from './reference-mode.mjs';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import * as api from '../src/science-hall-refinement.js';
import {createCampusModel} from '../src/model.js';
import {footprintMetrics, ringArea} from '../src/geo.js';

const {SCIENCE_HALL_ID, refineScienceHall} = api;
const data = JSON.parse(fs.readFileSync(new URL('../data/campus.json', import.meta.url)));
const names = JSON.parse(fs.readFileSync(new URL('../data/osm-names.json', import.meta.url)));
const site = JSON.parse(fs.readFileSync(new URL('../data/science-hall-references.json', import.meta.url)));
const feature = data.features.find(f => f.id === SCIENCE_HALL_ID);
const other = data.features.find(f => f.properties.kind === 'building' && f.id !== SCIENCE_HALL_ID);
const subset = {...data, features: [feature, other]};
const metrics = footprintMetrics(feature.geometry, data.metadata.center);
const near = (a, b, epsilon = 1e-5) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const meshes = object => {
  const result = [];
  object.traverse(o => { if (o.isMesh) result.push(o); });
  return result;
};
const role = (detail, name) => detail.children.find(o => o.userData.surfaceRole === name);
const setup = () => {
  const campus = createCampusModel(subset);
  const root = refineScienceHall(campus, subset);
  return {campus, root, detail: root.children.find(c => c.userData.campusDetail)};
};
const localRay = (detail, target, x, y, z = 4, direction = [0, 0, -1]) => {
  detail.updateWorldMatrix(true, true);
  const start = new THREE.Vector3(x, y, z).applyMatrix4(detail.matrixWorld);
  const vector = new THREE.Vector3(...direction).transformDirection(detail.matrixWorld);
  return new THREE.Raycaster(start, vector).intersectObject(target, true);
};
const brickHits = hits => hits.filter(hit => hit.object.material.name.includes('red brick'));
const polygonArea = polygons => polygons.reduce((sum, p) =>
  sum + ringArea(p[0]) - p.slice(1).reduce((s, r) => s + ringArea(r), 0), 0);

test('exact public exports and frozen identity are the 1919 科学馆, not a nearest POI', () => {
  assert.deepEqual(Object.keys(api).sort(), ['SCIENCE_HALL_ID', 'refineScienceHall']);
  assert.equal(SCIENCE_HALL_ID, 'building:geometry:91ba4cc6c7a0d501736a0fec');
  assert.equal(feature.properties.name, '科学馆');
  assert.equal(feature.properties.nameSourceFeatureId, 'osm:way:79701310');
  assert.equal(feature.properties.nameConfidence, 0.995);
  const osm = names.features.find(f => f.id === 'osm:way:79701310');
  assert.equal(osm.name, '科学馆');
  assert.equal(osm.tags.wikipedia, 'zh:清华大学科学馆');
  const overlap = polygonArea(polygonClipping.intersection(feature.geometry.coordinates, osm.geometry.coordinates));
  const union = polygonArea(polygonClipping.union(feature.geometry.coordinates, osm.geometry.coordinates));
  near(overlap / union, 0.9915083973, 1e-9);
  assert.ok(overlap / union > 0.99, 'independent frozen outline overlap, not proximity');
  near(metrics.area, 1323.538671923261);
  near(metrics.bounds[2] - metrics.bounds[0], 25.616880369054);
  near(metrics.bounds[3] - metrics.bounds[1], 62.66986769046912);
});

test('public refinement keeps the same root, map placement, registries and immutable source', () => {
  const campus = createCampusModel(subset);
  const root = campus.buildings.get(SCIENCE_HALL_ID), neighbor = campus.buildings.get(other.id);
  const before = JSON.stringify(subset), position = root.position.toArray();
  const uuid = root.uuid, base = root.getObjectByName('base');
  const neighborData = JSON.stringify(neighbor.userData);
  const result = refineScienceHall(campus, subset);
  assert.equal(result, root);
  assert.equal(root.uuid, uuid);
  assert.equal(campus.objects.get(SCIENCE_HALL_ID), root);
  assert.equal(campus.buildings.get(SCIENCE_HALL_ID), root);
  assert.equal(campus.buildings.size, 2);
  assert.deepEqual(root.position.toArray(), position);
  assert.equal(root.userData.featureId, SCIENCE_HALL_ID);
  assert.equal(root.userData.nameSourceFeatureId, 'osm:way:79701310');
  assert.equal(root.getObjectByName('base'), base);
  assert.equal(base.visible, false);
  assert.equal(root.userData.baseRenderHeight, 5);
  assert.equal(root.userData.referenceSite, 'science-hall');
  assert.equal(root.userData.reconstructionExtent, 'whole-footprint-estimate');
  assert.match(root.userData.refinementSummary, /非生命科学馆/);
  assert.match(root.userData.heightSource, /非测绘/);
  assert.deepEqual(root.userData.referencePages, site.source.pages);
  assert.equal(JSON.stringify(neighbor.userData), neighborData);
  assert.equal(JSON.stringify(subset), before);
  const identities = [];
  campus.group.traverse(o => { if (o.userData.featureId === SCIENCE_HALL_ID) identities.push(o); });
  assert.deepEqual(identities, [root]);
  assert.equal(root.children.filter(c => c.userData.campusDetail).length, 1);
});

test('source-derived front normal is east/slightly north and foundation preserves all corners', () => {
  const {root, detail} = setup(), d = detail.userData.dimensions;
  assert.deepEqual(detail.userData.facadeMapEdgeIndices, [2, 3]);
  near(root.userData.viewDirection[0], 0.9977520746672028, 1e-10);
  near(root.userData.viewDirection[1], 0, 1e-10);
  near(root.userData.viewDirection[2], -0.06701341281633451, 1e-10);
  near(Math.hypot(...root.userData.viewDirection), 1, 1e-10);
  near(d.frontWidth, 61.43562370238704);
  near(d.footprintDepth, 21.543505089594);
  near(d.footprintSkew, 0.0715178844004658);
  near(d.mapAreaSquareMeters, metrics.area);
  // Convert facade coordinates back to campus coordinates using the real attached detail.
  for (let i = 0; i < detail.userData.sourceFootprintFacadeXZ.length; i++) {
    const [x, z] = detail.userData.sourceFootprintFacadeXZ[i];
    const world = new THREE.Vector3(x, 0, z).applyMatrix4(detail.matrixWorld);
    near(world.x, metrics.projected[0][0][i][0], 1e-8);
    near(world.z, metrics.projected[0][0][i][1], 1e-8);
  }
  const baseMesh = meshes(role(detail, 'foundation'))[0];
  const p = baseMesh.geometry.attributes.position, index = baseMesh.geometry.index;
  let topArea = 0;
  for (let i = 0; i < index.count; i += 3) {
    const points = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(p, index.getX(i + k)));
    if (!points.every(point => Math.abs(point.y - 0.2) < 1e-5)) continue;
    topArea += ringArea(points.map(point => [point.x, point.z]));
  }
  near(topArea, metrics.area, 0.0002);
});

test('photo-derived three-storey facade uses clustered triple/single bays, not a uniform grid', () => {
  const {detail} = setup(), ud = detail.userData, d = ud.dimensions;
  assert.deepEqual(ud.photoProportions.size, [1920, 900]);
  near(d.eave, 12.848510762256154);
  near(d.gableWidth, 8.260251926371367);
  near(d.gablePeak, 15.946105234645417);
  near(d.windowWidth, 1.084158065336242);
  near(d.windowHeight, 2.426449003371589);
  const rows = [1.542290938035347, 5.465910603061747, 9.750076793228172];
  const windows = ud.frontWindows;
  assert.equal(windows.length, 68);
  for (let row = 0; row < rows.length; row++) {
    const actual = windows.filter(w => Math.abs(w.bottom - rows[row]) < 0.01);
    assert.equal(actual.length, row === 2 ? 24 : 22);
  }
  const left = windows.filter(w => w.x < -d.gableWidth / 2 && w.bottom > 9).sort((a, b) => a.x - b.x);
  assert.equal(left.length, 11);
  const gaps = left.slice(1).map((w, i) => w.x - left[i].x);
  assert.ok(Math.max(...gaps) / Math.min(...gaps) > 1.8, 'single/triple groups have real unequal spacing');
  const facade = role(detail, 'east-facade');
  for (const w of left) {
    const x = w.x + 0.12, y = w.bottom + 1.02;
    const hits = localRay(detail, facade, x, y);
    assert.equal(brickHits(hits).length, 0, 'the aperture is cut through brick');
    const glazing = hits.find(h => h.object.material.name.includes('glazing'));
    assert.ok(glazing, 'glazing exists inside actual opening');
    const local = detail.worldToLocal(glazing.point.clone());
    assert.ok(local.z < w.faceZ - 0.1, 'glazing is recessed, not a photo decal');
    assert.ok(brickHits(localRay(detail, facade, w.x + d.windowWidth / 2 + 0.15, y)).length > 0);
  }
});

test('central small gable, real round arch, bronze double door, sign and stairs exist in geometry', () => {
  const {detail} = setup(), ud = detail.userData, d = ud.dimensions;
  const entry = role(detail, 'central-entry'), portal = ud.portal;
  near(portal.width, 3.407353919628189);
  near(portal.crown, 7.840732023994354);
  assert.ok(portal.crown > 7.5 && portal.crown < 8.1);
  assert.equal(brickHits(localRay(detail, entry, 0.15, 7.5)).length, 0, 'arch crown is open');
  assert.ok(brickHits(localRay(detail, entry, portal.width / 2 - 0.07, 7.5)).length > 0,
    'curved corner above spring is brick, not a square hole');
  assert.ok(brickHits(localRay(detail, entry, 0, d.gablePeak - 0.7)).length > 0);
  assert.equal(brickHits(localRay(detail, entry, d.gableWidth / 2 - 0.2, d.gablePeak - 0.7)).length, 0,
    'gable triangle narrows towards apex');
  assert.ok(localRay(detail, entry, 0.4, 2.8).some(h => h.object.material.name.includes('bronze')));
  assert.equal(ud.englishSign, 'SCIENCE BVILDING');
  assert.ok(meshes(entry).some(m => m.material.name.includes('sign lettering')));
  assert.equal(ud.stairCountEstimate, 8);
  // Downward rays on actual treads, not just a metadata count.
  let previous = Infinity;
  for (let i = 0; i < 8; i++) {
    const z = portal.faceZ + (i + 0.5) * d.stairDepth / 8;
    const hit = localRay(detail, entry, 0.5, 4, z, [0, -1, 0])[0];
    assert.ok(hit);
    assert.ok(hit.point.y < previous - 0.05, 'treads descend towards eastern camera');
    previous = hit.point.y;
  }
  assert.ok(!detail.children.some(o => /colonnade|portico/i.test(o.name)));
});

test('roof has four physical hip slopes and two long low shed roof lights', () => {
  const {detail} = setup(), d = detail.userData.dimensions;
  const roof = role(detail, 'hipped-roof'), lights = role(detail, 'roof-lights');
  near(d.ridgeHeight, 18.126669509206685);
  near(d.roofRise, 5.278158746950529);
  assert.equal(detail.userData.roofFacets.length, 4);
  assert.equal(detail.userData.roofLightCount, 2);
  near(d.lightWidth, 10.299501620694299);
  assert.ok(d.lightWidth / d.frontWidth > 0.16 && d.lightWidth / d.frontWidth < 0.18);
  const top = (x, z) => localRay(detail, roof, x, 30, z, [0, -1, 0])[0]?.point.y;
  assert.ok(top(0, -d.footprintDepth / 2) > 18);
  assert.ok(top(27, -d.footprintDepth / 2) < 15.3, 'ends hip down, not gable-ended full ridge');
  assert.ok(top(12, -1) < top(12, -8), 'front plane rises inward');
  assert.ok(top(12, -20) < top(12, -13), 'rear plane falls outward');
  assert.equal(top(34, -10), undefined, 'roof does not extend across neighboring buildings');
  for (const x of d.lightXs) {
    const hits = localRay(detail, lights, x + 0.12, 15.75, 2);
    assert.ok(hits.some(hit => hit.object.material.name.includes('glazing')), 'actual shed-front glass face');
    assert.ok(localRay(detail, lights, x, 30, -5.55, [0, -1, 0]).length, 'actual roof-light cap');
  }
  assert.equal(localRay(detail, lights, 0, 30, -5.55, [0, -1, 0]).length, 0,
    'two separate roof lights, not one generic continuous strip');
});

test('finite batched geometry uses only filtered generated textures; detail-only height is measured', () => {
  const campus = createCampusModel(subset), root = campus.buildings.get(SCIENCE_HALL_ID);
  // Deliberately make hidden base huge to expose a Box3(root) height measurement bug.
  root.getObjectByName('base').scale.y = 50;
  refineScienceHall(campus, subset);
  const detail = root.children.find(o => o.userData.campusDetail), list = meshes(detail);
  assert.equal(list.length, 19);
  assert.equal(detail.userData.meshCount, 19);
  let vertices = 0, triangles = 0;
  const textureSet = new Set();
  for (const mesh of list) {
    for (const attribute of Object.values(mesh.geometry.attributes))
      assert.ok(attribute.array.every(Number.isFinite), `${mesh.name}: finite attribute`);
    assert.ok(mesh.geometry.index.array.every(i => i < mesh.geometry.attributes.position.count));
    vertices += mesh.geometry.attributes.position.count;
    triangles += mesh.geometry.index.count / 3;
    if (mesh.material.map) textureSet.add(mesh.material.map);
  }
  assert.deepEqual(detail.userData.geometryMetrics, {vertices, triangles});
  assert.ok(triangles < 20000);
  assert.equal(textureSet.size, 2);
  for (const texture of textureSet) {
    assert.ok(texture.isDataTexture);
    assert.ok(texture.image.data instanceof Uint8Array);
    assert.equal(texture.generateMipmaps, true);
    assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter);
    assert.equal(texture.magFilter, THREE.LinearFilter);
    assert.ok(texture.anisotropy >= 4);
    assert.match(texture.name, /generated.*no photograph/);
  }
  const measured = new THREE.Box3().setFromObject(detail);
  near(root.userData.renderHeight, measured.max.y, 1e-8);
  near(measured.max.y, 18.26667022705078);
  assert.ok(new THREE.Box3().setFromObject(root).max.y > 200, 'hidden base would spoil whole-root measurement');
  assert.ok(role(detail, 'estimated-back').userData.confidence.includes('no-back-photo'));
  assert.ok(meshes(role(detail, 'estimated-back')).every(m => !m.material.name.includes('glazing')));
  assert.ok(root.userData.unknowns.some(s => s.includes('侧后')));
});

test('reapplication replaces once, disposes previous owned geometry/materials/maps and keeps root', () => {
  const {campus, root, detail: old} = setup();
  const oldMeshes = meshes(old);
  const materials = new Set(oldMeshes.map(m => m.material));
  const textures = new Set([...materials].map(m => m.map).filter(Boolean));
  let geometriesDisposed = 0, materialsDisposed = 0, mapsDisposed = 0;
  oldMeshes.forEach(m => m.geometry.addEventListener('dispose', () => geometriesDisposed++));
  materials.forEach(m => m.addEventListener('dispose', () => materialsDisposed++));
  textures.forEach(t => t.addEventListener('dispose', () => mapsDisposed++));
  const height = root.userData.renderHeight, position = root.position.toArray();
  assert.equal(refineScienceHall(campus, subset), root);
  assert.equal(old.parent, null);
  assert.equal(root.children.filter(o => o.userData.campusDetail).length, 1);
  assert.equal(root.children.length, 2);
  assert.equal(geometriesDisposed, oldMeshes.length);
  assert.equal(materialsDisposed, materials.size);
  assert.equal(mapsDisposed, textures.size);
  near(root.userData.renderHeight, height, 1e-8);
  assert.deepEqual(root.position.toArray(), position);
  assert.equal(root.getObjectByName('base').visible, false);
  let identities = 0;
  campus.group.traverse(o => { if (o.userData.featureId === SCIENCE_HALL_ID) identities++; });
  assert.equal(identities, 1);
});

test('identity, frozen shape, projection, placement and duplicate drift fail before mutation', () => {
  for (const mutate of [
    f => { f.properties.name = '生命科学馆'; },
    f => { f.properties.nameSourceFeatureId = 'osm:way:12345'; },
    f => { f.properties.nameConfidence = 0.5; },
    f => { f.properties.nameSource = 'nearest-poi'; },
    f => { f.geometry.coordinates[0][0][0] += 0.000001; },
    f => { f.geometry.coordinates.push(f.geometry.coordinates[0]); },
    f => { f.geometry.coordinates[0][0][1] = NaN; },
    f => { f.properties.renderHeight = 30; },
  ]) {
    const changed = structuredClone(subset);
    mutate(changed.features[0]);
    const campus = createCampusModel(subset), root = campus.buildings.get(SCIENCE_HALL_ID);
    const before = JSON.stringify(root.userData);
    assert.throws(() => refineScienceHall(campus, changed), /geometry\/OSM identity/);
    assert.equal(JSON.stringify(root.userData), before);
    assert.equal(root.children.length, 1);
    assert.equal(root.getObjectByName('base').visible, true);
  }
  const changed = structuredClone(subset);
  changed.metadata.center[0] += 0.001;
  assert.throws(() => refineScienceHall(createCampusModel(subset), changed), /projection center/);
  for (const mutate of [
    r => { r.userData.localOriginMeters = [0, 0]; },
    r => { r.position.x += 1; },
    r => { r.rotation.y = 0.1; },
    r => { r.scale.z = 2; },
    r => { r.userData.featureId = 'other'; },
  ]) {
    const campus = createCampusModel(subset);
    mutate(campus.buildings.get(SCIENCE_HALL_ID));
    assert.throws(() => refineScienceHall(campus, subset), /origin|placement|identity/);
  }
  assert.throws(() => refineScienceHall(createCampusModel(subset),
    {...subset, features: [feature, feature]}), /unique/);
  assert.throws(() => refineScienceHall(createCampusModel({...subset, features: [other]}), subset), /identity/);
});

test('standalone SITE catalog retains original photograph dimensions, hashes and provenance', () => {
  assert.equal(site.id, 'science-hall');
  assert.equal(site.status, 'reference-ready');
  assert.ok(!('sites' in site), 'one SITE object, not a new global catalog');
  for (const key of ['id', 'name', 'aliases', 'coordinates', 'source', 'status', 'images', 'observations', 'unknowns'])
    assert.ok(key in site);
  assert.equal(site.source.buildingId, SCIENCE_HALL_ID);
  assert.equal(site.source.nameSourceFeatureId, feature.properties.nameSourceFeatureId);
  assert.deepEqual(site.source.bbox, [[116.317593455, 40.001278869], [116.317893863, 40.001841842]]);
  assert.ok(site.images.length >= 1);
  for (const image of site.images) {
    assert.ok(image.path.startsWith('references/science-hall-'));
    assert.match(image.sha256, /^[a-f0-9]{64}$/);
    assert.ok(image.bytes > 0 && image.width > 0 && image.height > 0);
    assert.equal(image.license, 'license-local-reference-only');
    assert.equal(image.pageUrl, site.source.pages[0]);
    assert.ok(image.imageUrl.startsWith('https://www.tsinghua.edu.cn/__local/'));
    assert.match(image.licenseNote, /不作为纹理/);
  }
});

referenceTest('science hall original PNG bytes and dimensions', () => {
  for (const image of site.images) {
    const bytes = fs.readFileSync(new URL(`../${image.path}`, import.meta.url));
    assert.equal(bytes.length, image.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), image.sha256);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), image.width);
    assert.equal(bytes.readUInt32BE(20), image.height);
  }
});
