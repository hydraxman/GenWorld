import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import {referenceTest} from './reference-mode.mjs';
import * as THREE from 'three';
import {footprintMetrics} from '../src/geo.js';
import {createCampusModel} from '../src/model.js';
import {TONGFANG_ID, createTongfangDetail, refineTongfang} from '../src/tongfang-refinement.js';

const data = JSON.parse(fs.readFileSync(new URL('../data/campus.json', import.meta.url)));
const feature = data.features.find(f => f.id === TONGFANG_ID);
const metrics = footprintMetrics(feature.geometry, data.metadata.center);
const smallData = {...data, features: [feature]};
const makeCampus = () => createCampusModel(smallData);
const makeDetail = () => createTongfangDetail(feature, data.metadata.center, metrics.origin);
const getDetail = root => root.children.find(c => c.userData.campusDetail);
const close = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const meshes = detail => {
  const result = []; detail.traverse(o => { if (o.isMesh) result.push(o); }); return result;
};
const groupByRole = (detail, role) => {
  let result; detail.traverse(o => { if (o.userData.surfaceRole === role) result = o; }); return result;
};

test('frozen identity is 同方部 with a reciprocal overlap association, not nearest matching', () => {
  assert.equal(TONGFANG_ID, 'building:geometry:767c29087b14fbf65879f219');
  assert.equal(feature.properties.name, '同方部');
  assert.equal(feature.properties.nameSourceFeatureId, 'osm:way:226633636');
  assert.equal(feature.properties.nameConfidence, 0.984);
  assert.equal(feature.properties.nameSource, 'osm-local-extract-building-overlap');
  assert.equal(feature.properties.sourceFeatureId, null);
  assert.equal(feature.geometry.type, 'Polygon');
  assert.equal(feature.geometry.coordinates.length, 1);
  assert.equal(feature.geometry.coordinates[0].length, 5);
  const r = feature.geometry.coordinates[0];
  assert.deepEqual([Math.min(...r.map(p => p[0])), Math.min(...r.map(p => p[1])),
    Math.max(...r.map(p => p[0])), Math.max(...r.map(p => p[1]))],
  [116.318950653, 40.001303525, 116.319288611, 40.001467897]);
  close(metrics.area, 436.61140634717947);
  assert.notEqual(TONGFANG_ID, data.features.find(f => f.properties.name === '清华学堂').id);
  assert.notEqual(TONGFANG_ID, data.features.find(f => f.properties.name === '大礼堂').id);
});

test('interface returns original root, freezes source data and keeps exactly the original 650 IDs', () => {
  const campus = createCampusModel(data), originals = new Map(campus.buildings);
  const snapshot = JSON.stringify(data), targetBefore = campus.buildings.get(TONGFANG_ID);
  const pose = targetBefore.matrix.clone(), root = refineTongfang(campus, data), detail = getDetail(root);
  assert.equal(root, targetBefore);
  assert.equal(root, campus.objects.get(TONGFANG_ID));
  assert.equal(root.parent, campus.layers.building);
  assert.equal(root.name, '同方部');
  assert.deepEqual(root.matrix.toArray(), pose.toArray());
  assert.equal(root.userData.featureId, TONGFANG_ID);
  assert.equal(root.userData.name, '同方部');
  assert.equal(root.userData.nameSourceFeatureId, 'osm:way:226633636');
  assert.equal(root.userData.nameConfidence, 0.984);
  assert.equal(root.userData.referenceSite, 'tongfang');
  assert.equal(root.userData.refinementStatus, 'detailed');
  assert.equal(root.userData.baseRenderHeight, 5);
  assert.equal(root.userData.baseHeightSource, 'openfreemap-render-height');
  assert.equal(root.userData.reconstructionExtent, 'partial');
  assert.match(root.userData.heightSource, /非测绘/);
  assert.match(root.userData.refinementSummary, /西向.*扁券.*蓝灰.*南门廊.*非整栋照片验证/);
  assert.equal(root.userData.referencePages.length, 3);
  assert.equal(root.userData.referenceImages.length, 2);
  assert.equal(detail.userData.featureId, undefined);
  assert.equal(detail.userData.buildingFeatureId, TONGFANG_ID);
  assert.equal(root.getObjectByName('base').visible, false);
  assert.deepEqual(root.userData.sourceFootprintGeometry, feature.geometry);
  close(root.position.x, metrics.origin[0]); close(root.position.z, metrics.origin[1]);
  const ids = [];
  campus.group.traverse(o => { if (o.userData.featureId) ids.push(o.userData.featureId); });
  assert.equal(ids.length, 650); assert.equal(new Set(ids).size, 650);
  assert.equal(campus.buildings.size, 650);
  assert.equal(JSON.stringify(data), snapshot);
  for (const [id, original] of originals) {
    assert.equal(campus.buildings.get(id), original);
    if (id !== TONGFANG_ID) {
      assert.equal(original.getObjectByName('base').visible, true);
      assert.equal(getDetail(original), undefined);
    }
  }
  // Height must come exclusively from the unattached replacement geometry.
  close(root.userData.renderHeight, new THREE.Box3().setFromObject(detail).max.y);
  assert.ok(root.userData.renderHeight > 10 && root.userData.renderHeight < 11);
});

