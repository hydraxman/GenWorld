import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import {referenceTest} from './reference-mode.mjs';
import * as THREE from 'three';
import {createCampusModel} from '../src/model.js';
import {footprintMetrics, ringArea, project} from '../src/geo.js';
import {CHEMISTRY_HALL_ID, refineChemistryHall} from '../src/chemistry-hall-refinement.js';

const frozen = JSON.parse(fs.readFileSync(new URL('../data/campus.json', import.meta.url), 'utf8'));
const excluded = [
  'building:geometry:fac61644977c4c3514669704',
  'building:geometry:15ccb810d680210fe04fa0bf',
];
const feature = frozen.features.find(f => f.id === CHEMISTRY_HALL_ID);
const m = footprintMetrics(feature.geometry, frozen.metadata.center);
const catalog = JSON.parse(fs.readFileSync(new URL('../data/chemistry-hall-references.json', import.meta.url), 'utf8'));
const near = (actual, expected, epsilon = 1e-5) => assert.ok(Math.abs(actual - expected) <= epsilon,
  `${actual} differs from ${expected} by more than ${epsilon}`);
const role = (detail, name) => detail.children.find(o => o.userData.surfaceRole === name);
const meshes = object => {
  const result = [];
  object.traverse(o => { if (o.isMesh) result.push(o); });
  return result;
};
function setup() {
  const data = structuredClone({...frozen, features: frozen.features.filter(f =>
    [CHEMISTRY_HALL_ID, ...excluded].includes(f.id))});
  const campus = createCampusModel(data);
  return {data, campus, root: campus.buildings.get(CHEMISTRY_HALL_ID)};
}
function refined() {
  const s = setup();
  refineChemistryHall(s.campus, s.data);
  return {...s, detail: s.root.children.find(c => c.userData.campusDetail)};
}
function localRay(detail, x, y, z = 2) {
  detail.updateWorldMatrix(true, true);
  return new THREE.Raycaster(
    new THREE.Vector3(x, y, z).applyMatrix4(detail.matrixWorld),
    new THREE.Vector3(0, 0, -1).transformDirection(detail.matrixWorld),
  ).intersectObject(detail, true);
}

test('public interface refines only the old frozen hall without changing source or other roots', () => {
  assert.equal(CHEMISTRY_HALL_ID, 'building:geometry:ad7b725c774db745829afef8');
  assert.equal(feature.properties.name, '化学馆');
  assert.equal(feature.properties.nameSourceFeatureId, 'osm:way:83801034');
  assert.equal(feature.properties.nameConfidence, 0.934);
  const {data, campus, root} = setup(), before = JSON.stringify(data);
  const originalBase = root.getObjectByName('base');
  const baseGeometry = originalBase.children[0].geometry;
  const basePositions = Array.from(baseGeometry.attributes.position.array);
  const position = root.position.clone(), rotation = root.rotation.clone();
  const other = excluded.map(id => {
    const object = campus.buildings.get(id);
    return {id, object, metadata: JSON.stringify(object.userData),
      position: object.position.clone(), children: [...object.children],
      positions: Array.from(object.getObjectByName('base').children[0].geometry.attributes.position.array)};
  });
  assert.equal(refineChemistryHall(campus, data), root);
  assert.equal(campus.objects.get(CHEMISTRY_HALL_ID), root);
  assert.equal(campus.buildings.size, 3);
  assert.equal(root.getObjectByName('base'), originalBase);
  assert.equal(originalBase.visible, false);
  assert.equal(originalBase.children[0].geometry, baseGeometry);
  assert.deepEqual(Array.from(baseGeometry.attributes.position.array), basePositions);
  assert.ok(root.position.equals(position));
  assert.ok(root.rotation.equals(rotation));
  assert.equal(root.userData.featureId, CHEMISTRY_HALL_ID);
  assert.equal(root.userData.baseRenderHeight, 5);
  assert.equal(root.userData.nameSourceFeatureId, 'osm:way:83801034');
  assert.equal(root.userData.referenceSite, 'chemistry-hall');
  assert.equal(root.userData.reconstructionExtent, 'partial');
  assert.equal(root.userData.campusDetail, undefined);
  assert.equal(JSON.stringify(data), before);
  const owners = [];
  campus.group.traverse(o => { if (o.userData.featureId === CHEMISTRY_HALL_ID) owners.push(o); });
  assert.deepEqual(owners, [root]);
  for (const saved of other) {
    const object = campus.buildings.get(saved.id);
    assert.equal(object, saved.object);
    assert.equal(JSON.stringify(object.userData), saved.metadata);
    assert.ok(object.position.equals(saved.position));
    assert.deepEqual(object.children, saved.children);
    assert.equal(object.getObjectByName('base').visible, true);
    assert.deepEqual(Array.from(object.getObjectByName('base').children[0].geometry.attributes.position.array), saved.positions);
  }
});

