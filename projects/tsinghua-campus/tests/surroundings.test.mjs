import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import data from '../data/campus.json' with {type: 'json'};
import {createCampusModel} from '../src/model.js';
import {createCampusSurroundings, createSurroundingsLayout} from '../src/surroundings.js';
import {pointInPolygon, segmentDistance} from '../src/geo.js';

const original = JSON.stringify(data), layout = createSurroundingsLayout(data);

test('surroundings are deterministic and never place buildings, streets or trees in the frozen campus', () => {
  assert.deepEqual(createSurroundingsLayout(data), layout);
  assert.equal(JSON.stringify(data), original);
  assert.ok(layout.buildings.length > 1000 && layout.buildings.length < 2400);
  assert.ok(layout.trees.length >= 1800 && layout.trees.length <= 2200);
  assert.ok(layout.trees.filter(tree => tree.edge).length > 400);
  for (const quadrant of [0, 1, 2, 3]) {
    assert.ok(layout.trees.filter(tree => (tree.x < 0 ? 1 : 0) + (tree.z < 0 ? 2 : 0) === quadrant).length > 350);
  }
  for (const building of layout.buildings) {
    const {x, z, width, depth, height} = building, w = width / 2 + .35, d = depth / 2 + .35;
    assert.ok([x, z, width, depth, height].every(Number.isFinite));
    assert.ok(height > 0 && height < 95);
    const footprint = [[[x - w, z - d], [x + w, z - d], [x + w, z + d], [x - w, z + d], [x - w, z - d]]];
    assert.deepEqual(polygonClipping.intersection([footprint], layout.protectedArea), []);
    assert.ok(!layout.buildings.some(other => other !== building &&
      Math.abs(x - other.x) < (width + other.width) / 2 + .7 &&
      Math.abs(z - other.z) < (depth + other.depth) / 2 + .7), 'Background buildings must not intersect each other');
  }
  for (const polygons of [layout.roads, layout.sidewalks]) {
    assert.deepEqual(polygonClipping.intersection(polygons, layout.protectedArea), []);
  }
  for (const tree of layout.trees) {
    assert.ok(!layout.protectedArea.some(polygon => pointInPolygon([tree.x, tree.z], polygon)));
    for (const ring of layout.protectedArea.flatMap(polygon => polygon)) for (let i = 1; i < ring.length; i++) {
      assert.ok(segmentDistance([tree.x, tree.z], ring[i - 1], ring[i]) > tree.radius * 1.3);
    }
    assert.ok(!layout.buildings.some(block =>
      Math.abs(tree.x - block.x) < block.width / 2 + tree.radius * 1.3 &&
      Math.abs(tree.z - block.z) < block.depth / 2 + tree.radius * 1.3));
  }
});

test('background stays outside building roots, has bounded shared resources and releases only its own resources', () => {
  const campus = createCampusModel(data), roots = new Map(campus.buildings);
  const bounds = new THREE.Box3().setFromObject(campus.group);
  const lawn = campus.layers.green.children[0].material;
  const environment = createCampusSurroundings(data, lawn), scene = new THREE.Scene();
  scene.add(campus.group, environment.group);
  assert.deepEqual(campus.buildings, roots);
  assert.ok(new THREE.Box3().setFromObject(campus.group).equals(bounds));
  assert.ok(environment.stats.drawCalls <= 20);
  assert.ok(environment.stats.triangles <= 260000);
  assert.ok(environment.stats.geometryBytes < 2 * 1024 ** 2);
  assert.equal(environment.stats.newTextureBytes, 64 * 64 * 4);
  assert.equal(environment.stats.newTextures, 1);
  const ground = environment.group.getObjectByName('Continuous meadow ground');
  for (const key of ['map', 'normalMap', 'roughnessMap']) assert.equal(ground.material[key], lawn[key]);
  const geometry = new Set(), materials = new Set(), instances = [];
  environment.group.traverse(mesh => {
    assert.equal(mesh.userData.featureId, undefined);
    if (!mesh.isMesh) return;
    assert.equal(mesh.castShadow, false); assert.equal(mesh.receiveShadow, false);
    geometry.add(mesh.geometry); materials.add(mesh.material);
    for (const attribute of Object.values(mesh.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
    if (mesh.isInstancedMesh) {
      instances.push(mesh);
      assert.ok(mesh.instanceMatrix.array.every(Number.isFinite));
      assert.ok(mesh.instanceColor.array.every(Number.isFinite));
      assert.ok(Number.isFinite(mesh.boundingSphere.radius));
    }
    const hits = [];
    mesh.raycast(new THREE.Raycaster(), hits); assert.deepEqual(hits, []);
  });
  const shaders = [...materials].map(material => {
    const shader = {uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader};
    material.onBeforeCompile(shader); return shader;
  });
  assert.equal(new Set(shaders.map(shader => shader.uniforms.backdropAtmosphere)).size, 1);
  environment.update(new THREE.OrthographicCamera());
  assert.ok(shaders.every(shader => shader.uniforms.backdropAtmosphere.value === 0));
  environment.update(new THREE.PerspectiveCamera());
  assert.ok(shaders.every(shader => shader.uniforms.backdropAtmosphere.value === 1));
  let ownedDisposals = 0, borrowedDisposals = 0;
  const owned = new Set([...geometry, ...materials, ...instances, [...materials].find(m => m.name.includes('window bays')).map]);
  owned.forEach(resource => resource.addEventListener('dispose', () => ownedDisposals++));
  [lawn.map, lawn.normalMap, lawn.roughnessMap].forEach(texture => texture.addEventListener('dispose', () => borrowedDisposals++));
  environment.dispose(); environment.dispose();
  assert.equal(ownedDisposals, owned.size); assert.equal(borrowedDisposals, 0);
  assert.equal(environment.group.parent, null); assert.equal(environment.group.children.length, 0);
  assert.deepEqual(campus.buildings, roots);
});

test('missing campus boundary or shared lawn fails explicitly', () => {
  assert.throws(() => createSurroundingsLayout({...data, features: data.features.filter(f => f.properties.kind !== 'campus')}), /boundary/);
  assert.throws(() => createCampusSurroundings(data), /shared campus lawn/);
});
