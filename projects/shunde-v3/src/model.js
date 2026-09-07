import {createBuilder} from './builder.js';
import {addPines} from './pine.js';
import {SHUNDE,assemblyAt} from './spec.js';

/** Actual geometry; the user photograph calibrates ratios, never used as a facade map. */
export function createShundeModel(THREE,{textured=true,foliage=true,signGlyphs=null}={}){
 const B=createBuilder(THREE),{box,cylinder}=B,S=SHUNDE,F=S.facade,E=S.entrance,W=S.width,D=S.depth;
 const group=new THREE.Group();group.name='Shunde V2 — new front-photo calibration';group.userData={...S};
 const part=(name,parent=group,data={})=>{const g=new THREE.Group();g.name=name;g.userData=data;parent.add(g);return g;};
 const building=part('Shunde V2 architecture — hidden elevations inferred');
 const campus=part('Continuous campus ground — planting placement photo-informed');
 const portico=part('Two-column recessed monumental entrance',building);
 const tiers=S.facadeBands.map(b=>part(b.name,building,{interiorStatus:S.interiorStatus,observableBand:true}));
 const upper=part('Recessed narrow roof window strip — not an asserted storey',building,{interiorStatus:S.interiorStatus});tiers.push(upper);
 const roof=part('Roof fascia — hidden roof inferred',building,{interiorStatus:S.interiorStatus});tiers.push(roof);
 const arc=part('Unverified arc hypothesis — excluded by default',building,{status:'inferred-placement-and-radius',orientationStatus:'unverified'});arc.visible=S.arcEnabled;
 const plain=(name,color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({name,color,roughness,metalness});
 const pbr=(name,kind,rgb,world,size=512)=>textured?B.pbr(name,kind,rgb,world,size):plain(name,new THREE.Color(...rgb.map(v=>v/255)));
 const tile=pbr('Pale warm-gray square ceramic grid','square-grid',[181,179,169],[1.68,1.68]);tile.normalScale?.set(.15,.15);
 const spandrel=pbr('Muted mauve-gray square-grid spandrels','square-grid',[151,138,134],[1.68,1.68]);spandrel.normalScale?.set(.12,.12);
 const limestone=pbr('Gray fine-grained round column stone','granite',[171,175,173],[1.4,1.4]);
 const stone=pbr('Dark brown mottled entrance stone','brown-marble',[63,48,40],[6,6],1024);stone.roughness=.34;
 const paving=pbr('Gray forecourt paving','paving',[127,132,130],[4,4]);
 const concrete=pbr('Inferred thin concrete slabs','grain',[163,164,158],[2,2]);
 const glass=plain('Unified sky-reflecting architectural glass','#567e91',.09,.65);
 const frame=plain('Warm silver anodized aluminium','#aeb3ac',.38,.54);
 const dark=plain('Deep window and entrance shadows','#15252b',.94);
 const grass=pbr('Muted campus lawn','grain',[84,99,65],[3,3]);
 const stripe=plain('Dark paving inlay','#565d5a',.92);
 const gold=plain('Sign brass','#c4a763',.28,.6);
 const stats=B.stats;Object.assign(stats,{porticoColumns:2,portals:1,hallIntermediateSlabs:0,arcClosedCircle:false,arcPlacement:'unverified-disabled',dimensionsStatus:S.dimensionsStatus,facadeBands:S.facadeBands,facadePierWidth:F.pierWidth,openCasements:0});
 const pane=(g,x,y,z,w,h,open=false)=>{
  box(g,'window reveal',x,y,z-.12,w+.10,h+.12,.24,dark);
  box(g,'glass',x,y,z+.04,w,h,.08,glass);stats.windows++;
  for(const yy of [-h/2,h/2,h*.27])box(g,'window horizontal aluminium',x,y+yy,z+.12,w+.08,.065,.11,frame);
  for(const xx of [-w/2,0,w/2])box(g,'window vertical aluminium',x+xx,y,z+.12,.064,h,.11,frame);
  if(open){
   const sash=part('Partly outward-open casement',g),sw=w*.23,sh=h*.70;
   sash.position.set(x-w/2,y-h*.14,z+.16);sash.rotation.y=-.61;
   box(sash,'open sash glass',sw/2,0,.01,sw,sh,.035,glass);
   for(const xx of [0,sw])box(sash,'open sash rail',xx,0,.05,.048,sh,.07,frame);
   for(const yy of [-sh/2,sh/2])box(sash,'open sash rail',sw/2,yy,.05,sw,.05,.07,frame);
   stats.openCasements++;
  }
 };
 for(const [l,b] of S.facadeBands.entries()){
  const g=tiers[l],y=b.base,h=b.height;
  // Thick piers and individual sill panels form the visual grid, not thin posts across wall stripes.
  for(let i=0;i<F.bayCount;i++){
   const x=-W/2+(i+.5)*F.bayWidth;if(l<3&&Math.abs(x)<E.halfWidth)continue;
   pane(g,x,b.windowCenter,4.91,F.opening,b.windowHeight,(l===1||l===2||l===3)&&i%5===3);
   const sillHeight=b.windowCenter-b.windowHeight/2-y-.17;
   box(g,'individual mauve sill panel',x,y+.17+sillHeight/2,5.01,F.opening,sillHeight,.30,spandrel);
   box(g,'thin floor-edge ceramic beam',x,y+.12,5.06,F.bayWidth,.25,.38,tile);
   const winTop=b.windowCenter+b.windowHeight/2;
   box(g,'ceramic window lintel',x,(winTop+y+h)/2,5.06,F.bayWidth,y+h-winTop,.38,tile);
   const pierX=x-F.bayWidth/2;
   // Photo-visible short round supports at the hall edges and two bays outward.
   // X positions follow the existing calibrated grid, not a claimed survey.
   const roundGround=l===0&&[2,4].some(n=>Math.abs(Math.abs(pierX)-n*F.bayWidth)<.01);
   if(roundGround){
    const support=part('Short round wing support',g,{role:'short-round-wing-support',placement:'photo-informed, grid-estimated'});
    cylinder(support,[pierX,y,4.68],[pierX,y+h,4.68],.57,.57,limestone,40);
   }else box(g,'broad vertical ceramic pier',pierX,y+h/2,5.04,F.pierWidth,h,.46,tile);
   if(i===F.bayCount-1)box(g,'end pier',W/2-.35,y+h/2,5.04,.7,h,.46,tile);
   // Narrow vertically aligned accent tiles visible in the front photograph.
   if(l>0)box(g,'slim pale-blue pier accent',pierX,y+h*.50,5.281,.055,h*.78,.014,frame);
  }
  if(l===0){
   const x=-2*F.bayWidth,support=part('Short round wing support',g,{role:'short-round-wing-support',placement:'photo-informed, grid-estimated'});
   cylinder(support,[x,y,4.68],[x,y+h,4.68],.57,.57,limestone,40);
  }
  // Exact side/rear openings are unknown; conservative repeated rhythm only.
  for(const side of [-1,1]){
   box(g,'inferred side sill',side*(W/2-.3),y+.6,5-D/2,.6,1.2,D,tile);
   box(g,'inferred side lintel',side*(W/2-.3),y+h-.45,5-D/2,.6,.9,D,tile);
   for(let j=0;j<6;j++){
    const z=3-j*3.9;
    box(g,'inferred side glass',side*(W/2+.02),b.windowCenter,z,.1,b.windowHeight,2.6,glass);stats.windows++;
    for(const dz of [-1.34,0,1.34])box(g,'side window rail',side*(W/2+.1),b.windowCenter,z+dz,.10,b.windowHeight,.065,frame);
    box(g,'inferred side pier',side*(W/2-.15),y+h/2,z-1.8,.6,h,1.03,tile);
   }
  }
  box(g,'inferred rear wall',0,y+h/2,5-D,W,h,.42,tile);
  for(let j=0;j<16;j++){const x=-W/2+(j+.5)*F.bayWidth;box(g,'inferred rear glazing',x,b.windowCenter,4.76-D,F.opening,b.windowHeight,.1,glass);stats.windows++;}
  if(l===0||l===3)box(g,'inferred slab',0,y-.11,5-D/2,W-.5,.22,D-.5,concrete);
  else{
   const wing=(W-2*E.halfWidth)/2;
   for(const side of [-1,1])box(g,'inferred wing slab',side*(E.halfWidth+wing/2),y-.11,5-D/2,wing-.1,.22,D-.5,concrete);
   box(g,'inferred rear slab beyond tall hall',0,y-.11,5-D*.72,E.halfWidth*2,.22,D*.53,concrete);
  }
  if(l>0)for(const x of [-24,-16,16,24])box(g,'inferred partition',x,y+1.0,-9,.12,2,15,concrete);
 }
 const R=S.roofBand;
 box(upper,'roof-strip slab',0,R.base-.1,5-D/2,W,.2,D,concrete);
 box(upper,'recessed slit shadow',0,R.windowCenter,4.21,W,R.windowHeight+.18,.4,dark);
 for(let i=0;i<32;i++){const x=-W/2+(i+.5)*W/32;box(upper,'narrow clerestory glass',x,R.windowCenter,4.43,W/32-.09,R.windowHeight,.1,glass);box(upper,'slit vertical frame',x-W/64,R.windowCenter,4.52,.06,R.windowHeight,.08,frame);stats.windows++;}
 box(roof,'roof solid cap',0,R.fasciaTop-.12,5-D/2,W+.2,.24,D+.2,limestone);
 box(roof,'broad pale ceramic roof fascia',0,(R.fasciaTop+R.fasciaBottom)/2,4.78,W+.12,R.fasciaTop-R.fasciaBottom,.82,tile);
 for(let i=0;i<17;i++)box(upper,'projecting short roof fin',-W/2+i*F.bayWidth,R.windowCenter+.13,5.13,.25,1.17,1.42,limestone);
 // The portico top aligns precisely with the bottom of the top regular facade group.
 const hallHeight=E.top-S.baseY;
 box(portico,'recessed curtain wall',0,S.baseY+hallHeight/2,1.15,E.halfWidth*2-.4,hallHeight,.18,glass);stats.windows++;
 for(let x=-7.2;x<7.3;x+=1.8)box(portico,'curtain mullion',x,S.baseY+hallHeight/2,1.27,.035,hallHeight,.06,dark);
 for(let y=1.9;y<E.top;y+=1.7)box(portico,'curtain transom',0,y,1.27,E.halfWidth*2,.035,.06,dark);
 for(const side of [-1,1])box(portico,'deep ceramic return',side*(E.halfWidth-.1),S.baseY+hallHeight/2,3.3,.50,hallHeight,4.45,tile);
 box(portico,'portico soffit',0,E.top-.14,3.35,E.halfWidth*2,.28,4.5,tile);
 for(const x of [-E.columnX,E.columnX]){
  cylinder(portico,[x,S.baseY,5.22],[x,E.top-.22,5.22],E.columnRadius,E.columnRadius,limestone,48);
  cylinder(portico,[x,S.baseY,5.22],[x,1.59,5.22],.63,.61,limestone,48);
  cylinder(portico,[x,1.57,5.22],[x,1.69,5.22],.67,.67,limestone,48);
  cylinder(portico,[x,E.top-.39,5.22],[x,E.top-.22,5.22],.60,.60,limestone,48);
 }
 const jamb=.65,doorWidth=E.portalWidth-jamb*2;
 for(const side of [-1,1])box(portico,'brown mottled portal jamb',side*(E.portalWidth-jamb)/2,(S.baseY+E.portalTop)/2,2.28,jamb,E.portalTop-S.baseY,.66,stone);
 box(portico,'brown mottled portal head',0,E.portalTop-E.portalHeadHeight/2,2.28,E.portalWidth,E.portalHeadHeight,.66,stone);
 for(let i=0;i<4;i++){const x=(i-1.5)*doorWidth/4;pane(portico,x,1.99,2.42,doorWidth/4-.045,2.16);box(portico,'door handle',x+.26,1.96,2.68,.035,.49,.06,frame);}
 const makeSign=(text,y,w,h,background)=>{
  const g=part(text+' — physical sign',portico,{role:'sign',text,height:y,background});
  box(g,'solid sign backing',0,y,2.69,w,h,.10,background==='white'?plain('White department plaque','#f0f0e9',.58):dark);
  if(textured){
   const c=document.createElement('canvas');c.width=background==='white'?1536:256;c.height=background==='white'?256:512;
   const cx=c.getContext('2d');cx.fillStyle=background==='white'?'#f0f0e9':'#22251f';cx.fillRect(0,0,c.width,c.height);
   if(background==='white'){
    cx.fillStyle='#181c19';cx.font='700 158px "Kaiti SC", "STKaiti", serif';cx.textAlign='center';cx.fillText(text,768,169,1440);
    cx.font='29px Georgia';cx.fillText('Department of Industrial Engineering, Tsinghua University',768,224,1450);
   }else if(signGlyphs)cx.drawImage(signGlyphs,25,34,206,444);
   const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
   box(g,'authored sign face',0,y,2.751,w-.035,h-.025,.012,new THREE.MeshStandardMaterial({name:text,map,roughness:.65}));
  }else box(g,'sign material fallback',0,y,2.751,w*.8,h*.8,.012,background==='white'?dark:gold);
  return g;
 };
 makeSign('舜德楼',8.0,.71,1.17,'black');
 makeSign('清华大学工业工程系',3.27,doorWidth,.59,'white');
 stats.signs=['舜德楼','清华大学工业工程系'];stats.portalHeightToColumnHeight=(E.portalTop-S.baseY)/(E.top-S.baseY);
 box(portico,'buried continuous building foundation',0,.18,5-D/2,W,1.44,D,limestone);
 // The photo's wide apron continues far past the columns into the facade plinth.
 box(portico,'continuous facade plinth course',0,.52,5.40,W,.76,1.3,limestone);
 box(portico,'continuous upper landing',0,.40,6.03,33.2,1.0,1.25,limestone);
 const warningYellow=plain('Warning yellow','#b9a338',.84),warningBlack=plain('Warning charcoal','#252b28',.92);
 for(let i=0;i<6;i++){
  const top=.9-i*.145,depth=2.25+i*.42,width=33.2+i*.36;
  const step=part(`Apron riser ${i+1}`,portico,{role:'entrance-step',profileStatus:'six visible risers approximated from photo',top,width});
  // Each nested solid reaches below grade; overlapping solids have no floating undersides.
  box(step,'continuous supported tread',0,(top-.10)/2,5.56+depth/2,width,top+.10,depth,limestone);
  const strip=part('Short alternating stair-nosing warning',step,{role:'stair-warning'});
  for(let j=0;j<16;j++)box(strip,'bonded anti-slip segment',1.65+(j-7.5)*.075,top+.002,5.56+depth-.07,.075,.004,.12,j%2?warningYellow:warningBlack);
 }
 // No ambiguous historic curved rear extension is generated in the evidence-led V2.
 box(campus,'continuous earth',0,-.45,0,320,.8,320,grass);
 box(campus,'flush broad forecourt',0,-.017,23,69,.067,36,paving);
 for(let x=-32;x<=32;x+=4)box(campus,'long paving inlay',x,.021,23,.075,.008,36,stripe);
 for(let z=6;z<42;z+=4)box(campus,'cross paving inlay',0,.021,z,69,.008,.075,stripe);
 for(const side of [-1,1])box(campus,'side walk',side*(W/2+2),-.008,-7,4,.065,48,paving);
 if(foliage)addPines(THREE,B,campus,{textured});
 B.finish();
 const setTime=t=>{const a=assemblyAt(t);tiers.forEach((g,i)=>{g.position.y=a*i*3.7;});group.updateMatrixWorld(true);};setTime(0);
 return {group,building,campus,tiers,portico,arc,stats,setTime,glassMaterial:glass};
}
