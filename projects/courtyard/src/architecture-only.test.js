import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createModel} from './model.js';

test('architecture-only reuse keeps the existing facade, basins and pergolas without loading plants', () => {
  const {group, stats} = createModel(THREE, {architectureOnly: true, textured: false});
  assert.equal(group.userData.architectureOnly, true);
  assert.equal(stats.basins, 3);
  assert.equal(stats.pergolas, 2);
  assert.equal(stats.pillars, 32);
  assert.equal(stats.trees, 0);
  assert.equal(stats.leafInstances, 0);
  assert.equal(stats.textures, 0);
  for (const name of ['Building shell', 'Windows and facade joinery', 'Terrace balustrade',
    'Three empty stone cascade basins', 'Twin pergolas']) {
    assert.ok(group.getObjectByName(name)?.children.length);
  }
  assert.equal(group.getObjectByName('Garden trees and beds'), undefined);
  group.traverse(object => {
    if (!object.isMesh) return;
    assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));
    assert.ok(object.geometry.attributes.normal.array.every(Number.isFinite));
  });
});
