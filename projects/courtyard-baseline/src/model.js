import {POOLS,poolSupport} from './pools.js';
import {createLeafGeometry,createLeafMaterial} from './leaves.js';
/** Photo-informed courtyard reconstruction. Y up, facade +Z; metres.
 * Only geometry/materials: no renderer, lights, cameras, network, or clock.
 */
export function createModel(THREE) {
  if (typeof document === 'undefined') throw new Error('createModel requires a browser canvas document.');
  const group = new THREE.Group();
  group.name = 'Photo-informed brick building and dry courtyard';
  const stats = { seed: 41827, basins: 3, pergolas: 2, pillars: 0, windows: 0, trees: 0, leafInstances: 0, textures: 0, batches: 0 };
  let seed = stats.seed;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const between = (a,b) => a + rand() * (b-a);
  const clamp = n => Math.max(0, Math.min(255, n));
  const color = (r,g,b) => `rgb(${clamp(r)|0},${clamp(g)|0},${clamp(b)|0})`;
  const sections = {};
  const buckets = new Map();
  const materials = {};
  const textureWorld = new Map();
  let current = 'Architecture';

  function canvas(size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    return [c, c.getContext('2d', {willReadFrequently:true})];
  }
  function texture(c, srgb = false) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.name = `Procedural ${stats.textures++}`;
    return t;
  }
  function pbr(name, kind, rgb, world, size = 512) {
    const [c,ctx] = canvas(size), [h,hx] = canvas(size), [r,rx] = canvas(size);
    ctx.fillStyle = color(...rgb); ctx.fillRect(0,0,size,size);
    hx.fillStyle = '#858585'; hx.fillRect(0,0,size,size);
    rx.fillStyle = '#dddddd'; rx.fillRect(0,0,size,size);
    if (kind === 'brick' || kind === 'paving' || kind === 'tile') {
      const cols = kind === 'brick' ? 4 : kind === 'tile' ? 8 : 6;
      const rows = kind === 'brick' ? 16 : kind === 'tile' ? 12 : 12;
      const w = size/cols, ht = size/rows;
      ctx.fillStyle = kind === 'brick' ? '#a39887' : '#77776e'; ctx.fillRect(0,0,size,size);
      hx.fillStyle = '#444444'; hx.fillRect(0,0,size,size);
      for (let y=0; y<rows; y++) for (let x=-1; x<cols+1; x++) {
        const off = y%2 ? w/2 : 0, xx = x*w+off, yy = y*ht;
        const d = between(-15,15), gap = kind === 'brick' ? 2 : 2.5;
        ctx.fillStyle = color(rgb[0]+d,rgb[1]+d,rgb[2]+d);
        ctx.fillRect(xx+gap,yy+gap,w-gap*2,ht-gap*2);
        hx.fillStyle = '#b5b5b5'; hx.fillRect(xx+gap,yy+gap,w-gap*2,ht-gap*2);
        ctx.strokeStyle = 'rgba(255,255,245,.14)'; ctx.lineWidth=1;
        ctx.strokeRect(xx+gap+.5,yy+gap+.5,w-gap*2-1,ht-gap*2-1);
        if (kind==='tile') {
          ctx.strokeStyle='rgba(22,27,27,.3)';ctx.beginPath();ctx.moveTo(xx+w*.8,yy+2);ctx.lineTo(xx+w*.8,yy+ht-2);ctx.stroke();
        }
      }
    }
    // Fine mineral grains: albedo, micro-height, and roughness all remain local.
    for (let i=0;i<size*size*.16;i++) {
      const x=rand()*size,y=rand()*size,s=between(.35,kind==='granite'?2:1.5);
      ctx.fillStyle = rand()>.55 ? 'rgba(255,251,239,.14)' : 'rgba(31,31,25,.16)';ctx.fillRect(x,y,s,s);
      hx.fillStyle = rand()>.5 ? '#939393' : '#a6a6a6';hx.fillRect(x,y,.8,.8);
      const rv = between(170,249);rx.fillStyle=color(rv,rv,rv);rx.fillRect(x,y,2,2);
    }
    // Tileable tangent-space normal map derived from the actual height field.
    const heights=hx.getImageData(0,0,size,size).data;
    const [nc,nx]=canvas(size), normal=nx.createImageData(size,size);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const ix=(y*size+x)*4;
      const dx=heights[(y*size+(x+1)%size)*4]-heights[(y*size+(x+size-1)%size)*4];
      const dy=heights[(((y+1)%size)*size+x)*4]-heights[(((y+size-1)%size)*size+x)*4];
      const v=new THREE.Vector3(-dx*.018,dy*.018,1).normalize();
      normal.data[ix]=(v.x*.5+.5)*255;normal.data[ix+1]=(v.y*.5+.5)*255;normal.data[ix+2]=(v.z*.5+.5)*255;normal.data[ix+3]=255;
    }
    nx.putImageData(normal,0,0);
    const mat = new THREE.MeshStandardMaterial({name,map:texture(c,true),normalMap:texture(nc),roughnessMap:texture(r),roughness:1,metalness:0,normalScale:new THREE.Vector2(.5,.5)});
    materials[name]=mat;textureWorld.set(mat,world);return mat;
  }
  const buff=pbr('Weathered deep brick red','brick',[137,76,61],[1.08,1.16],1024);
  buff.normalScale.set(.68,.68);
  const red=pbr('Red brown pergola brick','brick',[112,66,54],[1.08,1.16]);
  const granite=pbr('Speckled silver granite','granite',[157,156,145],[1.3,1.3]);
  const concrete=pbr('Pale weathered concrete','grain',[184,180,164],[1.5,1.5]);
  const coping=pbr('Light dressed granite coping','granite',[185,181,164],[1.3,1.3]);
  const roof=pbr('Gray overlapping roof tiles','tile',[111,117,112],[2.4,2.4]);
  const paving=pbr('Gray rectangular stone paving','paving',[141,145,132],[2.4,2.4]);
  const basinStone=pbr('Dry dark basin interior','granite',[100,109,93],[1.2,1.2]);
  const bark=pbr('Textured tree bark','grain',[74,67,46],[.7,2]);
  const soil=pbr('Earth and mulch','grain',[76,74,49],[2,2]);
  const plain=(name,c,r=.8,m=0)=>materials[name]=new THREE.MeshStandardMaterial({name,color:c,roughness:r,metalness:m});
  const frame=plain('Dark mahogany painted window frame','#483126',.6);
  const railing=plain('Oxide red painted metal','#783d31',.55,.22);
  const glass=plain('Unified gray blue architectural glass','#435c61',.22,.24);
  const glassLight=glass;
  const dark=plain('Interior recess and shadow','#192422',.92);
  const pipe=plain('Blue gray zinc downpipe','#526e78',.54,.45);
  const bench=plain('Dark oiled bench timber','#39382d',.83);
  const metal=plain('Graphite bench legs','#323a37',.57,.4);
  const grass=plain('Muted lawn green','#687550',1);
  const leaf=createLeafMaterial(THREE,'CC0 photographed green maple leaves');
  const vineLeaf=createLeafMaterial(THREE,'CC0 lobed pergola leaves');
  const flower=plain('Small pale seasonal flowers','#c4b786',.95);

  function section(name) {current=name;}
  function addGeometry(geo,mat,matrix) {
    if(matrix) geo.applyMatrix4(matrix);
    const key=current+'|'+mat.uuid;
    if(!buckets.has(key)) buckets.set(key,{section:current,mat,list:[]});
    buckets.get(key).list.push(geo);
  }
  function worldUV(geo,mat) {
    if(!textureWorld.has(mat)) return;
    const [sx,sy]=textureWorld.get(mat),p=geo.attributes.position,n=geo.attributes.normal;
    const a=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++) {
      const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
      let u,v;
      if(ny>nx&&ny>nz){u=p.getX(i);v=p.getZ(i);}
      else if(nx>nz){u=p.getZ(i);v=p.getY(i);}
      else{u=p.getX(i);v=p.getY(i);}
      a[i*2]=u/sx;a[i*2+1]=v/sy;
    }
    geo.setAttribute('uv',new THREE.BufferAttribute(a,2));
  }
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion();
  function box(name,x,y,z,w,h,d,mat,rot=0) {
    const geo = new THREE.BoxGeometry(w,h,d);worldUV(geo,mat);
    quat.setFromAxisAngle(new THREE.Vector3(0,1,0),rot);
    matrix.compose(new THREE.Vector3(x,y,z),quat,new THREE.Vector3(1,1,1));
    addGeometry(geo,mat,matrix);return {name,x,y,z,w,h,d};
  }
  function cylinder(a,b,r1,r2,mat,sides=8) {
    const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),delta=bb.clone().sub(aa);
    const geo=new THREE.CylinderGeometry(r2,r1,delta.length(),sides);
    worldUV(geo,mat);
    matrix.compose(aa.add(bb).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()),new THREE.Vector3(1,1,1));
    addGeometry(geo,mat,matrix);
  }
  function beam(a,b,width,height,mat) {
    const dx=b[0]-a[0],dz=b[2]-a[2];
    box('beam',(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,Math.hypot(dx,dz),height,width,mat,-Math.atan2(dz,dx));
  }
  function prism(points,y0,y1,mat) {
    const sh=new THREE.Shape();points.forEach(([x,z],i)=>i?sh.lineTo(x,-z):sh.moveTo(x,-z));sh.closePath();
    const geo=new THREE.ExtrudeGeometry(sh,{depth:y1-y0,bevelEnabled:false,steps:1});
    geo.rotateX(-Math.PI/2);geo.translate(0,y0,0);worldUV(geo,mat);addGeometry(geo,mat);
  }
  function roofHip(cx,cz,w,d,eave,rise,mat) {
    const x0=cx-w/2,x1=cx+w/2,z0=cz-d/2,z1=cz+d/2;
    const inset=Math.min(w,d)*.29,ra=[x0+inset,eave+rise,cz],rb=[x1-inset,eave+rise,cz];
    const a=[x0,eave,z0],b=[x1,eave,z0],c=[x1,eave,z1],dd=[x0,eave,z1];
    const pos=[...a,...ra,...b,...b,...ra,...rb,...b,...rb,...c,...c,...rb,...dd,...dd,...rb,...ra,...dd,...ra,...a];
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.computeVertexNormals();worldUV(geo,mat);addGeometry(geo,mat);
    beam(ra,rb,.15,.14,coping);
    for(const [p,q] of [[a,ra],[dd,ra],[b,rb],[c,rb]]) cylinder(p,q,.055,.055,mat,6);
  }
  function windowPanel(x,z,y,w,h,rot=0,cols=2,rows=3) {
    stats.windows++;
    const local=(u,v,dep,ww,hh,dd,mat)=>box('window',x+u*Math.cos(rot)+dep*Math.sin(rot),y+v,z-u*Math.sin(rot)+dep*Math.cos(rot),ww,hh,dd,mat,rot);
    local(0,0,.015,w+.18,h+.16,.06,dark);
    local(0,0,.06,w,h,.07,glass);
    for(let col=0;col<cols;col++) for(let row=0;row<rows;row++) {
      const cw=(w-.14)/cols,rh=(h-.14)/rows;
      local(-w/2+.07+cw*(col+.5),-h/2+.07+rh*(row+.5),.106,cw-.055,rh-.055,.014,(row===rows-1||rand()>.78)?glassLight:glass);
    }
    for(const u of [-w/2,w/2])local(u,0,.15,.09,h+.14,.15,frame);
    for(const v of [-h/2,h/2])local(0,v,.15,w+.12,.10,.15,frame);
    for(let i=1;i<cols;i++)local(-w/2+w*i/cols,0,.17,.055,h,.13,frame);
    for(let i=1;i<rows;i++)local(0,-h/2+h*i/rows,.17,w,.055,.13,frame);
    local(0,-h/2-.14,.12,w+.38,.18,.4,coping);
    local(0,h/2+.13,.045,w+.3,.14,.18,concrete);
  }
  function pipeRun(x,z,top=9.1,bottom=.28) {
    cylinder([x,bottom,z],[x,top,z],.085,.085,pipe,10);
    cylinder([x,top,z],[x,top+.16,z-.24],.085,.085,pipe,10);
    cylinder([x,bottom,z],[x,bottom-.07,z+.25],.085,.085,pipe,10);
    for(let y=bottom+.45;y<top;y+=1.6)box('pipe clip',x,y,z-.03,.23,.065,.19,pipe);
    box('rain hopper',x,top-.1,z,.27,.37,.25,pipe);
  }

  // Substantial brick massing, with a low stone basement and real projecting bay.
  section('Building shell');
  box('main basement',0,1.21,-4.5,33.6,2.42,9,concrete);
  box('central main hall',0,5.77,-4.55,20,6.68,9.1,buff);
  for(const s of [-1,1])box('lower flanking wing',s*13.35,5.31,-4.55,6.7,5.75,9.1,buff);
  const bay=[[-7.8,-.25],[-7.8,1.2],[-5.7,3.5],[5.7,3.5],[7.8,1.2],[7.8,-.25]];
  prism(bay,.02,2.45,concrete);prism(bay,2.45,7.06,buff);
  const apron=[[-8.15,-.45],[-8.15,1.37],[-5.86,3.88],[5.86,3.88],[8.15,1.37],[8.15,-.45]];
  prism(apron,6.94,7.14,coping);prism(apron,7.14,7.69,granite);
  const cap=apron.map(([x,z])=>[x*1.012,z+.08]);prism(cap,7.69,7.82,coping);
  prism(apron,7.82,7.86,paving);
  // Basement stringcourse and wing cornices remain legible around both side elevations.
  for(const s of [-1,1]) {
    box('wing stone base band',s*12.5,2.46,.08,8.7,.22,.25,coping);
    box('wing eave fascia',s*13.4,8.27,-4.55,7.1,.28,9.5,granite);
    box('wing red roof fascia',s*13.4,8.44,-4.55,7.15,.12,9.55,railing);
    roofHip(s*13.4,-4.55,7.15,9.55,8.5,.62,roof);
    box('side base course',s*16.85,2.48,-4.55,.2,.24,9.1,coping);
    box('side lower footing',s*16.9,.22,-4.55,.24,.32,9.3,granite);
    box('central shoulder cornice',s*8.9,9.03,-4.6,2.6,.26,9.4,granite);
  }
  box('rear base course',0,2.45,-9.12,33.6,.24,.2,coping);
  box('hall flat roof',0,9.14,-4.7,20.35,.2,9.65,granite);
  box('clerestory buff base',0,9.33,-4.75,15.1,.37,7.35,buff);
  box('clerestory wall',0,10.1,-4.75,15.1,1.22,7.35,buff);
  box('clerestory red eave',0,10.81,-4.75,16.05,.25,8.23,railing);
  box('clerestory soffit',0,10.69,-4.75,15.9,.065,8.08,frame);
  roofHip(0,-4.75,16.25,8.45,10.94,.63,roof);
  for(const x of [-4.7,0,4.7]) {
    box('small roof vent curb',x,11.58,-4.8,1.15,.23,.6,concrete);
    box('vent hood',x,11.73,-4.8,1.3,.1,.74,pipe);
    for(let i=0;i<5;i++)box('vent louvre',x-.48+i*.24,11.59,-4.48,.055,.13,.025,metal);
  }

  section('Windows and facade joinery');
  for(const x of [-3.7,0,3.7])windowPanel(x,3.515,4.81,2.32,3.85,0,2,3);
  for(const s of [-1,1]) {
    const rot=s*Math.atan2(2.3,2.1);
    windowPanel(s*6.75,2.35,4.81,2.18,3.85,rot,2,3);
    windowPanel(s*7.815,.45,4.9,1.05,3.6,s*Math.PI/2,1,3);
    for(const x of [8.8,11.5,14.5])windowPanel(s*x,.015,5.36,x===8.8?1.28:1.8,x===8.8?5.42:4.1,0,2,4);
    for(const z of [-1.8,-4.45,-7.15])windowPanel(s*16.71,z,5.32,1.62,4.05,s*Math.PI/2,2,3);
    for(const z of [-2.0,-5.8])windowPanel(s*16.83,z,1.37,1.25,1.02,s*Math.PI/2,2,1);
    for(const x of [9.0,12.3,15.0])windowPanel(s*x,.035,1.38,1.4,1.05,0,2,1);
    pipeRun(s*7.91,1.2,8.95);pipeRun(s*16.2,.2,8.33);
  }
  for(const x of [-3.6,0,3.6])windowPanel(x,3.515,1.38,2.14,1.13,0,2,1);
  for(let x=-6.65;x<=6.7;x+=.96)windowPanel(x,-1.06,10.09,.78,1.04,0,1,1);
  for(const s of [-1,1])for(const z of [-2.3,-3.65,-5,-6.35,-7.65])windowPanel(s*7.565,z,10.09,1.04,1.04,s*Math.PI/2,1,1);
  for(const x of [-13.7,-10.4,-7.1,-3.6,0,3.6,7.1,10.4,13.7])windowPanel(x,-9.115,5.3,1.65,3.7,Math.PI,2,3);
  for(const x of [-5.5,-2.75,0,2.75,5.5])windowPanel(x,-8.44,10.05,1.6,1.05,Math.PI,2,1);
  // Ground-level entrance inferred within the visible flanking mass, not over the central basin axis.
  box('entrance dark reveal',10.55,1.29,.1,1.75,2.5,.22,dark);
  for(const x of [10.12,10.98]) {
    box('timber entrance door',x,1.27,.25,.81,2.4,.12,frame);
    box('door inset glass',x,1.66,.32,.61,1.35,.03,glass);
    box('door lower panel',x,.54,.34,.59,.56,.05,railing);
    cylinder([x+.19,1.02,.4],[x+.19,1.35,.4],.02,.02,pipe,6);
  }
  box('entrance lintel',10.55,2.66,.17,2.02,.2,.45,coping);
  box('entrance threshold',10.55,.075,.43,2.0,.15,1.0,granite);
  // Narrow stone pilasters and round ornamental medallions seen above the terrace.
  for(const x of [-9.85,9.85])box('stone pier trim',x,5.83,.095,.24,6.31,.19,coping);
  for(const x of [-5.3,-2.65,0,2.65,5.3]) {
    cylinder([x,8.43,.035],[x,8.43,.17],.21,.21,concrete,20);
    cylinder([x,8.43,.17],[x,8.43,.19],.105,.105,granite,16);
  }
  section('Terrace balustrade');
  const railPts=[[-8.0,1.2],[-5.8,3.67],[5.8,3.67],[8,1.2],[8,-.65]];
  function railSegment(a,b) {
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/1.35);
    for(const y of [8.03,8.54,8.83])beam([a[0],y,a[1]],[b[0],y,b[1]],.065,.065,railing);
    for(let i=0;i<=n;i++) {
      const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n;
      box('red railing post',x,8.34,z,.075,1.03,.075,railing);
      box('post foot',x,7.9,z,.18,.09,.18,railing);
    }
  }
  railSegment([-8,-.65],railPts[0]);for(let i=1;i<railPts.length;i++)railSegment(railPts[i-1],railPts[i]);
  // A few low terrace planters are visible over the stone cornice.
  for(const x of [-4,0,4]) {box('terrace planter',x,8.08,2.75,1.15,.45,.52,concrete);box('terrace soil',x,8.315,2.75,.96,.025,.36,soil);}

  section('Courtyard paving and stairs');
  box('buried landscape foundation',0,-1.3,14,57,1,66,soil);
  box('wide courtyard paving',0,-.11,20.5,33,.30,34.5,paving);
  box('forecourt approach',0,-.68,41.5,39,.25,11,paving);
  box('building perimeter pavement',0,-.09,-4,36,.2,12,paving);
  for(let i=0;i<4;i++) {
    const z=36.3+i*.68,top=.025-i*.15;
    box('broad shallow granite step',0,top-.17,z,35.8,.34,.77,granite);
    box('stone step nosing',0,top+.009,z+.29,35.9,.055,.18,coping);
    for(let x=-17.5;x<18;x+=1.5)box('step joint',x,top+.038,z,.018,.008,.57,basinStone);
  }
  for(const x of [-16.65,16.65])box('long granite curb',x,.12,20.5,.26,.32,34.5,granite);
  for(const x of [-8.25,8.25])box('thin red paving inlay',x,.046,21,.22,.017,31,red);
  for(const z of [7,11,17,23,29,35])box('cross paving inlay',0,.049,z,32,.015,.17,red);
  // Three dry, raised rectangular cascade troughs, stepped towards the building.
  section('Three empty stone cascade basins');
  const basinSpecs=POOLS;
  basinSpecs.forEach((b,index)=>{
    const top=b.floor+.79,thick=.32;
    const support=poolSupport(b);
    box('continuous load-bearing basin plinth',0,(support.bottom+support.top)/2,b.z,support.width,support.top-support.bottom,support.depth,granite);
    box('basin ground-contact footing',0,-.03,b.z,b.w+.9,.2,b.d+.91,granite);
    box('dry basin floor',0,b.floor-.1,b.z,b.w,.2,b.d,basinStone);
    for(const s of [-1,1]) {
      box('basin long stone wall',s*(b.w/2+thick/2),(top+b.floor)/2,b.z,thick,top-b.floor,b.d+.65,granite);
      // Individual coping stones, rather than an unbroken toy-like lip.
      const count=Math.ceil((b.d+.7)/.95),span=(b.d+.7)/count;
      for(let i=0;i<count;i++)box('jointed side coping',s*(b.w/2+.16),top+.08,b.z-b.d/2-.35+span*(i+.5),.56,.2,span-.025,coping);
      box('basin end wall',0,(top+b.floor)/2,b.z+s*(b.d/2+.16),b.w,.79,.32,granite);
      const n=Math.ceil(b.w/1.05),ww=b.w/n;
      for(let i=0;i<n;i++)box('jointed end coping',-b.w/2+ww*(i+.5),top+.08,b.z+s*(b.d/2+.16),ww-.025,.2,.56,coping);
    }
    // Mineral waterline weathering and recessed drain are dry surface details.
    for(const s of [-1,1])box('old dry mineral tide mark',s*(b.w/2-.008),b.floor+.24,b.z,.014,.07,b.d-.1,basinStone);
    box('floor drain plate',0,b.floor+.007,b.z,.38,.012,.38,metal);
    for(let i=-2;i<=2;i++)box('drain slots',i*.055,b.floor+.017,b.z,.021,.013,.27,dark);
    if(index<2) {
      const bottom=-.18,upper=b.floor+.015;
      box('supported cascade masonry',0,(bottom+upper)/2,b.z+b.d/2+.7,b.w-.4,upper-bottom,1.05,granite);
      box('dry cascade apron',0,b.floor-.13,b.z+b.d/2+.7,b.w-.4,.29,1.05,granite);
      box('dry overflow lip',0,top+.01,b.z+b.d/2+.25,1.4,.12,.6,basinStone);
    }
  });

  section('Twin pergolas');
  const pergolaRows=[9.2,12.75,16.3,19.85,23.4,26.95,30.5,34.05];
  for(const s of [-1,1]) {
    // Both inner and outer columns: true colonnades supporting walk-through pergolas.
    for(const z of pergolaRows)for(const x of [s*10.0,s*13.5]) {
      stats.pillars++;
      box('granite pergola column plinth',x,.25,z,.86,.5,.86,concrete);
      box('red brick square pergola pillar',x,1.91,z,.64,2.9,.64,red);
      box('pillar stone capital',x,3.43,z,.85,.17,.85,coping);
      box('capital shadow bead',x,3.29,z,.71,.08,.71,granite);
    }
    for(const x of [s*10,s*13.5]) {
      box('pale continuous pergola girder',x,3.64,21.64,.29,.4,27.3,concrete);
      box('girder top weathered cap',x,3.85,21.64,.36,.065,27.35,coping);
    }
    for(let z=8.4;z<35.1;z+=.63) {
      box('pale transverse pergola slat',s*11.75,3.98,z,4.9,.27,.2,concrete);
      box('slat end stone cap',s*14.18,4.005,z,.09,.3,.22,coping);
    }
    // Seating underneath the outer edge, keeping the central walking route open.
    for(const z of [11,17.8,24.9,31.8]) {
      const x=s*13.07;
      for(let j=0;j<4;j++)box('bench timber seat slat',x+s*(j-.5)*.13,.58,z,.10,.10,2.4,bench);
      for(let j=0;j<3;j++)box('bench timber back slat',x+s*.43,.83+j*.15,z,.08,.105,2.4,bench);
      for(const zz of [z-.89,z+.89]) {
        box('bench steel leg',x,.29,zz,.085,.53,.09,metal);
        box('bench back support',x+s*.44,.77,zz,.065,1.05,.065,metal);
        box('bench foot',x+s*.16,.071,zz,.76,.05,.16,metal);
      }
    }
  }

  // Leaf blade instances are small, individually oriented low-poly lenticular leaves.
  // This preserves a broken silhouette, unlike solid green sphere canopies.
  const leafGeo=createLeafGeometry(THREE);
  const foliageBatches=[];
  const makeFoliage=(name,mat)=>{const o={name,mat,transforms:[],colors:[]};foliageBatches.push(o);return o;};
  const treeFoliage=makeFoliage('Individually modeled tree leaves',leaf),vineFoliage=makeFoliage('Pergola climbing vine leaves',vineLeaf),shrubFoliage=makeFoliage('Garden shrub leaves',leaf);
  function addLeaf(batch,x,y,z,size,hue=.25) {
    const e=new THREE.Euler(between(-1.4,1.4),rand()*Math.PI*2,rand()*Math.PI*2);
    const mat=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(e),new THREE.Vector3(size*between(.65,1.1),size,size));
    batch.transforms.push(mat);batch.colors.push(new THREE.Color().setHSL(hue+between(-.022,.025),between(.22,.46),between(.27,.62)).lerp(new THREE.Color(0xffffff),.8));
    stats.leafInstances++;
  }
  function leafCluster(batch,cx,cy,cz,rx,ry,rz,count,size) {
    for(let i=0;i<count;i++) {
      const u=rand()*Math.PI*2,v=between(-1,1),r=Math.cbrt(rand()),q=Math.sqrt(1-v*v);
      addLeaf(batch,cx+Math.cos(u)*q*r*rx,cy+v*r*ry,cz+Math.sin(u)*q*r*rz,size*between(.7,1.25));
    }
  }
  section('Pergola vines');
  for(const s of [-1,1]) {
    for(const z of [9.2,16.3,23.4,30.5,34.05]) {
      const x=s*13.52;
      for(let i=0;i<12;i++) {
        const y0=.23+i*.3,y1=y0+.31;
        cylinder([x+Math.sin(i*.85)*.29,y0,z+Math.cos(i*.85)*.29],[x+Math.sin((i+1)*.85)*.29,y1,z+Math.cos((i+1)*.85)*.29],.025,.021,bark,5);
        leafCluster(vineFoliage,x,y1,z,.45,.28,.4,14,.3);
      }
    }
    for(let z=9;z<35;z+=1.3) {
      const x=s*between(10.2,13.5);
      leafCluster(vineFoliage,x,4.13,z,between(.65,1.35),.30,.95,130,.33);
      cylinder([s*13.5,4.10,z],[x,4.1,z+.6],.028,.015,bark,5);
      if(rand()>.48)leafCluster(vineFoliage,s*9.85,3.66,z,.45,.62,.7,55,.3);
    }
  }
  section('Garden trees and beds');
  function gardenBed(x,z,w,d) {
    box('raised garden granite edge',x,.1,z,w,.28,d,granite);
    box('garden soil',x,.253,z,w-.27,.025,d-.27,soil);
  }
  for(const s of [-1,1]) {
    box('outer lawn strip',s*22,-.2,16,10,.36,49,grass);
    gardenBed(s*15.32,21,2.0,27);
    gardenBed(s*10.5,5.3,5.0,2.4);
    gardenBed(s*17.8,34.8,3.9,3.5);
    for(let z=9;z<34;z+=1.5)leafCluster(shrubFoliage,s*15.3,between(.75,1.1),z,.72,.67,.83,135,.3);
    for(let z=5;z<35;z+=2.3)leafCluster(shrubFoliage,s*19,between(.75,1.4),z,1.25,.9,1.3,180,.34);
    for(const x of [s*7.6,s*12,s*14])leafCluster(shrubFoliage,x,.78,5.3,.8,.7,.85,165,.27);
  }
  function tree(x,z,height,spread,style='broad') {
    stats.trees++;
    const base=.12,trunk=height*.53;
    cylinder([x,base,z],[x+.14,trunk,z-.11],height*.039,height*.021,bark,9);
    // Surface roots and non-uniform boughs connect every leaf cluster to wood.
    for(let i=0;i<5;i++) {
      const a=rand()*Math.PI*2;
      cylinder([x+Math.cos(a)*.85,.08,z+Math.sin(a)*.85],[x,.6,z],.045,.12,bark,6);
    }
    const tiers=style==='conifer'?5:3;
    for(let tier=0;tier<tiers;tier++) {
      const yc=height*(style==='conifer'?(.4+tier*.115):(.56+tier*.13));
      const radius=spread*(style==='conifer'?(1-tier*.16):(.88-tier*.14));
      for(let b=0;b<(style==='conifer'?7:6);b++) {
        const a=b*Math.PI*2/(style==='conifer'?7:6)+tier*.72+between(-.17,.17);
        const rr=radius*between(.6,1.0),cx=x+Math.cos(a)*rr,cz=z+Math.sin(a)*rr,cy=yc+between(-.2,.35);
        cylinder([x+.08,yc-.8,z],[cx,cy,cz],.09*(height/7),.025,bark,6);
        const cr=spread*(style==='conifer'?.33:.44);
        leafCluster(treeFoliage,cx,cy,cz,cr,style==='conifer'?.38:spread*.37,cr,style==='conifer'?180:275,style==='conifer'?.31:.37);
        for(let j=0;j<3;j++) {
          const aa=a+between(-.9,.9),tx=cx+Math.cos(aa)*cr*.7,tz=cz+Math.sin(aa)*cr*.7;
          cylinder([cx,cy,cz],[tx,cy+.45,tz],.023,.009,bark,5);
        }
      }
    }
    leafCluster(treeFoliage,x+.1,height*.94,z-.1,spread*.52,spread*.45,spread*.5,430,.36);
  }
  for(const t of [[-20,1,11,3.8],[-22,13,9.5,3.7],[-22,26,9,3.2],[-24,37,10,3.7],[20,-.5,12,4.2],[22,14,10,3.8],[23,28,9,3.5],[25,39,10,3.3],[-14,-13,10,3.6],[0,-15,10.5,3.8],[13,-13,11,3.7]])tree(...t);
  tree(18.5,4.5,11.5,3.5,'conifer');tree(-19.2,-6,11.2,3.1,'conifer');
  // Slender trees against the bay reflect the close reference without hiding it.
  for(const s of [-1,1])for(const z of [4.4,6.6])tree(s*8.7,z,4.4,1.05);
  section('Planters and low planting');
  for(const s of [-1,1])for(const z of [8.0,35.1]) {
    const x=s*7.5;
    box('square masonry planter',x,.46,z,1.05,.9,1.05,red);
    box('planter rim',x,.95,z,1.19,.14,1.19,coping);
    box('planter soil',x,1.025,z,.93,.02,.93,soil);
    leafCluster(shrubFoliage,x,1.35,z,.66,.61,.66,240,.24);
    for(let i=0;i<9;i++) {
      const xx=x+between(-.4,.4),zz=z+between(-.4,.4);
      cylinder([xx,1.15,zz],[xx,1.6,zz],.009,.007,leaf,5);
      const g=new THREE.SphereGeometry(.045,5,3);g.translate(xx,1.61,zz);addGeometry(g,flower);
    }
  }
  for(const x of [-4,0,4])leafCluster(shrubFoliage,x,8.55,2.75,.57,.32,.29,100,.16);

  // Merge only like-material static geometry within semantic groups: low draw-call
  // count, ordinary MeshStandardMaterial primitives and portable GLTF export.
  for(const {section:label,mat,list} of buckets.values()) {
    if(!sections[label]) {sections[label]=new THREE.Group();sections[label].name=label;group.add(sections[label]);}
    const counts=list.map(g=>g.index?g.index.count:g.attributes.position.count),total=counts.reduce((a,b)=>a+b,0);
    const position=new Float32Array(total*3),normal=new Float32Array(total*3),uv=new Float32Array(total*2);
    let at=0;
    for(const original of list) {
      const g=original.index?original.toNonIndexed():original;
      position.set(g.attributes.position.array,at*3);normal.set(g.attributes.normal.array,at*3);
      if(g.attributes.uv)uv.set(g.attributes.uv.array,at*2);
      at+=g.attributes.position.count;if(g!==original)g.dispose();original.dispose();
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(position,3));geo.setAttribute('normal',new THREE.BufferAttribute(normal,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    geo.computeBoundingBox();geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,mat);mesh.name=label+' — '+mat.name;mesh.castShadow=!label.includes('paving');mesh.receiveShadow=true;sections[label].add(mesh);stats.batches++;
  }
  for(const batch of foliageBatches) {
    const inst=new THREE.InstancedMesh(leafGeo,batch.mat,batch.transforms.length);inst.name=batch.name;
    batch.transforms.forEach((m,i)=>{inst.setMatrixAt(i,m);inst.setColorAt(i,batch.colors[i]);});
    inst.instanceMatrix.needsUpdate=true;if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
    inst.castShadow=true;inst.receiveShadow=true;inst.computeBoundingBox();inst.computeBoundingSphere();group.add(inst);stats.batches++;
  }
  group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(group);
  stats.bounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
  stats.meshes=0;stats.triangles=0;stats.materials=Object.keys(materials).length;
  group.traverse(o=>{if(o.isMesh){stats.meshes++;stats.triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
  group.userData={description:'Approximate photo-derived brick architecture; dry basins; inferred concealed rear and roof.',units:'metres',front:'+Z',seed:stats.seed};
  return {group,stats};
}
