import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {footprintMetrics, project} from '../src/geo.js';
import {createCampusModel} from '../src/model.js';
import {AUDITORIUM_ID, createAuditoriumDetail, refineAuditorium} from '../src/auditorium-refinement.js';

const data = JSON.parse(fs.readFileSync(new URL('../data/campus.json', import.meta.url), 'utf8'));
const feature = data.features.find(feature => feature.id === AUDITORIUM_ID);
const metrics = footprintMetrics(feature.geometry, data.metadata.center);
const makeDetail = () => createAuditoriumDetail(feature, data.metadata.center, metrics.origin);
const close = (a, b, epsilon = 1e-5) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

function inside([x, z], ring) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) result = !result;
  }
  return result;
}

function rayHits(detail, x, z) {
  detail.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 40, z), new THREE.Vector3(0, -1, 0));
  return ray.intersectObjects(detail.children, true);
}

test('frozen auditorium identification is the name-overlap feature, not a batched upstream ID', () => {
  assert.equal(AUDITORIUM_ID, 'building:geometry:ba46ccc8cc43f04fe38fc0ba');
  assert.equal(data.features.filter(feature => feature.id === AUDITORIUM_ID).length, 1);
  assert.equal(feature.properties.name, '大礼堂');
  assert.equal(feature.properties.nameSourceFeatureId, 'osm:way:33457842');
  assert.equal(feature.properties.nameConfidence, 0.993);
  assert.equal(feature.properties.sourceFeatureId, null);
  assert.equal(feature.geometry.coordinates.length, 1); // No holes in this reviewed source.
  assert.equal(feature.geometry.coordinates[0].length, 13); // Twelve-edged irregular cross.
  assert.ok(metrics.area > 1100 && metrics.area < 1115);
});

test('actual dataset replacement preserves building identity and touches no other feature', () => {
  const campus = createCampusModel(data);
  const originals = new Map(campus.buildings);
  const before = JSON.stringify(data);
  const target = refineAuditorium(campus, data);
  assert.equal(target, originals.get(AUDITORIUM_ID));
  assert.equal(campus.buildings.get(AUDITORIUM_ID), target);
  assert.equal(target.userData.featureId, AUDITORIUM_ID);
  assert.equal(campus.buildings.size, originals.size);
  for (const [id, building] of originals) {
    assert.equal(campus.buildings.get(id), building);
    if (id !== AUDITORIUM_ID) {
      assert.equal(building.getObjectByName('base').visible, true);
      assert.equal(building.children.filter(child => child.userData.campusDetail).length, 0);
    }
  }
  assert.equal(JSON.stringify(data), before, 'The frozen source data must not be mutated');
  close(target.position.x, metrics.origin[0]);
  close(target.position.z, metrics.origin[1]);
  assert.equal(target.getObjectByName('base').visible, false);
  assert.equal(target.children.filter(child => child.userData.campusDetail).length, 1);
  assert.equal(target.userData.baseRenderHeight, 5);
  assert.equal(target.userData.heightSource, '照片比例推定，非测绘');
  assert.equal(target.userData.name, '大礼堂');
  assert.equal(target.userData.referenceSite, 'auditorium');
  assert.ok(target.userData.referencePages.includes('https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm'));
  assert.match(target.userData.refinementSummary, /十字形/);
  assert.match(target.userData.limits, /非测绘/);
});

test('repeated refinement replaces its detail instead of duplicating it or losing base height', () => {
  const campus = createCampusModel(data);
  const target = refineAuditorium(campus, data);
  const first = target.children.find(child => child.userData.campusDetail);
  assert.equal(refineAuditorium(campus, data), target);
  assert.equal(first.parent, null);
  assert.equal(target.children.filter(child => child.userData.campusDetail).length, 1);
  assert.equal(target.getObjectByName('base').visible, false);
  assert.equal(target.userData.baseRenderHeight, 5);
});

