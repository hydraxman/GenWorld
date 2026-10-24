import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import data from '../data/campus.json' with {type: 'json'};
import anchor from '../data/second-gate-anchor.json' with {type: 'json'};
import {project} from '../src/geo.js';
import {createCampusModel} from '../src/model.js';
import {applyCampusLandmarks, LANDMARK_SITES} from '../src/landmarks.js';

test('Second Gate is a separate OSM-point landmark, not a fabricated map footprint', () => {
  const original = JSON.stringify(data);
  const campus = createCampusModel(data);
  const before = [...campus.buildings.keys()];
  assert.equal(before.length, 650);
  const ids = applyCampusLandmarks(campus, data);
  assert.deepEqual(ids, [anchor.id]);
  assert.equal(LANDMARK_SITES.length, 1);
  assert.deepEqual([...campus.buildings.keys()], before);
  assert.equal(campus.landmarks.size, 1);
  assert.equal(campus.objects.size, 651);
  const gate = campus.objects.get(anchor.id);
  const position = project(anchor.coordinates, data.metadata.center);
  assert.deepEqual(gate.position.toArray(), [position[0], 0, position[1]]);
  assert.equal(gate.userData.kind, 'landmark');
  assert.equal(gate.userData.footprintArea, null);
  assert.equal(gate.userData.mapSource.sourceVersion, 5);
  assert.equal(gate.userData.referenceSite, 'second-gate');
  assert.ok(gate.userData.refinementSummary);
  assert.equal(gate.parent, campus.layers.landmark);
  assert.equal(JSON.stringify(data), original);
  campus.group.traverse(object => {
    if (object.userData.kind === 'building') assert.equal(object.getObjectByName('base').visible, true);
  });
});

test('re-registering a landmark replaces it without duplicated IDs or geometry', () => {
  const campus = createCampusModel(data);
  applyCampusLandmarks(campus, data);
  const previous = campus.landmarks.get(anchor.id);
  applyCampusLandmarks(campus, data);
  assert.equal(previous.parent, null);
  assert.equal(campus.layers.landmark.children.length, 1);
  assert.equal(campus.landmarks.size, 1);
  assert.notEqual(campus.landmarks.get(anchor.id), previous);
  const nodes = [];
  campus.group.traverse(object => { if (object.userData.featureId) nodes.push(object.userData.featureId); });
  assert.equal(nodes.length, 651);
  assert.equal(new Set(nodes).size, 651);
  const gate = campus.landmarks.get(anchor.id);
  const box = new THREE.Box3().setFromObject(gate);
  assert.ok(box.max.y > 6 && box.max.y < 15);
  assert.equal(gate.userData.renderHeight, box.max.y);
});

test('a landmark cannot hijack an existing building identity', () => {
  const campus = createCampusModel(data);
  campus.buildings.set(anchor.id, new THREE.Group());
  assert.throws(() => applyCampusLandmarks(campus, data), /cannot replace a map building/);
});
