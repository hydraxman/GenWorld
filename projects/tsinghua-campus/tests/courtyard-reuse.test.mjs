import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createModel} from '../../courtyard/src/model.js';
import {createCourtyardReuse} from '../src/courtyard-reuse.js';

test('reused geometry is the existing courtyard model, not another architectural approximation', () => {
  const original = createModel(THREE, {architectureOnly: true, textured: false});
  const {group, architectureBounds, stats} = createCourtyardReuse();
  assert.equal(group.children.length, 5);
  assert.equal(stats.basins, 3);
  assert.equal(stats.pergolas, 2);
  assert.equal(group.userData.reusedSource, 'projects/courtyard/src/model.js');
  assert.equal(group.userData.placementStatus, 'unplaced-source-model');
  assert.ok(architectureBounds.getSize(new THREE.Vector3()).x > 33);
  assert.ok(architectureBounds.getSize(new THREE.Vector3()).y < 12);
  assert.equal(group.getObjectByName('Courtyard paving and stairs'), undefined);
  for (const section of group.children) {
    const source = original.group.getObjectByName(section.name);
    assert.equal(section.children.length, source.children.length);
    section.children.forEach((mesh, index) => {
      const previous = source.children[index];
      assert.deepEqual(mesh.geometry.attributes.position.array, previous.geometry.attributes.position.array);
      assert.deepEqual(mesh.geometry.attributes.normal.array, previous.geometry.attributes.normal.array);
      assert.deepEqual(mesh.geometry.attributes.uv.array, previous.geometry.attributes.uv.array);
      assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
    });
  }
});