test('full polygon foundation and skinny eastern connector retain map proportions and notches', () => {
  const {root, detail} = refined(), d = root.userData.dimensions;
  near(d.mapBoundsMeters[0], 90.11, 0.02);
  near(d.mapBoundsMeters[1], 25.16, 0.02);
  near(d.mainFrontWidth, 72.42, 0.02);
  assert.ok(d.mainFrontWidth / d.mapBoundsMeters[1] > 2.8);
  const sourceLocal = m.projected[0][0].map(([x, z]) => [x - m.origin[0], z - m.origin[1]]);
  for (let i = 0; i < sourceLocal.length; i++) {
    const [u, v] = detail.userData.sourceFootprintFacadeXZ[0][i];
    const actual = new THREE.Vector3(u, 0, v).applyMatrix4(detail.matrix);
    near(actual.x, sourceLocal[i][0], 1e-8);
    near(actual.z, sourceLocal[i][1], 1e-8);
  }
  assert.equal(sourceLocal.length, 10);
  const area = polys => polys.reduce((sum, p) => sum + ringArea(p[0]) -
    p.slice(1).reduce((s, r) => s + ringArea(r), 0), 0);
  near(area(detail.userData.mainPlan) + area(detail.userData.connectorPlan), m.area, 1e-6);
  assert.ok(area(detail.userData.connectorPlan) > 80 && area(detail.userData.connectorPlan) < 115);
  const connectorBox = new THREE.Box3().setFromObject(role(detail, 'east-connector'), true);
  assert.ok(connectorBox.max.x - connectorBox.min.x > 16);
  assert.ok(connectorBox.max.z - connectorBox.min.z < 7);
  near(connectorBox.max.y, 5.12);
  const foundation = role(detail, 'foundation');
  const foundationBox = new THREE.Box3().setFromObject(foundation, true);
  near(foundationBox.max.x - foundationBox.min.x, d.mapBoundsMeters[0], 1e-4);
  near(foundationBox.max.z - foundationBox.min.z, d.mapBoundsMeters[1], 1e-4);
  // Inspect actual cap triangles, not just declared metadata; no bbox fill.
  let capArea = 0;
  for (const mesh of meshes(foundation)) {
    const p = mesh.geometry.attributes.position, index = mesh.geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      if (!ids.every(j => Math.abs(p.getY(j) - 0.2) < 1e-5)) continue;
      const points = ids.map(j => [p.getX(j), p.getZ(j)]);
      capArea += ringArea(points);
    }
  }
  near(capArea, m.area, 0.002);
  assert.ok(capArea < d.mapBoundsMeters[0] * d.mapBoundsMeters[1] * 0.8);
});