test('rejects changed outlines, new holes, renamed/reidentified source and ambiguous identity', () => {
  for (const change of [
    f => { f.geometry.coordinates[0][0][0] += 0.00001; },
    f => { f.geometry.coordinates.push(f.geometry.coordinates[0].slice(0, 4)); },
    f => { f.geometry.type = 'MultiPolygon'; },
    f => { f.properties.name = '另一座建筑'; },
    f => { f.id = 'building:wrong'; },
    f => { f.properties.minHeight = 2; },
  ]) {
    const changed = structuredClone(feature);
    change(changed);
    assert.throws(() => createAuditoriumDetail(changed, data.metadata.center, metrics.origin), /mismatch/);
  }
  const campus = createCampusModel(data);
  assert.throws(() => refineAuditorium(campus, {...data, features: []}), /exactly once/);
  assert.throws(() => refineAuditorium(campus, {...data, features: [...data.features, feature]}), /exactly once/);
  assert.equal(campus.buildings.get(AUDITORIUM_ID).getObjectByName('base').visible, true);
});

test('placement mismatches throw before hiding the original source geometry', () => {
  const campus = createCampusModel(data);
  const target = campus.buildings.get(AUDITORIUM_ID);
  target.position.x += 3;
  assert.throws(() => refineAuditorium(campus, data), /placement\/identity mismatch/);
  assert.equal(target.getObjectByName('base').visible, true);
  assert.throws(() => makeBadOrigin(), /local origin/);
  function makeBadOrigin() {
    return createAuditoriumDetail(feature, data.metadata.center, [NaN, 0]);
  }
});

test('all geometry, normals, UVs and instance transforms are finite without DOM/Canvas', () => {
  const detail = makeDetail();
  let meshes = 0, triangles = 0;
  detail.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    for (const [name, attribute] of Object.entries(object.geometry.attributes)) {
      assert.ok(attribute.array.every(Number.isFinite), `${object.name}: ${name} has nonfinite values`);
    }
    if (object.isInstancedMesh) assert.ok(object.instanceMatrix.array.every(Number.isFinite));
    object.geometry.computeBoundingBox();
    assert.ok(object.geometry.boundingBox.min.toArray().every(Number.isFinite));
    assert.ok(object.geometry.boundingBox.max.toArray().every(Number.isFinite));
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 *
      (object.isInstancedMesh ? object.count : 1);
  });
  assert.ok(meshes < 200, `No thousands of draw calls: ${meshes}`);
  assert.ok(triangles < 50000, `No per-brick geometric explosion: ${triangles}`);
  assert.ok(detail.getObjectByName('four fluted white portico columns').isInstancedMesh);
  assert.ok(detail.getObjectByName('64 batched radial dome standing seams').isMesh);
});

test('dome is a shallow cap on a brick drum and tiered cornices, not a hemisphere', () => {
  const detail = makeDetail();
  const dome = detail.getObjectByName('shallow green-grey metal dome');
  const {radius, rise, springY, riseToDiameter} = dome.userData;
  assert.ok(rise / radius < 0.45 && rise / radius > 0.3);
  assert.ok(riseToDiameter < 0.23 && riseToDiameter > 0.17);
  close(radius * 2, 22.9);
  dome.geometry.computeBoundingBox();
  close(dome.geometry.boundingBox.min.y, springY);
  close(dome.geometry.boundingBox.max.y, springY + rise);
  for (const name of ['octagonal red brick drum', 'tiered octagonal cornice 1',
    'tiered octagonal cornice 2', 'tiered octagonal cornice 3', 'intersecting red pitched roofs']) {
    assert.ok(detail.getObjectByName(name), `Missing actual geometry: ${name}`);
  }
});

test('front is derived from south-facing footprint edge and lies toward the verified lawn', () => {
  const detail = makeDetail();
  const [east, south] = detail.userData.frontNormalXZ;
  assert.ok(south > 0.99 && east > 0.05 && east < 0.08);
  close(detail.userData.frontYawDegrees, 3.652, 0.01);
  assert.match(detail.userData.directionSource, /方向推定/);
  const lawn = data.features.find(feature => feature.id === 'landcover:807161562');
  const lawnOrigin = footprintMetrics(lawn.geometry, data.metadata.center).origin;
  const delta = lawnOrigin.map((value, axis) => value - metrics.origin[axis]);
  assert.ok(delta[0] * east + delta[1] * south > 100);
  const columns = detail.getObjectByName('four fluted white portico columns');
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < columns.count; i++) {
    columns.getMatrixAt(i, matrix);
    const world = new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(columns.matrixWorld);
    assert.ok(world.x * east + world.z * south > 20);
  }
});

