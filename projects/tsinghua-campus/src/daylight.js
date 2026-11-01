import * as THREE from 'three';
import {createCampusSky} from './campus-sky.js';

export const DAYLIGHT_DIRECTION = [.55, .9, .75];

export function createCampusDaylight(renderer, scene) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor('#87c4ee');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const {sky, texture: skyTexture} = createCampusSky(THREE);
  const environmentScene = new THREE.Scene();
  environmentScene.add(sky);
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(environmentScene, .04, .1, 20000);
  scene.environment = environment.texture;
  scene.environmentIntensity = .12;
  environmentScene.remove(sky);
  scene.add(sky);
  generator.dispose();
  const fill = new THREE.HemisphereLight('#dfedff', '#b6aea0', .8);
  const sun = new THREE.DirectionalLight('#fff4e3', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  scene.add(fill, sun, sun.target);
  return {sun, skyTexture};
}
