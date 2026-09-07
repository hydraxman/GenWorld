// Photo-confirmed rear identity; all coordinates below remain estimates, not a survey.
export const REAR=Object.freeze({center:[-5,-15],radius:9,lowRoof:14.8,orientationStatus:'user-confirmed-rear'});
const arcPoints=(radius,a,b,n=64)=>Array.from({length:n+1},(_,i)=>{const t=a+(b-a)*i/n;return [-5+radius*Math.cos(t),-15+radius*Math.sin(t)];});
const rearArc=arcPoints(9,0,-Math.PI);
export const mainFootprint=[[-33.28,5],[33.28,5],[32,-1],[4,-9],...rearArc,[-27,-9]];
const lowCurve=Array.from({length:33},(_,i)=>{const t=i/32,u=1-t;return [u*u*28+2*u*t*22+t*t*4,u*u*-6+2*u*t*-24+t*t*-15];});
export const lowFootprint=[[4,-9],[32,-1],[28,-6],...lowCurve.slice(1)];

export function addRear(THREE,B,{part,tiers,roof,upper,portico,arc,campus,S,materials}){
 const {tile,concrete,limestone,glass,frame,spandrel,paving}=materials,{box,cylinder}=B;
 function solid(parent,name,points,bottom,top,material,role,holes=[]){
  const g=part(name,parent,{role,geometryStatus:'photo-constrained-estimate'}),shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
  for(const h of holes)shape.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(...p))));
  const geo=new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false,steps:1,curveSegments:64});
  geo.rotateX(Math.PI/2);geo.translate(0,top,0);B.worldUV(geo,material);geo.setIndex(Array.from({length:geo.attributes.position.count},(_,i)=>i));B.add(g,geo,material);return g;
 }
 function sector(g,a,b,bottom,top,material,r=9,thickness=.42){
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
   sector(g,-Math.PI,0,y,top,tile,7.65,.42);
  }else{
   let previous=-Math.PI;
   for(const a of slots){
    sector(g,previous,a-half,y,top,tile);previous=a+half;
    const sill=y+.35,head=Math.min(top-.35,18.3);
    sector(g,a-half,a+half,y,sill,tile);sector(g,a-half,a+half,head,top,tile);
    // Pale recessed jambs and a substantial central mullion divide each tall slot into paired narrow panes.
    sector(g,a-half,a-half+.017,sill,head,limestone,8.95,.36);
    sector(g,a+half-.017,a+half,sill,head,limestone,8.95,.36);
    sector(g,a-.017,a+.017,sill,head,limestone,8.95,.36);
    for(const [aa,bb] of [[a-half+.017,a-.017],[a+.017,a+half-.017]]){
     sector(g,aa,bb,sill,head,glass,8.78,.045);B.stats.windows++;
     for(let yy=sill+.9;yy<head;yy+=1.05)sector(g,aa,bb,yy,yy+.065,frame,8.84,.08);
    }
    sector(g,a-half,a+half,Math.min(head,sill+2),Math.min(head,sill+2.55),spandrel,8.80,.1);
   }
   sector(g,previous,0,y,top,tile);
  }
  // Angled side/back planes use the polygon boundaries, not the retired rectangular box.
  const edges=[[[-33.28,5],[-27,-9]],[[-27,-9],[-14,-15]],[[4,-15],[4,-9]],[[4,-9],[32,-1]],[[32,-1],[33.28,5]]];
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
  const holes=l===1||l===2?[[[-7.65,4.98],[-7.65,-4],[7.65,-4],[7.65,4.98]]]:[];
  solid(tiers[l],'Nonrectangular main floor '+l,mainFootprint,y-.22,y,concrete,'footprint-slab',holes);
  if(l<3)solid(tiers[l],'Low courtyard wing floor '+l,lowFootprint,y-.22,y,concrete,'footprint-slab');
  if(l>0){
   // Only short inferred partitions inside the revised outline; no long rectangular wall remnants.
   for(const x of [-21,18])box(tiers[l],'inferred short partition',x,y+1,-1,.12,2,5.5,concrete);
  }
 }
 const supports=part('Rear cylinder raised base supports',arc,{role:'rear-supports'});
 for(const a of [-2.7,-1.95,-1.17,-.42]){const x=-5+8.62*Math.cos(a),z=-15+8.62*Math.sin(a);cylinder(supports,[x,.25,z],[x,3.9,z],.38,.38,limestone,32);}
 solid(upper,'Nonrectangular clerestory floor',mainFootprint,19.0,19.2,concrete,'footprint-slab');
 const parapet=part('High unbroken rear-cylinder parapet',roof,{role:'rear-curved-wall'});sector(parapet,-Math.PI,0,19.2,22.1,tile);
 // Solid high fascia along angled boundaries; no full-width rear rectangular parapet.
 for(const [a,b] of [[[-33.28,5],[-27,-9]],[[-27,-9],[-14,-15]],[[4,-15],[4,-9]],[[4,-9],[32,-1]],[[32,-1],[33.28,5]]]){
  const dx=b[0]-a[0],dz=b[1]-a[1];box(roof,'angled roof fascia',(a[0]+b[0])/2,20.65,(a[1]+b[1])/2,Math.hypot(dx,dz),2.9,.38,tile,-Math.atan2(dz,dx));
 }
 solid(roof,'Nonrectangular roof cap',mainFootprint,21.92,22.1,limestone,'footprint-roof');
 solid(portico,'Buried nonrectangular main foundation',mainFootprint,-.54,.9,limestone,'footprint-foundation');
 solid(portico,'Buried low-wing foundation',lowFootprint,-.54,.9,limestone,'footprint-foundation');
 // Lower, gently curving open courtyard gallery, connected to the cylinder and diagonal main wing.
 for(let l=0;l<3;l++){
  const y=S.facadeBands[l].base,top=l===2?REAR.lowRoof:S.facadeBands[l+1].base;
  const g=part('Low curved courtyard gallery '+l,tiers[l],{role:'low-curved-wing'});
  for(let i=0;i<lowCurve.length-1;i++){
   const a=lowCurve[i],b=lowCurve[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),rotation=-Math.atan2(dz,dx),x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
   box(g,'curved gallery floor edge',x,y+.18,z,length+.02,.36,.46,tile,rotation);
   box(g,'curved gallery lintel',x,top-.34,z,length+.02,.68,.5,tile,rotation);
   if(l<2)box(g,'recessed gallery glazing',x,(y+top)/2,z+.10,length,top-y-.9,.08,glass,rotation);
   if(i%4===0){cylinder(g,[a[0],y,a[1]],[a[0],top,a[1]],.23,.23,limestone,24);}
   if(l===2){box(g,'open gallery balustrade',x,y+1,z,length,.10,.10,frame,rotation);for(const yy of [y+.35,y+.68])box(g,'gallery horizontal rail',x,yy,z,length,.045,.06,frame,rotation);}
  }
 }
 solid(tiers[3],'Lower courtyard roof',lowFootprint,REAR.lowRoof-.22,REAR.lowRoof,limestone,'footprint-roof');
 const pergola=part('Open low courtyard roof frame',tiers[3],{role:'low-wing-pergola'});
 for(let i=0;i<lowCurve.length;i+=4){const [x,z]=lowCurve[i];cylinder(pergola,[x,REAR.lowRoof,z],[x,17,z],.16,.16,limestone,16);box(pergola,'gallery roof beam',x,17,z+1.35,.20,.25,2.7,tile);}
 for(let i=0;i<lowCurve.length-1;i++){const a=lowCurve[i],b=lowCurve[i+1];box(pergola,'curved open roof lintel',(a[0]+b[0])/2,17,(a[1]+b[1])/2,Math.hypot(b[0]-a[0],b[1]-a[1])+.01,.42,.32,tile,-Math.atan2(b[1]-a[1],b[0]-a[0]));}
 // Flush walking route on continuous earth; no raised rectangular display plinth.
 const path=Array.from({length:65},(_,i)=>{const t=i/64,x=-46+92*t;return [x,-31+5*Math.sin(t*Math.PI*2)];});
 const band=[...path.map(([x,z])=>[x,z-1]),...path.toReversed().map(([x,z])=>[x,z+1])];
 solid(campus,'Flush curved rear garden walk',band,-.05,.005,paving,'rear-campus-path');
 B.stats.rearRectangleRemoved=true;B.stats.rearSlots=slots.length;B.stats.rearEvidence='user-confirmed-rear-photo';B.stats.rearParameters=REAR;
 return {mainFootprint,lowFootprint};
}
