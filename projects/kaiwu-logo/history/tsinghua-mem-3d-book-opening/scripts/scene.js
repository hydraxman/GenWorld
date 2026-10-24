import * as THREE from '../vendor/three/build/three.module.js';
import {ExtrudeGeometry} from './SelectiveExtrudeGeometry.js';
import geometryData from '../inputs/semantic-geometry.json';
let pending=0;
window.renderAt=t=>{pending=Math.max(0,Math.min(12,Number(t)));if(window.__drawScene)window.__drawScene(pending)};
window.addEventListener('hf-seek',e=>window.renderAt(e.detail.time));
const clamp=(v)=>Math.max(0,Math.min(1,v));const ease=(v)=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10)};const phase=(t,a,b)=>ease((t-a)/(b-a));
function init(){
 const sky=document.getElementById('sky'),ctx=sky.getContext('2d');
 const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('three-layer'),antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(960,960,false);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-4.15,4.15,4.15,-4.15,.1,100);
 const env=new THREE.Scene();env.background=new THREE.Color('#292037');
 const panel=(color,power,x,y,z,w,h,ry=0)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.y=ry;env.add(m)};
 panel('#f6e6ff',5,-4,2,5,1.3,8,-.4);panel('#adcff5',4,5,0,4,.7,7,.6);panel('#e9d4f8',4,0,5,3,7,.8);panel('#d6bfe4',1.15,0,0,8,5,6);panel('#653c88',2,-4,-3,-3,3,5,1);
 const pmrem=new THREE.PMREMGenerator(renderer),envMap=pmrem.fromScene(env,.03,.1,50);scene.environment=envMap.texture;
 scene.add(new THREE.HemisphereLight(0xc8d5f1,0x271c39,1.8));const key=new THREE.DirectionalLight(0xf3e4ff,2.8);key.position.set(-3,4,7);scene.add(key);const fill=new THREE.DirectionalLight(0xaccbf2,1.3);fill.position.set(4,-2,4);scene.add(fill);
 const sweep=new THREE.PointLight(0xf9e4ff,0,20,2);scene.add(sweep);const sweep2=new THREE.PointLight(0xbbdeff,0,15,2);scene.add(sweep2);
 const studio=new THREE.PointLight(0xf4ddff,38,20,2);studio.position.set(-3.7,4,4);scene.add(studio);
 const face=new THREE.MeshPhysicalMaterial({color:0x6f337b,metalness:.72,roughness:.23,clearcoat:.8,clearcoatRoughness:.19,envMapIntensity:.8});const side=new THREE.MeshPhysicalMaterial({color:0x472050,metalness:.86,roughness:.23,clearcoat:.7,envMapIntensity:1.1});
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
 let seed=202303;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};const stars=Array.from({length:650},()=>({x:rand()*960,y:rand()*960,r:.3+rand()**4*1.55,a:.25+rand()*.7,p:rand()*6.28}));
 function drawSky(time){const t=Math.min(time,11);let bg=ctx.createLinearGradient(0,0,960,960);bg.addColorStop(0,'#10233a');bg.addColorStop(.5,'#1b2944');bg.addColorStop(1,'#28203e');ctx.fillStyle=bg;ctx.fillRect(0,0,960,960);
  ctx.save();ctx.globalCompositeOperation='screen';
  for(let layer=0;layer<3;layer++){ctx.filter='blur(12px)';for(let x=-25;x<1000;x+=4){const wav=Math.sin(x*.007+t*.12+layer*1.7)*50+Math.sin(x*.021-t*.08+layer)*18;const top=65+layer*44+wav;const height=145+55*Math.sin(x*.009+layer);let grad=ctx.createLinearGradient(x,top,x,top+height);grad.addColorStop(0,'rgba(60,223,175,0)');grad.addColorStop(.25,layer===1?'rgba(113,106,221,.2)':'rgba(36,198,165,.19)');grad.addColorStop(.65,'rgba(59,161,182,.10)');grad.addColorStop(1,'rgba(27,72,132,0)');ctx.fillStyle=grad;ctx.fillRect(x,top,5,height);}
   ctx.filter='blur(2px)';ctx.strokeStyle=layer===1?'rgba(162,127,239,.18)':'rgba(74,225,189,.2)';ctx.lineWidth=2;ctx.beginPath();for(let x=-25;x<1000;x+=4){const y=102+layer*42+Math.sin(x*.007+t*.12+layer*1.7)*50+Math.sin(x*.021-t*.08+layer)*18;if(x===-25)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();
  }ctx.restore();
  const center=ctx.createRadialGradient(480,480,100,480,480,475);center.addColorStop(0,'rgba(58,73,110,.86)');center.addColorStop(.7,'rgba(48,61,92,.79)');center.addColorStop(1,'rgba(33,40,68,0)');ctx.fillStyle=center;ctx.fillRect(0,0,960,960);
  for(const s of stars){const dist=Math.hypot(s.x-480,s.y-480);const a=s.a*(dist<370?.24:1)*(.85+.15*Math.sin(t*.65+s.p));ctx.fillStyle=`rgba(213,230,249,${a})`;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,6.2832);ctx.fill()}
 }
 window.sceneMetrics={duration:12,fps:30,threeRevision:THREE.REVISION,geometryType:'ExtrudeGeometry',sourcePaths:53,sourceHoles:164,semanticGroups:stats,vertices,bevelSourcePixels:.12,bevelThicknessSourcePixels:.18,artificialCutsBeveled:false,sourceColor:'#6f337b',PBRBaseColor:'#6f337b',pose:{}};
 function draw(t){const open=phase(t,1.8,6.0),settle=phase(t,0,6.5),cam=phase(t,4.8,8), early=1-phase(t,0,3.8);
  groups.leftPage.rotation.set(0,1.24*(1-open),0);groups.rightPage.rotation.set(0,-1.24*(1-open),0);
  groups.leftPage.position.set(0,0,.56*(1-settle));groups.rightPage.position.copy(groups.leftPage.position);
  groups.circuits.rotation.set(.10*(1-settle),-.2*(1-settle),-.28*(1-settle));groups.circuits.position.set(0,0,-.24*(1-settle));
  groups.letterBand.rotation.set(.16*(1-settle),-.30*(1-settle),-.85*(1-settle));groups.letterBand.position.set(0,0,.15*(1-settle));
  groups.braidedRim.rotation.set(-.13*(1-settle),.34*(1-settle),1.1*(1-settle));groups.braidedRim.position.set(0,0,-.63*(1-settle));
  badge.rotation.set(.06*early,.12*early,-.07*early);
  const az=.57*(1-cam),el=.26*(1-cam);camera.position.set(12*Math.sin(az)*Math.cos(el),12*Math.sin(el),12*Math.cos(az)*Math.cos(el));camera.lookAt(0,0,0);camera.zoom=.93+.07*cam;camera.updateProjectionMatrix();
  const progress=clamp((t-8)/3),angle=Math.PI/2-progress*Math.PI*2;const active=t>=8&&t<11;const strength=active?Math.sin(Math.PI*progress)**.35:0;sweep.position.set(3.7*Math.cos(angle),3.7*Math.sin(angle),2.2);sweep.intensity=95*strength;sweep2.position.set(3*Math.cos(angle-.20),3*Math.sin(angle-.20),1.3);sweep2.intensity=23*strength;scene.environmentRotation.z=active?-progress*Math.PI*2:0;
  scene.updateMatrixWorld(true);let maxError=0;for(const[name,pts]of Object.entries(landmarks))for(const p of pts){let v=new THREE.Vector3(...p),w=v.clone();groups[name].localToWorld(w);maxError=Math.max(maxError,v.distanceTo(w))}
  window.sceneMetrics.pose={time:t,leftPageAngle:groups.leftPage.rotation.y,rightPageAngle:groups.rightPage.rotation.y,leftPageAngleDegrees:THREE.MathUtils.radToDeg(groups.leftPage.rotation.y),rightPageAngleDegrees:THREE.MathUtils.radToDeg(groups.rightPage.rotation.y),ringBandAngle:groups.letterBand.rotation.toArray().slice(0,3),braidedRimAngle:groups.braidedRim.rotation.toArray().slice(0,3),camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),azimuth:az,elevation:el,zoom:camera.zoom},assemblyErrorWorld:maxError,assemblyErrorSourcePixels:maxError*100,gloss:{phase:t<8?'pending':t<11?'orbit':'complete',progress,angle,strength},stage:t<2?'layered rotation':t<6?'hinged opening':t<8?'front alignment':t<11?'one metallic orbit':'static final hold'};
  drawSky(t);renderer.render(scene,camera);
 }
 window.__sceneDebug={THREE,scene,camera,renderer,badge,groups,face,side,sweep,sweep2,geometryData,landmarks};window.__drawScene=draw;draw(pending);window.animationReady=true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
