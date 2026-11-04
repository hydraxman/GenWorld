import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createTeachingRoom} from '../src/knowledge-hall.js';
import {disposeExhibitTree, createLabExhibit} from '../../../shared/knowledge-labs/exhibit.js';
import {ANATOMY_FINISHES} from '../../../shared/knowledge-labs/anatomy-finishes.js';

for (const kind of ['shunde', 'jianhua']) test(`${kind} finishes use separate AO, bounded soft lights and fully owned resources`, () => {
  const room = createTeachingRoom({kind, labels: false}), geometry = new Set(), materials = new Set(), instances = new Set();
  const floor = room.getObjectByName('inset-teaching-floor');
  assert.equal(floor.material.aoMap.channel, 1);
  assert.equal(floor.material.aoMap.colorSpace, THREE.NoColorSpace);
  assert.equal(floor.geometry.attributes.uv1.count, floor.geometry.attributes.position.count);
  const pixels = floor.material.aoMap.image.data;
  assert.ok(Math.min(...pixels) < 150 && Math.max(...pixels) === 255);
  assert.equal(room.children.filter(object => object.isRectAreaLight).length, 3);
  assert.ok(room.children.filter(object => object.isLight).every(light => !light.castShadow));
  assert.ok(room.userData.finishStats.triangles < 2000);
  assert.ok(room.userData.finishStats.meshes <= 30);
  if (kind === 'jianhua') {
    assert.equal(room.getObjectByName('acoustic-ceiling'), undefined, 'Keep the tall atrium open');
    assert.equal(room.getObjectByName('interior-side-lining'), undefined, 'Do not wall off the open sides');
  }
  for (const x of [-.4, 0, .4]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, kind === 'shunde' ? 2.55 : 2.1, 4.5), new THREE.Vector3(0, 0, -1), 0, 7.7);
    room.updateMatrixWorld(true);
    assert.equal(ray.intersectObject(room, true).length, 0, 'Finishes must not obstruct the original entry');
  }
  room.traverse(mesh => {
    if (!mesh.isMesh) return;
    geometry.add(mesh.geometry); materials.add(mesh.material);
    for (const attribute of Object.values(mesh.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
    if (mesh.isInstancedMesh) {
      instances.add(mesh);
      assert.ok(mesh.instanceMatrix.array.every(Number.isFinite));
      if (mesh.name === 'oak-acoustic-slats') {
        assert.equal(mesh.userData.meterUV, true);
        const uv = mesh.geometry.attributes.uv, index = mesh.geometry.index;
        for (let i = 0; i < index.count; i += 3) {
          const [a, b, c] = [0, 1, 2].map(offset => index.getX(i + offset));
          const area = (uv.getX(b) - uv.getX(a)) * (uv.getY(c) - uv.getY(a)) -
            (uv.getY(b) - uv.getY(a)) * (uv.getX(c) - uv.getX(a));
          assert.ok(Math.abs(area) > 1e-6, 'End faces need non-degenerate UVs too');
        }
      }
    }
  });
  const resources = new Set([...geometry, ...materials, ...instances, floor.material.aoMap]);
  let disposed = 0;
  for (const resource of resources) resource.addEventListener('dispose', () => {disposed++;});
  disposeExhibitTree(room);
  assert.equal(disposed, resources.size);
});

test('bevels, basin rims and separated pointer fields retain the same exhibit envelope', () => {
  for (const id of ['graph', 'list', 'markov']) {
    const exhibit = createLabExhibit(id, {labels: false});
    const table = exhibit.root.getObjectByName('exhibit-table');
    assert.equal(table.geometry.type, 'RoundedBoxGeometry');
    assert.ok(table.geometry.parameters.radius <= table.geometry.parameters.height / 2);
    assert.equal(exhibit.root.getObjectByName('table-edge-reveal').material.color.getHexString(),
      ANATOMY_FINISHES.gold.slice(1));
    if (id === 'markov') {
      assert.ok(exhibit.root.getObjectByName('pond-rim'));
      assert.equal(exhibit.root.getObjectByName('lily-pad-0').geometry.type, 'ExtrudeGeometry');
    }
    if (id === 'list') assert.ok(exhibit.root.getObjectByName('list-pointer-field-n1'));
    exhibit.expand(true); exhibit.settle();
    assert.ok(new THREE.Box3().setFromObject(exhibit.root).max.y + .9 < 4.22);
    exhibit.dispose();
  }
});
