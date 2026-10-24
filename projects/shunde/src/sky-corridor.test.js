import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSkyCorridor, CORRIDOR_CLEARANCE} from './sky-corridor.js';

test('gray corridor is enclosed in the air with four-storey clearance and no ground-level obstruction', () => {
  const corridor = createSkyCorridor(THREE, {start: [-64, 2], end: [-44, 2], textured: false});
  const bounds = new THREE.Box3().setFromObject(corridor.group);
  assert.ok(Math.abs(bounds.min.y - CORRIDOR_CLEARANCE) < 1e-5);
  assert.ok(bounds.max.y - bounds.min.y > 3);
  for (const y of [.1, 3, 6, 9, 12.9]) {
    const hits = new THREE.Raycaster(new THREE.Vector3(-54, y, -5), new THREE.Vector3(0, 0, 1), 0, 15)
      .intersectObject(corridor.group, true);
    assert.equal(hits.length, 0, 'space below must remain genuinely open');
  }
  const glassHits = new THREE.Raycaster(new THREE.Vector3(-53.6, 15, -5), new THREE.Vector3(0, 0, 1), 0, 15)
    .intersectObject(corridor.group, true);
  assert.match(glassHits[0]?.object.material.name || '', /glass/);
  const floorHits = new THREE.Raycaster(new THREE.Vector3(-54, 14, 2), new THREE.Vector3(0, -1, 0), 0, 3)
    .intersectObject(corridor.group, true);
  assert.ok(floorHits.length && floorHits[0].point.y > 13.2);
  assert.equal(corridor.stats.storeyClearance, 4);
});