test('front orientation follows south edge and both documented camera positions lie outside it', () => {
  const {root, detail} = refined(), n = root.userData.facadeNormal;
  assert.deepEqual(root.userData.facadeMapEdgeIndices, [1, 2]);
  near(n[0], 0.063, 0.001);
  near(n[1], 0);
  near(n[2], 0.998, 0.001);
  const a = m.projected[0][0][1], b = m.projected[0][0][2];
  const midpoint = a.map((v, i) => (v + b[i]) / 2);
  for (const camera of [[116.313331, 40.004478], [116.313326, 40.004309]]) {
    const p = project(camera, frozen.metadata.center);
    assert.ok((p[0] - midpoint[0]) * n[0] + (p[1] - midpoint[1]) * n[2] > 10);
  }
  const out = new THREE.Vector3(0, 0, 1).transformDirection(detail.matrix);
  near(out.x, n[0], 1e-10);
  near(out.z, n[2], 1e-10);
  assert.deepEqual(root.userData.viewDirection, [n[0], 0.28, n[2]]);
});

test('photo frontage has six upper apertures, recessed gridded glass, and no cloned rear facade', () => {
  const {detail} = refined(), d = detail.userData.dimensions;
  const upper = detail.userData.openings.filter(o => o.role === 'central-upper');
  assert.equal(upper.length, 6);
  assert.deepEqual([...new Set(upper.map(o => o.x))], [-1.5, 0, 1.5]);
  assert.deepEqual([...new Set(upper.map(o => o.bottom))], [8.1, 12.1]);
  near(d.centralWindowWidth / d.centralWindowHeight, 1.18 / 2.48);
  for (const o of upper) {
    // Avoid mullions and transom: this point should meet recessed glass, not wall.
    const hits = localRay(detail, o.x + 0.26, o.bottom + 0.3);
    assert.ok(hits.length);
    assert.equal(hits[0].object.userData.surfaceRole, 'front-windows');
    assert.match(hits[0].object.material.name, /glazing/);
    const point = detail.worldToLocal(hits[0].point.clone());
    assert.ok(point.z < -0.1 && point.z > -0.2);
  }
  const wall = localRay(detail, 0.8, 11.3);
  assert.equal(wall[0].object.userData.surfaceRole, 'south-front', 'brick spandrel is real, not one tall glass strip');
  const back = role(detail, 'inferred-mass');
  assert.equal(back.userData.confidence, 'inferred');
  assert.ok(meshes(back).every(mesh => !/glazing/.test(mesh.material.name)));
  assert.equal(detail.children.filter(o => o.userData.surfaceRole === 'south-front').length, 1);
});

test('actual geometry supports stepped parapet, shell relief, rectangular portal and rising stone steps', () => {
  const {root, detail} = refined(), d = root.userData.dimensions;
  const ys = meshes(role(detail, 'south-front')).flatMap(mesh => {
    const p = mesh.geometry.attributes.position;
    return Array.from({length: p.count}, (_, i) => p.getY(i));
  });
  for (const height of [17.2, 18.15, 19.2, 19.32]) {
    assert.ok(ys.some(y => Math.abs(y - height) < 1e-5), `stepped parapet ${height} exists`);
  }
  assert.ok(d.parapetCrest > d.mainEave + 2.5);
  assert.ok(d.doorHeight > 3 && d.doorWidth > 2 && d.doorWidth < 2.5);
  const doorHit = localRay(detail, 0.36, d.landing + 1.55)[0];
  assert.equal(doorHit.object.userData.surfaceRole, 'entrance');
  assert.match(doorHit.object.material.name, /door panels/);
  const relief = role(detail, 'front-ornament');
  assert.ok(meshes(relief).some(mesh => mesh.geometry.attributes.position.count > 300));
  assert.equal(d.stepCount, 17);
  near(d.stepRise, 0.16);
  assert.ok(d.bottomStairWidth > d.topStairWidth * 1.5);
  const stair = role(detail, 'entry-stair');
  const nearGround = localRay(detail, 0, 0.26, d.stairDepth + 1);
  assert.equal(nearGround[0].object.userData.surfaceRole, 'entry-stair');
  const stepPositions = meshes(stair).filter(mesh => /warm gray stone/.test(mesh.material.name))
    .flatMap(mesh => Array.from(mesh.geometry.attributes.position.array).filter((_, i) => i % 3 === 1));
  for (let i = 1; i <= 17; i++) assert.ok(stepPositions.some(y => Math.abs(y - (0.2 + i * d.stepRise)) < 1e-5));
});

