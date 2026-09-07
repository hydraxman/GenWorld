import {createBuilder} from './builder.js';
import {createLeafGeometry,createLeafMaterial} from '../../../shared/leaves.js';
import {SHUNDE,assemblyAt} from './spec.js';

/** Photo-informed massing. Metres are estimates; +Z is the photograph-facing elevation, not surveyed north. */
export function createShundeModel(THREE,{textured=true,foliage=true}={}){
 const B=createBuilder(THREE),{box,cylinder}=B;
 const group=new THREE.Group();group.name='Shunde Hall — photo-informed, dimensions estimated';
 group.userData={...SHUNDE};
 const part=(name,parent=group,data={})=>{const g=new THREE.Group();g.name=name;g.userData=data;parent.add(g);return g;};
 const building=part('Shunde architecture — hidden elevations inferred');
 const campus=part('Continuous campus ground — illustrative planting');
 const portico=part('Two-column monumental entrance',building);
 const tiers=Array.from({length:5},(_,i)=>part(`Tier ${i+1} — illustrative floor assembly`,building,{interiorStatus:'inferred-not-surveyed'}));
 const roof=part('Roof — unseen construction inferred',building,{interiorStatus:'inferred-not-surveyed'});tiers.push(roof);
 const arc=part('Courtyard curved volume — uncertain placement and radius',building,{status:'inferred-placement-and-radius',radiusEstimate:7.2,orientationStatus:'unverified'});
 const plain=(name,color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({name,color,roughness,metalness});
 const pbr=(name,kind,rgb,world,size=512)=>textured?B.pbr(name,kind,rgb,world,size):plain(name,new THREE.Color(...rgb.map(v=>v/255)));
 const tile=pbr('Pale gray small ceramic cladding','brick',[183,183,176],[.84,1.12]);tile.normalScale?.set(.22,.22);
 const spandrel=pbr('Warm gray horizontal sill panels','brick',[145,137,131],[.84,1.12]);spandrel.normalScale?.set(.18,.18);
 const limestone=pbr('Silver granite columns and coping','granite',[183,187,183],[1.4,1.4]);
 const stone=pbr('Dark polished entrance granite','granite',[65,59,53],[1.3,1.3]);stone.roughness=.33;
 const paving=pbr('Continuous gray campus paving','paving',[134,143,135],[4,4]);
 const concrete=pbr('Inferred floor concrete','grain',[180,179,161],[2,2]);
 const bark=pbr('Textured bark','grain',[72,65,49],[.8,2]);
 const glass=plain('Unified blue gray architectural glass','#597580',.10,.5);
 const frame=plain('Silver window aluminium','#99a6a5',.36,.63);
 const dark=plain('Deep recesses','#293b3c',.95);
 const grass=pbr('Muted campus lawn','grain',[89,105,65],[3,3]);
 const road=pbr('Campus asphalt','grain',[68,75,70],[4,4]);
 const stripe=plain('Dark paving inlay','#656d65',.92);
 const gold=plain('Sign brass','#c4a763',.28,.6);
 const stats=B.stats;Object.assign(stats,{porticoColumns:2,portals:1,hallIntermediateSlabs:0,arcClosedCircle:false,arcPlacement:'inferred',dimensionsStatus:SHUNDE.dimensionsStatus});
 const levels=[.8,4.9,9.1,13.3,17.5],heights=[4.1,4.2,4.2,4.2,3];
 const pane=(g,x,y,z,w,h,rot=0)=>{
  box(g,'recess',x,y,z-.04,w+.14,h+.15,.19,dark,rot);
  box(g,'unified glazing',x,y,z+.10,w,h,.10,glass,rot);stats.windows++;
  // Frames are laid out locally before rotating the completed facade bay.
  const local=(xx,yy,ww,hh,dd=.11)=>box(g,'aluminium',x+xx*Math.cos(rot),y+yy,z-xx*Math.sin(rot)+.19,ww,hh,dd,frame,rot);
  local(0,h/2,w+.12,.085);local(0,-h/2,w+.12,.085);local(-w/2,0,.07,h);local(w/2,0,.07,h);
  local(0,0,.065,h);local(0,h*.27,w,.06);
 };
 // Four principal facade rows. The central portico has no mid-height floors or opaque facade panels.
 for(let l=0;l<4;l++){
  const g=tiers[l],y=levels[l],h=heights[l];
  const regions=l<3?[[-19.5,23],[19.5,23]]:[[0,62]];
  for(const [x,w] of regions){
   box(g,'continuous horizontal floor band',x,y+.26,4.98,w,.52,.62,tile);
   box(g,'window sill spandrel',x,y+.94,4.99,w,.95,.42,spandrel);
   box(g,'continuous lintel',x,y+h-.29,4.97,w,.58,.62,tile);
  }
  for(let i=0;i<16;i++){
   const x=-29.0625+i*3.875;if(l<3&&Math.abs(x)<8)continue;
   pane(g,x,y+2.53,4.80,2.76,1.98);
   box(g,'slender deep facade pier',x-1.72,y+h/2,5.13,.49,h,.71,tile);
  }
  box(g,'left corner',-30.68,y+h/2,4.95,.65,h,.75,tile);box(g,'right corner',30.68,y+h/2,4.95,.65,h,.75,tile);
  // Hidden side elevations repeat the observed material/rhythm, but their exact openings are inferred.
  for(const side of [-1,1]){
   box(g,'side sill',side*30.68,y+.65,-10,.6,1.3,30,tile);
   box(g,'side lintel',side*30.68,y+h-.33,-10,.6,.66,30,tile);
   for(let j=0;j<7;j++){
    const z=2.5-j*4.15;
    box(g,'side glass',side*30.92,y+2.53,z,.11,1.98,2.95,glass);stats.windows++;
    for(const dz of [-1.5,0,1.5])box(g,'side aluminium',side*31.02,y+2.53,z+dz,.12,2.03,.075,frame);
    for(const yy of [-.99,.55,.99])box(g,'side aluminium',side*31.02,y+2.53+yy,z,.12,.075,3.04,frame);
    box(g,'side pier',side*30.76,y+h/2,z-1.89,.66,h,.65,tile);
   }
  }
  // Rear hypothesis retains honest simple openings, rather than invented measured rooms.
  box(g,'rear sill',0,y+.68,-24.8,62,1.36,.5,tile);box(g,'rear lintel',0,y+h-.33,-24.8,62,.66,.5,tile);
  for(let j=0;j<16;j++){
   const x=-29.0625+j*3.875;box(g,'rear glass',x,y+2.53,-25.08,2.76,1.98,.12,glass);stats.windows++;
   box(g,'rear pier',x-1.72,y+h/2,-24.98,.52,h,.65,tile);
   for(const dx of [-1.4,0,1.4])box(g,'rear mullion',x+dx,y+2.53,-25.18,.07,2.05,.1,frame);
  }
  // Leave a three-storey void immediately behind the front entrance.
  if(l===0||l===3)box(g,'floor slab',0,y-.12,-10,61.8,.24,29.7,concrete);
  else{
   for(const x of [-19.4,19.4])box(g,'wing slab',x,y-.12,-10,23,.24,29.7,concrete);
   box(g,'rear slab beyond hall',0,y-.12,-14.9,15.8,.24,19.8,concrete);
  }
  // Sparse, explicitly inferred rooms. Set back from the windows; no gratuitous furniture.
  if(l>0){
   for(const x of [-22,-14,14,22])box(g,'inferred partition',x,y+1.18,-12,.12,2.35,20,concrete);
   for(const x of [-19.4,19.4])box(g,'inferred corridor wall',x,y+1.18,-3.5,22,.0+2.35,.12,concrete);
  }
 }
 // Recessed clerestory, pronounced pale parapet and fin rhythm visible in user photograph.
 const upper=tiers[4];
 box(upper,'upper floor',0,17.47,-10,62,.26,30,concrete);
 box(upper,'front parapet below slit',0,18.22,5,62,1.28,.6,tile);
 box(upper,'slit shadow',0,19.18,4.40,61.4,.75,.3,dark);
 for(let i=0;i<26;i++){const x=-29.8+i*2.38;box(upper,'clerestory glass',x,19.18,4.55,2.18,.66,.1,glass);stats.windows++;box(upper,'slit frame',x-1.13,19.18,4.64,.075,.76,.09,frame);}
 for(const side of [-1,1])box(upper,'upper side wall',side*30.7,19,-10,.6,3,30,tile);
 box(upper,'upper rear wall',0,19,-24.8,62,3,.6,tile);
 box(roof,'roof cap',0,20.65,-10,62.5,.35,30.5,limestone);
 box(roof,'high fascia',0,20.38,4.96,62.3,1.38,.8,tile);
 box(roof,'upper coping',0,21.15,4.98,62.5,.25,.94,limestone);
 for(let i=0;i<13;i++)box(upper,'projecting vertical upper fin',-28+i*4.66,19.23,5.09,.28,1.48,1.35,limestone);
 // The tall central front hall: blue scene-reflecting curtain wall, 2 round columns, stone portal.
 box(portico,'recessed curtain wall',0,6.78,1.45,15.8,11.8,.22,glass);stats.windows++;
 for(let i=-4;i<=4;i++)box(portico,'curtain mullion',i*1.95,6.8,1.61,.064,11.9,.12,frame);
 for(let y=2.1;y<12.8;y+=2.15)box(portico,'curtain transom',0,y,1.61,15.8,.065,.12,frame);
 for(const x of [-8,8])box(portico,'portico deep return',x,6.94,3.17,.62,12.3,3.95,tile);
 box(portico,'portico soffit',0,13.0,3.2,16.6,.62,4.25,tile);
 for(const x of [-4.8,4.8]){
  cylinder(portico,[x,.8,5.5],[x,12.74,5.5],.52,.47,limestone,48);
  cylinder(portico,[x,.8,5.5],[x,1.53,5.5],.69,.64,limestone,48);
  cylinder(portico,[x,1.49,5.5],[x,1.64,5.5],.70,.70,limestone,48);
  cylinder(portico,[x,12.54,5.5],[x,12.74,5.5],.59,.59,limestone,48);
 }
 for(const x of [-3.32,3.32])box(portico,'dark granite portal jamb',x,4.92,2.30,.77,8.25,.56,stone);
 box(portico,'dark granite portal head',0,8.45,2.30,7.4,1.6,.56,stone);
 for(let i=-2;i<2;i++){const x=(i+.5)*1.43;pane(portico,x,2.12,2.64,1.4,2.55);box(portico,'door handle',x+.43,2.13,2.87,.035,.52,.07,frame);}
 box(portico,'entrance name rail',0,3.58,2.7,6,.32,.22,limestone);
 box(portico,'name plaque',0,8.49,2.61,.66,1.27,.15,stone);
 if(textured){
  const c=document.createElement('canvas');c.width=256;c.height=512;const cx=c.getContext('2d');cx.fillStyle='#35362d';cx.fillRect(0,0,256,512);cx.fillStyle='#dfcc85';cx.font='bold 120px serif';cx.textAlign='center';['舜','德','楼'].forEach((s,i)=>cx.fillText(s,128,143+i*150));
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;const m=new THREE.MeshStandardMaterial({name:'Shunde vertical name — authored lettering',map,roughness:.5});box(portico,'name lettering',0,8.49,2.70,.57,1.15,.012,m);
 }else box(portico,'name lettering',0,8.49,2.70,.40,.95,.012,gold);
 for(const x of [-6,-2,2,6])cylinder(portico,[x,12.63,4],[x,12.72,4],.1,.1,limestone,16);
 // Solid below-grade foundation meets the ground: no air gap beneath the .8m entrance datum.
 box(portico,'buried continuous building foundation',0,.22,-10,62,1.16,30,limestone);
 // Shallow, supported steps merge down into the continuous plaza, not a floating slab.
 for(let i=0;i<6;i++)box(portico,'supported entrance step',0,(.8-i*.125)/2,6.25+i*.34,17.5,.8-i*.125,1.45,limestone);
 // Photograph supports an arc, not a surveyed full circle. Its location and radius are a switchable hypothesis.
 const r=7.2,cx=7,cz=-24.6,segments=24;
 for(let k=0;k<segments;k++){
  const a=Math.PI/2+(k+.5)*Math.PI/segments,x=cx+r*Math.sin(a),z=cz+r*Math.cos(a),rot=a;
  const w=2*r*Math.sin(Math.PI/segments/2)+.025;
  // Tangent rotates local X, radial face points along sin(a),cos(a).
  const tangent=a;
  box(arc,'buried curved footing',x,.22,z,w,1.16,.5,limestone,tangent);
  for(let l=0;l<4;l++){
   const yy=levels[l],h=heights[l];box(arc,'curved cladding segment',x,yy+h/2,z,w,h,.33,tile,tangent);
   if(k%4===1){box(arc,'arc narrow glazing',x+.2*Math.sin(a),yy+2.30,z+.2*Math.cos(a),w*.52,2.75,.06,glass,tangent);stats.windows++;}
  }
  box(arc,'arc upper parapet',x,18.3,z,w,1.65,.42,tile,tangent);
 }
 // Continuous landscaping: no finite raised rectangular display base.
 box(campus,'earth continuing beyond frame',0,-.45,0,320,.8,320,grass);
 box(campus,'flush central forecourt',0,-.017,20.5,51,.067,31,paving);
 box(campus,'continuous campus street',0,-.006,42,320,.065,12,road);
 box(campus,'rear garden walk',0,-.012,-34.5,90,.063,3,paving);
 for(let x=-24;x<=24;x+=4)box(campus,'long paving inlay',x,.021,20.5,.085,.008,31,stripe);
 for(let z=6;z<36;z+=4)box(campus,'cross paving inlay',0,.021,z,51,.008,.085,stripe);
 for(const side of [-1,1])box(campus,'side walk',side*34.2,-.008,-10,4,.065,52,paving);
 // Actual lobed, curved, CC0 textured leaf geometry shared with the earlier building.
 if(foliage){
  const positions=[[-14,16,1],[14,16,.96],[-25,23,1.1],[25,25,1.08],[-39,10,1.25],[39,9,1.2],[-40,-16,1.2],[40,-18,1.15],[-28,-39,1.05],[28,-40,1.1],[-16,49,1.15],[19,50,1.2]];
  const leaves=new THREE.InstancedMesh(createLeafGeometry(THREE,.57),createLeafMaterial(THREE,'CC0 photographed lobed maple leaves'),positions.length*1600);leaves.name='Instanced curved photographed leaves — planting illustrative';leaves.castShadow=true;leaves.receiveShadow=true;campus.add(leaves);
  const dummy=new THREE.Object3D();let index=0;
  for(const [x,z,s] of positions){
   const top=6.7*s;stats.trees++;cylinder(campus,[x,-.05,z],[x+.12,top*.81,z+.14],.23*s,.09*s,bark,12);
   const clusters=[];
   for(let b=0;b<10;b++){
    const a=b*2.399,rad=(b<6?2.25:1.25)*s,end=[x+Math.cos(a)*rad,top+(b<6?-.8:.7)*s,z+Math.sin(a)*rad];clusters.push(end);cylinder(campus,[x,top*.62,z],end,.09*s,.018*s,bark,8);
   }
   for(let j=0;j<1600;j++){
    const c=clusters[j%10],a=B.rand()*Math.PI*2,u=B.rand()*2-1,rad=Math.cbrt(B.rand())*1.42*s;
    dummy.position.set(c[0]+Math.sqrt(1-u*u)*Math.cos(a)*rad,c[1]+u*rad*.62,c[2]+Math.sqrt(1-u*u)*Math.sin(a)*rad);
    dummy.rotation.set(-.3+B.rand()*1.8,B.rand()*Math.PI*2,B.rand()*Math.PI*2);dummy.scale.setScalar(.70+B.rand()*.65);dummy.updateMatrix();leaves.setMatrixAt(index++,dummy.matrix);
   }
  }
  leaves.instanceMatrix.needsUpdate=true;stats.leafInstances=index;
 }
 B.finish();
 const setTime=t=>{const a=assemblyAt(t);tiers.forEach((g,i)=>{g.position.y=a*i*3.7;});group.updateMatrixWorld(true);};
 setTime(0);
 return {group,building,campus,tiers,portico,arc,stats,setTime,glassMaterial:glass};
}
