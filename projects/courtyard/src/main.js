import * as THREE from 'three';
import {makeEnvironment,addCampusLights} from '../../../shared/environment.js';
import {installGlassReflections} from '../../../shared/glass-reflections.js';

import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createModel} from './model.js';
import {createCampus} from './campus.js';
import {createWater} from './water.js';
import {createLightingPipeline} from './illumination.js';
import {cameraAt,DURATION} from './camera.js';
import {loadLeafTextures} from './leaves.js';
import {filmCameraAt} from './film-camera.js';
import {createExplodedBuilding} from './exploded.js';

let engine=null,pending=0;
window.addEventListener('hf-seek',e=>renderAt(e.detail.time+(document.body?.dataset.segment==='ending'?36:0)));
window.renderAt=renderAt;
function renderAt(time,force=false){
 pending=time;
 if(!engine)return;
 if(!force&&Number.isFinite(engine.lastTime)&&Math.abs(engine.lastTime-time)<1e-8)return;
 const pose=filmCameraAt(time);
 engine.camera.position.set(...pose.position);
 engine.camera.lookAt(...pose.target);
 engine.camera.fov=pose.fov;engine.camera.updateProjectionMatrix();
 engine.exploded.setTime(time);
 engine.renderer.shadowMap.needsUpdate=true;
 engine.water.setTime(time);
 const note=document.getElementById('interior-note');if(note)note.style.opacity=time>=36?'1':'0';
 engine.scene.updateMatrixWorld(true);
 engine.glass.update(engine.camera);
 engine.pipeline.render();
 engine.lastTime=time;
 window.__lastCamera=pose;
}
async function init(){
 const canvas=document.getElementById('scene');
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.setSize(1920,1080,false);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();const env=makeEnvironment(THREE,renderer);scene.background=env.background;scene.environment=env.environment;scene.environmentIntensity=0.75;
 scene.fog=new THREE.Fog('#d7dfd5',75,180);
 const camera=new THREE.PerspectiveCamera(48,1920/1080,0.12,300);
 addCampusLights(THREE,scene);
 await loadLeafTextures(THREE);
 const built=createModel(THREE);
 const campus=createCampus(THREE),water=createWater(THREE);
 built.group.add(campus.group,water.group);
 const exploded=createExplodedBuilding(THREE,built.group);
 scene.add(exploded.group);
 Object.assign(built.stats,campus.stats,water.stats);
 scene.add(built.group);
 built.group.updateMatrixWorld(true);
 const pipeline=createLightingPipeline(renderer,scene,camera);
 const glass=installGlassReflections(THREE,renderer,scene,scene,{position:[0,5,5],intensity:2.2,roughness:.025,metalness:.85,getRevision:()=>pending>=36?pending:0});
 engine={renderer,scene,camera,model:built.group,water,pipeline,glass,exploded,lastTime:null};
 window.__glassReflectionStats=glass.stats;
 window.setGlassReflectionEnabled=value=>{glass.setEnabled(value);renderAt(pending,true);};
 window.__verifyGlassSafety=()=>{
  const time=pending;pending=40.12345;
  const before=glass.stats.capturePasses,override=scene.overrideMaterial;
  scene.overrideMaterial=new THREE.MeshNormalMaterial();glass.update(camera);scene.overrideMaterial.dispose();scene.overrideMaterial=override;
  const overrideSkipped=before===glass.stats.capturePasses;
  const waterBefore=water.passes();glass.update(camera);const waterStable=JSON.stringify(waterBefore)===JSON.stringify(water.passes());
  const restore=glass.beginExport();let pbrExport=true;
  scene.traverse(o=>{if(o.isMesh&&/glass/i.test(o.material?.name||''))pbrExport&&=o.material.isMeshStandardMaterial&&!o.material.envMap?.isRenderTargetTexture;});
  restore();pending=time;
  return {overrideSkipped,pbrExport,waterStable};
 };
 window.__explosionStats=exploded.stats;
 window.__getExplosionState=()=>({tiers:exploded.group.children.map(o=>({name:o.name,y:o.position.y,visible:o.visible})),active:exploded.group.visible});
 window.setReflectionEnabled=value=>{water.setEnabled(value);renderAt(pending,true);};
 window.getReflectionPasses=()=>water.passes();
 renderAt(pending);
 renderer.shadowMap.autoUpdate=false;
 const bounds=new THREE.Box3().setFromObject(built.group);
 let sceneTriangles=0,sceneMeshBatches=0;
 built.group.traverse(o=>{if(o.isMesh){sceneMeshBatches++;sceneTriangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
 window.__modelStats={...built.stats,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},sceneMeshBatches,triangles:sceneTriangles,lastPostprocessDrawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
 window.exportGLB=async()=>{
  const restoreGlass=glass.beginExport(),restoreWater=water.beginExport(),restoreAssembly=exploded.beginExport();let buffer;
  try{const exportRoot=new THREE.Group();exportRoot.name='Courtyard V6 shared rendering with inferred interior';exportRoot.add(built.group.clone(true),exploded.group.clone(true));buffer=await new GLTFExporter().parseAsync(exportRoot,{binary:true,onlyVisible:true,maxTextureSize:1024});}finally{restoreAssembly();restoreWater();restoreGlass();}
  const parsed=await new GLTFLoader().parseAsync(buffer,'');
  let meshes=0;const namedParts=[];parsed.scene.traverse(o=>{if(o.isMesh)meshes++;if(o.name)namedParts.push(o.name);});
  window.__glbVerified={bytes:buffer.byteLength,meshes,namedParts,bounds:new THREE.Box3().setFromObject(parsed.scene).getSize(new THREE.Vector3()).toArray()};
  const bytes=new Uint8Array(buffer);let chunks=[];for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
  return btoa(chunks.join(''));
 };
 if(document.body.dataset.viewer==='true'){
  const controls=new OrbitControls(camera,canvas);controls.target.set(0,4,8);controls.minDistance=5;controls.maxDistance=100;controls.maxPolarAngle=Math.PI/2-0.015;controls.enableDamping=false;controls.update();
  controls.addEventListener('change',()=>{glass.update(camera);pipeline.render();});
  document.querySelectorAll('[data-shot]').forEach(button=>button.addEventListener('click',()=>{renderAt(Number(button.dataset.shot),true);controls.target.set(...filmCameraAt(Number(button.dataset.shot)).target);controls.update();}));
  document.getElementById('download').onclick=async()=>{const bytes=Uint8Array.from(atob(await window.exportGLB()),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download='Courtyard3D.glb';a.click();URL.revokeObjectURL(url);};
 }
 window.__sceneReady=true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{window.__sceneError=String(e.stack||e);console.error(e);}));
else init().catch(e=>{window.__sceneError=String(e.stack||e);console.error(e);});
