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
  assert.ok(model.stats.archedWindows >= 10 && model.stats.archedWindows < 24,
    'No red arched podium may occupy the north glass connector');
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
  assert.equal(corridor.stats.clearance, 9.84);
  assert.equal(BRIDGE_Z, -12, 'Attach near the north end, separately from the central courtyard connector');
});

test('north connector is truly open from plaza to courtyard and has a continuous glass volume above', () => {
  const model = createSEMBuilding(THREE, source, {textured: false});
  model.group.traverse(o => {if (o.isMesh) o.material.side = THREE.DoubleSide;});
  const opening = model.northOpening;
  assert.equal(opening.west, -120.544);
  assert.equal(opening.east, -98);
  assert.equal(opening.clearHeight, 9.76);
  for (const x of [-119, -114, -108, -102, -99]) for (const y of [.12, 1.7, 5, 9.5]) {
    for (const direction of [-1, 1]) {
      const start = new THREE.Vector3(x, y, direction === 1 ? -45 : 20);
      assert.equal(new THREE.Raycaster(start, new THREE.Vector3(0, 0, direction), 0, 65)
        .intersectObject(model.group, true).length, 0, `North axis blocked: ${x}/${y}/${direction}`);
    }
    const origin = new THREE.Vector3(x, 2, -10);
    for (const direction of [-1, 1]) {
      const hit = new THREE.Raycaster(origin, new THREE.Vector3(0, direction, 0))
        .intersectObject(model.architecture, true)[0];
      assert.ok(hit && Math.abs(hit.point.y - (direction === 1 ? opening.soffit : opening.floor)) < .02);
    }
    for (const direction of [-1, 1]) {
      assert.ok(new THREE.Raycaster(origin, new THREE.Vector3(direction, 0, 0), 0, 25)
        .intersectObject(model.architecture, true).length, 'Side walls bound the opening');
    }
    const upper = new THREE.Raycaster(new THREE.Vector3(x, 18, -45), new THREE.Vector3(0, 0, 1), 0, 60);
    assert.ok(upper.intersectObject(model.architecture, true).some(hit => /glazing/.test(hit.object.material.name)));
  }
});

test('one large metal cylinder supports the north soffit in front of the recessed lower facade', () => {
  const model = createSEMBuilding(THREE, source, {textured: false});
  const support = model.group.getObjectByName('Jianhua north silver cylindrical support');
  assert.ok(support);
  const bounds = new THREE.Box3().setFromObject(support);
  assert.ok(Math.abs(bounds.min.y - .08) < .001 && Math.abs(bounds.max.y - 9.84) < .001);
  assert.equal(support.userData.radius, .98);
  assert.ok(support.userData.lowerFacadeSetback > 6);
  const metal = support.children.find(mesh => /brushed silver/.test(mesh.material?.name));
  assert.ok(metal?.material.metalness >= .8 && metal.material.roughness < .4);
  const center = support.getWorldPosition(new THREE.Vector3());
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const hit = new THREE.Raycaster(center.clone().setY(4).addScaledVector(direction, 2), direction.negate(), 0, 2)
      .intersectObject(support, true)[0];
    assert.ok(hit && Math.abs(Math.hypot(hit.point.x - center.x, hit.point.z - center.z) - .98) < .004,
      'A round, not rectangular or low-sided support');
  }
  const overhead = new THREE.Raycaster(center.clone().setY(11), new THREE.Vector3(0, -1, 0), 0, 1)
    .intersectObject(model.architecture, true);
  assert.ok(overhead.length && Math.abs(overhead[0].point.y - 10.18) < .001,
    'The column must contact a real supporting slab');
});

test('glazed wing has a genuine two-ended passage, bounded by side walls, a floor and a supporting soffit', () => {
  const model = createSEMBuilding(THREE, source, {textured: false});
  const {passage} = model;
  assert.equal(passage.width, 17);
  assert.equal(passage.clearHeight, 9.76);
  assert.ok(passage.west[0] < passage.east[0]);
  // Double-sided rays also detect reversed/back-facing glass or wall remnants.
  model.group.traverse(o => {if (o.isMesh) o.material.side = THREE.DoubleSide;});
  for (const z of [11.8, 12.5, 15, 20, 25, 27.5, 28.2]) for (const y of [.12, 1.7, 5, 9.5]) {
    for (const direction of [-1, 1]) {
      const start = direction === 1 ? -138 : -45;
      const ray = new THREE.Raycaster(new THREE.Vector3(start, y, z), new THREE.Vector3(direction, 0, 0), 0, 93);
      assert.equal(ray.intersectObject(model.group, true).length, 0, `Blocked through-passage z=${z}, y=${y}, direction=${direction}`);
    }
  }
  for (const x of [-94, -82, -65]) {
    const origin = new THREE.Vector3(x, 2, 20);
    const up = new THREE.Raycaster(origin, new THREE.Vector3(0, 1, 0)).intersectObject(model.architecture, true)[0];
    assert.ok(up && Math.abs(up.point.y - passage.soffit) < 1e-5, 'The glass bridge must have a real opaque underside');
    const down = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0)).intersectObject(model.architecture, true)[0];
    assert.ok(down && Math.abs(down.point.y - passage.floor) < 1e-5, 'Continuous low paving, not a blocking foundation curb');
    for (const direction of [-1, 1]) {
      const side = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, direction)).intersectObject(model.architecture, true)[0];
      assert.ok(side && Math.abs(side.point.z - (direction === 1 ? passage.south : passage.north)) < .6,
        'The passage is enclosed on both sides, not an empty unbuilt shell');
    }
  }
  for (const z of [7, 36, 60]) {
    const closed = new THREE.Raycaster(new THREE.Vector3(-45, 4, z), new THREE.Vector3(-1, 0, 0), 0, 90);
    assert.ok(closed.intersectObject(model.architecture, true).length, 'Do not open the entire ground floor');
  }
  for (const z of [15, 20, 25]) {
    const above = new THREE.Raycaster(new THREE.Vector3(-45, 18, z), new THREE.Vector3(-1, 0, 0), 0, 90);
    assert.ok(above.intersectObject(model.architecture, true).some(hit => /glazing/.test(hit.object.material.name)),
      'Preserve the glazed storeys spanning above the opening');
  }
});
