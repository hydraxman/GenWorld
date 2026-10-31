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
  assert.equal(model.stats.archedWindows, 24, 'Only north/outer podium elevations use the observed tall arches');
  assert.ok(model.stats.windows > 100);
  const bounds = new THREE.Box3().setFromObject(model.architecture);
  assert.ok(bounds.max.y > 30 && bounds.max.y < 30.5);
  assert.ok(Math.abs(bounds.min.x - Math.min(...source.points.map(p => p[0]))) < 1);
  assert.ok(Math.abs(bounds.max.x - Math.max(...source.points.map(p => p[0]))) < 1);
  const faces = [];
  model.architecture.traverse(o => { if (o.name === 'SEM articulated facade') faces.push(o); });
  const north = faces.find(face => face.userData.outwardZ < -.9 && face.children.some(o => /terracotta/i.test(o.material?.name)));
  assert.ok(north);
  const glassMesh = north.children.find(o => o.isMesh && /glazing/.test(o.material.name));
  assert.ok(glassMesh, 'actual recessed glazing, not facade photo');
  const shapeWalls = north.children.filter(o => o.isMesh && /terracotta/.test(o.material.name));
  assert.ok(shapeWalls.length);
  const archedGlass = glassMesh.geometry.attributes.position;
  assert.ok(Array.from(archedGlass.array).some((v, i) => i % 3 === 1 && v > 19.2 && v < 21),
    'arched top is geometrically curved');
});
test('north entrance is transparent with an actual recessed 17 m arch opening, not a painted arch', () => {
  const model = createSEMBuilding(THREE, source, {textured: false});
  const {component, facade, archHeight, archWidth, archBase} = model.northAtrium;
  assert.ok(facade.userData.outwardZ < -.99);
  assert.equal(archHeight, 17);
  const direction = new THREE.Vector3(0, 0, -1).transformDirection(component.matrixWorld);
  const cast = (x, y) => new THREE.Raycaster(component.localToWorld(new THREE.Vector3(x, y, 5)), direction)
    .intersectObject(component, true);
  const aperture = cast(.4, 12);
  assert.match(aperture[0].object.material.name, /transparent atrium glazing/);
  assert.equal(aperture[0].object.material.metalness, 0);
  assert.equal(aperture[0].object.material.depthWrite, false);
  assert.ok(aperture[0].object.material.opacity < .3);
  assert.equal(aperture.some(hit => /white interior arch|terracotta/.test(hit.object.material.name)), false);
  const pier = cast(archWidth / 2 + .3, 8).find(hit => /white interior arch/.test(hit.object.material.name));
  assert.ok(pier);
  assert.ok(component.worldToLocal(pier.point.clone()).z < -1.4);
  assert.equal(cast(0, archBase + 16.2).some(hit => /white interior arch/.test(hit.object.material.name)), false);
  assert.ok(cast(0, archBase + 16.7).some(hit => /white interior arch/.test(hit.object.material.name)));
  assert.equal(cast(0, archBase + 17.1).some(hit => /white interior arch/.test(hit.object.material.name)), false);
  let meshes = 0, triangles = 0;
  model.group.traverse(o => {
    if (!o.isMesh) return;
    meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    for (const attribute of Object.values(o.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
  });
  assert.ok(meshes < 100 && triangles < 60000);
  const concavity = new THREE.Raycaster(new THREE.Vector3(-150, 40, 40), new THREE.Vector3(0, -1, 0));
  assert.equal(concavity.intersectObject(model.architecture, true).length, 0, 'No slab fills the frozen L-shaped courtyard');
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
