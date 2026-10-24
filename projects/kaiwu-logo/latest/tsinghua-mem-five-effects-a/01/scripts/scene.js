import * as THREE from '../vendor/three/build/three.module.js';
import {ExtrudeGeometry} from './SelectiveExtrudeGeometry.js';
import {makeGalaxy} from './background.js';
import geometryData from '../inputs/semantic-geometry.json';
let pending=0;
window.renderAt=t=>{pending=Math.max(0,Math.min(5,Number(t)));if(window.__drawScene)window.__drawScene(pending)};
window.addEventListener('hf-seek',e=>window.renderAt(e.detail.time));
const clamp=(v)=>Math.max(0,Math.min(1,v));const ease=(v)=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10)};const phase=(t,a,b)=>ease((t-a)/(b-a));
function init(){
 const galaxy=makeGalaxy();
 const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('three-layer'),antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(1920,1080,false);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.autoClear=false;
 const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(35.14,1920/1080,.1,100);
 const env=new THREE.Scene();env.background=new THREE.Color('#171322');
 const panel=(color,power,x,y,z,w,h,ry=0)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.y=ry;env.add(m)};
 panel('#fff3e8',4,.7,0,6,.9,9);panel('#aaaed9',2,-1.8,0,5,.8,7);panel('#f1caff',2,0,3,5,8,.6);panel('#814c97',1.2,-4,-3,-3,2,4,1);
 const pmrem=new THREE.PMREMGenerator(renderer),envMap=pmrem.fromScene(env,.03,.1,50);scene.environment=envMap.texture;
 scene.add(new THREE.HemisphereLight(0xbbacd1,0x10081c,.55));const key=new THREE.DirectionalLight(0xf3e4ff,1.25);key.position.set(-3,4,7);scene.add(key);const fill=new THREE.DirectionalLight(0xaccbf2,1.0);fill.position.set(4,-2,4);scene.add(fill);
 const sweep=new THREE.PointLight(0xf9e4ff,0,20,2);scene.add(sweep);const sweep2=new THREE.PointLight(0xbbdeff,0,15,2);scene.add(sweep2);
 const studio=new THREE.PointLight(0xf4ddff,23,20,2);studio.position.set(-3.7,4,4);scene.add(studio);
 const texData=new Uint8Array(128*128*4);for(let i=0;i<128*128;i++){let n=(Math.sin(i*12.9898)*43758.5453)%1;const v=210+Math.floor(Math.abs(n)*40);texData.set([v,v,v,255],i*4)}const micro=new THREE.DataTexture(texData,128,128);micro.wrapS=micro.wrapT=THREE.RepeatWrapping;micro.repeat.set(26,26);micro.needsUpdate=true;
 const face=new THREE.MeshPhysicalMaterial({color:0x713485,metalness:.6,roughness:.18,roughnessMap:micro,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:1.2});const side=new THREE.MeshPhysicalMaterial({color:0xc6b4cb,metalness:.88,roughness:.22,clearcoat:.6,envMapIntensity:1.6});
 // Subtle cast-enamel curvature produces spatial reflection, not a flat color plate.
 face.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 enamelPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nenamelPosition=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 enamelPosition;').replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize(normal+vec3(.105*sin(enamelPosition.x*1.6+enamelPosition.y*.6),.08*cos(enamelPosition.y*1.7-enamelPosition.x*.4),0.));').replace('#include <clearcoat_normal_fragment_begin>','#include <clearcoat_normal_fragment_begin>\nclearcoatNormal=normal;');};
 const badge=new THREE.Group();badge.name='Source-exact semantic badge assembly';scene.add(badge);const groups={},stats={};let vertices=0;
 for(const [name,polys] of Object.entries(geometryData)){
  const group=new THREE.Group();group.name=name;badge.add(group);groups[name]=group;let holes=0;
  for(const [i,p] of polys.entries()){
   const coords=a=>a.map(([x,y])=>new THREE.Vector2((x-319.3)*.01,(319.5-y)*.01));const shape=new THREE.Shape(coords(p.outer));for(const h of p.holes)shape.holes.push(new THREE.Path(coords(h)));holes+=p.holes.length;
   const noBevel=new Set(coords(p.noBevel).map(v=>v.x.toFixed(8)+','+v.y.toFixed(8)));
   const depth=(name.includes('Page')?.18:name==='braidedRim'?.27:.21);const geo=new ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelThickness:.008,bevelSize:.0055,bevelSegments:3,curveSegments:1,bevelAllowed:v=>!noBevel.has(v.x.toFixed(8)+','+v.y.toFixed(8))});geo.translate(0,0,-depth);const pos=geo.attributes.position;for(let j=0;j<pos.count;j++)pos.setZ(j,Math.round(pos.getZ(j)*1e7)/1e7);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,[face,side]);mesh.name=`${name}-${i}`;mesh.userData={semantic:name,originalApertures:p.holes.length,sourceDerived:true,artificialCutVerticesUnbeveled:noBevel.size};group.add(mesh);vertices+=geo.attributes.position.count;
  }
  stats[name]={meshes:polys.length,holes};
 }
 // All front lettering is aperture topology of the same hinged solid: it cannot drift.
 const landmarks={leftPage:[[-1.6,1.2,0],[-1.6,-1.2,0]],rightPage:[[1.6,1.2,0],[1.6,-1.2,0]],circuits:[[0,2.05,0],[0,-1.9,0]],letterBand:[[0,2.5,0]],braidedRim:[[0,3,0]]};
 window.sceneMetrics={duration:5,fps:30,threeRevision:THREE.REVISION,geometryType:'ExtrudeGeometry',sourcePaths:53,sourceHoles:164,semanticGroups:stats,vertices,bevelSourcePixels:.55,bevelThicknessSourcePixels:.8,artificialCutsBeveled:false,sourceColor:'#6f337b',PBRBaseColor:'#713485',background:'Perspective depth convergence; long forward-traveling light streaks; curved trajectories and acceleration, derived from the road/lane light-pair and distortion description. Original implementation here uses cylindrical depth lanes rather than a road.',width:1920,height:1080,pose:{}};
 function draw(t){const open=phase(t,.12,1.85),settle=phase(t,0,2.65),cam=phase(t,1.55,2.8), early=1-phase(t,0,1.7);
  groups.leftPage.rotation.set(0,1.24*(1-open),0);groups.rightPage.rotation.set(0,-1.24*(1-open),0);
  groups.leftPage.position.set(0,0,.56*(1-settle));groups.rightPage.position.copy(groups.leftPage.position);
  groups.circuits.rotation.set(.10*(1-settle),-.2*(1-settle),-.28*(1-settle));groups.circuits.position.set(0,0,-.24*(1-settle));
  groups.letterBand.rotation.set(.16*(1-settle),-.30*(1-settle),-.85*(1-settle));groups.letterBand.position.set(0,0,.15*(1-settle));
  groups.braidedRim.rotation.set(-.13*(1-settle),.34*(1-settle),1.1*(1-settle));groups.braidedRim.position.set(0,0,-.63*(1-settle));
  badge.rotation.set(.06*early,.12*early,-.07*early);
  const az=.57*(1-cam),el=.26*(1-cam);camera.position.set(12*Math.sin(az)*Math.cos(el),12*Math.sin(el),12*Math.cos(az)*Math.cos(el));camera.lookAt(0,0,0);camera.zoom=.93+.07*cam;camera.updateProjectionMatrix();
  const progress=clamp((t-2.8)/1.45),angle=Math.PI/2-progress*Math.PI*2;const active=t>=2.8&&t<4.25;const strength=active?Math.sin(Math.PI*progress)**.35:0;sweep.position.set(3.7*Math.cos(angle),3.7*Math.sin(angle),2.2);sweep.intensity=57*strength;sweep2.position.set(3*Math.cos(angle-.20),3*Math.sin(angle-.20),1.3);sweep2.intensity=14*strength;scene.environmentRotation.z=active?-progress*Math.PI*2:0;
  scene.updateMatrixWorld(true);let maxError=0;for(const[name,pts]of Object.entries(landmarks))for(const p of pts){let v=new THREE.Vector3(...p),w=v.clone();groups[name].localToWorld(w);maxError=Math.max(maxError,v.distanceTo(w))}
  window.sceneMetrics.pose={time:t,leftPageAngle:groups.leftPage.rotation.y,rightPageAngle:groups.rightPage.rotation.y,leftPageAngleDegrees:THREE.MathUtils.radToDeg(groups.leftPage.rotation.y),rightPageAngleDegrees:THREE.MathUtils.radToDeg(groups.rightPage.rotation.y),ringBandAngle:groups.letterBand.rotation.toArray().slice(0,3),braidedRimAngle:groups.braidedRim.rotation.toArray().slice(0,3),camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),azimuth:az,elevation:el,zoom:camera.zoom},assemblyErrorWorld:maxError,assemblyErrorSourcePixels:maxError*100,gloss:{phase:t<2.8?'pending':t<4.25?'orbit':'complete',progress,angle,strength},stage:t<.2?'layered rotation':t<1.85?'hinged opening':t<2.8?'front alignment':t<4.25?'one metallic orbit':'static final hold'};
  galaxy.draw(t,open);renderer.clear();renderer.render(galaxy.scene,galaxy.camera);renderer.clearDepth();renderer.render(scene,camera);window.sceneMetrics.pose.backgroundTime=t;window.sceneMetrics.pose.nebulaOpening=open;
 }
 window.__sceneDebug={THREE,scene,camera,renderer,galaxy,badge,groups,face,side,sweep,sweep2,geometryData,landmarks};window.__drawScene=draw;draw(pending);window.animationReady=true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
