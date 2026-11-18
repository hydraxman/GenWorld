import * as THREE from 'three';
import {createCampusSky} from './campus-sky.js';
import {campusWeather} from './campus-weather.js';

export const DAYLIGHT_DIRECTION = campusWeather('clear').direction;

export function createCampusDaylight(renderer, scene, initialWeather = 'clear') {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor('#87c4ee');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const {sky, texture: skyTexture, setWeather: paintSky} = createCampusSky(THREE, initialWeather);
  const environmentScene = new THREE.Scene();
  const skyCopy = sky.clone();
  environmentScene.add(skyCopy);
  const cube = new THREE.WebGLCubeRenderTarget(128, {type: THREE.HalfFloatType, depthBuffer: false});
  const capture = new THREE.CubeCamera(.1, 20000, cube);
  const generator = new THREE.PMREMGenerator(renderer);
  scene.add(sky);
  const fill = new THREE.HemisphereLight('#dfedff', '#b6aea0', .8);
  const sun = new THREE.DirectionalLight('#fff4e3', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  scene.add(fill, sun, sun.target);
  let environment, current;
  function setWeather(id) {
    const p = campusWeather(id);
    if (current === id) return;
    paintSky(id);
    capture.update(renderer, environmentScene);
    // Reuse the PMREM target: glass/metal fallbacks can retain this texture across switches.
    environment = generator.fromCubemap(cube.texture, environment);
    scene.environment = environment.texture;
    scene.environmentIntensity = p.environment;
    renderer.toneMappingExposure = p.exposure;
    renderer.setClearColor(p.sky.horizon);
    fill.color.set(p.fill[0]); fill.groundColor.set(p.fill[1]); fill.intensity = p.fill[2];
    sun.color.set(p.sun[0]); sun.intensity = p.sun[1];
    sun.position.copy(sun.target.position).add(new THREE.Vector3(...p.direction).normalize());
    sun.shadow.intensity = p.shadow;
    current = id;
  }
  setWeather(initialWeather);
  return {sun, skyTexture, setWeather, dispose() {
    scene.environment = null; environment.dispose(); cube.dispose(); generator.dispose();
    sky.geometry.dispose(); sky.material.dispose(); skyTexture.dispose(); sun.dispose();
  }};
}
