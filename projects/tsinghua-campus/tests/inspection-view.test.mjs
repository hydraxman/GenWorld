import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {fitInspectionView, fitInspectionShadow, updateInspectionClipping} from '../src/inspection-view.js';

function assertContained(camera, box, width, height, region) {
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) {
    for (const z of [box.min.z, box.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(camera);
      const sx = (point.x + 1) * width / 2, sy = (1 - point.y) * height / 2;
      assert.ok(sx >= region.x - 1e-5 && sx <= region.x + region.width + 1e-5, `Clipped x: ${sx}`);
      assert.ok(sy >= region.y - 1e-5 && sy <= region.y + region.height + 1e-5, `Clipped y: ${sy}`);
      assert.ok(point.z >= -1 && point.z <= 1, `Clipped depth: ${point.z}`);
    }
  }
}

test('perspective and plan views fit all eight corners inside the UI-free region, including resize', () => {
  const box = new THREE.Box3(new THREE.Vector3(317, 0, -640), new THREE.Vector3(362, 25, -592));
  const original = box.clone();
  for (const camera of [new THREE.PerspectiveCamera(40, 1, 1, 30000),
    new THREE.OrthographicCamera(-1800, 1800, 1400, -1400, 1, 30000)]) {
    for (const [width, height, region] of [
      [1600, 1050, {x: 346, y: 160, width: 1230, height: 700}],
      [390, 844, {x: 14, y: 196, width: 362, height: 578}],
      [320, 568, {x: 14, y: 196, width: 292, height: 302}],
      [844, 390, {x: 14, y: 160, width: 816, height: 160}],
      [1600, 1050, {x: 24, y: 160, width: 1552, height: 700}],
    ]) {
      if (camera.isOrthographicCamera) camera.up.set(0, 0, -1);
      const direction = camera.isOrthographicCamera ? [0, 1, 0] : [.45, .8, 1];
      fitInspectionView(camera, box, {width, height, region, direction});
      assertContained(camera, box, width, height, region);
      assert.ok(camera.getWorldDirection(new THREE.Vector3()).dot(new THREE.Vector3(...direction).normalize()) < -.999);
    }
  }
  assert.ok(box.equals(original), 'Framing never translates or scales the model bounds');
});

test('framing handles campus-scale, tall and flat objects, asymmetric safe areas and underside views', () => {
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 30000);
  const width = 1200, height = 800, region = {x: 340, y: 180, width: 830, height: 500};
  for (const size of [[3500, 70, 2900], [10, 180, 10], [90, 0, 140], [0, 0, 0]]) {
    const box = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(...size));
    for (const direction of [[.3, .9, 1.1], [.5, -.1, 1], [1, .4, -.5]]) {
      fitInspectionView(camera, box, {width, height, region, direction});
      assertContained(camera, box, width, height, region);
    }
  }
});

test('inspection shadows contain the focus and resolve sub-three-centimeter detail without a larger map', () => {
  const sun = new THREE.DirectionalLight();
  sun.shadow.mapSize.set(4096, 4096);
  const closeup = new THREE.Box3(new THREE.Vector3(-20, 0, -25), new THREE.Vector3(20, 25, 25));
  const focus = fitInspectionShadow(sun, closeup);
  assert.ok(focus.texelMeters < .03);
  assert.ok(sun.shadow.normalBias < .02, 'A meter-scale normal bias erases shallow moulding shadows');
  const depthOffset = -sun.shadow.bias * (sun.shadow.camera.far - sun.shadow.camera.near);
  assert.ok(depthOffset >= focus.texelMeters && depthOffset <= focus.texelMeters * 2,
    'Depth bias must cover the PCF filter footprint without excessive shadow detachment');
  sun.updateMatrixWorld(true);
  sun.shadow.updateMatrices(sun);
  assertContained(sun.shadow.camera, closeup, 4096, 4096, {x: 0, y: 0, width: 4096, height: 4096});
  const overview = new THREE.Box3(new THREE.Vector3(-1700, 0, -1600), new THREE.Vector3(1700, 80, 1600));
  assert.ok(fitInspectionShadow(sun, overview).extent > focus.extent * 20);
  sun.updateMatrixWorld(true);
  sun.shadow.updateMatrices(sun);
  assertContained(sun.shadow.camera, overview, 4096, 4096, {x: 0, y: 0, width: 4096, height: 4096});
  assert.equal(sun.shadow.mapSize.x, 4096);
});

test('invalid framing inputs fail explicitly instead of corrupting the camera', () => {
  const camera = new THREE.PerspectiveCamera();
  const box = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(10, 10, 10));
  const options = {width: 400, height: 700, region: {x: 10, y: 180, width: 380, height: 450}};
  for (const patch of [{width: 0}, {height: NaN}, {padding: -1}, {direction: [0, 0, 0]},
    {region: {...options.region, width: 600}}]) {
    assert.throws(() => fitInspectionView(camera, box, {...options, ...patch}), /Invalid/);
  }
  assert.throws(() => fitInspectionView(camera, new THREE.Box3(), options), /nonempty/);
  assert.throws(() => fitInspectionShadow(new THREE.DirectionalLight(), new THREE.Box3()), /nonempty/);
});

test('orbit clipping preserves distant ground depth separation without cutting the focused object', () => {
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 30000);
  for (const distance of [12, 100, 1000, 5000, 13000]) {
    camera.position.set(0, distance * .6, distance * .8);
    updateInspectionClipping(camera, new THREE.Vector3());
    assert.ok(camera.near <= distance * .021);
    assert.ok(camera.near >= .2);
    const depthStepMeters = distance * distance / (2 ** 24 * camera.near);
    assert.ok(depthStepMeters < .07, `Ground layers need finer-than-7cm precision at ${distance}m`);
  }
  const plan = new THREE.OrthographicCamera(); plan.position.set(0, 5000, 0);
  updateInspectionClipping(plan, new THREE.Vector3());
  assert.equal(plan.near, 1);
  assert.throws(() => updateInspectionClipping(camera, camera.position), /focus distance/);
});
