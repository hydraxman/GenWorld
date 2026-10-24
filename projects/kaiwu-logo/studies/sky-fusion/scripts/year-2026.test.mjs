import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../../../latest/tsinghua-mem-five-effects-cloud/vendor/three/build/three.module.js';
import {withYear2026} from './year-2026.js';

const source = JSON.parse(await readFile(new URL(
  '../../../latest/tsinghua-mem-five-effects-cloud/inputs/semantic-geometry.json', import.meta.url)));

function inside([x, y], contour) {
  let result = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const [ax, ay] = contour[i], [bx, by] = contour[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) result = !result;
  }
  return result;
}

test('2026 changes only the final year digit and does not mutate the original artwork', () => {
  const original = structuredClone(source);
  const revised = withYear2026(source, THREE);
  assert.deepEqual(source, original);
  for (const name of Object.keys(source).filter(name => name !== 'circuits')) {
    assert.deepEqual(revised[name], source[name]);
  }
  assert.equal(revised.circuits.length, source.circuits.length + 1);
  revised.circuits.slice(0, -1).forEach((polygon, index) => {
    if (index !== 8) return assert.deepEqual(polygon, source.circuits[index]);
    assert.deepEqual(polygon.outer, source.circuits[index].outer);
    assert.deepEqual(polygon.noBevel, source.circuits[index].noBevel);
    polygon.holes.forEach((hole, i) => {
      if (i === 5) assert.notDeepEqual(hole, source.circuits[index].holes[i]);
      else assert.deepEqual(hole, source.circuits[index].holes[i]);
    });
  });
});

test('six has a lower enclosed counter, open upper terminal and matching source-scale bounds', () => {
  const revised = withYear2026(source, THREE);
  const six = revised.circuits[8].holes[5], island = revised.circuits.at(-1);
  assert.equal(island.holes.length, 0);
  assert.ok(island.outer.every(point => inside(point, six)), 'Counter must lie strictly inside the six outline');
  assert.ok(inside([358.5, 490], six), 'Six needs a continuous left stem');
  assert.ok(!inside([358.5, 490], source.circuits[8].holes[5]), 'Original three must not have that stem');
  assert.ok(!inside([370.5, 485], six), 'Upper terminal must remain open, not become an eight');
  assert.ok(inside([364.4, 494.7], island.outer), 'Lower bowl must have a solid counter');
  for (const [x, y] of [...six, ...island.outer]) {
    assert.ok(x >= 355.87 && x <= 373 && y >= 477.31296875 && y <= 503);
  }
  assert.ok(THREE.ShapeUtils.area(six.map(([x, y]) => new THREE.Vector2(x, y))) !== 0);
  assert.throws(() => withYear2026({...source, circuits: []}, THREE), /exactly one/);
});
