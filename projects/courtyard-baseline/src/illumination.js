import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
class DeterministicGTAOPass extends GTAOPass{
 _generateNoise(){
  const size=64,data=new Uint8Array(size*size*4);let seed=17319;
  for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=i%4===3?255:seed>>>24;}
  const noise=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);noise.wrapS=noise.wrapT=THREE.RepeatWrapping;noise.needsUpdate=true;return noise;
 }
}
export function createLightingPipeline(renderer,scene,camera){
 const target=new THREE.WebGLRenderTarget(1920,1080,{type:THREE.HalfFloatType,samples:2});
 const composer=new EffectComposer(renderer,target);composer.setSize(1920,1080);composer.addPass(new RenderPass(scene,camera));
 const ao=new DeterministicGTAOPass(scene,camera,960,540,undefined,{radius:.62,thickness:1.1,distanceExponent:1.2,scale:1,samples:16},{radius:5,samples:8,normalPhi:4});
 ao.blendIntensity=.72;composer.addPass(ao);ao.setSize(960,540);
 composer.addPass(new OutputPass());
 return {composer,ao,render(){composer.render(0);}};
}
