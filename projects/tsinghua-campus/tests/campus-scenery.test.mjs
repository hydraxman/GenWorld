import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import data from '../data/campus.json' with {type: 'json'};
import {createCampusModel} from '../src/model.js';
import {createCampusScenery, sceneryPlacements, SCENERY_REFERENCE} from '../src/campus-scenery.js';
import {createCampusWaterShader, WATER_REFLECTION_CLIP_BIAS} from '../src/campus-water.js';
import {createCampusSky, campusSkyGLSL, SKY_TEXTURE_SIZE} from '../src/campus-sky.js';
import {createQingmingWillow, prepareQingmingTextures} from '../src/qingming-reuse.js';
import {DAYLIGHT_DIRECTION} from '../src/daylight.js';
import {footprintMetrics, lines, pointInPolygon, project, roadProfile, segmentDistance} from '../src/geo.js';

await prepareQingmingTextures();

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
  assert.deepEqual(shader.uniforms.campusSunDirection.value.toArray(), new THREE.Vector3(...DAYLIGHT_DIRECTION).normalize().toArray());
  assert.match(shader.fragmentShader, /normalize\(campusSunDirection\)/);
  assert.doesNotMatch(shader.fragmentShader, /vec3\(-24\., 43\., 32\.\)/);
  assert.match(shader.fragmentShader, /fwidth\(q\)/);
  assert.match(shader.fragmentShader, /reflectionEnabled/);
  assert.equal(shader.uniforms.campusSky.value, null, 'The viewer injects its one shared sky texture');
  assert.ok(shader.fragmentShader.includes(campusSkyGLSL));
  assert.deepEqual(shader.uniforms.reflectionFade.value.toArray(), [220, 380]);
  assert.match(shader.fragmentShader, /float viewDistance = distance\(eye, worldPosition\)/);
  assert.match(shader.fragmentShader, /smoothstep\(reflectionFade.x, reflectionFade.y, viewDistance\)/);
  assert.match(shader.fragmentShader, /smoothstep\(80\., 320\., viewDistance\)/);
  assert.match(shader.fragmentShader, /mix\(body, reflection, \.55 \+ \.4 \* fresnel\)/,
    'Disabling the local reflection must retain the sky contribution');
  assert.doesNotMatch(shader.fragmentShader, /discard/);
  assert.equal(shader.uniforms.microNormal.value.image.width, 256);
  shader.uniforms.microNormal.value.dispose();
  assert.match(shader.vertexShader, /textureMatrix/);
});

test('one deterministic mipmapped sky panorama contains blue areas and white clouds for sky and water', () => {
  const a = createCampusSky(THREE), b = createCampusSky(THREE), pixels = a.texture.image.data;
  assert.deepEqual(pixels, b.texture.image.data);
  assert.deepEqual([a.texture.image.width, a.texture.image.height], SKY_TEXTURE_SIZE);
  assert.equal(pixels.byteLength, 2 * 1024 * 1024);
  assert.equal(a.texture.colorSpace, THREE.SRGBColorSpace);
  assert.equal(a.texture.generateMipmaps, true);
  assert.equal(a.texture.wrapS, THREE.RepeatWrapping);
  assert.ok(a.texture.userData.sharedCampusSurface);
  assert.equal(a.sky.material.uniforms.campusSky.value, a.texture);
  assert.ok(a.sky.material.fragmentShader.includes(campusSkyGLSL));
  let blue = 0, white = 0;
  for (let i = pixels.length / 2; i < pixels.length; i += 4) {
    if (pixels[i + 2] > pixels[i] + 50) blue++;
    if (pixels[i] > 210 && pixels[i + 2] - pixels[i] < 15) white++;
  }
  const count = SKY_TEXTURE_SIZE[0] * SKY_TEXTURE_SIZE[1] / 2;
  assert.ok(blue > count * .1 && white > count * .01, `Missing blue/white sky structure: ${blue}/${white}`);
  for (const {sky, texture} of [a, b]) {sky.geometry.dispose(); sky.material.dispose(); texture.dispose();}
});

test('planar reflection clips the ground below water rather than reflecting a dark green screen', () => {
  const reflector = new Reflector(new THREE.PlaneGeometry(1, 1), {clipBias: WATER_REFLECTION_CLIP_BIAS});
  reflector.rotation.x = -Math.PI / 2; reflector.position.y = .12; reflector.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(40, 1.6, .1, 30000);
  camera.position.set(-555, 22, 275); camera.lookAt(-585, 0, 220); camera.updateMatrixWorld(true);
  let captures = 0;
  const renderer = {xr: {enabled: false}, shadowMap: {autoUpdate: false}, autoClear: true,
    state: {buffers: {depth: {setMask() {}}}}, getRenderTarget: () => null, setRenderTarget() {},
    render(scene, reflected) {
      captures++;
      for (const z of [220, 0, -500, -1500]) {
        assert.ok(new THREE.Vector3(-585, .07, z).project(reflected).z < -1, `Grass at z=${z} leaked into the reflection`);
        assert.ok(new THREE.Vector3(-585, .2, z).project(reflected).z > -1, `Above-water geometry at z=${z} was clipped`);
      }
    }};
  reflector.onBeforeRender(renderer, new THREE.Scene(), camera);
  assert.equal(captures, 1);
  reflector.geometry.dispose(); reflector.dispose();
});