test('the foundation retains concave corners, and roof triangles stay inside the source footprint', () => {
  const detail = makeDetail();
  const foundation = detail.getObjectByName('exact cross footprint foundation');
  const ring = metrics.projected[0][0].slice(0, -1)
    .map(([x, z]) => [x - metrics.origin[0], z - metrics.origin[1]]);
  const geometry = foundation.geometry;
  let area = 0;
  for (let i = 0; i < geometry.attributes.position.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i);
    const b = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i + 2);
    area += new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2;
  }
  close(area, metrics.area, 0.001);
  const roof = detail.getObjectByName('intersecting red pitched roofs');
  const positions = roof.geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 3) {
    const centroid = new THREE.Vector3();
    for (let j = 0; j < 3; j++) centroid.add(new THREE.Vector3().fromBufferAttribute(positions, i + j));
    centroid.divideScalar(3).applyMatrix4(roof.matrixWorld);
    assert.ok(inside([centroid.x, centroid.z], ring), 'A pitched-roof triangle bridges a concave notch');
  }
  // North corners of the bbox are not occupied by the cross or the drum.
  assert.equal(rayHits(detail, -14.8, -21).length, 0);
  assert.equal(rayHits(detail, 14.4, -21).length, 0);
  assert.ok(rayHits(detail, 0, 0).length > 0);
});

test('front portico is genuinely open below its slab', () => {
  const detail = makeDetail();
  const architecture = detail.getObjectByName('footprint-aligned architecture');
  const columns = detail.getObjectByName('four fluted white portico columns');
  const m = new THREE.Matrix4();
  columns.getMatrixAt(1, m);
  const z = new THREE.Vector3().setFromMatrixPosition(m).z;
  const position = new THREE.Vector3(0.2, 3, z - 1).applyMatrix4(architecture.matrixWorld);
  const ray = new THREE.Raycaster(position, new THREE.Vector3(0, 1, 0));
  const hits = ray.intersectObjects(detail.children, true);
  assert.ok(hits.length > 0);
  assert.ok(hits[0].distance > 5.8 && hits[0].distance < 7,
    'Open porch should reach overhead slab, not a solid infill');
});

test('detail uses requested local coordinates and measures height in local Y', () => {
  const offset = [17, -23];
  const alternateOrigin = metrics.origin.map((value, i) => value + offset[i]);
  const normal = makeDetail();
  const shifted = createAuditoriumDetail(feature, data.metadata.center, alternateOrigin);
  const a = new THREE.Box3().setFromObject(normal), b = new THREE.Box3().setFromObject(shifted);
  close(a.min.x, b.min.x + offset[0]);
  close(a.max.z, b.max.z + offset[1]);
  close(a.max.y, b.max.y);
  const dimensions = normal.userData.estimatedDimensionsMeters;
  assert.ok(dimensions.meshLocalYMax > 22 && dimensions.meshLocalYMax < 28);
  assert.ok(a.min.y > -0.001);
  const width = metrics.bounds[2] - metrics.bounds[0], depth = metrics.bounds[3] - metrics.bounds[1];
  assert.ok(a.max.x - a.min.x < width + 3);
  assert.ok(a.max.z - a.min.z < depth + 5);
  const campus = createCampusModel(data);
  campus.group.position.y = 100; // Parent world translation must not become renderHeight.
  const target = refineAuditorium(campus, data);
  close(target.userData.renderHeight, a.max.y, 0.001);
});

test('procedural materials contain no photo pixel data or environment dependency', () => {
  const detail = makeDetail();
  const maps = new Set();
  detail.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) if (material.map) maps.add(material.map);
  });
  assert.equal(maps.size, 2);
  for (const map of maps) {
    assert.ok(map.isDataTexture);
    assert.equal(map.image.width, 256);
    assert.equal(map.image.height, 128);
    assert.match(map.name, /not photograph/);
  }
  assert.equal(detail.userData.noReferencePhotoTextures, true);
});