test('finite batched geometry and procedural mipmapped textures; height/focus bounds use detail only', t => {
  const {root, detail, campus, data} = refined(), list = meshes(detail);
  assert.equal(list.length, detail.userData.meshCount);
  assert.ok(list.length <= 24, `${list.length} material/group batches`);
  for (const mesh of list) {
    for (const attribute of Object.values(mesh.geometry.attributes)) {
      assert.ok(Array.from(attribute.array).every(Number.isFinite), mesh.name);
    }
    mesh.geometry.computeBoundingBox();
    assert.ok(mesh.geometry.boundingBox.min.toArray().every(Number.isFinite));
    assert.ok(mesh.geometry.boundingBox.max.toArray().every(Number.isFinite));
    assert.ok(mesh.geometry.attributes.normal);
  }
  const textures = new Set(list.map(mesh => mesh.material.map).filter(Boolean));
  assert.equal(textures.size, 2);
  for (const texture of textures) {
    assert.ok(texture.isDataTexture);
    assert.equal(texture.image.width, 64);
    assert.equal(texture.generateMipmaps, true);
    assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter);
    assert.equal(texture.magFilter, THREE.LinearFilter);
    assert.equal(texture.anisotropy, 8);
    assert.match(texture.name, /procedural.*no photograph/);
  }
  near(root.userData.renderHeight, new THREE.Box3().setFromObject(detail).max.y);
  near(root.userData.renderHeight, 19.32);
  assert.equal(root.userData.noReferencePhotoTextures, true);
  assert.equal(root.userData.reconstructionExtent, 'partial');
  assert.ok(root.userData.unknowns.some(s => s.includes('非测绘')));
  assert.ok(root.userData.unknowns.some(s => s.includes('东侧')));
  const focus = root.userData.focusBoundsLocal, bounds = root.userData.detailBoundsLocal;
  assert.ok(focus.min.every(Number.isFinite) && focus.max.every(Number.isFinite));
  assert.ok(focus.max[0] - focus.min[0] < 15);
  assert.ok(bounds.max[0] - bounds.min[0] > 90);
  t.diagnostic(JSON.stringify({
    dimensions: root.userData.dimensions, viewDirection: root.userData.viewDirection,
    focusBoundsLocal: focus, detailBoundsLocal: bounds, meshes: list.length,
    vertices: list.reduce((sum, o) => sum + o.geometry.attributes.position.count, 0),
    triangles: list.reduce((sum, o) => sum + o.geometry.index.count / 3, 0),
  }));
  // Artificially inflate hidden BASE geometry: reapplication must still measure detail only.
  root.getObjectByName('base').children[0].geometry.scale(1, 100, 1);
  refineChemistryHall(campus, data);
  near(root.userData.renderHeight, 19.32);
});

function minimalData() { return {metadata: frozen.metadata, features: [feature]}; }

test('reapplication replaces one detail, disposes its exclusive resources, and remains deterministic', () => {
  const {root, detail, campus, data} = refined();
  const oldGeometry = meshes(detail)[0].geometry, oldMaterial = meshes(detail)[0].material;
  const oldTexture = meshes(detail).find(o => o.material.map).material.map;
  const calls = {geometry: 0, material: 0, texture: 0};
  oldGeometry.addEventListener('dispose', () => calls.geometry++);
  oldMaterial.addEventListener('dispose', () => calls.material++);
  oldTexture.addEventListener('dispose', () => calls.texture++);
  const oldHeight = root.userData.renderHeight, oldDims = structuredClone(root.userData.dimensions);
  assert.equal(refineChemistryHall(campus, data), root);
  assert.equal(detail.parent, null);
  assert.equal(root.children.filter(c => c.userData.campusDetail).length, 1);
  assert.deepEqual(calls, {geometry: 1, material: 1, texture: 1});
  assert.equal(root.userData.baseRenderHeight, 5);
  assert.equal(root.userData.renderHeight, oldHeight);
  assert.deepEqual(root.userData.dimensions, oldDims);
  const again = root.children.find(c => c.userData.campusDetail);
  const originalPositions = meshes(detail).map(o => Array.from(o.geometry.attributes.position.array));
  assert.deepEqual(meshes(again).map(o => Array.from(o.geometry.attributes.position.array)), originalPositions);
});

