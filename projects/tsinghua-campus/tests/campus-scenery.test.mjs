import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import data from '../data/campus.json' with {type: 'json'};
import {createCampusModel} from '../src/model.js';
import {createCampusScenery, sceneryPlacements, SCENERY_REFERENCE} from '../src/campus-scenery.js';
import {createCampusWaterShader} from '../src/campus-water.js';
import {createQingmingWillow} from '../src/qingming-reuse.js';
import {footprintMetrics, lines, pointInPolygon, project, roadProfile, segmentDistance} from '../src/geo.js';

test('illustrative street life is deterministic, on safe mapped paths and outside water/buildings', () => {
  const original = JSON.stringify(data), placements = sceneryPlacements(data);
  assert.deepEqual(placements, sceneryPlacements(data));
  assert.equal(JSON.stringify(data), original);
  const blocked = data.features.filter(feature => ['building', 'water'].includes(feature.properties.kind) &&
    feature.geometry.type.includes('Polygon')).flatMap(feature => footprintMetrics(feature.geometry, data.metadata.center).projected);
  const campus = data.features.filter(feature => feature.properties.kind === 'campus')
    .flatMap(feature => footprintMetrics(feature.geometry, data.metadata.center).projected);
  for (const [key, entries] of Object.entries(placements)) {
    assert.ok(entries.length >= (key === 'willows' ? 1 : 20), `Empty scenery population: ${key}`);
    for (const entry of entries) {
      assert.ok(entry.position.every(Number.isFinite));
      assert.ok(campus.some(polygon => pointInPolygon(entry.position, polygon)));
      assert.ok(!blocked.some(polygon => pointInPolygon(entry.position, polygon)), `${key} intrudes into a building or water`);
      assert.match(entry.basis, /^illustrative-/);
      const source = data.features.find(feature => feature.id === entry.sourceId);
      assert.ok(source);
      if (key === 'people') {
        const {height, brunnel, width} = roadProfile(source);
        assert.ok(brunnel !== 'bridge' && brunnel !== 'tunnel');
        assert.equal(entry.height, height);
        const paths = lines(source.geometry).map(line => line.map(point => project(point, data.metadata.center)));
        assert.ok(paths.some(line => line.slice(1).some((b, i) => segmentDistance(entry.position, line[i], b) < width / 2)));
        assert.ok(entry.scale >= .90 && entry.scale <= 1.06);
      }
    }
  }
  assert.ok(placements.people.length >= 180 && placements.people.length <= 240);
  assert.ok(placements.banks.length <= 2600);
  assert.match(SCENERY_REFERENCE.revision, /^[a-f0-9]{40}$/);
});

test('near scenery is finite, bounded, independent of building roots and fully disposable', () => {
  const campus = createCampusModel(data), roots = new Map(campus.buildings);
  const before = campus.layers.water.children[0].geometry.attributes.position.array.slice();
  const scenery = createCampusScenery(campus, data, []);
  assert.deepEqual(campus.buildings, roots);
  assert.deepEqual(campus.layers.water.children[0].geometry.attributes.position.array, before);
  const camera = new THREE.PerspectiveCamera(45, 1.5, .1, 2000);
  camera.position.set(-545, 16, 300); camera.lookAt(-545, 0, 250);
  scenery.update(camera, false);
  assert.ok(scenery.stats().visible.banks > 0);
  assert.ok(scenery.stats().visible.people <= 72);
  assert.ok(scenery.stats().drawCalls <= 12);
  scenery.update(camera, true);
  assert.ok(scenery.stats().visible.people <= 36);
  assert.ok(scenery.stats().visible.banks <= 500);
  const meshes = [...campus.layers.streetscape.children, ...campus.layers.riverbanks.children];
  for (const mesh of meshes) {
    assert.ok(mesh.isInstancedMesh);
    for (const attribute of Object.values(mesh.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
    assert.ok((mesh.geometry.index.count / 3) < 1600);
    assert.ok(mesh.instanceMatrix.array.every(Number.isFinite));
  }
  campus.layers.water.visible = false; campus.layers.road.visible = false;
  scenery.update(camera, false);
  assert.ok(Object.values(scenery.stats().visible).every(count => count === 0));
  campus.layers.water.visible = true; campus.layers.road.visible = true;
  scenery.update(new THREE.OrthographicCamera(-500, 500, 500, -500, 1, 5000), false);
  assert.ok(Object.values(scenery.stats().visible).every(count => count === 0));
  let geometryDisposals = 0, materialDisposals = 0, instanceDisposals = 0, textureDisposals = 0;
  const materials = new Set(meshes.flatMap(mesh => [mesh.material, mesh.customDepthMaterial]).filter(Boolean));
  const textures = new Set([...materials].map(material => material.map).filter(Boolean));
  materials.forEach(material => material.addEventListener('dispose', () => materialDisposals++));
  textures.forEach(texture => texture.addEventListener('dispose', () => textureDisposals++));
  meshes.forEach(mesh => {
    mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
    mesh.addEventListener('dispose', () => instanceDisposals++);
  });
  scenery.dispose();
  assert.equal(geometryDisposals, meshes.length); assert.equal(instanceDisposals, meshes.length);
  assert.equal(materialDisposals, materials.size); assert.equal(textureDisposals, 1);
  assert.equal(campus.layers.streetscape, undefined); assert.equal(campus.layers.riverbanks, undefined);
  assert.deepEqual(campus.buildings, roots);
});

test('direct willow reuse preserves original leaf atlas, source tint and shared wind/depth time', () => {
  const willow = createQingmingWillow();
  assert.equal(willow.parts.length, 4);
  const leaves = willow.parts.filter(part => part.material.map);
  assert.equal(leaves.length, 3);
  assert.equal(new Set(leaves.map(part => part.material.map)).size, 1);
  const texture = leaves[0].material.map;
  assert.equal(texture.image.width, 512); assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  const uniforms = [];
  for (const part of willow.parts) {
    assert.ok(part.material.color.g > part.material.color.b, 'Auto1 must inherit the original source palette, not default white');
    assert.ok(part.material.color.r < .4);
    for (const material of [part.material, part.depthMaterial]) {
      const shader = {uniforms: {}, vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>'};
      material.onBeforeCompile(shader);
      assert.match(shader.vertexShader, /transformed\.xz\+=breezeAt/);
      uniforms.push(shader.uniforms.detailTime);
    }
    part.geometry.dispose();
  }
  assert.equal(new Set(uniforms).size, 1);
  willow.setTime(2.5);
  assert.ok(uniforms.every(uniform => uniform.value === 2.5));
  willow.dispose();
});

test('campus water remains deterministic and filters fine ripples rather than adding simulation targets', () => {
  const shader = createCampusWaterShader(THREE);
  assert.equal(shader.uniforms.time.value, 0);
  assert.match(shader.fragmentShader, /fwidth\(q\)/);
  assert.match(shader.fragmentShader, /reflectionEnabled/);
  assert.doesNotMatch(shader.fragmentShader, /discard/);
  assert.equal(shader.uniforms.microNormal.value.image.width, 256);
  shader.uniforms.microNormal.value.dispose();
  assert.match(shader.vertexShader, /textureMatrix/);
});
