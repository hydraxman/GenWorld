import {createBuilder} from './builder.js';
import {FOOTPRINT,SOURCE_ENU} from './footprint.js';
import {createNorthFacade} from './north-facade.js';
import {addPines} from './pine.js';

/** Combined source-plan complex. Shunde north/west/cylinder is the photo focus.
 * Curvature, heights, openings, landscaping and wing partition are interpretations.
 * All architecture uses x=E, z=-N. Never an isolated surveyed Shunde outline. */
export function createShundeModel(THREE,{textured=true,foliage=true,signGlyphs=null}={}){
 const B=createBuilder(THREE),{box,cylinder}=B;
 const group=new THREE.Group();group.name='Weilun + Shunde source-plan context — photo-informed reconstruction';
 group.userData={scope:'combined Weilun + Shunde; exact partition unknown',coordinates:'x=East,y=estimated height,z=-North',horizontalSource:'OSM way 84653293 v9',license:'ODbL 1.0',dimensionsStatus:'source-plan context; details and heights estimated'};
 const part=(name,parent=group,data={})=>{const g=new THREE.Group();g.name=name;g.userData=data;parent.add(g);return g;};
 const building=part('Architecture — continuous open courtyard boundary'),campus=part('Illustrative campus landscape');
 const arc=part('Court-facing round projection — NORTH wing, projecting SOUTH',building,{role:'court-cylinder'});
 const west=part('Straight-segmented WEST court hall — glazing coverage inferred',building,{role:'diagonal-hall',intermediateSlabs:0,glazingCoverage:'inferred on s11–s15; no photo-survey match claimed'});
 const context=part('Less-certain southern and eastern contextual wings',building,{inferred:true,partition:'unknown'});
 const roof=part('Shared concave roof and foundation — north opening unbridged',building);
 const plain=(name,color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({name,color,roughness,metalness});
 const pbr=(name,kind,rgb,world,size=512)=>textured?B.pbr(name,kind,rgb,world,size):plain(name,new THREE.Color(...rgb.map(v=>v/255)));
 const tile=pbr('Pale warm-gray ceramic grid','square-grid',[181,179,169],[1.68,1.68]);tile.normalScale?.set(.15,.15);
 const contextTile=pbr('Context wings — subtly cooler ceramic estimate','square-grid',[167,173,170],[1.68,1.68]);
 const spandrel=pbr('Muted mauve spandrel','square-grid',[151,138,134],[1.68,1.68]);
 const concrete=pbr('Roof weathered concrete','grain',[131,138,132],[2,2]);
 const glass=plain('Unified reflective architectural glazing','#567e91',.12,.65);
 const frame=plain('Warm silver anodized mullions','#b5b8af',.4,.5),shadow=plain('Window recess shadow','#172b30');
 const lawn=pbr('Garden grass','grain',[90,111,66],[3,3]);
 const paving=pbr('Campus stone paving','paving',[155,157,146],[4,4]);
 const stone=pbr('Garden granite','granite',[141,143,133],[2,2]);
 // Smooth only the source's faceted cylinder run; use the same sampled boundary
 // for envelope, cap and foundation so no rectangular core remains behind it.
 const curve=new THREE.CatmullRomCurve3(FOOTPRINT.slice(3,12).map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
 const arcPoints=curve.getPoints(96).map(v=>[v.x,v.z]);
 const outline=[...FOOTPRINT.slice(0,3),...arcPoints,...FOOTPRINT.slice(12)];
 // A lower gallery follows existing s11..s15 without moving ANY source vertex.
 // Its 8m inward roof setback is inferred: it is not a Weilun/Shunde division.
 const outerHall=FOOTPRINT.slice(11,17),inset=[];
 const normals=outerHall.slice(0,-1).map((a,i)=>{const b=outerHall[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);return [-(b[1]-a[1])/L,(b[0]-a[0])/L];});
 for(let i=0;i<outerHall.length;i++){
  const a=normals[Math.max(0,i-1)],b=normals[Math.min(normals.length-1,i)],mx=a[0]+b[0],mz=a[1]+b[1],den=mx*b[0]+mz*b[1];
  inset.push([outerHall[i][0]+8*mx/den,outerHall[i][1]+8*mz/den]);
 }
 const upperOutline=[...FOOTPRINT.slice(0,3),...arcPoints,...inset,...FOOTPRINT.slice(16)];
 const lowOutline=[...outerHall,...inset.toReversed()];
 for(const [points,y,h,material] of [[outline,-.4,1.3,tile],[upperOutline,21.55,.4,concrete],[lowOutline,14.4,.4,concrete]]){
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
  const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:1});g.rotateX(-Math.PI/2);g.translate(0,y,0);B.worldUV(g,material);B.add(roof,g,material);
 }
 // Segment-local x axis follows the boundary, positive z faces courtyard/exterior.
 const panel=(parent,a,b,name)=>{const g=part(name,parent);g.position.set(a[0],0,a[1]);g.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);return {g,L:Math.hypot(b[0]-a[0],b[1]-a[1])};};
 const strip=(g,x,w,y,h,mat,z=0,d=.4)=>{if(w>.001&&h>.001)box(g,'envelope panel',x,y,z,w,h,d,mat);};
 const pane=(g,x,y,w,h)=>{
  strip(g,x,w,y,h,shadow,.07,.20);strip(g,x,w-.10,y,h-.08,glass,-.07,.06);
  for(const xx of [-w/2,0,w/2])strip(g,x+xx,.055,y,h,frame,-.13,.09);
  for(const yy of [-h/2,h/2,h*.26])strip(g,x,w,y+yy,.055,frame,-.13,.09);
  B.stats.windows++;
 };
 // Cylinder: broad tiled piers with paired tall slit windows. Openings are real
 // holes in opaque wall strips (not blue rectangles laid over a solid cylinder).
 let length=0;
 for(let i=0;i<arcPoints.length-1;i++){
  const {g,L}=panel(arc,arcPoints[i],arcPoints[i+1],`Curved court facade ${i}`);
  const phase=(length+L/2)%7.3,slot=phase>2.4&&phase<5.0;
  if(!slot)strip(g,L/2,L+.015,11.25,20.7,tile);
  else{
   strip(g,L/2,L+.015,2.4,3,tile);strip(g,L/2,L+.015,20.15,2.9,tile);
   strip(g,L/2,L+.015,11.7,.55,tile,.08,.46);
   strip(g,L/2,L,11.25,14.4,glass,-.10,.07);
   for(let y=4.2;y<18.6;y+=1.2)strip(g,L/2,L,y,.07,frame,-.17,.13);
   for(const mark of [2.4,3.7,5.0]){const at=mark-length%7.3;if(at>=0&&at<=L)strip(g,at,.13,11.25,14.5,tile,-.15,.27);}
  }
  strip(g,L/2,L+.035,21.95,.65,tile);length+=L;
 }
 // Remaining envelope. North is replaced by the authored photo-front component.
 const perimeterEdges=[[0,1],[2,3],[11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],[18,19],[19,20],[20,21],[21,22],[22,23],[23,0]];
 for(const [ia,ib] of perimeterEdges){
  const isWest=ia>=11&&ia<=15,isContext=ia>=16||ia===23;
  const parent=isWest?west:isContext?context:building,{g,L}=panel(parent,FOOTPRINT[ia],FOOTPRINT[ib],`Boundary ${ia}-${ib}`),mat=isContext?contextTile:tile;
  const n=Math.max(1,Math.round(L/4.15)),w=L/n;
  for(let i=0;i<n;i++){
   const x=(i+.5)*w,opening=w*.68;
   if(isWest){
    // Photo-informed lower tall glass hall, not regular upper window storeys.
    pane(g,x,6.0,w-.25,10.2);strip(g,x-w/2,.25,6.0,10.2,tile,-.08,.5);
    strip(g,x,w,11.45,.65,tile);pane(g,x,12.3,w-.18,.9);
    strip(g,x,w,13.3,1.1,tile);strip(g,x,w,14.1,.5,tile);
   }else{
    for(const [base,top,cy,wh] of [[.9,3.9,2.75,1.3],[3.9,8.3,6.55,2.15],[8.3,12.7,10.95,2.15],[12.7,19.2,15.35,2.15]]){
     pane(g,x,cy,opening,wh);
     // Opaque piers flank, not cover, glazing.
     strip(g,x-w/2+(w-opening)/4,(w-opening)/2,(base+top)/2,top-base,mat);
     strip(g,x+w/2-(w-opening)/4,(w-opening)/2,(base+top)/2,top-base,mat);
     strip(g,x,opening,(base+cy-wh/2)/2,cy-wh/2-base,spandrel);
     strip(g,x,opening,(cy+wh/2+top)/2,top-cy-wh/2,mat);
    }
   }
   if(!isWest){pane(g,x,19.52,w-.3,.58);strip(g,x,w,21.1,2.3,mat);strip(g,x,w+.01,22.0,.45,mat);}
   strip(g,x,w+.01,.8,.25,mat);
  }
 }
 // Setback upper enclosure and open pergola are explicitly inferred depth,
 // but the lower glazed character and pale roof members are photo-supported.
 const pergola=part('Photo-informed open pale gallery pergola',west,{height:15.4,depthStatus:'inferred8m'});
 const stepChain=[outerHall[0],...inset,outerHall.at(-1)];
 for(let i=0;i<stepChain.length-1;i++){
  const {g,L}=panel(building,stepChain[i],stepChain[i+1],`Inferred upper setback enclosure ${i}`);
  strip(g,L/2,L,18.25,7.0,tile);strip(g,L/2,L,21.85,.5,tile);
 }
 for(let i=0;i<outerHall.length-1;i++){
  const {g,L}=panel(pergola,outerHall[i],outerHall[i+1],`Open pergola segment ${i}`);
  for(const z of [.35,3.6])strip(g,L/2,L+.04,15.35,.19,tile,z,.22);
  for(let x=.2;x<L;x+=1.45){strip(g,x,.16,15.37,.17,tile,2.0,3.65);if(x%5<1.5)strip(g,x,.18,14.72,1.35,tile,.35,.18);}
 }
 const front=createNorthFacade(THREE,{textured,foliage:false,signGlyphs});
 const a=FOOTPRINT[1],b=FOOTPRINT[2],dx=b[0]-a[0],dz=b[1]-a[1],angle=Math.atan2(dz,dx);
 // Local +z of old FRONT surface becomes geographic north; this component alone
 // is transformed, NOT an old solid or rear cylinder.
 const frontAnchor=part('NORTH entry surface — faces negative scene Z',building,{role:'north-entry',outwardNormal:[Math.sin(angle),0,-Math.cos(angle)],photoWidthStatus:'source north edge plus photo bay proportions, estimated placement'});
 frontAnchor.rotation.y=Math.PI-angle;frontAnchor.scale.x=Math.hypot(dx,dz)/66.56;
 frontAnchor.position.set((a[0]+b[0])/2-5*Math.sin(angle),0,(a[1]+b[1])/2+5*Math.cos(angle));front.building.traverse(o=>{if(o.isMesh&&/architectural glass/i.test(o.material.name))o.material=glass;});frontAnchor.add(front.building);
 const frontLandscape=part('North forecourt planting',campus);frontLandscape.position.copy(frontAnchor.position);frontLandscape.rotation.copy(frontAnchor.rotation);
 if(foliage)addPines(THREE,B,frontLandscape,{textured});
 box(campus,'continuous earth',32,-.49,22,550,.9,550,lawn);
 // Broad north apron joins ground, no display-model plinth.
 box(campus,'north forecourt',-8,.003,-23,89,.045,28,paving,.0255);
 for(let x=-47;x<35;x+=4)box(campus,'paving inlay',x,.029,-23,.065,.012,28,concrete);
 for(let z=-35;z<-11;z+=4)box(campus,'paving inlay',-8,.029,z,89,.012,.065,concrete);
 // Lawn and wandering paths are landscape inference, kept below architectural base.
 const pathMat=pbr('Fine pale garden gravel','grain',[192,189,167],[.6,.6]);
 const path=(points,width)=>{const c=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,.04,z)));const ps=c.getPoints(70);for(let i=0;i<70;i++){const a=ps[i],b=ps[i+1];box(campus,'continuous winding gravel path',(a.x+b.x)/2,.025,(a.z+b.z)/2,width,.045,a.distanceTo(b)+.07,pathMat,Math.atan2(b.x-a.x,b.z-a.z));}};
 path([[38,-8],[38,5],[40,16],[35,27],[18,35],[0,37],[-14,44]],1.8);
 path([[38,27],[50,31],[65,35],[74,42]],1.45);
 const bark=pbr('Garden tree bark','grain',[83,77,61],[.5,2]);
 if(foliage){
  const points=[[5,29,5.1],[27,31,5.5],[48,20,5.6],[63,30,6.2],[60,39,4.8],[-8,32,4.5],[69,13,6.0],[35,-23,7],[-45,-22,7]];
  const leafShape=new THREE.Shape();leafShape.moveTo(0,-.18);leafShape.quadraticCurveTo(.13,-.03,0,.22);leafShape.quadraticCurveTo(-.13,-.03,0,-.18);
  const leafGeo=new THREE.ShapeGeometry(leafShape,3),leafMat=plain('Illustrative deciduous leaves','#658143');leafMat.side=THREE.DoubleSide;
  const leaves=new THREE.InstancedMesh(leafGeo,leafMat,points.length*2300),dummy=new THREE.Object3D(),color=new THREE.Color();let ix=0;
  leaves.name='Garden foliage — instanced real leaf silhouettes';leaves.castShadow=true;leaves.receiveShadow=true;campus.add(leaves);
  for(const [tx,tz,h] of points){
   cylinder(campus,[tx,0,tz],[tx+.17,h,tz],.15,.035,bark,9);
   for(let k=0;k<7;k++){const an=k*2.4,r=1.2+(k%3)*.3;cylinder(campus,[tx,h*.43,tz],[tx+Math.cos(an)*r,h*(.72+k*.035),tz+Math.sin(an)*r],.055,.014,bark,6);}
   for(let j=0;j<2300;j++){
    const an=B.rand()*Math.PI*2,r=Math.cbrt(B.rand())*2.25,v=B.rand()*2-1;
    const branch=j%7,ba=branch*2.4,br=1.1+branch*.08;dummy.position.set(tx+Math.cos(ba)*br+Math.cos(an)*r*.62*Math.sqrt(1-v*v),h*.76+(branch%3)*.33+v*1.15,tz+Math.sin(ba)*br+Math.sin(an)*r*.62*Math.sqrt(1-v*v));dummy.rotation.set(B.rand()*6,B.rand()*6,B.rand()*6);dummy.scale.setScalar(.85+B.rand()*.7);dummy.updateMatrix();leaves.setMatrixAt(ix,dummy.matrix);color.setHSL(.20+B.rand()*.09,.28,.18+B.rand()*.16);leaves.setColorAt(ix++,color);
   }
  }
  leaves.instanceMatrix.needsUpdate=true;leaves.instanceColor.needsUpdate=true;
  B.stats.trees+=points.length;B.stats.leafInstances+=ix;
  const beds=[[1,22,2.2],[5,25,2.0],[9,26,1.5],[27,26,2.0],[31,24,1.7],[23,36,2.6],[43,33,2.1],[56,25,2.3]];
  const shrubs=new THREE.InstancedMesh(leafGeo,leafMat,beds.length*1100);shrubs.name='Layered courtyard shrub foliage';shrubs.castShadow=true;shrubs.receiveShadow=true;campus.add(shrubs);let si=0;
  for(const [sx,sz,radius] of beds)for(let j=0;j<1100;j++){
   const a=B.rand()*Math.PI*2,r=Math.sqrt(B.rand())*radius,y=.15+B.rand()*.85*(1-.55*r/radius);
   dummy.position.set(sx+Math.cos(a)*r,y,sz+Math.sin(a)*r*.65);dummy.rotation.set(B.rand()*6,B.rand()*6,B.rand()*6);dummy.scale.setScalar(.65+B.rand()*.65);dummy.updateMatrix();shrubs.setMatrixAt(si,dummy.matrix);color.setHSL(.24+B.rand()*.06,.28,.14+B.rand()*.12);shrubs.setColorAt(si++,color);
  }
  shrubs.instanceMatrix.needsUpdate=true;shrubs.instanceColor.needsUpdate=true;B.stats.leafInstances+=si;
 }
 // Benches, glacial boulders and low path lanterns give human-scale court cues.
 for(const [x,z] of [[11,30],[51,33],[63,20]]){
  for(const dx of [-.85,.85])box(campus,'bench stone leg',x+dx,.24,z,.2,.48,.48,stone);
  box(campus,'bench pale timber seat',x,.5,z,2.5,.12,.54,spandrel);
 }
 for(const [x,z,s] of [[4,34,1.2],[53,36,1],[19,27,.75]]){const g=new THREE.IcosahedronGeometry(s,1);g.scale(1.5,.63,1);g.translate(x,.42,z);B.add(campus,g,stone);}
 const lamp=plain('Frosted path lantern','#dddcc6',.5);
 for(const [x,z] of [[29,25],[44,29],[6,38],[56,34],[38,9]]){cylinder(campus,[x,0,z],[x,.43,z],.11,.11,stone,12);cylinder(campus,[x,.43,z],[x,.75,z],.13,.1,lamp,12);}
 B.finish();group.updateMatrixWorld(true);
 const stats={...B.stats,windows:B.stats.windows+front.stats.windows,sourceVertexCount:SOURCE_ENU.length,footprintVertexCount:outline.length,sourceScope:'combined Weilun + Shunde',northOpening:true,diagonalHall:true,porticoColumns:2};
 return {group,building,campus,arc,west,context,roof,portico:frontAnchor,tiers:[],stats,glassMaterial:glass,outline,setTime:()=>group.updateMatrixWorld(true)};
}
