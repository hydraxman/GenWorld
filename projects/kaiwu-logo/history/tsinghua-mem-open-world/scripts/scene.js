import * as THREE from '../vendor/three/build/three.module.js';
import {ExtrudeGeometry} from './SelectiveExtrudeGeometry.js';
import {createAtmosphere} from './atmosphere.js';
import geometryData from '../inputs/semantic-geometry.json';
let pending=0;
window.renderAt=t=>{pending=Math.max(0,Math.min(12,Number(t)));if(window.__drawScene)window.__drawScene(pending)};
window.addEventListener('hf-seek',e=>window.renderAt(e.detail.time));
const clamp=(v)=>Math.max(0,Math.min(1,v));const ease=(v)=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10)};const phase=(t,a,b)=>ease((t-a)/(b-a));
function init(){
 const atmosphere=createAtmosphere(THREE,phase,clamp);
 const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('three-layer'),antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(1920,1080,false);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;
 const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-7.55,7.55,4.247,-4.247,.1,100);
 const env=new THREE.Scene();env.background=new THREE.Color('#0d0716');
 const panel=(color,power,x,y,z,w,h,ry=0)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.y=ry;env.add(m)};
 panel('#f6e6ff',6,-4,2,5,.5,8,-.4);panel('#adcff5',4,5,0,4,.35,7,.6);panel('#e9d4f8',3,0,5,3,7,.35);panel('#d6bfe4',.62,0,0,8,5,6);panel('#653c88',1,-4,-3,-3,3,5,1);
 const pmrem=new THREE.PMREMGenerator(renderer),envMap=pmrem.fromScene(env,.03,.1,50);scene.environment=envMap.texture;
 scene.add(new THREE.HemisphereLight(0xc8d5f1,0x271c39,1.1));const key=new THREE.DirectionalLight(0xf3e4ff,2.6);key.position.set(-3,4,7);scene.add(key);const fill=new THREE.DirectionalLight(0xaccbf2,1.1);fill.position.set(4,-2,4);scene.add(fill);
 const sweep=new THREE.PointLight(0xf9e4ff,0,20,2);scene.add(sweep);const sweep2=new THREE.PointLight(0xbbdeff,0,15,2);scene.add(sweep2);
 const studio=new THREE.PointLight(0xf4ddff,18,20,2);studio.position.set(-2.1,2,2);scene.add(studio);
 const face=new THREE.MeshPhysicalMaterial({color:0x6f337b,metalness:.68,roughness:.26,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:1.15});const side=new THREE.MeshPhysicalMaterial({color:0xc5adc5,metalness:1,roughness:.14,clearcoat:1,envMapIntensity:1.35});
 face.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 normal=normalize(normal+vec3(.055*sin(vViewPosition.x*1.4+vViewPosition.y*.5),.035*cos(vViewPosition.y*1.7-vViewPosition.x*.4),0.));`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 roughnessFactor*=.87+.13*sin(vViewPosition.x*3.7)*cos(vViewPosition.y*4.1);`);};
 const badge=new THREE.Group();badge.name='Source-exact semantic badge assembly';scene.add(badge);const groups={},stats={};let vertices=0;
 for(const [name,polys] of Object.entries(geometryData)){
  const group=new THREE.Group();group.name=name;badge.add(group);groups[name]=group;let holes=0;
  for(const [i,p] of polys.entries()){
   const coords=a=>a.map(([x,y])=>new THREE.Vector2((x-319.3)*.01,(319.5-y)*.01));const shape=new THREE.Shape(coords(p.outer));for(const h of p.holes)shape.holes.push(new THREE.Path(coords(h)));holes+=p.holes.length;
   const noBevel=new Set(coords(p.noBevel).map(v=>v.x.toFixed(8)+','+v.y.toFixed(8)));
   const depth=(name.includes('Page')?.092:name==='braidedRim'?.17:.125);const geo=new ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelThickness:.0018,bevelSize:.0012,bevelSegments:2,curveSegments:1,bevelAllowed:v=>!noBevel.has(v.x.toFixed(8)+','+v.y.toFixed(8))});geo.translate(0,0,-depth);const pos=geo.attributes.position;for(let j=0;j<pos.count;j++)pos.setZ(j,Math.round(pos.getZ(j)*1e7)/1e7);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,[face,side]);mesh.name=`${name}-${i}`;mesh.userData={semantic:name,originalApertures:p.holes.length,sourceDerived:true,artificialCutVerticesUnbeveled:noBevel.size};group.add(mesh);vertices+=geo.attributes.position.count;
  }
  stats[name]={meshes:polys.length,holes};
 }
 // All front lettering is aperture topology of the same hinged solid: it cannot drift.
 const landmarks={leftPage:[[-1.6,1.2,0],[-1.6,-1.2,0]],rightPage:[[1.6,1.2,0],[1.6,-1.2,0]],circuits:[[0,2.05,0],[0,-1.9,0]],letterBand:[[0,2.5,0]],braidedRim:[[0,3,0]]};
 window.sceneMetrics={duration:12,fps:30,threeRevision:THREE.REVISION,geometryType:'ExtrudeGeometry',sourcePaths:53,sourceHoles:164,semanticGroups:stats,vertices,bevelSourcePixels:.12,bevelThicknessSourcePixels:.18,artificialCutsBeveled:false,sourceColor:'#6f337b',PBRBaseColor:'#6f337b',pose:{}};
 function draw(t){
  const open=phase(t,2,6),arrival=phase(t,7.3,8.65),cam=phase(t,6.4,8.65),reveal=phase(t,.75,2.2);
  groups.leftPage.rotation.set(0,1.41*(1-open),0);groups.rightPage.rotation.set(0,-1.41*(1-open),0);
  groups.leftPage.position.set(0,0,.45*(1-open));groups.rightPage.position.copy(groups.leftPage.position);
  groups.circuits.rotation.set(.15*(1-arrival),-.1*(1-arrival),-.32*(1-arrival));groups.circuits.position.set(0,0,-.48*(1-arrival));
  groups.letterBand.rotation.set(.28*(1-arrival),-.4*(1-arrival),-.9*(1-arrival));groups.letterBand.position.set(0,0,-.9*(1-arrival));
  groups.braidedRim.rotation.set(-.24*(1-arrival),.44*(1-arrival),1.32*(1-arrival));groups.braidedRim.position.set(0,0,-1.4*(1-arrival));
  groups.letterBand.scale.setScalar(1+.19*(1-arrival));groups.braidedRim.scale.setScalar(1+.29*(1-arrival));
  badge.rotation.set(.1*(1-cam),.15*(1-cam),-.12*(1-cam));badge.scale.setScalar(.82+.18*reveal);badge.position.z=-2.4*(1-reveal);
  for(const n of ['leftPage','rightPage','circuits','letterBand','braidedRim'])groups[n].visible=t>(n.includes('Page')?.7:n==='circuits'?2.8:6.8);
  const az=.61*(1-cam),el=.18*(1-cam);camera.position.set(12*Math.sin(az)*Math.cos(el),12*Math.sin(el),12*Math.cos(az)*Math.cos(el));camera.lookAt(0,0,0);camera.zoom=.95+.05*cam;camera.updateProjectionMatrix();
  const progress=clamp((t-8.7)/2.5),angle=Math.PI/2-progress*Math.PI*2;const active=t>=8.7&&t<11.2;const strength=active?Math.sin(Math.PI*progress)**.35:0;sweep.position.set(3.7*Math.cos(angle),3.7*Math.sin(angle),2.2);sweep.intensity=95*strength;sweep2.position.set(3*Math.cos(angle-.20),3*Math.sin(angle-.20),1.3);sweep2.intensity=23*strength;scene.environmentRotation.z=active?-progress*Math.PI*2:0;
  scene.updateMatrixWorld(true);let maxError=0;for(const[name,pts]of Object.entries(landmarks))for(const p of pts){let v=new THREE.Vector3(...p),w=v.clone();groups[name].localToWorld(w);maxError=Math.max(maxError,v.distanceTo(w))}
  window.sceneMetrics.pose={time:t,leftPageAngle:groups.leftPage.rotation.y,rightPageAngle:groups.rightPage.rotation.y,leftPageAngleDegrees:THREE.MathUtils.radToDeg(groups.leftPage.rotation.y),rightPageAngleDegrees:THREE.MathUtils.radToDeg(groups.rightPage.rotation.y),ringBandAngle:groups.letterBand.rotation.toArray().slice(0,3),braidedRimAngle:groups.braidedRim.rotation.toArray().slice(0,3),camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),azimuth:az,elevation:el,zoom:camera.zoom},assemblyErrorWorld:maxError,assemblyErrorSourcePixels:maxError*100,gloss:{phase:t<8.7?'pending':t<11.2?'orbit':'complete',progress,angle,strength},nebulaSplit:open,pathOrder:phase(t,5,8),stage:t<2?'chaotic nebula traversal':t<5?'book opens / heavens part':t<8?'insight: disorder becomes directed circuitry':t<8.7?'outer rings settle':t<11.2?'one metallic orbit':'badge holds / world flows'};
  atmosphere.draw(t);renderer.render(scene,camera);
 }
 window.__sceneDebug={THREE,scene,camera,renderer,badge,groups,face,side,sweep,sweep2,geometryData,landmarks,atmosphere};window.__drawScene=draw;draw(pending);window.animationReady=true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
