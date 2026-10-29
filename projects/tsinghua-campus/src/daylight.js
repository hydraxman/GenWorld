import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';

export const DAYLIGHT_DIRECTION = [.55, .9, .75];

export function createCampusDaylight(renderer, scene) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor('#dce7ed');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const sky = new Sky();
  sky.scale.setScalar(10000);
  sky.material.uniforms.turbidity.value = 3;
  sky.material.uniforms.rayleigh.value = 1.2;
  sky.material.uniforms.mieCoefficient.value = .005;
  sky.material.uniforms.sunPosition.value.set(...DAYLIGHT_DIRECTION).normalize();
  const environmentScene = new THREE.Scene();
  environmentScene.add(sky);
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(environmentScene, .04, .1, 20000);
  scene.environment = environment.texture;
  scene.environmentIntensity = .12;
  environmentScene.remove(sky);
  sky.scale.setScalar(450000);
  scene.add(sky);
  generator.dispose();
  const fill = new THREE.HemisphereLight('#dfedff', '#b6aea0', .8);
  const sun = new THREE.DirectionalLight('#fff4e3', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  scene.add(fill, sun, sun.target);
  return sun;
}
