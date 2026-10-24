import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {viewBounds} from '../src/view-bounds.js';

test('unpartitioned buildings keep their normal geometry bounds', () => {
  const object = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 30));
  object.position.set(100, 0, 200);
  assert.ok(viewBounds(object).equals(new THREE.Box3().setFromObject(object)));
});

test('photo-focus bounds transform from root-local coordinates without including neutral extensions', () => {
  const parent = new THREE.Group(), object = new THREE.Group();
  parent.position.set(100, 0, 200);
  object.position.set(10, 0, 20);
  object.userData.focusBoundsLocal = {min: [-3, 0, -4], max: [3, 12, 4]};
  object.add(new THREE.Mesh(new THREE.BoxGeometry(300, 20, 300)));
  parent.add(object);
  const box = viewBounds(object);
  assert.deepEqual(box.min.toArray(), [107, 0, 216]);
  assert.deepEqual(box.max.toArray(), [113, 12, 224]);
  assert.ok(new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).x > box.getSize(new THREE.Vector3()).x);
});

test('invalid or inverted focus metadata is rejected, not replaced by misleading fallback', () => {
  const object = new THREE.Group();
  object.userData.focusBoundsLocal = {min: [0, 0, 0], max: [1, NaN, 1]};
  assert.throws(() => viewBounds(object), /Invalid local photo-focus/);
  object.userData.focusBoundsLocal = {min: [0, 1, 0], max: [1, 0, 1]};
  assert.throws(() => viewBounds(object), /Invalid local photo-focus/);
});
