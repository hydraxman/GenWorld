import test from 'node:test';
import assert from 'node:assert/strict';
import { randomSource, createComposition, makeBranch, windOffset, sampleStroke } from '../src/model.js';

test('seed and density reproduce every branch and leaf without ambient randomness', () => {
  assert.deepEqual(createComposition(240724, 60), createComposition(240724, 60));
  assert.notDeepEqual(createComposition(240724, 60), createComposition(240725, 60));
  const a = randomSource(7), b = randomSource(7);
  for (let i = 0; i < 100; i++) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
});

test('density increases leaf counts and all default composition points stay inside the print area', () => {
  let count = 0;
  for (const density of [15, 40, 60, 80, 100]) {
    const branches = createComposition(240724, density);
    const leaves = branches.flatMap(branch => branch.leaves);
    assert.ok(leaves.length > count);
    count = leaves.length;
    for (const branch of branches) for (const [x, y] of branch.points) {
      assert.ok(x >= 75 && x <= 925);
      assert.ok(y > 485 && y < 845);
    }
    for (const leaf of leaves) {
      assert.ok(Object.values(leaf).every(Number.isFinite));
      assert.ok(leaf.length > 0 && leaf.length < 60);
      assert.ok(leaf.color >= 0 && leaf.color < 5);
    }
  }
});

test('wind repels, attracts, is bounded and restores exactly without mutating input', () => {
  const pointer = { x: 200, y: 200 };
  const push = windOffset(230, 240, pointer, 'push');
  const attract = windOffset(230, 240, pointer, 'attract');
  assert.ok(push[0] > 0 && push[1] > 0);
  assert.ok(attract[0] < 0 && attract[1] < 0);
  assert.ok(Math.hypot(...push) < 68);
  assert.deepEqual(windOffset(230, 240, pointer, 'restore'), [0, 0]);
  assert.deepEqual(windOffset(230, 240, null, 'push'), [0, 0]);
  assert.deepEqual(windOffset(200, 200, pointer, 'push'), [0, 0]);
  assert.deepEqual(windOffset(900, 900, pointer, 'push'), [0, 0]);
  assert.deepEqual(pointer, { x: 200, y: 200 });
  assert.throws(() => windOffset(230, 240, pointer, 'invalid'));
});

test('strokes are sampled and bounded without mutating input; duplicate points produce no invalid leaves', () => {
  const points = [[100, 500]];
  assert.equal(sampleStroke(points, [102, 502]), points);
  assert.deepEqual(sampleStroke(points, [-50, 1200]), [[100, 500], [75, 845]]);
  assert.deepEqual(points, [[100, 500]]);
  const branch = makeBranch([[200, 600], [200, 600], [400, 650]], 60, 1);
  assert.ok(branch.leaves.length > 0);
  assert.deepEqual(makeBranch([[200, 600], [200, 600]], 60, 1).leaves, []);
  for (const leaf of branch.leaves) assert.ok(Object.values(leaf).every(Number.isFinite));
});

test('invalid parameters fail instead of silently selecting another composition', () => {
  for (const seed of [0, -1, 1000000000, NaN, 1.5]) assert.throws(() => randomSource(seed));
  for (const density of [0, 101, NaN, 40.5]) assert.throws(() => createComposition(1, density));
  assert.throws(() => makeBranch([[0, 0]], 60, 1));
  assert.throws(() => makeBranch([[0, 0], [NaN, 1]], 60, 1));
  assert.throws(() => sampleStroke([], [NaN, 5]));
});
