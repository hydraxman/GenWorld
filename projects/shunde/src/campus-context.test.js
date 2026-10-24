import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCampusContext, insideFootprint} from './campus-context.js';

const fixture = {
  sourceUrl: 'test-fixture', license: 'test only', limitations: 'Synthetic geometry, not campus data',
  buildings: [{id: 1, name: 'test', height: 12, heightStatus: 'test', tags: {},
    points: [[-115, 90], [-90, 90], [-90, 110], [-115, 110]]}],
  roads: [{id: 2, kind: 'service', points: [[-140, 70], [-60, 70]]}],
  trees: [[-100, 100], [-105, 60]],
};
test('context uses source footprint and deterministically avoids planting inside buildings', () => {
  const model = createCampusContext(THREE, fixture, {textured: false});
  assert.equal(model.stats.buildings, 1);
  assert.equal(model.stats.roads, 1);
  assert.ok(model.stats.windows > 0);
  assert.ok(model.stats.trees > 0);
  assert.ok(insideFootprint([-100, 100], fixture.buildings[0].points));
  assert.ok(!insideFootprint([-100, 80], fixture.buildings[0].points));
  for (const tree of model.treeSites) assert.ok(!insideFootprint(tree, fixture.buildings[0].points));
  const box = new THREE.Box3().setFromObject(model.architecture);
  assert.ok(Math.abs(box.min.x + 115) < .3 && Math.abs(box.max.x + 90) < .3);
  assert.ok(Math.abs(box.min.z - 90) < .3 && Math.abs(box.max.z - 110) < .3);
  assert.ok(box.max.y > 12 && box.max.y < 12.5);
  const repeated = createCampusContext(THREE, fixture, {textured: false});
  assert.deepEqual(model.treeSites, repeated.treeSites);
  const first = model.group.children.find(o => o.isInstancedMesh);
  const second = repeated.group.children.find(o => o.isInstancedMesh);
  assert.deepEqual(first.instanceMatrix.array, second.instanceMatrix.array);
  assert.deepEqual(first.instanceColor.array, second.instanceColor.array);
});
test('missing map evidence fails explicitly rather than inventing an empty or random campus', () => {
  assert.throws(() => createCampusContext(THREE, {buildings: [], roads: []}));
});
