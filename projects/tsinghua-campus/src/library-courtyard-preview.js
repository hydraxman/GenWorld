import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createCourtyardReuse} from './courtyard-reuse.js';

try {
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  document.getElementById('scene').append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e7eee4');
  scene.add(new THREE.HemisphereLight('#fff6e4', '#717d6e', 2.6));
  const sun = new THREE.DirectionalLight('#fff0dc', 3);
  sun.position.set(-35, 50, 65);
  scene.add(sun);
  const built = createCourtyardReuse({textured: true});
  scene.add(built.group);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
  camera.position.set(33, 27, 63);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 4, 12);
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.update();
  function resize() {
    const node = document.getElementById('scene');
    renderer.setSize(node.clientWidth, node.clientHeight);
    camera.aspect = node.clientWidth / node.clientHeight;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  controls.addEventListener('change', () => renderer.render(scene, camera));
  window.addEventListener('resize', resize);
  resize();
  window.courtyardPreview = {ready: true, group: built.group, stats: built.stats,
    exportModel: () => new GLTFExporter().parseAsync(built.group, {binary: true, onlyVisible: true, maxTextureSize: 1024})};
} catch (error) {
  console.error(error);
  window.courtyardPreviewError = String(error);
  document.getElementById('status').textContent = `模型加载失败：${error.message}`;
}