test('wrong hall/OSM/polygon/projection/root fail before hiding base or replacing detail', () => {
  for (const mutate of [
    s => { s.data.features.find(f => f.id === CHEMISTRY_HALL_ID).properties.name = '新化学馆'; },
    s => { s.data.features.find(f => f.id === CHEMISTRY_HALL_ID).properties.nameSourceFeatureId = 'osm:way:85480383'; },
    s => { s.data.features.find(f => f.id === CHEMISTRY_HALL_ID).properties.nameConfidence = 0.992; },
    s => { s.data.features.find(f => f.id === CHEMISTRY_HALL_ID).geometry.coordinates[0][4][0] += 1e-6; },
    s => { s.data.features.find(f => f.id === CHEMISTRY_HALL_ID).geometry.coordinates[0][0][0] = NaN; },
    s => { s.data.features.find(f => f.id === CHEMISTRY_HALL_ID).geometry.coordinates.push(feature.geometry.coordinates[0]); },
    s => { s.data.metadata.center[0] += 0.001; },
    s => { s.root.position.x += 1; },
    s => { s.root.rotation.y = 0.01; },
    s => { s.root.scale.x = 2; },
    s => { s.root.userData.featureId = excluded[0]; },
    s => { s.root.userData.nameSourceFeatureId = 'osm:way:85480383'; },
    s => { s.root.userData.localOriginMeters = [NaN, 0]; },
  ]) {
    const s = setup();
    mutate(s);
    assert.throws(() => refineChemistryHall(s.campus, s.data), /Old Chemistry Hall/);
    assert.equal(s.root.getObjectByName('base').visible, true);
    assert.equal(s.root.children.filter(c => c.userData.campusDetail).length, 0);
  }
  assert.throws(() => refineChemistryHall({buildings: new Map()}, minimalData()), /Old Chemistry Hall/);
  assert.throws(() => refineChemistryHall(null, null), /Old Chemistry Hall/);
});

function jpegSize(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  let offset = 2;
  while (offset < bytes.length) {
    assert.equal(bytes[offset++], 0xff);
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if ([0xd8, 0xd9].includes(marker)) continue;
    const length = bytes.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    }
    offset += length;
  }
  throw new Error('JPEG dimensions missing');
}

test('standalone SITE catalog retains image provenance, dimensions, hashes and local-only licensing', () => {
  assert.equal(catalog.id, 'chemistry-hall');
  assert.equal(catalog.sites, undefined, 'one SITE, not a whole shared catalog');
  assert.equal(catalog.status, 'reference-ready');
  assert.equal(catalog.images.length, 6);
  assert.equal(catalog.coordinates[0], feature.properties.localOrigin[0]);
  near(catalog.coordinates[1], feature.properties.localOrigin[1], 1e-9);
  for (const ref of catalog.images) {
    assert.match(ref.path, /^references\\chemistry-hall-/);
    assert.match(ref.pageUrl, /^https:\/\//);
    assert.match(ref.imageUrl, /^https:\/\//);
    assert.match(ref.license, /本地/);
    assert.match(ref.license, /不作纹理/);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
    assert.ok(ref.width > 0 && ref.height > 0);
  }
  for (const url of refined().root.userData.referencePages) assert.ok(catalog.images.some(ref => ref.pageUrl === url));
  assert.ok(catalog.unknowns.some(s => s.includes('partial')));
});

referenceTest('chemistry hall original and review-image hashes and dimensions', () => {
  for (const ref of catalog.images) {
    const bytes = fs.readFileSync(new URL(`../${ref.path.replaceAll('\\', '/')}`, import.meta.url));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
    assert.deepEqual(jpegSize(bytes), [ref.width, ref.height], ref.path);
  }
});
