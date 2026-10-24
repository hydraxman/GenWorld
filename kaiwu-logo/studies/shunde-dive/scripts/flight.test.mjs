import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import campus from '../../../../projects/shunde/docs/campus-context.json' with {type: 'json'};
import {insideFootprint} from '../../../../projects/shunde/src/campus-context.js';
import {SEM_WAY, SEM_HEIGHT} from '../../../../projects/shunde/src/sem-building.js';
import {GROVE_SITES} from '../../../../projects/shunde/src/forecourt.js';
import {flightAt, badgeAt, FRONT, OUTWARD, FINAL_DISTANCE, FINAL_OFFSET} from './flight.js';

test('opening sky stays fixed, steep aerial proof precedes a true frontal hold', () => {
  for (const t of [0, .3, .65]) {
    assert.equal(flightAt(t).pitch, .76);
    assert.equal(flightAt(t).yaw, 0);
    assert.deepEqual(badgeAt(t), {scale: 1, y: 0});
  }
  assert.ok(flightAt(1.45).pitch < -Math.PI / 3, 'aerial proof must look down at least 60 degrees');
  const end = flightAt(4);
  assert.deepEqual(end, flightAt(3.4));
  const towardFront = [FRONT[0] + FINAL_OFFSET - end.position[0], FRONT[1] - end.position[2]];
  const length = Math.hypot(...towardFront);
  assert.ok(towardFront.every((v, i) => Math.abs(v / length + OUTWARD[i]) < 1e-12));
  assert.equal(end.position[1], 8.5);
  assert.equal(FINAL_OFFSET, 0, 'the final camera must sit on the entrance normal, not bias toward the SEM');
  assert.ok(FINAL_DISTANCE < 57 * .8, 'land at least 20% closer than first delivery');
  assert.equal(end.fov, 63);
  assert.deepEqual(badgeAt(4), {scale: .42, y: 1.55});
  assert.ok(badgeAt(4).scale >= .30 * 1.35 && badgeAt(4).y < 2.32 - .6);
});

test('absolute-time poses are finite, continuous, and do not roll or descend below grade', () => {
  const camera = new THREE.PerspectiveCamera();
  let last, quaternion;
  for (let i = 0; i <= 480; i++) {
    const t = i / 120, pose = flightAt(t);
    assert.ok(pose.position.concat(pose.target, pose.pitch, pose.yaw).every(Number.isFinite));
    assert.ok(pose.position[1] >= 8.5);
    assert.ok(pose.position[2] < FRONT[1] - 39);
    camera.position.set(...pose.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(...pose.target);
    if (last) {
      assert.ok(camera.position.distanceTo(new THREE.Vector3(...last.position)) < 2.6);
      assert.ok(camera.quaternion.angleTo(quaternion) < .08, 'no camera snap across segment boundaries');
      assert.ok(pose.position[1] <= last.position[1]);
    }
    last = pose;
    quaternion = camera.quaternion.clone();
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => flightAt(value));
    assert.throws(() => badgeAt(value));
  }
  assert.deepEqual(flightAt(-2), flightAt(0));
  assert.deepEqual(flightAt(10), flightAt(4));
});

test('flight clears actual mapped neighboring footprints and retains the key campus buildings', () => {
  const ids = campus.buildings.map(b => b.id);
  for (const id of [937482182,743595593,226667976,85553379,80342017]) assert.ok(ids.includes(id));
  assert.ok(!ids.includes(84653293), 'do not duplicate the main combined source model');
  for (let i = 0; i <= 240; i++) {
    const [x, y, z] = flightAt(i / 60).position;
    for (const building of campus.buildings) {
      const height = building.id === SEM_WAY ? SEM_HEIGHT : building.height;
      if (insideFootprint([x, z], building.points)) assert.ok(y > height + 3, `camera hits ${building.id}`);
    }
    for (const [tx, tz, height] of GROVE_SITES) {
      assert.ok(y > height + 2.5 || Math.hypot(x - tx, z - tz) > 5, 'camera must not fly through foreground trees');
    }
  }
  for (const road of campus.roads) for (const point of road.points) {
    assert.ok(point.every(v => Math.abs(v) <= 420.001), 'clip complete intersecting source ways');
  }
});
