import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export function createCampusRenderPipeline(renderer, scene) {
  let composer, renderPass, ao, width = 0, height = 0;
  return (camera, contactShadows) => {
    if (!contactShadows) {
      renderer.render(scene, camera);
      return;
    }
    if (!composer) {
      const target = new THREE.WebGLRenderTarget(1, 1, {type: THREE.HalfFloatType,
        samples: Math.min(4, renderer.capabilities.maxSamples)});
      composer = new EffectComposer(renderer, target);
      composer.setPixelRatio(1);
      renderPass = new RenderPass(scene, camera);
      ao = new GTAOPass(scene, camera, 1, 1, undefined,
        {radius: 1.6, thickness: .5, scale: 1, samples: 8, screenSpaceRadius: false},
        {radius: 4, samples: 8});
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = .5;
      composer.addPass(renderPass);
      composer.addPass(ao);
      composer.addPass(new OutputPass());
    }
    const canvas = renderer.domElement;
    if (width !== canvas.width || height !== canvas.height) {
      width = canvas.width; height = canvas.height;
      composer.setSize(width, height);
      const scale = Math.min(.5, 720 / height);
      ao.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    }
    renderPass.camera = camera;
    if (ao.camera !== camera) {
      ao.camera = camera;
      ao.gtaoMaterial.defines.PERSPECTIVE_CAMERA = camera.isPerspectiveCamera ? 1 : 0;
      ao.gtaoMaterial.needsUpdate = true;
    }
    composer.render();
  };
}
