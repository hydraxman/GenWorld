import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {footprintMetrics} from '../src/geo.js';
import {createCampusModel} from '../src/model.js';
import {SCHOOL_ID, createSchoolDetail, refineSchool} from '../src/school-refinement.js';

const data = JSON.parse(fs.readFileSync(new URL('../data/campus.json', import.meta.url), 'utf8'));
const feature = data.features.find(feature => feature.id === SCHOOL_ID);
const metrics = footprintMetrics(feature.geometry, data.metadata.center);
const newSchool = data.features.find(feature => feature.properties.name === '新清华学堂');
const smallData = {...data, features: [feature, newSchool]};
const makeCampus = () => createCampusModel(smallData);
const makeDetail = () => createSchoolDetail(feature, data.metadata.center, metrics.origin);
const getDetail = target => target.children.find(child => child.userData.campusDetail);
const close = (a, b, epsilon = 1e-5) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

function pointInRing([x, z], ring, includeBoundary = false) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j], [bx, bz] = ring[i];
    const dx = bx - ax, dz = bz - az, lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared)) : 0;
    if (includeBoundary && Math.hypot(x - ax - t * dx, z - az - t * dz) < 1e-4) return true;
    if ((az > z) !== (bz > z) && x < ax + (z - az) * dx / dz) inside = !inside;
  }
  return inside;
}

function uvToLocal(detail, [u, v]) {
  const east = detail.userData.footprintAxisEastXZ, south = detail.userData.footprintAxisSouthXZ;
  return [u * east[0] + v * south[0], u * east[1] + v * south[1]];
}

function downwardHits(detail, point) {
  detail.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(point[0], 30, point[1]), new THREE.Vector3(0, -1, 0))
    .intersectObject(detail, true);
}

function countGeometry(detail) {
  const result = {meshes: 0, triangles: 0, materials: new Set(), textures: new Set()};
  detail.traverse(object => {
    if (!object.isMesh) return;
    result.meshes++;
    result.triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    for (const material of [].concat(object.material)) {
      result.materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) result.textures.add(value);
    }
  });
  return result;
}

test('OLD school identity and reviewed U outline are not 新清华学堂 or 大礼堂', () => {
  assert.equal(SCHOOL_ID, 'building:geometry:a253512bb392fe6910f5ddae');
  assert.equal(feature.properties.name, '清华学堂');
  assert.equal(feature.properties.nameSourceFeatureId, 'osm:way:83805067');
  assert.equal(feature.properties.nameConfidence, 0.99);
  assert.equal(feature.properties.sourceFeatureId, null);
  assert.equal(feature.geometry.type, 'Polygon');
  assert.equal(feature.geometry.coordinates.length, 1);
  assert.equal(feature.geometry.coordinates[0].length, 13);
  assert.equal(data.features.filter(feature => feature.id === SCHOOL_ID).length, 1);
  assert.equal(newSchool.id, 'building:geometry:817a1008370fb3945f0ebf35');
  assert.notEqual(SCHOOL_ID, newSchool.id);
  assert.notEqual(SCHOOL_ID, data.features.find(feature => feature.properties.name === '大礼堂').id);
  close(metrics.area, 2192.4809259657613);
});

