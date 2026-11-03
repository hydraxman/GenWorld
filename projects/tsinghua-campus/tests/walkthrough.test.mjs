import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import source from '../../shunde/docs/campus-context.json' with {type: 'json'};
import {createShundeModel} from '../../shunde/src/model.js';
import {createSEMBuilding, SEM_WAY} from '../../shunde/src/sem-building.js';
import {advanceVisitorVelocity, stepVisitor, visitorCanStand, visitorFloor} from '../src/walkthrough.js';

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
