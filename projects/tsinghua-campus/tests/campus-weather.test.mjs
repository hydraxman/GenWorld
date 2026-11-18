import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {CAMPUS_WEATHER, campusWeather} from '../src/campus-weather.js';
import {createCampusSky} from '../src/campus-sky.js';
import {fitInspectionShadow} from '../src/inspection-view.js';

test('one shared panorama re-lights in place, changes the sky and returns exactly to clear', () => {
  const sky = createCampusSky(THREE), texture = sky.texture, bytes = texture.image.data;
  const clear = bytes.slice(), version = texture.version;
  sky.setWeather('clear'); assert.equal(texture.version, version);
  const skies = new Map([['clear', clear]]);
  for (const id of ['sunset', 'after-rain', 'overcast']) {
    sky.setWeather(id);
    assert.equal(texture.image.data, bytes);
    assert.equal(sky.sky.material.uniforms.campusSky.value, texture);
    for (const [other, pixels] of skies) {
      let changed = 0, samples = 0;
      for (let i = bytes.length / 2; i < bytes.length; i += 4 * 31) {
        samples++;
        if ([0, 1, 2].some(c => Math.abs(bytes[i + c] - pixels[i + c]) >= 12)) changed++;
      }
      assert.ok(changed / samples > .3, `${id} must visibly differ from ${other}`);
    }
    skies.set(id, bytes.slice());
  }
  sky.setWeather('clear'); assert.deepEqual(bytes, clear);
  assert.throws(() => sky.setWeather('constructor'), RangeError);
  sky.sky.geometry.dispose(); sky.sky.material.dispose(); texture.dispose();
});

test('every inspection scale keeps its preset direction; only the rain-cleared pavement is wet', () => {
  const sun = new THREE.DirectionalLight();
  for (const id of Object.keys(CAMPUS_WEATHER)) {
    const p = campusWeather(id), expected = new THREE.Vector3(...p.direction).normalize();
    assert.ok(expected.y > 0 && p.visibility[1] > p.visibility[0]);
    assert.equal(p.wet > 0, id === 'after-rain');
    for (const scale of [18, 220, 3100]) {
      const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(540, 20, -713), new THREE.Vector3(scale, 40, scale));
      fitInspectionShadow(sun, box, p.direction);
      assert.ok(sun.position.clone().sub(sun.target.position).normalize().distanceTo(expected) < 1e-12);
    }
  }
});