test('actual full-campus replacement returns the original addressable group and mutates no other feature', () => {
  const campus = createCampusModel(data), originals = new Map(campus.buildings);
  const sourceBefore = JSON.stringify(data), target = refineSchool(campus, data);
  assert.equal(target, originals.get(SCHOOL_ID));
  assert.equal(campus.buildings.get(SCHOOL_ID), target);
  assert.equal(target.name, '清华学堂');
  assert.equal(target.userData.name, '清华学堂');
  assert.equal(target.userData.featureId, SCHOOL_ID);
  assert.equal(target.userData.nameSourceFeatureId, 'osm:way:83805067');
  assert.equal(target.userData.referenceSite, 'tsinghua-school');
  assert.equal(target.userData.reconstructionBatch, 3);
  assert.equal(target.userData.refinementStatus, 'detailed');
  assert.equal(target.userData.heightSource, '照片比例推定，非测绘');
  assert.equal(target.userData.baseRenderHeight, 5);
  assert.match(target.userData.refinementSummary, /非新清华学堂/);
  assert.match(target.userData.refinementSummary, /U 形灰砌筑/);
  assert.match(target.userData.refinementSummary, /透空栏杆/);
  assert.deepEqual(target.userData.referencePages, ['https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm']);
  assert.match(target.userData.referenceImages[0], /55D1EDFDEEAC5CC4720BCF830F2_6E1BFFB2_C4429/);
  assert.equal(target.getObjectByName('base').visible, false);
  assert.equal(getDetail(target).userData.featureId, undefined);
  assert.equal(getDetail(target).userData.buildingFeatureId, SCHOOL_ID);
  const addressableIds = [];
  campus.group.traverse(object => {
    if (object.userData.featureId) addressableIds.push(object.userData.featureId);
  });
  assert.equal(addressableIds.length, 650, 'Attached school detail must not become a 651st building feature');
  assert.equal(new Set(addressableIds).size, 650);
  assert.equal(campus.buildings.size, originals.size);
  close(target.position.x, metrics.origin[0]);
  close(target.position.z, metrics.origin[1]);
  assert.deepEqual(target.userData.localOriginMeters, metrics.origin);
  assert.equal(JSON.stringify(data), sourceBefore);
  for (const [id, original] of originals) {
    assert.equal(campus.buildings.get(id), original);
    if (id !== SCHOOL_ID) {
      assert.equal(original.getObjectByName('base').visible, true);
      assert.equal(getDetail(original), undefined);
    }
  }
});

test('repeat replacement has exactly one detail, preserves original base height, and disposes old owned resources', () => {
  const campus = makeCampus(), target = refineSchool(campus, smallData), first = getDetail(target);
  const oldMesh = first.getObjectByName('grey masonry U shell and raised end pavilions');
  let geometryDisposed = false, textureDisposed = false;
  oldMesh.geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  oldMesh.material.map.addEventListener('dispose', () => { textureDisposed = true; });
  const beforeHeight = target.userData.renderHeight;
  assert.equal(refineSchool(campus, smallData), target);
  assert.equal(first.parent, null);
  assert.notEqual(getDetail(target), first);
  assert.equal(target.children.filter(child => child.userData.campusDetail).length, 1);
  assert.equal(target.children.length, 2);
  assert.equal(getDetail(target).userData.featureId, undefined);
  assert.equal(getDetail(target).userData.buildingFeatureId, SCHOOL_ID);
  const featureNodes = [];
  target.traverse(object => {
    if (object.userData.featureId) featureNodes.push(object);
  });
  assert.deepEqual(featureNodes, [target], 'Only the original school root remains addressable after repeats');
  assert.equal(target.getObjectByName('base').visible, false);
  assert.equal(target.userData.baseRenderHeight, 5);
  close(target.userData.renderHeight, beforeHeight);
  assert.ok(geometryDisposed && textureDisposed);
});

test('rejects changed footprint, source association, closure, topology, name and source heights', () => {
  for (const change of [
    f => { f.geometry.coordinates[0][0][0] += 0.00001; },
    f => { f.geometry.coordinates[0][12][1] += 0.00001; },
    f => { f.geometry.coordinates[0].reverse(); },
    f => { f.geometry.coordinates[0][3][0] = NaN; },
    f => { f.geometry.coordinates.push(f.geometry.coordinates[0]); },
    f => { f.geometry.type = 'MultiPolygon'; },
    f => { f.id = newSchool.id; },
    f => { f.properties.name = '新清华学堂'; },
    f => { f.properties.nameSourceFeatureId = 'osm:way:33457842'; },
    f => { f.properties.nameSource = 'nearest-name-guess'; },
    f => { f.properties.nameConfidence = 0.1; },
    f => { f.properties.sourceFeatureId = '103278700'; },
    f => { f.properties.extrude = false; },
    f => { f.properties.minHeight = 1; },
    f => { f.properties.renderHeight = 12; },
  ]) {
    const changed = structuredClone(feature);
    change(changed);
    assert.throws(() => createSchoolDetail(changed, data.metadata.center, metrics.origin), /association\/geometry mismatch/);
  }
});

