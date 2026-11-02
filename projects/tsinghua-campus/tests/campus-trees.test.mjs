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
  assert.equal(group.children.length, 4);
  const meshes = group.children.filter(mesh => mesh.isMesh);
  assert.ok(meshes.every(mesh => mesh.isInstancedMesh));
  assert.ok(meshes.every(mesh => !mesh.geometry.type.includes('Icosahedron')));
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
  assert.equal(group.userData.treeLOD.clustered, false);
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
  assert.equal(exported.visible, true); assert.equal(branches.visible, true);
  assert.deepEqual(exported.instanceMatrix.array, branches.instanceMatrix.array);
  assert.notEqual(exported.geometry, far.geometry);
  assert.ok(exported.geometry.attributes.position.count > far.geometry.attributes.position.count);
  assert.deepEqual(far.instanceMatrix.array, before);
  camera.position.set(0, 900, 1100); camera.updateMatrixWorld(true); renderer.update(camera);
  const second = prepareTreeExport(group.clone(true)).children.find(mesh => mesh.userData.campusTreeCanopy);
  assert.deepEqual(exported.instanceMatrix.array, second.instanceMatrix.array);
  assert.equal(exported.geometry, second.geometry);
});

test('low-altitude cells retain exact instance transforms and colors while enabling spatial culling', () => {
  const group = new THREE.Group();
  const trees = [{position: [0, -120]}, {position: [5, -125]}, {position: [1800, -120]}];
  const renderer = createCampusTrees(group, trees);
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 2000);
  camera.position.set(0, 10, 25); camera.lookAt(0, 5, -120); camera.updateMatrixWorld(true);
  renderer.update(camera); group.updateMatrixWorld(true);
  const [branches, crowns, leaves, cells] = group.children;
  assert.equal(cells.visible, true); assert.equal(branches.visible, false); assert.equal(crowns.visible, false);
  assert.equal(leaves.count, 0);
  assert.equal(cells.children.length, 4);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  assert.ok(frustum.intersectsObject(cells.children[0]));
  assert.equal(frustum.intersectsObject(cells.children[2]), false);
  const matrix = new THREE.Matrix4(), expected = new THREE.Matrix4(), color = new THREE.Color(), expectedColor = new THREE.Color();
  let index = 0;
  for (let cell = 0; cell < cells.children.length; cell += 2) {
    const wood = cells.children[cell], canopy = cells.children[cell + 1];
    assert.equal(wood.geometry, branches.geometry); assert.equal(canopy.geometry, crowns.geometry);
    for (let slot = 0; slot < wood.count; slot++, index++) {
      branches.getMatrixAt(index, expected); wood.getMatrixAt(slot, matrix); assert.deepEqual(matrix, expected);
      crowns.getMatrixAt(index, expected); canopy.getMatrixAt(slot, matrix); assert.deepEqual(matrix, expected);
      crowns.getColorAt(index, expectedColor); canopy.getColorAt(slot, color); assert.deepEqual(color, expectedColor);
    }
  }
  assert.equal(index, trees.length);
  camera.position.y = 200; camera.updateMatrixWorld(true); renderer.update(camera);
  assert.equal(cells.visible, false); assert.equal(branches.visible, true); assert.equal(crowns.visible, true);
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
