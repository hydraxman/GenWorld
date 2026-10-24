import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeEnvironment} from './environment.js';
import {createLightingPipeline} from '../../../shared/illumination.js';
import {createShundeModel} from './model.js';
import {shundeCameraAt,DURATION} from './spec.js';
let engine,pending=0;
window.renderAt=time=>{pending=Math.max(0,Math.min(DURATION,Number(time)||0));if(!engine)return;const {camera,draw}=engine,p=shundeCameraAt(pending);camera.up.set(0,1,0);camera.position.set(...p.position);camera.lookAt(...p.target);camera.fov=p.fov;camera.aspect=16/9;camera.updateProjectionMatrix();draw();const chapter=document.getElementById('chapter');if(chapter)chapter.textContent=p.chapter;window.__lastCamera=p;};
window.addEventListener('hf-seek',e=>window.renderAt(e.detail.time));
const bounds=o=>{const b=new THREE.Box3().setFromObject(o);return {min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new THREE.Vector3()).toArray()};};
async function init(){
 const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('scene'),antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.setSize(1920,1080,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene(),env=makeEnvironment(THREE,renderer);scene.background=env.background;scene.backgroundBlurriness=.025;scene.environment=env.environment;scene.environmentIntensity=.80;scene.fog=new THREE.Fog('#d7dfd5',240,470);
 scene.add(new THREE.HemisphereLight('#d8e8fa','#89916d',1.1));
 const sun=new THREE.DirectionalLight('#fff2da',2.5);sun.position.set(-65,95,-45);sun.target.position.set(25,0,20);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-115,right:115,top:105,bottom:-95,near:1,far:300});sun.shadow.bias=-.00005;sun.shadow.normalBias=.035;scene.add(sun,sun.target);
 const fill=new THREE.DirectionalLight('#d4e5f5',.45);fill.position.set(10,30,80);scene.add(fill);
 const camera=new THREE.PerspectiveCamera(44,16/9,.15,700);
 const signGlyphs=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src='assets/name-glyphs.png';});
 const built=createShundeModel(THREE,{signGlyphs});scene.add(built.group);scene.updateMatrixWorld(true);
 const pipeline=createLightingPipeline(renderer,scene,camera),draw=()=>{scene.updateMatrixWorld(true);pipeline.render();};
 engine={renderer,scene,camera,built,pipeline,draw};window.renderAt(pending);renderer.shadowMap.autoUpdate=false;
 const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
 let meshes=0,triangles=0;built.group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
 window.__modelStats={...built.stats,meshBatches:meshes,triangles,buildingBounds:bounds(built.building),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),threeRevision:THREE.REVISION};
 window.__getCaptureState=()=>({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),projection:camera.projectionMatrix.toArray(),pending});
 window.captureTop=()=>{
  const top=new THREE.OrthographicCamera(-88,88,52,-52,.1,400);top.position.set(32,150,25);top.up.set(0,0,-1);top.lookAt(32,0,25);top.updateMatrixWorld(true);
  const size=renderer.getSize(new THREE.Vector2());try{renderer.setSize(1760,1040,false);renderer.render(scene,top);return {data:renderer.domElement.toDataURL('image/png'),projectionType:top.type,up:[0,0,-1],north:'image top',buildingBounds:bounds(built.building)};}finally{renderer.setSize(size.x,size.y,false);draw();}
 };
 const captureAt=t=>{const saved=camera.clone(),oldPending=pending;try{window.renderAt(t);return {data:renderer.domElement.toDataURL('image/png'),pose:window.__lastCamera};}finally{camera.copy(saved);pending=oldPending;draw();}};
 window.captureCalibration=()=>captureAt(3);
 window.captureRearCalibration=()=>captureAt(20); // legacy API alias; meaning now COURT
 window.captureCourtyard=()=>captureAt(20);
 window.exportGLB=async({campus=true}={})=>{
  const root=(campus?built.group:built.building).clone(true);root.updateMatrixWorld(true);
  const exportGeometries=[];root.traverse(o=>{if(o.isMesh&&o.material.normalMap){o.geometry=o.geometry.clone();o.geometry.computeTangents();exportGeometries.push(o.geometry);}});
  let buffer;try{buffer=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,maxTextureSize:1024,includeCustomExtensions:true});}finally{exportGeometries.forEach(g=>g.dispose());}
  const parsed=await new GLTFLoader().parseAsync(buffer,'');let meshes=0,instances=0;const textures=new Set();parsed.scene.traverse(o=>{if(o.isMesh){o.castShadow=!/glaz|glass/i.test(o.material.name);o.receiveShadow=true;meshes++;if(o.isInstancedMesh)instances+=o.count;for(const key of ['map','normalMap','roughnessMap'])if(o.material[key])textures.add(o.material[key].uuid);}});
  const view=new DataView(buffer),manifest=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,view.getUint32(12,true))));
  window.__glbVerified={bytes:buffer.byteLength,meshes,instances,textures:textures.size,bounds:bounds(parsed.scene),extensionsUsed:manifest.extensionsUsed||[],images:manifest.images?.length||0,materials:manifest.materials?.length||0};
  window.__lastGLBScene=parsed.scene;
  const bytes=new Uint8Array(buffer),chunks=[];for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));return btoa(chunks.join(''));
 };
 window.verifyExportTopology=()=>{
  const architecture=window.__lastGLBScene;if(!architecture)throw new Error('Export first');architecture.updateMatrixWorld(true);
  const ray=(x,z)=>new THREE.Raycaster(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0)).intersectObject(architecture,true).filter(h=>h.point.y>.5).map(h=>({y:h.point.y,name:h.object.name}));
  return {northGap:ray(38,5),court:ray(38,32),cylinder:ray(18,12),south:ray(0,55),east:ray(90,25)};
 };
 window.renderExportedModel=()=>{if(!window.__lastGLBScene)throw new Error('Export first');built.group.visible=false;scene.add(window.__lastGLBScene);renderer.shadowMap.needsUpdate=true;draw();const data=renderer.domElement.toDataURL('image/png');scene.remove(window.__lastGLBScene);built.group.visible=true;renderer.shadowMap.needsUpdate=true;draw();return data;};
 if(document.body.dataset.viewer==='true'){
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(...shundeCameraAt(0).target);controls.maxDistance=300;controls.minDistance=5;controls.update();controls.addEventListener('change',draw);
  document.querySelectorAll('[data-shot]').forEach(button=>button.onclick=()=>{window.renderAt(Number(button.dataset.shot));controls.target.set(...shundeCameraAt(Number(button.dataset.shot)).target);controls.update();});
  document.getElementById('download').onclick=async()=>{const b64=await window.exportGLB(),url=URL.createObjectURL(new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download='Shunde-courtyard-context.glb';a.click();URL.revokeObjectURL(url);};
 }
 window.__sceneReady=true;
}
const start=()=>init().catch(e=>{window.__sceneError=String(e.stack||e);console.error(e);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