test('missing or ambiguous ID fails rather than replacing another school or silently returning', () => {
  const campus = makeCampus(), target = campus.buildings.get(SCHOOL_ID);
  assert.throws(() => refineSchool(campus, {...smallData, features: [newSchool]}), /exactly once/);
  assert.throws(() => refineSchool(campus, {...smallData, features: [...smallData.features, feature]}), /exactly once/);
  assert.equal(target.getObjectByName('base').visible, true);
  assert.equal(getDetail(target), undefined);
});

test('incorrect target placement, source identity and invalid options fail before hiding the base', () => {
  for (const change of [
    target => { target.position.x += 2; },
    target => { target.position.y = 1; },
    target => { target.rotation.y = 0.1; },
    target => { target.scale.z = 1.1; },
    target => { target.userData.nameSourceFeatureId = 'osm:way:wrong'; },
    target => { target.userData.localOriginMeters = [0, 0]; },
    target => { target.userData.localOriginMeters = [NaN, 0]; },
    target => { target.userData.featureId = newSchool.id; },
    target => { target.remove(target.getObjectByName('base')); },
  ]) {
    const campus = makeCampus(), target = campus.buildings.get(SCHOOL_ID);
    const base = target.getObjectByName('base');
    change(target);
    assert.throws(() => refineSchool(campus, smallData), /mismatch|local origin/);
    assert.equal(base.visible, true);
    assert.equal(getDetail(target), undefined);
  }
  const campus = makeCampus();
  for (const options of [null, [], {scale: 2}, {frontYaw: 0}]) {
    assert.throws(() => refineSchool(campus, smallData, options), /options/);
  }
  assert.throws(() => createSchoolDetail(feature, [0, NaN], metrics.origin), /projection center/);
  assert.throws(() => createSchoolDetail(feature, undefined, metrics.origin), /projection center/);
  assert.throws(() => createSchoolDetail(feature, data.metadata.center, [0]), /local origin/);
  assert.equal(campus.buildings.get(SCHOOL_ID).getObjectByName('base').visible, true);
});

test('all merged geometry, normals, UVs and bounding boxes are finite and Node/Canvas-free', () => {
  assert.equal(typeof document, 'undefined');
  const detail = makeDetail(), counts = countGeometry(detail);
  detail.traverse(object => {
    if (!object.isMesh) return;
    for (const [name, attribute] of Object.entries(object.geometry.attributes)) {
      assert.ok(attribute.array.every(Number.isFinite), `${object.name}: invalid ${name}`);
    }
    assert.ok(object.geometry.boundingBox.min.toArray().every(Number.isFinite));
    assert.ok(object.geometry.boundingBox.max.toArray().every(Number.isFinite));
    for (let i = 0; i < object.geometry.attributes.normal.count; i++) {
      const n = new THREE.Vector3().fromBufferAttribute(object.geometry.attributes.normal, i);
      close(n.length(), 1, 2e-5);
    }
  });
  assert.equal(counts.meshes, 8, 'Batched surfaces should need eight main-pass mesh draws');
  assert.equal(counts.materials.size, 7, 'Dormer hoods share the main roof material');
  assert.ok(counts.triangles < 30000, `Too many triangles: ${counts.triangles}`);
  assert.equal(counts.textures.size, 2);
  assert.equal(detail.userData.componentCounts.entranceColumns, 2);
  assert.equal(detail.userData.componentCounts.balconyBalusters, 14);
  assert.equal(detail.userData.componentCounts.dormers, 7);
  assert.ok(detail.userData.componentCounts.windowBays > 50);
});

