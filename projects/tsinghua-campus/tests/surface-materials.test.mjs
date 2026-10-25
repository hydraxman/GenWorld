import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createMasonryMaterial, createGlazingMaterial, createEstimatedFacade} from '../src/surface-materials.js';

test('procedural masonry separates sRGB color from unit-vector normal data and remains deterministic', () => {
  for (const stone of [false, true]) {
    const first = createMasonryMaterial('test', [174, 96, 56], stone);
    const second = createMasonryMaterial('test', [174, 96, 56], stone);
    assert.equal(first.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(first.normalMap.colorSpace, THREE.NoColorSpace);
    assert.equal(first.roughnessMap, null, 'Do not reintroduce the raw roughness-map GLB packing failure');
    for (const key of ['map', 'normalMap']) {
      assert.deepEqual(first[key].image.data, second[key].image.data);
      assert.ok(first[key].generateMipmaps && first[key].anisotropy >= 4);
      assert.match(first[key].name, /generated.*no photograph/);
    }
    const bytes = first.normalMap.image.data;
    for (let i = 0; i < bytes.length; i += 4) {
      const vector = [0, 1, 2].map(axis => bytes[i + axis] / 127.5 - 1);
      assert.ok(Math.abs(Math.hypot(...vector) - 1) < .012);
      assert.ok(vector[2] > .8);
    }
  }
});

test('exterior glazing uses dielectric physical reflections without pretending to reconstruct interiors', () => {
  const glass = createGlazingMaterial('window');
  assert.ok(glass.isMeshPhysicalMaterial);
  assert.equal(glass.metalness, 0);
  assert.equal(glass.ior, 1.5);
  assert.ok(glass.roughness > .1 && glass.roughness < .3);
  assert.equal(glass.transparent, false);
  assert.equal(glass.transmission, 0);
  assert.equal(glass.map, null);
});

test('estimated bays avoid cropped windows at corners and do not put windows on narrow wall fragments', () => {
  const facade = createEstimatedFacade(), uv = facade.uvGenerator(4, 24);
  const vertices = [0, 0, 0, 10, 0, 0, 10, 0, 20, 0, 0, 20];
  const corners = uv.generateSideWallUV(null, vertices, 0, 1, 2, 3);
  assert.deepEqual(corners.map(p => p.toArray()), [[0, 0], [3, 0], [3, 5], [0, 5]]);
  const thin = [0, 0, 0, .8, 0, 0, .8, 0, 20, 0, 0, 20];
  assert.ok(uv.generateSideWallUV(null, thin, 0, 1, 2, 3).every(p => p.x < .19));
  assert.throws(() => facade.uvGenerator(0, 0), /height range/);
  assert.throws(() => facade.uvGenerator(NaN, 20), /height range/);
});
