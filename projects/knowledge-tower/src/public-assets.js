import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function fitModel(model, height, position) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('Invalid public model bounds');
  const scale = height / size.y;
  model.scale.setScalar(scale);
  const center = bounds.getCenter(new THREE.Vector3()).multiplyScalar(scale);
  model.position.set(position[0] - center.x, position[1] - bounds.min.y * scale, position[2] - center.z);
  model.traverse(object => {
    if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
  });
}

export async function loadAcademyAssets() {
  const loader = new GLTFLoader();
  const [fountain, assistant] = await Promise.all([
    loader.loadAsync('assets/models/kenney-fountain/pavement-fountain.glb'),
    loader.loadAsync('assets/models/kenney-assistant/character.glb'),
  ]);
  const group = new THREE.Group();
  group.name = 'cc0-kenney-plaza-assets';
  fountain.scene.name = 'kenney-cc0-plaza-fountain';
  assistant.scene.name = 'kenney-cc0-robot-assistant';
  fitModel(fountain.scene, 1.7, [-10.7, .45, 11.4]);
  fitModel(assistant.scene, 1.8, [10, .45, 11]);
  group.add(fountain.scene, assistant.scene);
  return group;
}
