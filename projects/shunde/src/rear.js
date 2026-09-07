// Photo-confirmed rear identity; all coordinates below remain estimates, not a survey.
export const REAR=Object.freeze({center:[-5,-15],radius:6.4,lowRoof:14.8,orientationStatus:'user-confirmed-rear'});
const arcPoints=(radius,a,b,n=64)=>Array.from({length:n+1},(_,i)=>{const t=a+(b-a)*i/n;return [-5+radius*Math.cos(t),-15+radius*Math.sin(t)];});
const rearArc=arcPoints(6.4,0,-Math.PI);
export const mainFootprint=[[-33.28,5],[33.28,5],[32,-1],[1.4,-9],...rearArc,[-27,-9]];
// Screen-left in the rear photo is world +X: one planar tall-hall facade.
const hallLine=Array.from({length:9},(_,i)=>{const t=i/8;return [28+(1.4-28)*t,-6+(-15+6)*t];});
export const lowFootprint=[[1.4,-9],[32,-1],[28,-6],...hallLine.slice(1)];

export function addRear(THREE,B,{part,tiers,roof,upper,portico,arc,campus,S,materials}){
 const {tile,concrete,limestone,glass,frame,spandrel,paving}=materials,{box,cylinder}=B;
 function solid(parent,name,points,bottom,top,material,role,holes=[]){
  const g=part(name,parent,{role,geometryStatus:'photo-constrained-estimate'}),shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
  for(const h of holes)shape.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(...p))));
  const geo=new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false,steps:1,curveSegments:64});
  geo.rotateX(Math.PI/2);geo.translate(0,top,0);B.worldUV(geo,material);geo.setIndex(Array.from({length:geo.attributes.position.count},(_,i)=>i));B.add(g,geo,material);return g;
 }
 function sector(g,a,b,bottom,top,material,r=6.4,thickness=.42){
  if(b-a<1e-6||top<=bottom)return;
  const n=Math.max(2,Math.ceil((b-a)*36));
  // Boundary follows the same sampled circle as the roof. Annular pieces leave physical openings.
  const p=[...arcPoints(r,a,b,n),...arcPoints(r-thickness,b,a,n)];
  const shape=new THREE.Shape(p.map(p=>new THREE.Vector2(...p)));
  const geo=new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false,steps:1});geo.rotateX(Math.PI/2);geo.translate(0,top,0);B.worldUV(geo,material);geo.setIndex(Array.from({length:geo.attributes.position.count},(_,i)=>i));B.add(g,geo,material);
 }
 const slots=[-Math.PI*.86,-Math.PI*.68,-Math.PI*.50,-Math.PI*.32,-Math.PI*.14],half=.085;
 for(let l=0;l<4;l++){
  const b=S.facadeBands[l],g=part('Rear cylinder — curved ceramic wall '+l,tiers[l],{role:'rear-curved-wall'}),y=b.base,top=y+b.height;
  if(l===0){
   sector(g,-Math.PI,0,y,top,tile,5.05,.42);
  }else{
   let previous=-Math.PI;
   for(const a of slots){
    sector(g,previous,a-half,y,top,tile);previous=a+half;
    const sill=y+.35,head=Math.min(top-.35,18.3);
    sector(g,a-half,a+half,y,sill,tile);sector(g,a-half,a+half,head,top,tile);
    // Pale recessed jambs and a substantial central mullion divide each tall slot into paired narrow panes.
    sector(g,a-half,a-half+.017,sill,head,limestone,6.35,.36);
    sector(g,a+half-.017,a+half,sill,head,limestone,6.35,.36);
    sector(g,a-.017,a+.017,sill,head,limestone,6.35,.36);
    for(const [aa,bb] of [[a-half+.017,a-.017],[a+.017,a+half-.017]]){
     sector(g,aa,bb,sill,head,glass,6.18,.045);B.stats.windows++;
     for(let yy=sill+.9;yy<head;yy+=1.05)sector(g,aa,bb,yy,yy+.065,frame,6.24,.08);
    }
    sector(g,a-half,a+half,Math.min(head,sill+2),Math.min(head,sill+2.55),spandrel,6.20,.1);
   }
   sector(g,previous,0,y,top,tile);
  }
  // Angled side/back planes use the polygon boundaries, not the retired rectangular box.
  const edges=[[[-33.28,5],[-27,-9]],[[-27,-9],[-11.4,-15]],[[1.4,-15],[1.4,-9]],[[1.4,-9],[32,-1]],[[32,-1],[33.28,5]]];
  const side=part('Slanted rear and side planes '+l,tiers[l],{role:'rear-diagonal-wall'});
  for(const [a,bp] of edges){
   const dx=bp[0]-a[0],dz=bp[1]-a[1],length=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx);
   const segment=(start,end,yy,hh,material,depth=.38)=>{const t=(start+end)/2/length;box(side,'sloped plane',a[0]+dx*t,yy,a[1]+dz*t,end-start,hh,depth,material,angle);};
   const wh=l===0?1.3:2.6,wy=l===0?2.85:Math.min(y+2.45,16.1),bottom=wy-wh/2,head=wy+wh/2;
   segment(0,length,(y+bottom)/2,bottom-y,tile);segment(0,length,(head+top)/2,top-head,tile);
   const count=Math.max(1,Math.floor(length/3.3));
   for(let i=0;i<count;i++){
    const x0=i*length/count,x1=(i+1)*length/count;segment(x0,x0+.52,wy,wh,tile);segment(x0+.52,x1,wy,wh,glass,.10);B.stats.windows++;
    segment(x1-.07,x1,wy,wh,frame,.14);
   }
  }
  const floor=l===1||l===2?[mainFootprint[0],[-7.65,5],[-7.65,-4],[7.65,-4],[7.65,5],...mainFootprint.slice(1)]:mainFootprint;
  solid(tiers[l],'Nonrectangular main floor '+l,floor,y-.22,y,concrete,'footprint-slab');
  if(l===0||l===2)solid(tiers[l],'Straight hall base or upper floor '+l,lowFootprint,y-.22,y,concrete,'footprint-slab');
  if(l>0){
   // Only short inferred partitions inside the revised outline; no long rectangular wall remnants.
   for(const x of [-21,18])box(tiers[l],'inferred short partition',x,y+1,-1,.12,2,5.5,concrete);
  }
 }
 const supports=part('Rear cylinder raised base supports',arc,{role:'rear-supports'});
 for(const a of [-2.7,-1.95,-1.17,-.42]){const x=-5+6.02*Math.cos(a),z=-15+6.02*Math.sin(a);cylinder(supports,[x,.25,z],[x,3.9,z],.38,.38,limestone,32);}
 solid(upper,'Nonrectangular clerestory floor',mainFootprint,19.0,19.2,concrete,'footprint-slab');
 const parapet=part('High unbroken rear-cylinder parapet',roof,{role:'rear-curved-wall'});sector(parapet,-Math.PI,0,19.2,22.1,tile);
 // Solid high fascia along angled boundaries; no full-width rear rectangular parapet.
 for(const [a,b] of [[[-33.28,5],[-27,-9]],[[-27,-9],[-11.4,-15]],[[1.4,-15],[1.4,-9]],[[1.4,-9],[32,-1]],[[32,-1],[33.28,5]]]){
  const dx=b[0]-a[0],dz=b[1]-a[1];box(roof,'angled roof fascia',(a[0]+b[0])/2,20.65,(a[1]+b[1])/2,Math.hypot(dx,dz),2.9,.38,tile,-Math.atan2(dz,dx));
 }
 solid(roof,'Nonrectangular roof cap',mainFootprint,21.92,22.1,limestone,'footprint-roof');
 solid(portico,'Buried nonrectangular main foundation',mainFootprint,-.54,.9,limestone,'footprint-foundation');
 solid(portico,'Buried low-wing foundation',lowFootprint,-.54,.9,limestone,'footprint-foundation');
 // Photo-left hall: straight full-height glazing, not a curved stacked gallery.
 const hallBase=S.baseY,hallTop=S.facadeBands[2].base;
 const hall=part('Straight double-height glazed rear hall',tiers[0],{role:'rear-straight-tall-hall',intermediateSlabs:0,photoSide:'left',heightStatus:'estimated-from-photo'});
 const gallery=part('Straight upper hall window band',tiers[2],{role:'rear-straight-upper-wing'});
 for(let i=0;i<hallLine.length-1;i++){
  const a=hallLine[i],b=hallLine[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),rotation=-Math.atan2(dz,dx),x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
  box(hall,'straight hall low sill',x,hallBase+.10,z,length+.01,.20,.40,tile,rotation);
  box(hall,'straight hall head beam',x,hallTop-.22,z,length+.01,.44,.48,tile,rotation);
  box(hall,'continuous floor-to-ceiling glazing',x,(hallBase+hallTop)/2-.12,z+.06,length-.10,hallTop-hallBase-.68,.08,glass,rotation);B.stats.windows++;
  // Thin rails divide glass panels without introducing opaque storey bands or slabs.
  for(const yy of [hallBase+1.15,hallBase+3.6])box(hall,'fine hall glazing transom',x,yy,z-.04,length,.045,.08,frame,rotation);
  cylinder(hall,[a[0],hallBase,a[1]],[a[0],hallTop,a[1]],.19,.19,limestone,24);
  const windowBottom=hallTop+1.4,windowTop=REAR.lowRoof-1.5;
  box(gallery,'straight upper sill',x,(hallTop+windowBottom)/2,z,length+.01,windowBottom-hallTop,.42,tile,rotation);
  box(gallery,'straight upper window',x,(windowBottom+windowTop)/2,z+.05,length-.10,windowTop-windowBottom,.08,glass,rotation);B.stats.windows++;
  box(gallery,'straight upper lintel',x,(windowTop+REAR.lowRoof)/2,z,length+.01,REAR.lowRoof-windowTop,.45,tile,rotation);
  box(gallery,'upper mullion',a[0],(windowBottom+windowTop)/2,a[1],.10,windowTop-windowBottom,.12,frame,rotation);
 }
 const end=hallLine.at(-1);cylinder(hall,[end[0],hallBase,end[1]],[end[0],hallTop,end[1]],.19,.19,limestone,24);
 solid(tiers[3],'Straight hall roof',lowFootprint,REAR.lowRoof-.22,REAR.lowRoof,limestone,'footprint-roof');
 const pergola=part('Straight open hall roof frame',tiers[3],{role:'low-wing-pergola'});
 const dx=hallLine.at(-1)[0]-hallLine[0][0],dz=hallLine.at(-1)[1]-hallLine[0][1],length=Math.hypot(dx,dz),rotation=-Math.atan2(dz,dx);
 for(const [x,z] of hallLine){cylinder(pergola,[x,REAR.lowRoof,z],[x,17,z],.16,.16,limestone,16);box(pergola,'straight transverse roof beam',x,17,z+1.35,.20,.25,2.7,tile);}
 box(pergola,'single straight open roof lintel',(hallLine[0][0]+end[0])/2,17,(hallLine[0][1]+end[1])/2,length,.42,.32,tile,rotation);
 B.stats.leftRearHall={facade:'straight',glazing:'double-height',intermediateSlabs:0};
 // Flush walking route on continuous earth; no raised rectangular display plinth.
 const path=Array.from({length:65},(_,i)=>{const t=i/64,x=-46+92*t;return [x,-31+5*Math.sin(t*Math.PI*2)];});
 const band=[...path.map(([x,z])=>[x,z-1]),...path.toReversed().map(([x,z])=>[x,z+1])];
 solid(campus,'Flush curved rear garden walk',band,-.05,.005,paving,'rear-campus-path');
 B.stats.rearRectangleRemoved=true;B.stats.rearSlots=slots.length;B.stats.rearEvidence='user-confirmed-rear-photo';B.stats.rearParameters=REAR;
 return {mainFootprint,lowFootprint};
}
