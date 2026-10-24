import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

async function main() {
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setSize(1600, 1200);
  renderer.setPixelRatio(1);
  renderer.setClearColor('#e6edf1');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#aeb4ba', 2));
  const sun = new THREE.DirectionalLight('#fff9f0', 3);
  sun.position.set(-10, 20, 15);
  sun.target.position.set(0, 4, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -13, right: 13, top: 17, bottom: -9, near: 0.1, far: 70});
  sun.shadow.normalBias = 0.015;
  scene.add(sun, sun.target);
  const {scene: gate} = await new GLTFLoader().loadAsync(__MODEL_URL__);
  gate.traverse(object => {
    if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
  });
  scene.add(gate);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({color: '#d9dcda', roughness: 1}));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  ground.receiveShadow = true;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(42, 4 / 3, 0.1, 300);
  window.gateStudy = {
    ready: true,
    capture(angle) {
      if (angle === 'front') {
        camera.position.set(0, 1.8, 26);
        camera.lookAt(0, 6.4, 0);
      } else if (angle === 'oblique') {
        camera.position.set(-14, 1.8, 20);
        camera.lookAt(0, 6.1, 0);
      } else throw new Error(`Unknown reference angle: ${angle}`);
      renderer.render(scene, camera);
    },
  };
  window.gateStudy.capture('front');
}

main().catch(error => {
  console.error(error);
  window.gateStudyError = String(error);
});
