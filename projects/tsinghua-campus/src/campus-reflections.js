import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {installGlassReflections} from '../../../shared/glass-reflections.js';
import {CAMPUS_WATER_COLOR, WATER_REFLECTION_FADE, WATER_REFLECTION_CLIP_BIAS, createCampusWaterShader} from './campus-water.js';
import {campusGlass, installCourtyardSurfaces} from './courtyard-surfaces.js';

export function installCampusReflections(renderer, scene, campus, {compact = false, skyTexture} = {}) {
  if (!skyTexture?.isTexture) throw new Error('Campus water requires the shared daylight sky texture.');
  const sun = scene.children.find(object => object.isDirectionalLight);
  if (!sun) throw new Error('Campus water requires the shared daylight sun.');
  const finishes = installCourtyardSurfaces(campus), resolution = compact ? 256 : 512;
  const waterMeshes = campus.layers.water.children.filter(mesh => mesh.isMesh);
  if (waterMeshes.length !== 1) throw new Error('Campus reflection expects the single merged frozen water surface.');
  const originalWater = waterMeshes[0], geometry = originalWater.geometry.clone();
  geometry.translate(0, -.12, 0); geometry.rotateX(Math.PI / 2);
  const reflector = new Reflector(geometry, {shader: createCampusWaterShader(THREE), color: CAMPUS_WATER_COLOR,
    textureWidth: resolution, textureHeight: resolution, multisample: 0, clipBias: WATER_REFLECTION_CLIP_BIAS});
  const water = new THREE.Mesh(geometry, reflector.material);
  water.isReflector = true;
  water.rotation.x = -Math.PI / 2; water.position.y = .12;
  water.name = originalWater.name; water.userData = {...originalWater.userData, campusPlanarWater: true};
  water.material.polygonOffset = originalWater.material.polygonOffset;
  water.material.polygonOffsetFactor = originalWater.material.polygonOffsetFactor;
  water.material.polygonOffsetUnits = originalWater.material.polygonOffsetUnits;
  water.material.uniforms.reflectionEnabled.value = 0;
  water.material.uniforms.campusSky.value = skyTexture;
  const capture = reflector.onBeforeRender;
  // The one merged surface keeps every polygon/hole. Capturing is explicitly scheduled,
  // never triggered recursively by a probe, AO pass or another scene render.
  water.onBeforeRender = () => {};
  campus.layers.water.remove(originalWater); campus.layers.water.add(water);
  const exportWater = new THREE.MeshPhysicalMaterial({name: 'Mapped blue-green water; viewer adds shared planar reflection',
    color: CAMPUS_WATER_COLOR, roughness: .16, metalness: 0, clearcoat: 1, clearcoatRoughness: .15, side: THREE.DoubleSide});
  const glass = installGlassReflections(THREE, renderer, scene, campus.group, {
    isGlass: campusGlass, resolution: compact ? 64 : 128, far: 700, intensity: 2.2, roughness: .09, metalness: 0,
    physical: true, colorScale: .65,
    position: [0, 6, 0],
  });
  const stats = {waterTargets: 1, waterResolution: resolution, waterCaptures: 0, waterPasses: 0,
    waterLastDrawCalls: 0, waterEnabled: false, waterTime: 0, maxWaterHz: 8, maxGlassHz: 1,
    glass: glass.stats};
  const metalFallbacks = new Map();
  let enabled = true, revision = -1, lastWaterKey = '', lastWater = -Infinity;
  let lastGlassKey = '', lastGlass = -Infinity, wakeAt = Infinity;
  const viewProjection = new THREE.Matrix4(), frustum = new THREE.Frustum();
  const reflectionCamera = new THREE.PerspectiveCamera();
  function refresh() {
    if (revision === campus.architectureRevision) return;
    finishes.refresh(); glass.refresh(); revision = campus.architectureRevision;
    campus.group.traverse(object => {
      if (!object.isMesh) return;
      for (const material of [].concat(object.material)) if (material.userData.campusMetalReflection && scene.environment) {
        if (!metalFallbacks.has(material)) metalFallbacks.set(material, material.clone());
        // The lighting rig, not an individual building, owns the shared environment.
        scene.environment.userData.sharedCampusSurface = true;
        material.envMap = scene.environment;
        material.envMapIntensity = .9;
        material.needsUpdate = true;
      }
    });
  }
  function update(camera, close, force = false) {
    if (scene.overrideMaterial) return;
    water.material.uniforms.campusSunDirection.value.copy(sun.position).sub(sun.target.position).normalize();
    water.material.uniforms.campusSunColor.value.copy(sun.color);
    water.material.uniforms.campusSunIntensity.value = sun.intensity;
    const now = performance.now();
    close = close && enabled;
    wakeAt = Infinity;
    refresh();
    const visible = ['building', 'trees', 'water', 'riverbanks', 'streetscape'].map(key => campus.layers[key].visible).join();
    const glassKey = `${Math.round(camera.position.x / 60)},${Math.round(camera.position.z / 60)},${visible},${revision}`;
    glass.setEnabled(Boolean(close));
    if (close && (force || glassKey !== lastGlassKey)) {
      if (force || now - lastGlass >= 1000) {
        glass.setPosition(new THREE.Vector3(camera.position.x, Math.max(5, Math.min(12, camera.position.y)), camera.position.z));
        glass.invalidate();
        glass.update(camera); lastGlass = now; lastGlassKey = glassKey;
      } else wakeAt = Math.min(wakeAt, lastGlass + 1000);
    }
    camera.updateMatrixWorld(true); water.updateMatrixWorld(true);
    reflector.matrixWorld.copy(water.matrixWorld);
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewProjection);
    const active = Boolean(close && camera.isPerspectiveCamera && camera.position.y > .13
      && camera.position.y - water.position.y < WATER_REFLECTION_FADE[1]
      && campus.layers.water.visible && frustum.intersectsObject(water));
    stats.waterEnabled = active;
    water.material.uniforms.eye.value.copy(camera.position);
    if (!active) {water.material.uniforms.reflectionEnabled.value = 0; lastWaterKey = ''; return;}
    const key = `${camera.matrixWorld.elements.join()},${camera.projectionMatrix.elements.join()},${visible},${revision},${Math.floor(stats.waterTime * 2)}`;
    if (!force && key === lastWaterKey) return;
    if (!force && now - lastWater < 125) {wakeAt = Math.min(wakeAt, lastWater + 125); return;}
    const target = renderer.getRenderTarget(), xr = renderer.xr.enabled;
    const shadowAuto = renderer.shadowMap.autoUpdate, shadowNeeds = renderer.shadowMap.needsUpdate;
    const shadowEnabled = renderer.shadowMap.enabled, autoReset = renderer.info.autoReset;
    const oldCalls = renderer.info.render.calls, visibleWater = water.visible;
    const hidden = [];
    scene.traverse(object => {
      if (object.isReflector || object.isBox3Helper) {hidden.push([object, object.visible]); object.visible = false;}
    });
    try {
      renderer.info.autoReset = false; renderer.shadowMap.enabled = false;
      renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
      reflectionCamera.copy(camera, false);
      // Reflector reverses the horizontal camera basis; mirror the off-axis principal point too.
      reflectionCamera.projectionMatrix.elements[8] *= -1;
      reflectionCamera.projectionMatrixInverse.copy(reflectionCamera.projectionMatrix).invert();
      capture.call(reflector, renderer, scene, reflectionCamera);
      water.material.uniforms.reflectionEnabled.value = 1;
      stats.waterCaptures++; stats.waterPasses++; stats.waterLastDrawCalls = renderer.info.render.calls - oldCalls;
      lastWater = now; lastWaterKey = key;
    } finally {
      hidden.forEach(([object, visible]) => {object.visible = visible;}); water.visible = visibleWater;
      renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = shadowAuto; renderer.shadowMap.needsUpdate = shadowNeeds;
      renderer.shadowMap.enabled = shadowEnabled; renderer.info.autoReset = autoReset; renderer.setRenderTarget(target);
    }
  }
  return {update, refresh, pending: () => performance.now() >= wakeAt,
    setTime(time) {
      if (!Number.isFinite(time) || time < 0) throw new RangeError('Water time must be finite and non-negative.');
      water.material.uniforms.time.value = time; stats.waterTime = time;
    },
    setEnabled(value) {enabled = Boolean(value); lastGlassKey = ''; lastWaterKey = '';},
    invalidate() {lastGlassKey = ''; lastWaterKey = '';},
    stats: () => ({...stats, surfaces: finishes.stats()}),
    prepareExport(object) {
      glass.prepareExport(object);
      object.traverse(mesh => {
        if (mesh.userData.campusPlanarWater) mesh.material = exportWater;
        else if (mesh.isMesh) mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(material => metalFallbacks.get(material) || material)
          : metalFallbacks.get(mesh.material) || mesh.material;
      });
    },
    dispose() {
      for (const [material, fallback] of metalFallbacks) {
        material.envMap = fallback.envMap; material.envMapIntensity = fallback.envMapIntensity;
        material.needsUpdate = true; fallback.dispose();
      }
      metalFallbacks.clear();
      glass.dispose(); finishes.dispose(); water.material.uniforms.microNormal.value.dispose();
      reflector.dispose(); geometry.dispose(); exportWater.dispose();
      campus.layers.water.remove(water); campus.layers.water.add(originalWater);
    }};
}
