import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLabExhibit} from './exhibit.js';
import {initialExperiment, stepMarkov} from './experiments.js';
import {createTeachingRoom, SHUNDE_STANDS, SHUNDE_STAND_OBSTACLES} from '../../projects/tsinghua-campus/src/knowledge-hall.js';
import {visitorCanStand, stepVisitor} from '../../projects/tsinghua-campus/src/walkthrough.js';
import {setLabViewport} from './camera.js';

test('exhibits lift within the existing Shunde ceiling and release owned geometry', () => {
  for (const id of ['graph', 'list', 'markov']) {
    const view = createLabExhibit(id, {labels: false});
    const before = new THREE.Box3().setFromObject(view.root);
    view.expand(true); view.settle();
    const after = new THREE.Box3().setFromObject(view.root);
    assert.equal(view.snapshot().lift, .7);
    assert.ok(after.max.y > before.max.y);
    assert.ok(after.max.y + .9 < 4.22);
    let meshes = 0, triangles = 0, disposed = 0;
    view.root.traverse(object => {
      if (!object.isMesh) return;
      meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      object.geometry.addEventListener('dispose', () => {disposed++;});
    });

    assert.ok(meshes < 70); assert.ok(triangles < 20000);
    if (id === 'markov') {
      view.sync(stepMarkov(initialExperiment(id))); view.settle();
      assert.equal(view.root.getObjectByName('markov-frog').children.length, 10);
    }
    view.dispose(); assert.equal(disposed, meshes);
  }
});

test('runtime room linings fit the existing ceiling and leave the actual entry clear', () => {
  const room = createTeachingRoom({labels: false});
  room.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(room);
  assert.ok(bounds.max.y <= 4.22);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 2.55, 4.5), new THREE.Vector3(0, 0, -1), 0, 7.7);
  assert.equal(ray.intersectObject(room, true).length, 0);
  const back = room.getObjectByName('interior-back-lining');
  assert.ok(new THREE.Box3().setFromObject(back).max.z > -5.685, 'Lining covers the original lobby notice, not behind it');
});

test('Shunde exhibit tables preserve an open entrance and center aisle', () => {
  assert.equal(SHUNDE_STANDS.length, 3);
  const spec = {zones: [{min: [-5.5, -5.7], max: [5.5, .85], floor: .9}], obstacles: SHUNDE_STAND_OBSTACLES};
  for (const point of [[0, .5], [0, -1], [-1.3, -1], [1.3, -1]]) assert.ok(visitorCanStand(spec, point));
  for (const {x, z} of SHUNDE_STANDS) assert.equal(visitorCanStand(spec, [x, z]), false);
  assert.ok(stepVisitor(spec, [0, .5], [0, -10])[1] > -3, 'Visitor stops before the pond stand');
});

test('focused 3D center occupies the uncovered canvas region at desktop and mobile sizes', () => {
  for (const [width, height] of [[1600, 1000], [390, 844], [320, 700]]) {
    const camera = new THREE.PerspectiveCamera(60, width / height, .05, 100);
    camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    const region = setLabViewport(camera, width, height);
    const point = new THREE.Vector3().project(camera);
    assert.ok(Math.abs((point.x + 1) * width / 2 - (region.x + region.width / 2)) < .001);
    assert.ok(Math.abs((1 - point.y) * height / 2 - (region.y + region.height / 2)) < .001);
  }
});
