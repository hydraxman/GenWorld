import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createDetailedDisplay, prepareDetailedExport, projectedScale, displayTier} from '../src/display-lod.js';
import data from '../data/campus.json' with {type: 'json'};
import {createCampusModel} from '../src/model.js';
import {applyCampusRefinements} from '../src/refinements.js';
import {applyCampusLandmarks} from '../src/landmarks.js';

function fixture(options) {
  const group = new THREE.Group(), layer = new THREE.Group(), root = new THREE.Group();
  group.add(layer); layer.add(root); root.position.set(13, 0, -25);
  root.userData = {featureId: 'original', kind: 'building', refinementStatus: 'detailed'};
  const material = new THREE.MeshStandardMaterial(), fine = new THREE.MeshStandardMaterial({name: 'Main building slender window frames'});
  const meshes = [];
  for (let i = 0; i < 5; i++) {
    const part = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), material);
    part.userData.apartmentNumber = i + 1; part.position.x = i * 2; part.add(mesh); root.add(part); meshes.push(mesh);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(.07, 2, .07), fine); frame.position.z = 3; root.add(frame);
  const campus = {group, layers: {building: layer}, objects: new Map([['original', root]])};
  const display = createDetailedDisplay(campus, options);
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 20000);
  camera.position.set(20, 2000, 3000); camera.lookAt(root.position); camera.updateMatrixWorld(true);
  return {campus, root, meshes, frame, display, camera};
}

test('display tiers use physical output pixels, perspective/orthographic projection and return hysteresis', () => {
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 1000), point = new THREE.Vector3(0, 0, -100);
  camera.updateMatrixWorld(true);
  assert.ok(Math.abs(projectedScale(camera, point, 1000) - 8.660254) < 1e-5);
  assert.equal(projectedScale(camera, point, 2000), projectedScale(camera, point, 1000) * 2);
  const ortho = new THREE.OrthographicCamera(-50, 50, 50, -50, .1, 1000); ortho.updateMatrixWorld(true);
  assert.equal(projectedScale(ortho, point, 1000), 10);
  assert.equal(displayTier(165, 2), 2); assert.equal(displayTier(195, 2), 1);
  assert.equal(displayTier(650, 1), 1); assert.equal(displayTier(725, 1), 0);
  assert.throws(() => displayTier(NaN), /finite/);
});

test('batch picking retains original identity and part while canonical export restores exact source visibility', () => {
  const {campus, root, meshes, frame, display, camera} = fixture();
  const geometry = meshes.map(mesh => mesh.geometry);
  display.update(camera, 1000); campus.group.updateMatrixWorld(true);
  assert.equal(display.stats().batches, 1);
  assert.equal(frame.visible, false);
  assert.ok(meshes.every(mesh => !mesh.visible));
  const batch = campus.layers.building.children.find(mesh => mesh.isBatchedMesh);
  const ray = new THREE.Raycaster(new THREE.Vector3(17, 10, -25), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(batch)[0];
  assert.deepEqual(batch.userData.identities[hit.batchId], {featureId: 'original', apartmentNumber: 3});
  const clone = prepareDetailedExport(root.clone(true)), exported = [];
  clone.traverseVisible(mesh => {if (mesh.isMesh) exported.push(mesh);});
  assert.equal(exported.length, 6);
  assert.deepEqual(meshes.map(mesh => mesh.geometry), geometry);
  assert.equal(frame.visible, false, 'Export must not change live display');
  root.visible = false; display.update(camera, 1000);
  for (let i = 0; i < batch.instanceCount; i++) assert.equal(batch.getVisibleAt(i), false);
  root.visible = true; display.setEnabled(false); display.update(camera, 1000);
  assert.ok(meshes.every(mesh => mesh.visible)); assert.equal(frame.visible, true); assert.equal(batch.visible, false);
  let disposed = 0; geometry.forEach(g => g.addEventListener('dispose', () => disposed++));
  display.dispose(); assert.equal(disposed, 0); assert.ok(!batch.parent);
});

test('devices without multi-draw keep original meshes and subpixel LOD without allocating batches', () => {
  const {root, meshes, frame, display, camera} = fixture({batching: false});
  display.update(camera, 1000);
  assert.equal(display.stats().batching, false);
  assert.equal(display.stats().batches, 0);
  assert.equal(display.stats().batchGeometryBytes, 0);
  assert.ok(meshes.every(mesh => mesh.visible));
  assert.equal(frame.visible, false);
  let exported = 0;
  prepareDetailedExport(root.clone(true)).traverseVisible(mesh => {if (mesh.isMesh) exported++;});
  assert.equal(exported, 6);
  camera.position.copy(root.position).add(new THREE.Vector3(0, 3, 10));
  camera.lookAt(root.position); camera.updateMatrixWorld(true);
  display.update(camera, 1000);
  assert.equal(frame.visible, true);
  display.dispose();
  assert.equal(Object.hasOwn(frame.userData, 'campusDisplaySourceVisible'), false);
});

test('real refined campus batching is bounded and never changes frozen roots, openings or canonical geometry', () => {
  const campus = createCampusModel(data);
  applyCampusRefinements(campus, data, {textured: false}); applyCampusLandmarks(campus, data);
  const roots = new Map(campus.objects), originals = [];
  for (const root of roots.values()) if (root.userData.refinementStatus === 'detailed') {
    root.traverseVisible(mesh => {if (mesh.isMesh) originals.push([mesh, mesh.geometry, mesh.geometry.index?.array,
      mesh.geometry.attributes.position.array.slice()]);});
  }
  const display = createDetailedDisplay(campus);
  assert.equal(display.stats().roots, 41);
  assert.ok(display.stats().batches < 70);
  assert.ok(display.stats().batchGeometryBytes < 12 * 1024 ** 2);
  const camera = new THREE.PerspectiveCamera(40, 1.6, 1, 30000);
  camera.position.set(0, 2500, 3000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  display.update(camera, 1000);
  assert.ok(display.stats().omittedSubpixelMeshes >= 80);
  assert.deepEqual(campus.objects, roots);
  for (const [mesh, geometry, index, positions] of originals) {
    assert.equal(mesh.geometry, geometry); assert.equal(geometry.index?.array, index);
    assert.deepEqual(geometry.attributes.position.array, positions);
  }
  for (const root of roots.values()) if (root.userData.refinementStatus === 'detailed') {
    const expected = originals.filter(([mesh]) => {
      for (let p = mesh; p; p = p.parent) if (p === root) return true;
      return false;
    }).length;
    let restored = 0;
    prepareDetailedExport(root.clone(true)).traverseVisible(mesh => {if (mesh.isMesh) restored++;});
    assert.equal(restored, expected);
  }
  display.dispose();
});
