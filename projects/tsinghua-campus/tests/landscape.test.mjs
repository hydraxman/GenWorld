import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import data from '../data/campus.json' with {type: 'json'};
import evidence from '../data/landscape-evidence.json' with {type: 'json'};
import {landscapeEvidence} from '../scripts/landscape-evidence.mjs';
import {createCampusModel} from '../src/model.js';
import {applyCampusLandscape, disposeCampusLandscape} from '../src/landscape.js';

test('sports and trees replay exactly from whitelisted frozen OSM, excluding buildings and outside school grounds', async () => {
  assert.deepEqual(await landscapeEvidence(), evidence);
  assert.equal(evidence.grounds.length, 41); assert.equal(evidence.trees.length, 66);
  assert.equal(new Set(evidence.grounds.map(ground => ground.id)).size, 41);
  for (const id of ['32954674', '32954848', '32954864']) assert.ok(evidence.grounds.some(ground => ground.id === `osm:way:${id}`));
  assert.ok(!evidence.grounds.some(ground => ['osm:way:84832395', 'osm:way:32954637'].includes(ground.id)));
  assert.match(evidence.limitations, /not a current survey/);
  for (const ground of evidence.grounds) {
    assert.deepEqual(Object.keys(ground).sort(), ['geometry', 'id', 'leisure', 'name', 'sourceGeometry', 'sport']);
    assert.equal(ground.geometry.type, 'MultiPolygon');
  }
});

test('landscape retains650 building identities with bounded finite sports batches and instanced original trees', () => {
  const frozen = JSON.stringify(data), campus = createCampusModel(data);
  const originalRoots = new Map(campus.buildings);
  const stats = applyCampusLandscape(campus, data);
  assert.equal(stats.grounds, 41); assert.ok(stats.trees >= 300 && stats.trees <= 650);
  assert.equal(stats.mappedTrees + stats.excludedMappedTrees, evidence.trees.length);
  assert.equal(stats.mappedTrees + stats.illustrativeTrees, stats.trees);
  assert.deepEqual(campus.buildings, originalRoots); assert.equal(campus.buildings.size, 650);
  assert.equal(campus.layers.trees.children.length, 2);
  assert.ok(campus.layers.trees.children.every(mesh => mesh.isInstancedMesh));
  assert.ok(campus.layers.sports.children.length <= 5);
  let triangles = 0;
  for (const layer of [campus.layers.trees, campus.layers.sports]) layer.traverse(object => {
    if (!object.isMesh) return;
    for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.count ?? 1);
    assert.ok(new THREE.Box3().setFromObject(object).isEmpty() === false);
  });
  assert.ok(triangles < 200000, `Landscape geometry exceeds budget: ${triangles}`);
  assert.ok(campus.layers.trees.userData.trees.every(tree => /^(?:mapped-tree|illustrative-green-area-planting)$/.test(tree.basis)));
  assert.throws(() => applyCampusLandscape(campus, data), /Dispose/);
  assert.equal(JSON.stringify(data), frozen);
  const meshes = [...campus.layers.sports.children, ...campus.layers.trees.children];
  const disposed = [];
  meshes.forEach(mesh => mesh.geometry.addEventListener('dispose', () => disposed.push(mesh)));
  disposeCampusLandscape(campus);
  assert.equal(disposed.length, meshes.length);
  assert.equal(campus.layers.sports, undefined); assert.equal(campus.layers.trees, undefined);
  assert.equal(campus.sports, undefined);
});
