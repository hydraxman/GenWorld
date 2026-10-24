import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import campus from '../docs/campus-context.json' with {type: 'json'};
import {createSEMBuilding, SEM_WAY, SEM_HEIGHT, BRIDGE_Z} from './sem-building.js';
import {FOOTPRINT} from './footprint.js';

const source = campus.buildings.find(b => b.id === SEM_WAY);
test('photo-informed red SEM retains the source footprint and has actual arched apertures', () => {
  const model = createSEMBuilding(THREE, source, {textured: false});
  assert.equal(model.stats.height, SEM_HEIGHT);
  assert.ok(model.stats.archedWindows > 25);
  assert.ok(model.stats.windows > 100);
  const bounds = new THREE.Box3().setFromObject(model.architecture);
  assert.ok(bounds.max.y > 30 && bounds.max.y < 30.5);
  assert.ok(Math.abs(bounds.min.x - Math.min(...source.points.map(p => p[0]))) < 1);
  assert.ok(Math.abs(bounds.max.x - Math.max(...source.points.map(p => p[0]))) < 1);
  const faces = [];
  model.architecture.traverse(o => { if (o.name === 'SEM articulated facade') faces.push(o); });
  const east = faces.find(face => face.position.x > -66 && face.position.x < -63);
  assert.ok(east);
  const glassMesh = east.children.find(o => o.isMesh && /glazing/.test(o.material.name));
  assert.ok(glassMesh, 'actual recessed glazing, not facade photo');
  const shapeWalls = east.children.filter(o => o.isMesh && /terracotta/.test(o.material.name));
  assert.ok(shapeWalls.length);
  const archedGlass = glassMesh.geometry.attributes.position;
  assert.ok(Array.from(archedGlass.array).some((v, i) => i % 3 === 1 && v > 19.2 && v < 21),
    'arched top is geometrically curved');
});
test('elevated corridor physically spans the gap between source building envelopes', () => {
  const {corridor} = createSEMBuilding(THREE, source, {textured: false});
  const {start, end} = corridor.group.userData;
  assert.equal(start[1], BRIDGE_Z);
  assert.equal(end[1], BRIDGE_Z);
  const xAt = (a, b) => a[0] + (b[0] - a[0]) * (BRIDGE_Z - a[1]) / (b[1] - a[1]);
  assert.ok(start[0] < xAt(source.points[3], source.points[4]));
  assert.ok(end[0] > xAt(FOOTPRINT[0], FOOTPRINT[1]));
  assert.ok(corridor.length > 15 && corridor.length < 25);
  assert.equal(corridor.stats.storeyClearance, 4);
});
