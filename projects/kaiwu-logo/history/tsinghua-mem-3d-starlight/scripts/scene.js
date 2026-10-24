import * as THREE from '../vendor/three/build/three.module.js';
import {SVGLoader} from '../vendor/three/examples/jsm/loaders/SVGLoader.js';
import source from '../inputs/Tsinghua-MEM-2023-Transparent.svg';
import nebulaURL from '../assets/nebula-0.jpg';

let pending=0;
window.renderAt=t=>{pending=Math.max(0,Math.min(6,Number(t)));if(window.__drawScene)window.__drawScene(pending);};
window.addEventListener('hf-seek',e=>window.renderAt(e.detail.time));
function init(){
 const sky=document.getElementById('sky'),ctx=sky.getContext('2d');
 const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('three-layer'),antialias:true,alpha:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.setSize(960,960,false);renderer.setClearColor(0x000000,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,100);camera.position.set(0,0,15.6);camera.lookAt(0,0,0);
 const env=new THREE.Scene();env.background=new THREE.Color('#1c1630');
 const panel=(color,intensity,x,y,z,w,h,ry=0)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.y=ry;env.add(m);};
 panel('#e8ddff',5,-3,1,5,1.2,9,-.4);panel('#a9e5ff',3.5,5,2,3,1.0,8,.7);panel('#e5b7f5',3,0,5,4,8,.65,0);panel('#8c5dc9',1.5,-5,-2,-2,3,7,1);panel('#dfc9f6',2.4,.2,.7,8,4.5,5.5,0);
 const pmrem=new THREE.PMREMGenerator(renderer);const envMap=pmrem.fromScene(env,.02,.1,50);scene.environment=envMap.texture;
 scene.add(new THREE.HemisphereLight(0xc5d6ff,0x271334,1.1));
 const key=new THREE.DirectionalLight(0xe5d5ff,2.2);key.position.set(-4,5,8);scene.add(key);
 const fill=new THREE.DirectionalLight(0x86cfff,1.4);fill.position.set(5,-1,4);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xc18ef9,2.4);rim.position.set(-3,-3,-3);scene.add(rim);
 const face=new THREE.MeshPhysicalMaterial({color:0x944ba4,metalness:.64,roughness:.235,clearcoat:.85,clearcoatRoughness:.15,iridescence:.22,iridescenceIOR:1.3,iridescenceThicknessRange:[140,340],envMapIntensity:1.0});
 const side=new THREE.MeshPhysicalMaterial({color:0x4c235f,metalness:.86,roughness:.26,clearcoat:.6,clearcoatRoughness:.18,envMapIntensity:.95});
 const parsed=new SVGLoader().parse(source);const badge=new THREE.Group();badge.name='Tsinghua MEM — original SVG extruded';scene.add(badge);
 const native=new THREE.Group();native.name='SVG coordinate system';native.scale.set(.01,-.01,.01);native.position.set(-3.2,3.2,-.07);badge.add(native);
 let shapeCount=0,holeCount=0,vertices=0;const pathStats=[];
 parsed.paths.forEach((path,i)=>{const shapes=SVGLoader.createShapes(path);let holes=0;shapes.forEach((shape,j)=>{holes+=shape.holes.length;const geometry=new THREE.ExtrudeGeometry(shape,{depth:14,bevelEnabled:true,bevelThickness:.22,bevelSize:.22,bevelSegments:2,steps:1,curveSegments:10});geometry.computeBoundingBox();const mesh=new THREE.Mesh(geometry,[face,side]);mesh.name=`source-path-${i}-shape-${j}`;mesh.userData={sourcePathIndex:i,shapeIndex:j,holes:shape.holes.length,depthSourcePx:14,bevelSourcePx:.22};native.add(mesh);vertices+=geometry.attributes.position.count;});pathStats.push({path:i,shapes:shapes.length,holes});shapeCount+=shapes.length;holeCount+=holes;});
 window.__sceneDebug={THREE,scene,camera,badge,renderer,native,face,side,source,parsed};
 window.sceneMetrics={duration:6,fps:30,threeRevision:THREE.REVISION,sourcePathCount:parsed.paths.length,shapeCount,holeCount,meshCount:native.children.length,vertices,depth:14,depthUnits:'source pixels',bevel:.22,geometryType:'ExtrudeGeometry',pathStats,materials:{face:{color:face.color.getHexString(),metalness:face.metalness,roughness:face.roughness,clearcoat:face.clearcoat,iridescence:face.iridescence},side:{color:side.color.getHexString(),metalness:side.metalness,roughness:side.roughness}},camera:{fov:32,position:[0,0,15.6]},pose:{}};
 const nebula=new Image();nebula.src=nebulaURL;
 let seed=202309;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const stars=Array.from({length:900},()=>({x:rand()*1100-70,y:rand()*1100-70,r:.35+rand()**4*1.65,a:.28+rand()*.65,p:rand()*6.28,z:.2+rand()*.8}));
 function drawSky(t){
  ctx.fillStyle='#18223e';ctx.fillRect(0,0,960,960);
  if(nebula.complete&&nebula.naturalWidth)ctx.drawImage(nebula,-35+6*Math.sin(t*.25),-40+4*Math.cos(t*.22),1040,1040);
  // Medium-blue light through apertures; the brightest nebula stays outside the badge.
  const g=ctx.createRadialGradient(480,480,140,480,480,520);g.addColorStop(0,'rgba(46,64,103,.84)');g.addColorStop(.62,'rgba(45,59,95,.75)');g.addColorStop(.82,'rgba(95,72,139,.12)');g.addColorStop(1,'rgba(73,50,110,0)');ctx.fillStyle=g;ctx.fillRect(0,0,960,960);
  for(const s of stars){const x=s.x+t*1.1*s.z,y=s.y-t*.45*s.z;const d=Math.hypot(x-480,y-480);if(d<365)continue;const a=s.a*(.82+.18*Math.sin(t*.8+s.p));ctx.fillStyle=`rgba(219,226,255,${a})`;ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill();if(s.r>1.4){const glow=ctx.createRadialGradient(x,y,0,x,y,s.r*5);glow.addColorStop(0,`rgba(173,198,255,${a*.35})`);glow.addColorStop(1,'rgba(120,155,255,0)');ctx.fillStyle=glow;ctx.fillRect(x-s.r*5,y-s.r*5,s.r*10,s.r*10);}}
 }
 window.__drawScene=(t)=>{const phase=t/6*Math.PI*2;badge.rotation.set(Math.sin(phase)*.075,Math.sin(phase)*.305,Math.sin(phase)*.015);scene.environmentRotation.y=.12*Math.sin(phase*.5);window.sceneMetrics.pose={time:t,x:badge.rotation.x,y:badge.rotation.y,z:badge.rotation.z,degreesY:THREE.MathUtils.radToDeg(badge.rotation.y)};drawSky(t);renderer.render(scene,camera);};
 nebula.onload=()=>{window.__drawScene(pending);window.animationReady=true;};
 if(nebula.complete&&nebula.naturalWidth){window.__drawScene(pending);window.animationReady=true;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
