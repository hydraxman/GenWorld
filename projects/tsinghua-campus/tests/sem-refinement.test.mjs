import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import data from '../data/campus.json' with {type: 'json'};
import {createCampusModel} from '../src/model.js';
import {refineSEM, SEM_ID} from '../src/sem-refinement.js';
import {refineShunde} from '../src/shunde-refinement.js';

const SHUNDE_ID = 'building:geometry:6bd0154b26cfe7cf654cdd3b';
const subset = () => ({...data, features: data.features.filter(item => [SEM_ID, SHUNDE_ID].includes(item.id))});

test('red SEM replaces the correct mapped building and retains its identity and local origin', () => {
  const source = subset();
  const campus = createCampusModel(source);
  const target = campus.buildings.get(SEM_ID);
  const position = target.position.toArray(), outline = target.userData.bounds.slice();
  refineSEM(campus, source, {textured: false});
  assert.deepEqual(target.position.toArray(), position);
  assert.equal(campus.buildings.size, 2);
  assert.equal(target.getObjectByName('base').visible, false);
  assert.equal(target.children.filter(item => item.userData.campusDetail).length, 1);
  assert.equal(target.userData.featureId, SEM_ID);
  assert.equal(target.userData.nameSourceFeatureId, 'osm:way:937482182');
  assert.equal(target.userData.baseRenderHeight, 5);
  const detail = target.children.find(item => item.userData.campusDetail);
  const architecture = detail.getObjectByName('SEM red podium and glazed upper wing');
  const bounds = new THREE.Box3().setFromObject(architecture);
  assert.ok(bounds.max.y > 30 && bounds.max.y < 30.5);
  assert.ok(Math.abs(bounds.min.x - outline[0]) < 1);
  assert.ok(Math.abs(bounds.max.x - outline[2]) < 1);
  assert.ok(Math.abs(bounds.min.z - outline[1]) < 1);
  assert.ok(Math.abs(bounds.max.z - outline[3]) < 1);
  assert.ok(detail.userData.meshStats.archedWindows > 25);
  assert.ok(detail.userData.meshStats.windows > 100);
  architecture.traverse(object => {
    if (object.geometry) assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));
  });
});

test('the same-coordinate-frame corridor is suspended between SEM and Shunde', () => {
  const source = subset(), campus = createCampusModel(source);
  refineShunde(campus, source, SHUNDE_ID);
  const target = refineSEM(campus, source, {textured: false});
  const {startCampus, endCampus, clearance, storeyClearance} = target.userData.corridor;
  assert.equal(clearance, 13.2);
  assert.equal(storeyClearance, 4);
  assert.equal(startCampus[1], clearance);
  assert.equal(endCampus[1], clearance);
  assert.ok(startCampus[0] < endCampus[0]);
  const shundeBounds = campus.buildings.get(SHUNDE_ID).userData.bounds;
  assert.ok(Math.abs(endCampus[0] - shundeBounds[0]) < 1);
  const detail = target.children.find(item => item.userData.campusDetail);
  const corridor = detail.getObjectByName('Gray enclosed elevated corridor between SEM and Shunde');
  const bounds = new THREE.Box3().setFromObject(corridor);
  assert.ok(Math.abs(bounds.min.y - clearance) < 0.01);
  const midpoint = new THREE.Vector3((startCampus[0] + endCampus[0]) / 2, 5,
    (startCampus[2] + endCampus[2]) / 2);
  const ray = new THREE.Raycaster(midpoint, new THREE.Vector3(0, 1, 0));
  const hit = ray.intersectObject(corridor, true).find(item => item.object.isMesh);
  assert.ok(hit && hit.point.y >= clearance - 0.01);
});

test('a changed source association is rejected instead of attaching to a similarly named building', () => {
  const source = structuredClone(subset());
  source.features.find(item => item.id === SEM_ID).properties.nameSourceFeatureId = 'osm:way:84653293';
  const campus = createCampusModel(source);
  assert.throws(() => refineSEM(campus, source, {textured: false}), /re-match/);
});
