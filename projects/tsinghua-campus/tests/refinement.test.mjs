import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import source from '../../shunde/docs/courtyard/source-footprint.json' with {type: 'json'};
import {shundePlacement} from '../src/shunde-refinement.js';
import {project} from '../src/geo.js';

test('existing Shunde ENU coordinates align with campus coordinates, without resizing by eye', () => {
  const center = [116.32, 40.006], localOrigin = [390, 820];
  const matrix = shundePlacement(center, localOrigin);
  const original = source.geometry_enu_m.coordinates[0];
  for (let i = 0; i < original.length; i++) {
    const [e, n] = original[i];
    const expected = project(source.geometry_wgs84.coordinates[0][i], center);
    const actual = new THREE.Vector3(e, 17, -n).applyMatrix4(matrix);
    assert.ok(Math.hypot(actual.x + localOrigin[0] - expected[0], actual.z + localOrigin[1] - expected[1]) < 0.1);
    assert.equal(actual.y, 17);
  }
});
