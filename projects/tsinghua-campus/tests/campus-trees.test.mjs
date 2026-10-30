import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createCampusTrees, prepareTreeExport, TREE_LIMITS} from '../src/campus-trees.js';
import {createLeafGeometry} from '../../courtyard/src/leaves.js';

const placements = Array.from({length: 40}, (_, i) => ({id: `illustrative:${i}`, position: [(i % 8 - 4) * 9, -Math.floor(i / 8) * 9]}));
function setup() {
  const group = new THREE.Group(), renderer = createCampusTrees(group, placements);
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 2000);
  camera.position.set(0, 10, 25); camera.lookAt(0, 5, -12); camera.updateMatrixWorld(true);
  return {group, renderer, camera};
}

test('all trees use reused courtyard branches and lobed canopies; close-up leaves are capped separately for mobile', () => {
  const {group, renderer, camera} = setup();
  assert.equal(group.children.length, 3);
  assert.ok(group.children.every(mesh => mesh.isInstancedMesh));
  assert.ok(group.children.every(mesh => !mesh.geometry.type.includes('Icosahedron')));
  renderer.update(camera);
  const near = group.children.find(mesh => mesh.userData.campusTreeDisplayOnly);
  assert.equal(near.count, TREE_LIMITS.desktop);
  assert.equal(group.userData.treeLOD.nearTrees, near.count);
  const sourceLeaf = createLeafGeometry(THREE);
  assert.equal(near.geometry.attributes.position.count, sourceLeaf.attributes.position.count * TREE_LIMITS.leavesPerTree);
  renderer.update(camera, true);
  assert.equal(near.count, TREE_LIMITS.mobile);
  group.visible = false; renderer.update(camera);
  assert.equal(near.count, 0);
  group.visible = true; camera.position.set(0, 900, 1100); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  renderer.update(camera); assert.equal(near.count, 0);
  sourceLeaf.dispose();
});

test('tree exports are independent of camera LOD, retain every instance and leave the display untouched', () => {
  const {group, renderer, camera} = setup();
  renderer.update(camera);
  const far = group.children.find(mesh => mesh.userData.campusTreeCanopy);
  const before = far.instanceMatrix.array.slice();
  const clone = prepareTreeExport(group.clone(true));
  assert.equal(clone.children.length, 2);
  const exported = clone.children.find(mesh => mesh.userData.campusTreeCanopy);
  const branches = clone.children.find(mesh => mesh.userData.campusTreeBranches);
  assert.equal(exported.count, placements.length);
  assert.deepEqual(exported.instanceMatrix.array, branches.instanceMatrix.array);
  assert.notEqual(exported.geometry, far.geometry);
  assert.ok(exported.geometry.attributes.position.count > far.geometry.attributes.position.count);
  assert.deepEqual(far.instanceMatrix.array, before);
  camera.position.set(0, 900, 1100); camera.updateMatrixWorld(true); renderer.update(camera);
  const second = prepareTreeExport(group.clone(true)).children.find(mesh => mesh.userData.campusTreeCanopy);
  assert.deepEqual(exported.instanceMatrix.array, second.instanceMatrix.array);
  assert.equal(exported.geometry, second.geometry);
});

test('tree templates are deterministic and preserve leaf, branch and export geometry within measured budgets', () => {
  const a = setup(), b = setup();
  for (let i = 0; i < 3; i++) {
    const ga = a.group.children[i].geometry, gb = b.group.children[i].geometry;
    for (const [name, attr] of Object.entries(ga.attributes)) {
      assert.deepEqual(attr.array, gb.attributes[name].array);
      assert.ok(attr.array.every(Number.isFinite));
    }
  }
  const triangles = mesh => (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
  assert.ok((triangles(a.group.children[0]) + triangles(a.group.children[1])) * 650 < 310000);
  assert.ok(triangles(a.group.children[2]) * TREE_LIMITS.desktop < 620000);
});
