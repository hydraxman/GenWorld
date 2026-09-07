import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeEnvironment,addCampusLights,createReflectionGrove} from './environment.js';
import {createLightingPipeline} from '../../../shared/illumination.js';
import {installGlassReflections} from '../../../shared/glass-reflections.js';
import {createShundeModel} from './model.js';
import {shundeCameraAt,assemblyAt,SHUNDE} from './spec.js';

let engine,pending=0,visibilityRevision=0;
window.renderAt=renderAt;
window.addEventListener('hf-seek',e=>renderAt(Number(e.detail.time)));
function renderAt(time,force=false){
 if(!Number.isFinite(time))return;pending=Math.max(0,Math.min(46,time));if(!engine)return;
 if(!force&&engine.lastTime===pending)return;
 const {camera,built,renderer,scene,glass,pipeline}=engine,pose=shundeCameraAt(pending);
 camera.position.set(...pose.position);camera.lookAt(...pose.target);camera.fov=pose.fov;camera.updateProjectionMatrix();
 built.setTime(pending);renderer.shadowMap.needsUpdate=true;scene.updateMatrixWorld(true);glass.update(camera);pipeline.render();
 const note=document.getElementById('interior-note');if(note)note.style.opacity=pending>=36?'1':'0';
 const chapter=document.getElementById('chapter');if(chapter)chapter.textContent=pending>=36?'06 / 分层示意':pending>=31?'05 / 整体轮廓':pending>=24?'04 / 门廊细部':pending>=16?'03 / 侧向体量 · 推测':pending>=8?'02 / 中央入口':'01 / 主立面';
 engine.lastTime=pending;window.__lastCamera=pose;
}
function reportBounds(object){const b=new THREE.Box3().setFromObject(object);return {min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new THREE.Vector3()).toArray()};}
async function init(){
 const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('scene'),antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.setSize(1920,1080,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene(),env=makeEnvironment(THREE,renderer);scene.background=env.background;scene.environment=env.environment;scene.environmentIntensity=.75;scene.fog=new THREE.Fog('#d7dfd5',105,240);
 const camera=new THREE.PerspectiveCamera(44,1920/1080,.15,400);addCampusLights(THREE,scene);scene.add(createReflectionGrove(THREE));
 const signGlyphs=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src='assets/name-glyphs.png';});const built=createShundeModel(THREE,{signGlyphs});scene.add(built.group);scene.updateMatrixWorld(true);
 const pipeline=createLightingPipeline(renderer,scene,camera);
 const glass=installGlassReflections(THREE,renderer,scene,built.group,{position:[0,7,9],resolution:512,intensity:1.75,roughness:.015,metalness:.75,getRevision:()=>`${assemblyAt(pending)}:${visibilityRevision}`});
 engine={renderer,scene,camera,built,pipeline,glass,lastTime:null};renderAt(pending,true);renderer.shadowMap.autoUpdate=false;
 let meshes=0,triangles=0;built.group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
 window.__modelStats={...built.stats,meshBatches:meshes,triangles,buildingBounds:reportBounds(built.building),sceneBounds:reportBounds(built.group),renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER)};
 const rearPose={position:[-9,4.2,-55],target:[-1,10.4,-14],fov:45};
 const topPose={position:[0,100,-9.01],target:[0,0,-9],fov:46};
 const rearQuarterPose={position:[-43,38,-65],target:[0,10,-8],fov:46};
 const applyPose=(pose,width,height)=>{camera.up.set(0,1,0);camera.position.set(...pose.position);camera.lookAt(...pose.target);camera.fov=pose.fov;camera.aspect=width/height;camera.updateProjectionMatrix();if(pose.shift){camera.projectionMatrix.elements[9]=pose.shift;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();}};
 const draw=()=>{renderer.shadowMap.needsUpdate=true;scene.updateMatrixWorld(true);glass.update(camera);pipeline.render();};
 function capturePose(pose,width,height,metadata=()=>({})){
  const saved=camera.clone(),size=renderer.getSize(new THREE.Vector2()),positions=built.tiers.map(g=>g.position.clone());
  try{
   built.setTime(0);applyPose(pose,width,height);renderer.setSize(width,height,false);pipeline.composer.setSize(width,height);visibilityRevision++;draw();
   return {data:renderer.domElement.toDataURL('image/png'),size:[width,height],pose,...metadata(),note:'Photo-constrained estimate; not surveyed'};
  }finally{
   built.tiers.forEach((g,i)=>g.position.copy(positions[i]));camera.copy(saved);renderer.setSize(size.x,size.y,false);pipeline.composer.setSize(size.x,size.y);visibilityRevision++;draw();
  }
 }
 window.captureCalibration=()=>capturePose({position:[-.22,3.2,36.25],target:[-.22,3.2,5],fov:44,shift:.637},1920,1281,()=>{
  const project=(x,y,z)=>{const p=new THREE.Vector3(x,y,z).project(camera);return [(p.x+1)*1920/2,(1-p.y)*1281/2];};
  return {landmarks:{roofTop:project(0,SHUNDE.roofBand.fasciaTop,5),slit:project(0,SHUNDE.roofBand.windowCenter,5),porticoTop:project(0,SHUNDE.entrance.top,5),landing:project(0,SHUNDE.baseY,5),columnLeft:project(-SHUNDE.entrance.columnX,6,5.22),columnRight:project(SHUNDE.entrance.columnX,6,5.22)}};
 });
 window.captureRearCalibration=()=>capturePose(rearPose,1080,810);
 window.captureTop=()=>capturePose(topPose,1600,1200);
 window.captureRearQuarter=()=>capturePose(rearQuarterPose,1600,1200);
 window.__getCaptureState=()=>({pending,lastTime:engine.lastTime,size:renderer.getSize(new THREE.Vector2()).toArray(),position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),projection:camera.projectionMatrix.toArray(),tiers:built.tiers.map(g=>g.position.toArray())});
 window.__glassReflectionStats=glass.stats;
 window.setGlassReflectionEnabled=value=>{glass.setEnabled(value);renderAt(pending,true);};
 window.__getExplosionState=()=>({amount:assemblyAt(pending),tiers:built.tiers.map(g=>({name:g.name,y:g.position.y})),porticoY:built.portico.position.y});
 window.__verifyGlassSafety=()=>{
  const old=scene.overrideMaterial,before=glass.stats.capturePasses;scene.overrideMaterial=new THREE.MeshNormalMaterial();glass.update(camera);scene.overrideMaterial.dispose();scene.overrideMaterial=old;
  return {overrideSkipped:glass.stats.capturePasses===before};
 };
 window.exportGLB=async({campus=true}={})=>{
  const oldTime=pending;built.setTime(0);const restore=glass.beginExport();let buffer;
  const correctedTextures=[];const clonedMaterials=[],clonedGeometries=[];
  try{
   const root=(campus?built.group:built.building).clone(true);root.name=campus?'Shunde Hall with illustrative campus — estimated dimensions':'Shunde Hall architecture — estimated dimensions';
   // glTF can encode scalar normal scale only: bake shared leaf DirectX green inversion for parity.
   const materials=new Map();
   root.traverse(o=>{if(o.isMesh&&o.material.normalScale?.y<0){
    let m=materials.get(o.material);if(!m){m=o.material.clone();const image=m.normalMap.image,c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);const d=x.getImageData(0,0,c.width,c.height);for(let i=1;i<d.data.length;i+=4)d.data[i]=255-d.data[i];x.putImageData(d,0,0);m.normalMap=new THREE.CanvasTexture(c);m.normalMap.flipY=o.material.normalMap.flipY;m.normalScale.y=Math.abs(m.normalScale.y);correctedTextures.push(m.normalMap);clonedMaterials.push(m);materials.set(o.material,m);}o.material=m;
   }});
   // Explicit tangents avoid GLTFLoader's derivative-tangent Y correction and preserve the baked normal convention.
   root.traverse(o=>{if(o.isMesh&&o.material.normalMap){o.geometry=o.geometry.clone();o.geometry.computeTangents();clonedGeometries.push(o.geometry);}});
   root.updateMatrixWorld(true);buffer=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,maxTextureSize:1024,includeCustomExtensions:true});
  }finally{restore();built.setTime(oldTime);for(const t of correctedTextures)t.dispose();for(const m of clonedMaterials)m.dispose();for(const g of clonedGeometries)g.dispose();renderAt(oldTime,true);}
  const parsed=await new GLTFLoader().parseAsync(buffer,'');let meshes=0,instances=0;const textures=new Set(),namedParts=[];let normalYPositive=true;
  parsed.scene.traverse(o=>{if(o.name)namedParts.push(o.name);if(o.isMesh){meshes++;if(o.isInstancedMesh)instances+=o.count;for(const key of ['map','normalMap','roughnessMap'])if(o.material[key])textures.add(o.material[key].uuid);normalYPositive&&=!o.material.normalMap||o.material.normalScale.y>=0;}});
  const view=new DataView(buffer),jsonLength=view.getUint32(12,true),manifest=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jsonLength)));
  window.__glbVerified={bytes:buffer.byteLength,meshes,instances,textures:textures.size,bounds:reportBounds(parsed.scene),normalYPositive,extensionsUsed:manifest.extensionsUsed||[],images:manifest.images?.length||0,materials:manifest.materials?.length||0,namedParts,sourceAssemblyRestored:built.tiers.every((g,i)=>g.position.y===assemblyAt(oldTime)*i*3.7),closedAssembly:reportBounds(parsed.scene).max[1]<=SHUNDE.height};
  window.__lastGLBScene=parsed.scene;
  const bytes=new Uint8Array(buffer),chunks=[];for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));return btoa(chunks.join(''));
 };
 window.renderExportedModel=()=>{if(!window.__lastGLBScene)throw new Error('Export model first');const restore=glass.beginExport();built.group.visible=false;scene.add(window.__lastGLBScene);renderer.shadowMap.needsUpdate=true;pipeline.render();scene.remove(window.__lastGLBScene);built.group.visible=true;restore();};
 if(document.body.dataset.viewer==='true'){
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(...shundeCameraAt(0).target);controls.minDistance=8;controls.maxDistance=150;controls.maxPolarAngle=Math.PI/2-.01;controls.update();
  controls.addEventListener('change',()=>{glass.update(camera);pipeline.render();});
  document.querySelectorAll('[data-shot]').forEach(button=>button.onclick=()=>{renderAt(Number(button.dataset.shot),true);controls.target.set(...shundeCameraAt(Number(button.dataset.shot)).target);controls.update();});
  const show=pose=>{renderAt(0,true);applyPose(pose,1920,1080);controls.target.set(...pose.target);controls.update();draw();};
  document.getElementById('rear-view').onclick=()=>show(rearPose);
  document.getElementById('top-view').onclick=()=>show(topPose);
  document.getElementById('download').onclick=async()=>{const b64=await window.exportGLB(),url=URL.createObjectURL(new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download='Shunde3D.glb';a.click();URL.revokeObjectURL(url);};
 }
 window.__sceneReady=true;
}
const start=()=>init().catch(e=>{window.__sceneError=String(e.stack||e);console.error(e);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