test('reapply has one detail and disposes only old owned geometry, materials and procedural textures', () => {
  const campus = makeCampus(), root = refineTongfang(campus, smallData), first = getDetail(root);
  const oldMesh = meshes(first).find(m => m.material.map), base = root.getObjectByName('base');
  let disposedGeometry = false, disposedMaterial = false, disposedTexture = false, disposedBase = false;
  oldMesh.geometry.addEventListener('dispose', () => { disposedGeometry = true; });
  oldMesh.material.addEventListener('dispose', () => { disposedMaterial = true; });
  oldMesh.material.map.addEventListener('dispose', () => { disposedTexture = true; });
  base.children[0].geometry.addEventListener('dispose', () => { disposedBase = true; });
  const height = root.userData.renderHeight, counts = root.userData.modelMetrics;
  assert.equal(refineTongfang(campus, smallData), root);
  assert.equal(first.parent, null);
  assert.notEqual(getDetail(root), first);
  assert.equal(root.children.filter(c => c.userData.campusDetail).length, 1);
  assert.equal(root.children.length, 2);
  assert.ok(disposedGeometry && disposedMaterial && disposedTexture);
  assert.equal(disposedBase, false);
  assert.equal(base.visible, false);
  assert.equal(root.userData.baseRenderHeight, 5);
  close(root.userData.renderHeight, height);
  assert.deepEqual(root.userData.modelMetrics, counts);
  const ids = []; root.traverse(o => { if (o.userData.featureId) ids.push(o.userData.featureId); });
  assert.deepEqual(ids, [TONGFANG_ID]);
});

test('fail-closed before changing base visibility on changed source or ambiguous ID', () => {
  for (const edit of [
    f => { f.id = 'wrong'; }, f => { f.properties.name = '清华同方'; },
    f => { f.properties.nameSource = 'nearest-neighbor'; },
    f => { f.properties.nameConfidence = 0.983; },
    f => { f.properties.nameSourceFeatureId = 'osm:way:226633635'; },
    f => { f.properties.sourceFeatureId = '226633636'; },
    f => { f.properties.idStrategy = 'osm-id'; },
    f => { f.properties.renderHeight = 6; }, f => { f.properties.minHeight = 1; },
    f => { f.properties.extrude = false; }, f => { f.properties.kind = 'landmark'; },
    f => { f.geometry.coordinates[0][0][0] += 0.00001; },
    f => { f.geometry.coordinates[0].reverse(); },
    f => { f.geometry.coordinates[0][4][1] += 0.00001; },
    f => { f.geometry.coordinates[0][0][1] = NaN; },
    f => { f.geometry.coordinates.push(f.geometry.coordinates[0]); },
    f => { f.geometry.type = 'MultiPolygon'; },
  ]) {
    const changed = structuredClone(feature); edit(changed);
    assert.throws(() => createTongfangDetail(changed, data.metadata.center, metrics.origin), /source identity\/geometry mismatch/);
  }
  const campus = makeCampus(), base = campus.buildings.get(TONGFANG_ID).getObjectByName('base');
  for (const features of [[], [feature, feature]]) {
    assert.throws(() => refineTongfang(campus, {...smallData, features}), /exactly once/);
  }
  assert.equal(base.visible, true);
  assert.equal(getDetail(campus.buildings.get(TONGFANG_ID)), undefined);
});

