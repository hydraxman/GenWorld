import * as THREE from 'three';

import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createModel} from './model.js';
import {cameraAt,DURATION} from './camera.js';

let engine=null,pending=0;
window.addEventListener('hf-seek',e=>renderAt(e.detail.time));
window.renderAt=renderAt;
function renderAt(time){
 pending=time;
 if(!engine)return;
 const pose=cameraAt(time);
 engine.camera.position.set(...pose.position);
 engine.camera.lookAt(...pose.target);
 engine.camera.fov=pose.fov;engine.camera.updateProjectionMatrix();
 engine.renderer.render(engine.scene,engine.camera);
 window.__lastCamera=pose;
}
function makeEnvironment(renderer){
 const c=document.createElement('canvas');c.width=1024;c.height=512;
 const ctx=c.getContext('2d');
 const g=ctx.createLinearGradient(0,0,0,512);
 g.addColorStop(0,'#8eb8d3');g.addColorStop(0.38,'#c8dbe2');g.addColorStop(0.52,'#e8e8df');g.addColorStop(0.65,'#92987e');g.addColorStop(1,'#535a44');
 ctx.fillStyle=g;ctx.fillRect(0,0,1024,512);
 for(let i=0;i<15;i++){
  const x=(i*181+80)%1024,y=60+(i*43)%155;
  const cloud=ctx.createRadialGradient(x,y,4,x,y,110);cloud.addColorStop(0,'rgba(255,255,250,.22)');cloud.addColorStop(1,'rgba(255,255,250,0)');ctx.fillStyle=cloud;ctx.fillRect(x-110,y-110,220,220);
 }
 const tex=new THREE.CanvasTexture(c);tex.mapping=THREE.EquirectangularReflectionMapping;tex.colorSpace=THREE.SRGBColorSpace;
 const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();const env=pmrem.fromEquirectangular(tex).texture;pmrem.dispose();
 return {background:tex,environment:env};
}
async function init(){
 const canvas=document.getElementById('scene');
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.setSize(1920,1080,false);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();const env=makeEnvironment(renderer);scene.background=env.background;scene.environment=env.environment;scene.environmentIntensity=0.55;
 scene.fog=new THREE.Fog('#d7dfd5',75,180);
 const camera=new THREE.PerspectiveCamera(48,1920/1080,0.12,300);
 const hemi=new THREE.HemisphereLight('#d8e8fa','#89916d',1.35);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#fff2da',3.0);sun.position.set(-24,43,32);sun.target.position.set(0,1,9);scene.add(sun,sun.target);
 sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-46;sun.shadow.camera.right=46;sun.shadow.camera.top=50;sun.shadow.camera.bottom=-46;sun.shadow.camera.near=1;sun.shadow.camera.far=130;sun.shadow.bias=-0.00015;sun.shadow.normalBias=0.06;sun.shadow.radius=3;
 const fill=new THREE.DirectionalLight('#d4e5f5',0.45);fill.position.set(25,16,-12);scene.add(fill);
 const built=createModel(THREE);scene.add(built.group);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial({color:'#9ba08b',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-0.72;floor.receiveShadow=true;scene.add(floor);
 built.group.updateMatrixWorld(true);
 engine={renderer,scene,camera,model:built.group};
 renderAt(pending);
 renderer.shadowMap.autoUpdate=false;
 const bounds=new THREE.Box3().setFromObject(built.group);
 window.__modelStats={...built.stats,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
 window.exportGLB=async()=>{
  const buffer=await new GLTFExporter().parseAsync(built.group,{binary:true,onlyVisible:true,maxTextureSize:1024});
  const parsed=await new GLTFLoader().parseAsync(buffer,'');
  let meshes=0;parsed.scene.traverse(o=>{if(o.isMesh)meshes++;});
  window.__glbVerified={bytes:buffer.byteLength,meshes,bounds:new THREE.Box3().setFromObject(parsed.scene).getSize(new THREE.Vector3()).toArray()};
  const bytes=new Uint8Array(buffer);let chunks=[];for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
  return btoa(chunks.join(''));
 };
 if(document.body.dataset.viewer==='true'){
  const controls=new OrbitControls(camera,canvas);controls.target.set(0,4,8);controls.minDistance=5;controls.maxDistance=100;controls.maxPolarAngle=Math.PI/2-0.015;controls.enableDamping=false;controls.update();
  controls.addEventListener('change',()=>renderer.render(scene,camera));
  document.querySelectorAll('[data-shot]').forEach(button=>button.addEventListener('click',()=>{renderAt(Number(button.dataset.shot));controls.target.set(...cameraAt(Number(button.dataset.shot)).target);controls.update();}));
  document.getElementById('download').onclick=async()=>{const bytes=Uint8Array.from(atob(await window.exportGLB()),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download='Courtyard3D.glb';a.click();URL.revokeObjectURL(url);};
 }
 window.__sceneReady=true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{window.__sceneError=String(e.stack||e);console.error(e);}));
else init().catch(e=>{window.__sceneError=String(e.stack||e);console.error(e);});
