import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import * as THREE from 'three';
import data from '../data/campus.json' with {type: 'json'};
import {createCampusModel, disposeOwnedDetail} from '../src/model.js';
import {refineShunde, shundePlacement} from '../src/shunde-refinement.js';
import {createShundeModel} from '../../shunde/src/model.js';

const ID = 'building:geometry:6bd0154b26cfe7cf654cdd3b';
function signature(root) {
  root.updateMatrixWorld(true);
  const entries = [];
  root.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry, hash = createHash('sha256');
    for (const key of ['position', 'normal', 'uv', 'index']) {
      const attribute = key === 'index' ? geometry.index : geometry.attributes[key];
      hash.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    }
    entries.push({name: object.name, geometry: hash.digest('hex'),
      world: object.matrixWorld.elements, material: object.material.name});
  });
  return entries;
}

test('Shunde campus reuse keeps every original architectural mesh and source placement', () => {
  const campus = createCampusModel(data), target = campus.buildings.get(ID);
  const roots = [...campus.buildings.keys()], position = target.position.clone();
  const original = createShundeModel(THREE, {textured: false, foliage: false, refinedFront: true});
  refineShunde(campus, data, ID, {textured: false});
  const detail = target.children.find(child => child.userData.campusDetail);
  const architecture = detail.getObjectByName('Architecture — continuous open courtyard boundary');
  const expected = original.building;
  const placement = new THREE.Group();
  placement.matrix.copy(target.matrixWorld).multiply(shundePlacement(data.metadata.center, target.userData.localOriginMeters));
  placement.matrixAutoUpdate = false; placement.add(expected); placement.updateMatrixWorld(true);
  assert.deepEqual(signature(architecture), signature(expected));
  assert.deepEqual([...campus.buildings.keys()], roots);
  assert.deepEqual(target.position, position);
  assert.equal(detail.children.length, 1);
  assert.equal(detail.userData.reusedSource, 'projects/shunde/src/model.js');
  assert.equal(detail.getObjectByName('Illustrative campus landscape'), undefined);
  assert.ok(architecture.getObjectByName('Photo-left cylinder fin and balconies'));
  const roles = new Set();
  architecture.traverse(o => roles.add(o.userData.role));
  assert.ok(roles.has('north-entry') && roles.has('garden-door'));
  disposeOwnedDetail(original.group, {preserve: placement}); disposeOwnedDetail(placement); disposeOwnedDetail(campus.group);
});

test('replacing Shunde releases the previous detail exactly once without duplicate map roots', () => {
  const campus = createCampusModel(data);
  refineShunde(campus, data, ID, {textured: false});
  const target = campus.buildings.get(ID), old = target.children.find(child => child.userData.campusDetail);
  const resources = new Map();
  old.traverse(object => {
    if (!object.isMesh) return;
    for (const resource of [object.geometry, object.material]) resources.set(resource, 0);
  });
  for (const resource of resources.keys()) resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1));
  refineShunde(campus, data, ID, {textured: false});
  assert.equal(old.parent, null);
  assert.equal(target.children.filter(child => child.userData.campusDetail).length, 1);
  assert.ok([...resources.values()].every(count => count === 1));
  assert.equal(campus.buildings.size, 650);
  disposeOwnedDetail(campus.group);
});

test('discarding standalone surroundings preserves resources shared with retained architecture', () => {
  const texture = new THREE.Texture(), geometry = new THREE.BoxGeometry(), shared = new THREE.MeshStandardMaterial({map: texture});
  const otherGeometry = new THREE.BoxGeometry(), otherMaterial = new THREE.MeshStandardMaterial({map: texture});
  const preserve = new THREE.Group(), removed = new THREE.Group();
  preserve.add(new THREE.Mesh(geometry, shared));
  removed.add(new THREE.Mesh(geometry, shared), new THREE.Mesh(otherGeometry, otherMaterial));
  const resources = [texture, geometry, shared, otherGeometry, otherMaterial], disposed = new Map(resources.map(r => [r, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
  disposeOwnedDetail(removed, {preserve});
  assert.deepEqual(resources.map(resource => disposed.get(resource)), [0, 0, 0, 1, 1]);
  disposeOwnedDetail(preserve);
  assert.deepEqual(resources.map(resource => disposed.get(resource)), [1, 1, 1, 1, 1]);
});