test('foundation is the exact concave U polygon, not a rectangle or closed courtyard slab', () => {
  const detail = makeDetail(), foundation = detail.getObjectByName('exact U footprint foundation');
  const position = foundation.geometry.attributes.position;
  let area = 0;
  for (let i = 0; i < position.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, i);
    const b = new THREE.Vector3().fromBufferAttribute(position, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, i + 2);
    if ([a, b, c].every(point => Math.abs(point.y - 0.45) < 1e-5)) {
      area += Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
    }
  }
  close(area, metrics.area, 0.02);
  const ring = metrics.projected[0][0].slice(0, -1).map(([x, z]) => [x - metrics.origin[0], z - metrics.origin[1]]);
  for (const point of [[0, -15], [0, 5], [0, 7.8], [-36, 1], [36, 1]]) {
    const local = uvToLocal(detail, point);
    assert.equal(pointInRing(local, ring), false, `Reviewed point should be in open notch: ${point}`);
    assert.equal(downwardHits(detail, local).length, 0, `Courtyard filled at ${point}`);
  }
  for (const point of [[0, 16], [-48, -9], [49, -9]]) {
    assert.ok(downwardHits(detail, uvToLocal(detail, point)).length > 0, `Missing U arm/bar at ${point}`);
  }
});

test('every primary roof triangle stays inside the source footprint and total projected area matches exactly', () => {
  const detail = makeDetail(), roof = detail.getObjectByName('red pitched roofs clipped to frozen U footprint');
  const source = metrics.projected[0][0].slice(0, -1).map(([x, z]) => [x - metrics.origin[0], z - metrics.origin[1]]);
  detail.updateMatrixWorld(true);
  const position = roof.geometry.attributes.position;
  let area = 0, pitched = 0;
  for (let i = 0; i < position.count; i += 3) {
    const tri = [0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(position, i + offset).applyMatrix4(roof.matrixWorld));
    const [a, b, c] = tri;
    area += Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    assert.ok(normal.y > 0.5, 'Roof faces should have upward normals');
    if (normal.y < 0.99) pitched++;
    for (const weights of [[1/3, 1/3, 1/3], [.8,.1,.1], [.1,.8,.1], [.1,.1,.8],
      [1,0,0], [0,1,0], [0,0,1], [.5,.5,0], [.5,0,.5], [0,.5,.5]]) {
      const p = tri.reduce((sum, value, index) => sum.addScaledVector(value, weights[index]), new THREE.Vector3());
      assert.ok(pointInRing([p.x, p.z], source, true), `Roof bridges a notch at ${p.x}, ${p.z}`);
    }
  }
  close(area, metrics.area, 0.03);
  assert.equal(pitched, position.count / 3);
  assert.equal(roof.userData.footprintClipped, true);
  assert.equal(detail.userData.roofPartitions.length, 5);
  assert.ok(detail.userData.roofPartitions.every(zone => zone.ridge - zone.eave > 3.5));
});

test('entrance is the southeast chamfer, with explicit inferred front and viewer direction', () => {
  const detail = makeDetail(), normal = detail.userData.frontNormalXZ;
  close(normal[0], 0.8041778857348963);
  close(normal[1], 0.5943887011837894);
  close(detail.userData.frontYawDegrees, 53.53093374744613);
  assert.ok(normal.every(value => value > 0));
  assert.deepEqual(detail.userData.viewDirection, [normal[0], 0.65, normal[1]]);
  assert.match(detail.userData.directionSource, /东南斜切角/);
  assert.match(detail.userData.directionSource, /推定，非测绘/);
  const points = metrics.projected[0][0], a = points[3], b = points[4];
  const edge = [b[0] - a[0], b[1] - a[1]];
  close(edge[0] * normal[0] + edge[1] * normal[1], 0);
});

