import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {installGlassReflections} from '../../../shared/glass-reflections.js';
import {createWaterShader, WATER_COLOR} from '../../courtyard/src/water.js';
import {campusGlass, installCourtyardSurfaces} from './courtyard-surfaces.js';

export function installCampusReflections(renderer, scene, campus, {compact = false} = {}) {
  const finishes = installCourtyardSurfaces(campus), resolution = compact ? 256 : 512;
  const waterMeshes = campus.layers.water.children.filter(mesh => mesh.isMesh);
  if (waterMeshes.length !== 1) throw new Error('Campus reflection expects the single merged frozen water surface.');
  const originalWater = waterMeshes[0], geometry = originalWater.geometry.clone();
  geometry.translate(0, -.12, 0); geometry.rotateX(Math.PI / 2);
  const reflector = new Reflector(geometry, {shader: createWaterShader(THREE), color: WATER_COLOR,
    textureWidth: resolution, textureHeight: resolution, multisample: 0, clipBias: .002});
  const water = new THREE.Mesh(geometry, reflector.material);
  water.isReflector = true;
  water.rotation.x = -Math.PI / 2; water.position.y = .12;
  water.name = originalWater.name; water.userData = {...originalWater.userData, campusPlanarWater: true};
  water.material.polygonOffset = originalWater.material.polygonOffset;
  water.material.polygonOffsetFactor = originalWater.material.polygonOffsetFactor;
  water.material.polygonOffsetUnits = originalWater.material.polygonOffsetUnits;
  water.material.uniforms.reflectionEnabled.value = 0;
  const capture = reflector.onBeforeRender;
  // The one merged surface keeps every polygon/hole. Capturing is explicitly scheduled,
  // never triggered recursively by a probe, AO pass or another scene render.
  water.onBeforeRender = () => {};
  campus.layers.water.remove(originalWater); campus.layers.water.add(water);
  const exportWater = new THREE.MeshPhysicalMaterial({name: 'Mapped blue-green water; viewer adds shared planar reflection',
    color: WATER_COLOR, roughness: .16, metalness: 0, clearcoat: 1, clearcoatRoughness: .15, side: THREE.DoubleSide});
  const glass = installGlassReflections(THREE, renderer, scene, campus.group, {
    isGlass: campusGlass, resolution: compact ? 64 : 128, far: 700, intensity: 2.2, roughness: .09, metalness: 0,
    physical: true, colorScale: .65,
    position: [0, 6, 0],
  });
  const stats = {waterTargets: 1, waterResolution: resolution, waterCaptures: 0, waterPasses: 0,
    waterLastDrawCalls: 0, waterEnabled: false, waterTime: 0, maxWaterHz: 8, maxGlassHz: 1,
    glass: glass.stats};
  let enabled = true, revision = campus.architectureRevision, lastWaterKey = '', lastWater = -Infinity;
  let lastGlassKey = '', lastGlass = -Infinity, wakeAt = Infinity;
  const viewProjection = new THREE.Matrix4(), frustum = new THREE.Frustum();
  function refresh() {
    if (revision === campus.architectureRevision) return;
    finishes.refresh(); glass.refresh(); revision = campus.architectureRevision;
  }
  function update(camera, close, force = false) {
    if (scene.overrideMaterial) return;
    const now = performance.now();
    close = close && enabled;
    wakeAt = Infinity;
    refresh();
    const visible = ['building', 'trees', 'water'].map(key => campus.layers[key].visible).join();
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
      && campus.layers.water.visible && frustum.intersectsObject(water));
    stats.waterEnabled = active;
    water.material.uniforms.eye.value.copy(camera.position);
    if (!active) {water.material.uniforms.reflectionEnabled.value = 0; lastWaterKey = ''; return;}
    const key = `${camera.matrixWorld.elements.join()},${camera.projectionMatrix.elements.join()},${visible},${revision}`;
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
      capture.call(reflector, renderer, scene, camera);
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
    setEnabled(value) {enabled = Boolean(value); lastGlassKey = ''; lastWaterKey = '';},
    invalidate() {lastGlassKey = ''; lastWaterKey = '';},
    stats: () => ({...stats, surfaces: finishes.stats()}),
    prepareExport(object) {
      glass.prepareExport(object);
      object.traverse(mesh => {if (mesh.userData.campusPlanarWater) mesh.material = exportWater;});
    },
    dispose() {
      glass.dispose(); finishes.dispose(); reflector.dispose(); geometry.dispose(); exportWater.dispose();
      campus.layers.water.remove(water); campus.layers.water.add(originalWater);
    }};
}