test('wrong target placement, source association, origin and foreign detail fail without mutations', () => {
  for (const edit of [
    root => { root.position.x += 1; }, root => { root.position.y = 1; },
    root => { root.rotation.y = 0.01; }, root => { root.scale.x = 2; },
    root => { root.userData.featureId = 'wrong'; }, root => { root.userData.name = 'wrong'; },
    root => { root.userData.nameConfidence = 0; },
    root => { root.userData.nameSourceFeatureId = 'osm:way:wrong'; },
    root => { root.userData.localOriginMeters = [0, 0]; },
    root => { root.userData.localOriginMeters = [NaN, 0]; },
    root => { const foreign = new THREE.Group(); foreign.userData.campusDetail = true; root.add(foreign); },
  ]) {
    const campus = makeCampus(), root = campus.buildings.get(TONGFANG_ID), base = root.getObjectByName('base');
    edit(root);
    assert.throws(() => refineTongfang(campus, smallData), /mismatch|finite bbox|unexpected detail/);
    assert.equal(base.visible, true);
  }
  assert.throws(() => createTongfangDetail(feature, [0, NaN], metrics.origin), /projection center/);
  assert.throws(() => createTongfangDetail(feature, undefined, metrics.origin), /projection center/);
  assert.throws(() => createTongfangDetail(feature, data.metadata.center, [0]), /bbox-center/);
  assert.throws(() => createTongfangDetail(feature, data.metadata.center, [0, 0]), /local origin/);
  const campus = makeCampus(), root = campus.buildings.get(TONGFANG_ID), base = root.getObjectByName('base');
  root.remove(base);
  assert.throws(() => refineTongfang(campus, smallData), /mismatch/);
  assert.equal(base.visible, true);
});

test('batched geometry is finite, proportioned and browser-free with mipmapped generated textures only', () => {
  assert.equal(typeof document, 'undefined');
  const detail = makeDetail(), materials = new Set(), textures = new Set();
  for (const m of meshes(detail)) {
    for (const [name, attribute] of Object.entries(m.geometry.attributes)) {
      assert.ok(attribute.array.every(Number.isFinite), `${m.name}: nonfinite ${name}`);
    }
    assert.ok(m.geometry.boundingBox.min.toArray().every(Number.isFinite));
    assert.ok(m.geometry.boundingBox.max.toArray().every(Number.isFinite));
    assert.ok(Number.isFinite(m.geometry.boundingSphere.radius));
    const index = m.geometry.index;
    assert.ok(index.array.every(i => i >= 0 && i < m.geometry.attributes.position.count));
    materials.add(m.material);
    for (const v of Object.values(m.material)) if (v?.isTexture) textures.add(v);
  }
  assert.equal(materials.size, 8);
  assert.equal(textures.size, 2);
  for (const t of textures) {
    assert.ok(t.isDataTexture);
    assert.equal(t.userData.procedural, true);
    assert.equal(t.generateMipmaps, true);
    assert.equal(t.minFilter, THREE.LinearMipmapLinearFilter);
    assert.equal(t.magFilter, THREE.LinearFilter);
    assert.equal(t.anisotropy, 8);
    assert.equal(t.colorSpace, THREE.SRGBColorSpace);
    assert.match(t.name, /generated.*no photograph/);
    assert.equal(t.image.width, 128); assert.equal(t.image.height, 128);
  }
  const size = new THREE.Box3().setFromObject(detail).getSize(new THREE.Vector3());
  assert.ok(size.x > 28 && size.x < 32);
  assert.ok(size.z > 18 && size.z < 22);
  assert.ok(size.y > 10 && size.y < 11);
  assert.ok(size.x / size.y > 2.6 && size.x / size.y < 3.1);
  assert.ok(detail.userData.modelMetrics.meshes < 30);
  assert.ok(detail.userData.modelMetrics.triangles < 20000);
  assert.equal(detail.userData.modelMetrics.meshes, meshes(detail).length);
});