test('entrance has a true arched wall aperture and recessed door, not a dark panel on a solid wall', () => {
  const detail = makeDetail(), n = detail.userData.frontNormalXZ;
  const points = metrics.projected[0][0], a = points[3], b = points[4];
  const center = [(a[0] + b[0]) / 2 - metrics.origin[0], (a[1] + b[1]) / 2 - metrics.origin[1]];
  detail.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(center[0] + n[0] * 3, 2.3, center[1] + n[1] * 3),
    new THREE.Vector3(-n[0], 0, -n[1]));
  const hits = ray.intersectObject(detail, true);
  assert.ok(hits.length);
  assert.equal(hits[0].object.userData.surfaceRole, 'wood');
  assert.ok(hits[0].distance > 3.1 && hits[0].distance < 3.3, 'Door should be recessed behind the masonry plane');
  const masonryHits = hits.filter(hit => hit.object.userData.surfaceRole === 'masonry');
  assert.ok(masonryHits.every(hit => hit.distance > 4), 'No source shell can occlude the entrance hole');
});

test('pure detail origin offset gives stable placement without moving/recentering the source building', () => {
  const first = makeDetail(), offsetOrigin = [metrics.origin[0] + 13, metrics.origin[1] - 7];
  const second = createSchoolDetail(feature, data.metadata.center, offsetOrigin);
  assert.equal(first.parent, null);
  assert.equal(second.parent, null);
  const firstBounds = new THREE.Box3().setFromObject(first), secondBounds = new THREE.Box3().setFromObject(second);
  close(firstBounds.min.x + metrics.origin[0], secondBounds.min.x + offsetOrigin[0]);
  close(firstBounds.max.z + metrics.origin[1], secondBounds.max.z + offsetOrigin[1]);
  close(first.userData.estimatedDimensionsMeters.meshLocalYMax, second.userData.estimatedDimensionsMeters.meshLocalYMax);
  assert.deepEqual(first.userData.frontNormalXZ, second.userData.frontNormalXZ);
  const firstPosition = first.getObjectByName('red pitched roofs clipped to frozen U footprint').geometry.attributes.position.array;
  const secondPosition = second.getObjectByName('red pitched roofs clipped to frozen U footprint').geometry.attributes.position.array;
  assert.deepEqual(firstPosition, secondPosition, 'Procedural geometry must be deterministic');
});

test('renderHeight comes only from visible unattached detail, not hidden base or world parent transforms', () => {
  const campus = makeCampus(), original = campus.buildings.get(SCHOOL_ID);
  original.getObjectByName('base').scale.y = 20;
  campus.group.position.y = 100;
  campus.group.scale.set(2, 3, 2);
  campus.group.rotation.y = 0.5;
  const target = refineSchool(campus, smallData), detail = getDetail(target);
  const height = target.userData.renderHeight;
  assert.ok(height > 17 && height < 17.5);
  close(height, detail.userData.estimatedDimensionsMeters.meshLocalYMax);
  assert.equal(target.userData.baseRenderHeight, 5);
  campus.group.updateMatrixWorld(true);
  assert.ok(new THREE.Box3().setFromObject(target).max.y >= 400, 'Box3 includes the invisible tall base: regression fixture');
  assert.equal(refineSchool(campus, smallData).userData.renderHeight, height);
});

test('materials use only deterministic procedural DataTextures, never reference-image pixels', () => {
  const first = makeDetail(), second = makeDetail(), textures = [...countGeometry(first).textures];
  assert.equal(first.userData.noReferencePhotoTextures, true);
  assert.equal(textures.length, 2);
  const secondTextures = [...countGeometry(second).textures];
  textures.forEach((texture, index) => {
    assert.ok(texture.isDataTexture);
    assert.match(texture.name, /procedural/);
    assert.equal(texture.image.width, 128);
    assert.equal(texture.image.height, 128);
    assert.equal(texture.image.data.length, 128 * 128 * 4);
    assert.deepEqual(texture.image.data, secondTextures[index].image.data);
    assert.equal(texture.source.data.src, undefined);
  });
  assert.match(first.userData.limits, /非测绘/);
  assert.match(first.userData.limits, /隐蔽面/);
  assert.match(first.userData.limits, /不使用照片贴图/);
});
