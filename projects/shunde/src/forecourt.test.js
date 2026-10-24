import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createForecourt, FORECOURT, GROVE_SITES} from './forecourt.js';

test('the former approach lawn is covered by level concrete with physical joints and a real grove', () => {
  const built = createForecourt(THREE, {textured: false});
  assert.ok(built.stats.trees >= 10);
  assert.ok(built.stats.leafInstances > 30000);
  assert.equal(built.stats.terrainRaised, false);
  for (const x of [-30, -8, 5, 22]) for (const z of [-38, -45, -56, -70, -88]) {
    const hits = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0), 0, 2)
      .intersectObject(built.paving, true);
    assert.ok(hits.length);
    assert.ok(hits[0].point.y > 0 && hits[0].point.y < .05);
    assert.match(hits[0].object.material.name, /concrete/i);
  }
  assert.ok(GROVE_SITES.every(([x, z]) => x > FORECOURT.minX && x < FORECOURT.maxX &&
    z > FORECOURT.minZ && z < FORECOURT.maxZ));
  const second = createForecourt(THREE, {textured: false});
  assert.deepEqual(built.leaves.instanceMatrix.array, second.leaves.instanceMatrix.array);
});
