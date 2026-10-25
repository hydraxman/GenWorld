import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import data from '../data/campus.json' with {type: 'json'};
import names from '../data/osm-names.json' with {type: 'json'};
import {ZIJING_SOURCES, ZIJING_APARTMENTS, zijingPartitions} from '../src/zijing-sources.js';
import {footprintMetrics, ringArea} from '../src/geo.js';
import {createCampusModel} from '../src/model.js';
import {createZijingDetail, refineZijing} from '../src/zijing.js';

const feature = source => data.features.find(feature => feature.id === source.featureId);
const near = (a, b, tolerance = 1e-4) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('all documented dormitory numbers 1–23 are resolved without inventing map identities', () => {
  assert.deepEqual(ZIJING_APARTMENTS.map(p => p.number), Array.from({length: 23}, (_, i) => i + 1));
  assert.equal(ZIJING_SOURCES.length, 20);
  assert.equal(new Set(ZIJING_SOURCES.map(s => s.featureId)).size, 20);
  for (const source of ZIJING_SOURCES) {
    const f = feature(source);
    const parts = zijingPartitions(f, data.metadata.center);
    near(parts.reduce((a, part) => a + ringArea(part.ring), 0), footprintMetrics(f.geometry, data.metadata.center).area);
    for (const part of parts) {
      const osm = names.features.find(f => f.name === `紫荆学生公寓${part.number}号楼`);
      assert.ok(osm, 'A logical number must have an independent named OSM way, not a nearby label');
      const bounds = footprintMetrics(osm.geometry, data.metadata.center).bounds;
      for (const point of part.ring) {
        assert.ok(point[0] > bounds[0] - 2 && point[0] < bounds[2] + 2 &&
          point[1] > bounds[1] - 2 && point[1] < bounds[3] + 2);
      }
    }
  }
});

test('each dormitory has finite, batched geometry, real window openings, UVs and a distinct roof family', () => {
  for (const source of ZIJING_SOURCES) {
    const f = feature(source), m = footprintMetrics(f.geometry, data.metadata.center);
    const detail = createZijingDetail(f, data.metadata.center, m.origin);
    detail.updateMatrixWorld(true);
    const parts = detail.children.filter(child => child.userData.apartmentNumber);
    assert.deepEqual(parts.map(part => part.userData.apartmentNumber), source.numbers);
    for (const part of parts) {
      const d = part.userData;
      assert.ok(d.windowCount >= 20);
      assert.ok(d.facadeSample && d.windowOpenings.length === d.windowCount);
      assert.equal(d.doorwayCount, 1);
      const doorway = new THREE.Raycaster(new THREE.Vector3(...d.doorwayProbe.outside),
        new THREE.Vector3(...d.doorwayProbe.normal).negate(), 0, 3).intersectObject(part, true);
      assert.ok(doorway.length);
      assert.match(doorway[0].object.material.name, /glass/, 'The entrance reaches glazing below the window-sill height');
      assert.match(d.certainty, /typology|estimate/);
      assert.ok(d.estimatedFloors >= 7 && d.estimatedFloors <= 14);
      assert.equal(d.family, ZIJING_APARTMENTS.find(p => p.number === d.apartmentNumber).family);
      let meshes = 0;
      part.traverse(object => {
        if (!object.isMesh) return;
        meshes++;
        for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
        assert.ok(object.geometry.attributes.uv);
        assert.ok(object.material.name.startsWith('zijing:'));
        if (object.material.map) assert.ok(new Set(object.geometry.attributes.uv.array).size > 10);
      });
      assert.ok(meshes >= 5 && meshes <= 16, `A dormitory must use bounded batches, not one draw call per window: ${meshes}`);
      assert.ok(part.getObjectByName(d.family === 'pitched-low-rise' ? 'Pitched roof and gable closures'
        : d.family === 'w-doctoral' ? 'W roof and glazed linking hall' : 'High-rise roof frames and stair cores'));
      const [window] = d.windowOpenings;
      const ray = new THREE.Raycaster(new THREE.Vector3(...window.outside),
        new THREE.Vector3(...window.normal).negate(), 0, 3);
      const hits = ray.intersectObject(part, true);
      assert.ok(hits.length, 'A window should be physically present');
      assert.match(hits[0].object.material.name, /glass/, 'The opening must reach recessed glazing, not a solid wall or decal');
    }
    const bounds = new THREE.Box3().setFromObject(detail);
    assert.ok(bounds.min.y >= -.001 && bounds.max.y < 48);
    assert.ok(bounds.min.x >= m.bounds[0] - m.origin[0] - 3 && bounds.max.x <= m.bounds[2] - m.origin[0] + 3);
    assert.ok(bounds.min.z >= m.bounds[1] - m.origin[1] - 3 && bounds.max.z <= m.bounds[3] - m.origin[1] + 3);
  }
});

test('reapplying a dormitory releases owned geometry/materials without changing frozen roots or base geometry', () => {
  const campus = createCampusModel(data), ids = [...campus.buildings.keys()];
  const source = ZIJING_SOURCES.find(source => source.numbers.length === 4), root = campus.buildings.get(source.featureId);
  const base = root.getObjectByName('base'), origin = root.position.clone(), before = root.userData.renderHeight;
  assert.equal(refineZijing(campus, data, source.featureId), root);
  const old = root.children.find(child => child.userData.campusDetail);
  const resources = new Set();
  old.traverse(object => {
    if (!object.isMesh) return;
    resources.add(object.geometry); resources.add(object.material);
    for (const value of Object.values(object.material)) if (value?.isTexture) resources.add(value);
  });
  let released = 0;
  for (const resource of resources) resource.addEventListener('dispose', () => released++);
  refineZijing(campus, data, source.featureId);
  assert.equal(released, resources.size);
  assert.deepEqual([...campus.buildings.keys()], ids);
  assert.equal(root.getObjectByName('base'), base);
  assert.equal(base.visible, false);
  assert.ok(root.position.equals(origin));
  assert.equal(root.userData.baseRenderHeight, before);
  assert.deepEqual(root.userData.apartmentNumbers, [14, 15, 16, 17]);
  const identities = [];
  campus.group.traverse(object => {if (object.userData.featureId) identities.push(object.userData.featureId);});
  assert.equal(identities.length, 650);
});

test('changed geometry, name evidence or root placement fails before replacing an existing detail', () => {
  const source = ZIJING_SOURCES[0];
  for (const change of [
    f => {f.geometry.coordinates[0][0][0] += .00001;},
    f => {f.properties.name = '1公寓';},
    f => {f.properties.nameSourceFeatureId = 'osm:way:wrong';},
    f => {f.properties.renderHeight = 5;},
  ]) {
    const f = structuredClone(feature(source)); change(f);
    assert.throws(() => createZijingDetail(f, data.metadata.center, [0, 0]), /frozen|identity|source/i);
  }
  const merged = structuredClone(feature(ZIJING_SOURCES.find(s => s.numbers.length === 4)));
  merged.properties.poiLabels.pop();
  assert.throws(() => zijingPartitions(merged, data.metadata.center), /identity/);
  const campus = createCampusModel(data), root = campus.buildings.get(source.featureId);
  root.position.x += 1;
  assert.throws(() => refineZijing(campus, data, source.featureId), /placement|origin/);
  assert.equal(root.getObjectByName('base').visible, true);
  assert.equal(root.children.some(c => c.userData.campusDetail), false);
});