test('foundation preserves exact frozen area and vertices rather than a bounding box', () => {
  const detail = makeDetail(), foundation = groupByRole(detail, 'foundation');
  const mesh = meshes(foundation)[0], p = mesh.geometry.attributes.position, index = mesh.geometry.index;
  let area = 0;
  for (let i = 0; i < index.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, index.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(p, index.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(p, index.getX(i + 2));
    if ([a, b, c].every(p => Math.abs(p.y - 0.34) < 1e-5)) {
      area += Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
    }
  }
  close(area, metrics.area, 0.003);
  const east = detail.userData.footprintAxisEastXZ, south = detail.userData.footprintAxisSouthXZ;
  for (const [x, z] of metrics.projected[0][0]) {
    const dx = x - metrics.origin[0], dz = z - metrics.origin[1];
    const u = dx * east[0] + dz * east[1], v = dx * south[0] + dz * south[1];
    assert.ok(Array.from({length: p.count}, (_, i) => i).some(i =>
      Math.abs(p.getX(i) - u) < 2e-5 && Math.abs(p.getZ(i) - v) < 2e-5));
  }
  const bbArea = (metrics.bounds[2] - metrics.bounds[0]) * (metrics.bounds[3] - metrics.bounds[1]);
  assert.ok(bbArea - area > 80, 'Do not use the geographic bbox as a footprint.');
});

test('west facade has distinctive true openings, ornamental bars, fan lintels, sign, lamps and vent', () => {
  const detail = makeDetail(), west = groupByRole(detail, 'west-photo-facade');
  assert.equal(west.userData.confidence, 'photo-informed');
  assert.deepEqual(detail.userData.componentCounts, {
    westTallWindows: 2, westDoor: 1, westTransoms: 3, jackArchLintels: 3,
    rusticatedPiers: 4, westLanterns: 2, smallGableVent: 1, plaqueGlyphs: 3,
    inferredSouthWindows: 7, inferredSouthDoors: 2, inferredPorchPiers: 2,
  });
  assert.equal(detail.userData.plaque.visualLeftToRight, '部方同');
  assert.equal(detail.userData.plaque.facade, 'west');
  const brick = meshes(west).find(m => /generated grey brick/.test(m.material.name));
  const hit = (x, y) => {
    west.updateWorldMatrix(true, true);
    const origin = west.localToWorld(new THREE.Vector3(x, y, 2));
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(west.matrixWorld);
    return new THREE.Raycaster(origin, direction, 0, 2.5).intersectObject(brick);
  };
  assert.equal(hit(-4.2, 2.2).length, 0, 'Left tall window must perforate the wall.');
  assert.equal(hit(4.2, 2.2).length, 0, 'Right tall window must perforate the wall.');
  assert.equal(hit(0, 2.2).length, 0, 'Door must perforate the wall.');
  assert.equal(hit(0, 4.9).length, 0, 'Upper transom must perforate the wall.');
  assert.equal(hit(0, 8.7).length, 0, 'Round attic vent must perforate the gable.');
  assert.ok(hit(6.4, 2.2).length > 0);
  assert.ok(hit(0.8, 7.4).length > 0);
  const frame = meshes(west).find(m => /painted joinery/.test(m.material.name));
  const bars = meshes(west).find(m => /lamp iron/.test(m.material.name));
  assert.ok(frame.geometry.index.count > 500);
  assert.ok(bars.geometry.index.count > 2500, 'Observed inset rectangular motifs should be real small bars.');
});

test('orientation follows the frozen polygon and archive, while unseen surfaces remain honestly inferred', () => {
  const detail = makeDetail(), e = detail.userData.footprintAxisEastXZ, s = detail.userData.footprintAxisSouthXZ;
  close(e[0], 0.9950370692364373); close(e[1], -0.09950492874909055);
  close(e[0] * s[0] + e[1] * s[1], 0);
  assert.ok(s[1] > 0.99);
  assert.ok(detail.userData.frontNormalXZ[0] < -0.99, 'Photographed sign is west-facing, not south-facing.');
  const west = groupByRole(detail, 'west-photo-facade');
  const porch = groupByRole(detail, 'porch');
  assert.notEqual(porch.parent, west);
  assert.equal(porch.parent.userData.surfaceRole, 'south-inferred-facade');
  assert.match(porch.userData.confidence, /inferred/);
  assert.match(groupByRole(detail, 'context-shell').userData.confidence, /not-photographed/);
  assert.match(groupByRole(detail, 'east-inferred-facade').userData.confidence, /not-photographed/);
  assert.equal(detail.userData.reconstructionExtent, 'partial');
  assert.match(detail.userData.limits, /分界.*推定.*非测绘.*北侧.*不复制书法/);
  const d = detail.userData.estimatedDimensionsMeters;
  assert.ok(d.inferredSplitU > 0, 'Text evidence says west is the larger portion.');
  assert.ok(d.westEave < d.eastEave);
  assert.ok(d.westRidge > d.westEave + 3);
  assert.deepEqual(detail.userData.viewDirection, [-1.1, 0.38, 0.38]);
});

function jpegSize(buffer) {
  assert.equal(buffer.readUInt16BE(0), 0xffd8);
  for (let i = 2; i < buffer.length;) {
    assert.equal(buffer[i++], 0xff);
    while (buffer[i] === 0xff) i++;
    const marker = buffer[i++], length = buffer.readUInt16BE(i);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return [buffer.readUInt16BE(i + 5), buffer.readUInt16BE(i + 3)];
    i += length;
  }
  throw new Error('JPEG dimensions missing.');
}

test('catalog entry retains site schema, reference hashes, dimensions and non-open licenses', () => {
  const site = JSON.parse(fs.readFileSync(new URL('../data/tongfang-references.json', import.meta.url)));
  assert.equal(site.id, 'tongfang');
  assert.equal(site.name, '同方部');
  assert.equal(site.status, 'reference-ready');
  assert.equal(site.images.length, 2);
  for (const key of ['aliases', 'coordinates', 'coordinateSource', 'observations', 'unknowns']) assert.ok(site[key]);
  for (const ref of site.images) {
    assert.match(ref.path, /^references\\tongfang-/);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
    assert.ok(ref.bytes > 0 && ref.width > 0 && ref.height > 0);
    assert.match(ref.imageUrl, /^https:\/\/(?:www|xsg)\.tsinghua\.edu\.cn\//);
    assert.match(ref.pageUrl, /^https:\/\/(?:www|xsg)\.tsinghua\.edu\.cn\//);
    assert.match(ref.license, /未查得.*自由许可.*仅本地.*不作纹理/);
  }
  console.log('Tongfang model metrics:', JSON.stringify(makeDetail().userData.modelMetrics));
  console.log('Tongfang detail dimensions:', JSON.stringify(makeDetail().userData.estimatedDimensionsMeters));
});

referenceTest('tongfang original JPEG hashes, bytes and dimensions', () => {
  const site = JSON.parse(fs.readFileSync(new URL('../data/tongfang-references.json', import.meta.url)));
  for (const ref of site.images) {
    const bytes = fs.readFileSync(new URL(`../${ref.path.replaceAll('\\', '/')}`, import.meta.url));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), ref.sha256);
    assert.equal(bytes.length, ref.bytes);
    assert.deepEqual(jpegSize(bytes), [ref.width, ref.height]);
  }
});
