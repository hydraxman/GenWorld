import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FLOORS} from '../src/curriculum.js';
import {createKnowledgeTower} from '../src/tower.js';

test('assembled side enclosure meets each floor and the next slab without daylight cracks', () => {
  const tower = createKnowledgeTower(THREE, FLOORS);
  tower.setState({mode: 'tower', floor: 1});
  for (let floor = 1; floor <= 16; floor++) {
    const base = tower.getFloorPosition(floor).y;
    for (const height of [.35, 2.8, 3.04, 3.2, 3.48, 3.59]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(-12, base + height, -4), new THREE.Vector3(1, 0, 0), 0, 1.4);
      const hits = ray.intersectObject(tower.group, true);
      assert.ok(hits.length, `Daylight crack at floor ${floor}, local height ${height}m`);
      const rear = new THREE.Raycaster(new THREE.Vector3(5, base + height, -10), new THREE.Vector3(0, 0, 1), 0, 1.4);
      assert.ok(rear.intersectObject(tower.group, true).length, `Rear daylight crack at floor ${floor}, height ${height}m`);
    }
  }
});

test('front teaching cutaway and exploded separation stay intentionally open', () => {
  const tower = createKnowledgeTower(THREE, FLOORS);
  tower.setState({mode: 'floor', floor: 4});
  const floor = tower.group.getObjectByName('floor-4');
  const ray = new THREE.Raycaster(new THREE.Vector3(5, floor.position.y + 2, 10), new THREE.Vector3(0, 0, -1), 0, 1.1);
  assert.equal(ray.intersectObject(floor, true).length, 0);
  tower.setState({mode: 'exploded', floor: 4});
  assert.ok(tower.getFloorPosition(5).y - tower.getFloorPosition(4).y > 6);
});
