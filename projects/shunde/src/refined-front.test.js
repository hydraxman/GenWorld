import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createShundeModel} from './model.js';

test('opt-in refinement adds actual recessed windows without changing courtyard or entrance placement', () => {
  const base = createShundeModel(THREE, {textured: false, foliage: false});
  const refined = createShundeModel(THREE, {textured: false, foliage: false, refinedFront: true});
  const windows = [];
  refined.building.traverse(o => { if (o.userData.role === 'refined-window') windows.push(o); });
  assert.ok(windows.length > 35);
  base.building.traverse(o => assert.notEqual(o.userData.role, 'refined-window'));
  assert.deepEqual(base.outline, refined.outline);
  assert.deepEqual(base.portico.matrixWorld.toArray(), refined.portico.matrixWorld.toArray());
  assert.equal(base.stats.windows, refined.stats.windows);
  const glass = [];
  refined.building.traverse(o => {
    if (o.isMesh && o.material.name === 'Refined north glazing') glass.push(o.material);
  });
  assert.ok(glass.length);
  for (const material of glass) {
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    assert.ok(material.opacity > .25 && material.opacity < .6);
  }
  for (const window of windows) {
    assert.match(window.userData.interiorStatus, /illustrative/);
    assert.ok(window.children.length >= 4, 'room, reveals, slats and sills use distinct material batches');
    const size = new THREE.Box3().setFromObject(window).getSize(new THREE.Vector3());
    assert.ok(size.z > .7, 'real recess depth, not a flat window texture');
  }
});
