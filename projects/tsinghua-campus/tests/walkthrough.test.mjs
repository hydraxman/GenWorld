import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import source from '../../shunde/docs/campus-context.json' with {type: 'json'};
import {createShundeModel} from '../../shunde/src/model.js';
import {createSEMBuilding, SEM_WAY} from '../../shunde/src/sem-building.js';
import {advanceVisitorVelocity, setWalkViewport, stepVisitor, visitorCanStand, visitorFloor} from '../src/walkthrough.js';

test('assembled Shunde doorway has one paving surface, not coplanar foundation tiles', () => {
  const built = createShundeModel(THREE, {textured: false, foliage: false, refinedFront: true});
  let anchor;
  built.group.traverse(object => {if (object.userData.walkthrough?.id === 'shunde') anchor = object;});
  built.group.updateMatrixWorld(true);
  for (const x of [-5.3, -.65, .17, .65, 5.3]) for (const z of [-5.5, -.3, .8, 1.4, 2.8, 4.6, 4.9, 5.3]) {
    const origin = anchor.localToWorld(new THREE.Vector3(x, 1.3, z));
    const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0, 1.3).intersectObject(built.building, true)
      .filter(hit => Math.abs(anchor.worldToLocal(hit.point.clone()).y - .9) < .0001);
    assert.equal(hits.length, 1, `Competing top faces at ${x},${z}: ${hits.map(hit => hit.object.material.name).join(' / ')}`);
    assert.equal(hits[0].object.material.name, 'Gray forecourt paving');
    assert.equal(hits[0].object.material.polygonOffset, false, 'Repair geometry rather than biasing depth');
  }
});

for (const kind of ['shunde', 'jianhua']) test(`${kind} visitor actually passes through open doors into a floored bounded lobby`, () => {
  const built = kind === 'shunde' ? createShundeModel(THREE, {textured: false, foliage: false, refinedFront: true})
    : createSEMBuilding(THREE, source.buildings.find(building => building.id === SEM_WAY), {textured: false});
  let anchor;
  built.group.traverse(object => {
    if (object.userData.walkthrough?.id === kind) anchor = object;
    if (object.isMesh) object.material.side = THREE.DoubleSide;
  });
  assert.ok(anchor);
  built.group.updateMatrixWorld(true);
  const spec = anchor.userData.walkthrough;
  assert.ok(visitorCanStand(spec, spec.spawn));
  assert.ok(visitorCanStand(spec, spec.entryTarget));
  const entered = stepVisitor(spec, spec.spawn, spec.entryTarget.map((value, axis) => value - spec.spawn[axis]));
  assert.ok(Math.hypot(...entered.map((value, axis) => value - spec.entryTarget[axis])) < 1e-10);
  const finish = stepVisitor(spec, spec.spawn, [0, -20]);
  assert.ok(finish[1] < -4);
  assert.ok(visitorCanStand(spec, finish));
  assert.ok(!visitorCanStand(spec, [0, -30]));
  const againstWall = stepVisitor(spec, finish, [100, 0]);
  assert.ok(againstWall[0] < 5.5);
  assert.ok(visitorCanStand(spec, againstWall));
  assert.throws(() => stepVisitor(spec, spec.spawn, [NaN, 0]), /finite/);
  for (const x of [-.4, 0, .4]) {
    const start = anchor.localToWorld(new THREE.Vector3(x, visitorFloor(spec, [0, -3]) + 1.65, 4.5));
    const end = anchor.localToWorld(new THREE.Vector3(x, visitorFloor(spec, [0, -3]) + 1.65, -3.2));
    const direction = end.clone().sub(start), ray = new THREE.Raycaster(start, direction.clone().normalize(), 0, direction.length());
    assert.equal(ray.intersectObject(built.building || built.architecture, true).length, 0, `Actual glazing/backers obstruct entry at x=${x}`);
  }
  const floor = visitorFloor(spec, [0, -3]);
  const origin = anchor.localToWorld(new THREE.Vector3(0, floor + 1.5, -3));
  const hit = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0, 3).intersectObject(built.building || built.architecture, true)[0];
  assert.ok(hit, 'A walkable lobby must have real floor geometry');
  assert.ok(Math.abs(hit.point.y - floor) < .02);
  assert.match(spec.limitations, /示意/);
});

test('walking acceleration has frame-rate-independent distance and a short controlled stop', () => {
  function simulate(fps) {
    let velocity = [0, 0], distance = 0;
    for (let step = 0; step < fps; step++) {
      const next = advanceVisitorVelocity(velocity, [0, -2.4], 1 / fps);
      velocity = next.velocity; distance += next.delta[1];
    }
    return {velocity, distance};
  }
  const slow = simulate(20), fast = simulate(120);
  assert.ok(Math.abs(slow.distance - fast.distance) < 1e-10);
  assert.ok(slow.distance < -2.19 && slow.distance > -2.21);
  const stopped = advanceVisitorVelocity(fast.velocity, [0, 0], .5);
  assert.ok(Math.abs(stopped.delta[1]) < .2);
  assert.ok(Math.abs(stopped.velocity[1]) < .006);
  assert.throws(() => advanceVisitorVelocity([0, NaN], [0, 0], .1), /finite/);
});

test('compact walking controls reveal more height without cropping the pond on portrait screens', () => {
  const camera = new THREE.PerspectiveCamera(65, 1, .06, 6000);
  camera.position.set(0, 2.55, .2); camera.lookAt(0, 2.55, -4.15); camera.updateMatrixWorld(true);
  for (const [width, height] of [[320, 740], [390, 844], [430, 932], [390, 1100], [740, 390], [1600, 1000]]) {
    const freeHeight = height - 224;
    setWalkViewport(camera, width, height, freeHeight);
    if (width > 850) {
      assert.equal(camera.fov, 65); assert.equal(camera.view?.enabled, false); continue;
    }
    for (const x of [-1.7, 1.7]) for (const z of [-5.3, -3]) {
      const point = new THREE.Vector3(x, 2.07, z).project(camera);
      assert.ok(Math.abs(point.x) < 1, `Pond cropped horizontally at ${width}x${height}`);
      const y = (1 - point.y) * height / 2;
      assert.ok(y > 0 && y < freeHeight, `Pond obstructed by compact controls at ${width}x${height}`);
    }
  }
});
