/** Closing-only, absolute-time architectural assembly. Coordinates are metres. */
const smooth = (t, start, end) => {
  if (t <= start+1e-9) return 0;
  if (t >= end-1e-9) return 1;
  const u = (t-start)/(end-start);
  return u*u*u*(u*(u*6-15)+10);
};

export function explodedOffsets(t) {
  if (!Number.isFinite(t) || t < 36) return {active:false, base:0, main:0, roof:0};
  const s = t-36;
  return {
    active:true,
    base:0,
    main:5.6*smooth(s,1.65,4)*(1-smooth(s,6.3,8.0)),
    roof:12.4*smooth(s,.7,2.9)*(1-smooth(s,7.05,9.2)),
  };
}

const EPS = 1e-5;
const TIER_NAMES = ['base','main','roof'];

// Weld only for component discovery, not rendering: hard normals and UV seams
// are retained. model.js merges primitives by material, losing their names.
function componentsOf(geometry) {
  const p=geometry.attributes.position, index=geometry.index;
  const count=(index ? index.count : p.count)/3;
  const parent=Array.from({length:count},(_,i)=>i), seen=new Map();
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const vertex=(t,j)=>index ? index.getX(t*3+j) : t*3+j;
  for(let t=0;t<count;t++) for(let j=0;j<3;j++) {
    const i=vertex(t,j);
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v/EPS)).join(',');
    if(seen.has(key)) parent[root(t)]=root(seen.get(key));else seen.set(key,t);
  }
  const groups=new Map();
  for(let t=0;t<count;t++) {
    const r=root(t);
    if(!groups.has(r))groups.set(r,{triangles:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
    const c=groups.get(r);c.triangles.push(t);
    for(let j=0;j<3;j++) {
      const i=vertex(t,j), xyz=[p.getX(i),p.getY(i),p.getZ(i)];
      for(let a=0;a<3;a++){c.min[a]=Math.min(c.min[a],xyz[a]);c.max[a]=Math.max(c.max[a],xyz[a]);}
    }
  }
  return {components:[...groups.values()],vertex};
}

// Sutherland-Hodgman clipping; vertex layout is xyz, normal xyz, uv.
// All attributes interpolate at the same intersection, avoiding texture jumps.
function clip(poly, axis, value, greater) {
  if(!poly.length)return [];
  const out=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length];
    const da=(a[axis]-value)*(greater?1:-1),db=(b[axis]-value)*(greater?1:-1);
    const ai=da>=0,bi=db>=0;
    if(ai)out.push(a);
    if(ai!==bi) {
      const f=da/(da-db),v=a.map((n,j)=>n+(b[j]-n)*f);
      v[axis]=value;out.push(v);
    }
  }
  return out;
}

// Remove an internal shared wall rectangle, retaining its exterior remainder.
function subtractRectangle(poly, planes) {
  const kept=[];let remainder=poly;
  for(const [axis,value,greater] of planes) {
    const outside=clip(remainder,axis,value,!greater);
    if(outside.length>=3)kept.push(outside);
    remainder=clip(remainder,axis,value,greater);
    if(remainder.length<3)break;
  }
  return kept;
}

function internalWallPieces(poly,component) {
  const flat=(axis,value)=>poly.every(v=>Math.abs(v[axis]-value)<EPS);
  // The projecting bay overlaps the hall: its back is not an interior wall.
  if(component.max[2]>1 && flat(2,-.25))return [];
  if(component.min[2]<-8 && flat(2,0)) {
    return subtractRectangle(poly,[[0,-7.8,true],[0,7.8,false],[1,6.94,false]]);
  }
  if(flat(0,10)||flat(0,-10))return [clip(poly,1,8.13,true)];
  return [poly];
}

/**
 * Split source geometry without changing any buffer or material. Reconstruct
 * merged primitive components to distinguish the lower bay roof from the tall
 * hall behind it. For shell massing, discard the solid block's top/bottom lids
 * and shared internal walls; replacement thin slabs are authored separately.
 * Returns non-indexed geometries (or null), retaining material group indices.
 */
export function splitGeometryIntoTiers(THREE, geometry, {shell=false, terrace=false}={}) {
  const {components,vertex}=componentsOf(geometry);
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  const buckets=Object.fromEntries(TIER_NAMES.map(k=>[k,new Map()]));
  let removedTriangles=0;
  const materialAt=t=>geometry.groups.find(g=>t*3>=g.start&&t*3<g.start+g.count)?.materialIndex??0;
  function append(tier,poly,material) {
    if(poly.length<3)return;
    if(!buckets[tier].has(material))buckets[tier].set(material,[]);
    const dest=buckets[tier].get(material);
    for(let i=1;i<poly.length-1;i++) {
      const a=poly[0],b=poly[i],c=poly[i+1];
      const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
      const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      if(Math.hypot(...cross)<1e-10)continue;
      dest.push(a,b,c);
    }
  }
  for(const component of components) {
    const size=component.max.map((v,i)=>v-component.min[i]);
    const mass=shell&&size[0]>4&&size[1]>1.8&&size[2]>3;
    const cx=(component.min[0]+component.max[0])/2;
    const bay=component.max[2]>1 && component.min[0]>-8.4 && component.max[0]<8.4;
    const roofAt=bay?6.94:Math.abs(cx)>=10-EPS?8.13:9;
    for(const t of component.triangles) {
      const poly=Array.from({length:3},(_,j)=>{
        const i=vertex(t,j);
        return [p.getX(i),p.getY(i),p.getZ(i),n?.getX(i)??0,n?.getY(i)??0,n?.getZ(i)??0,uv?.getX(i)??0,uv?.getY(i)??0];
      });
      if(mass && poly.every(v=>Math.abs(v[1]-poly[0][1])<EPS)) {removedTriangles++;continue;}
      const pieces=mass?internalWallPieces(poly,component):[poly];
      if(!pieces.length)removedTriangles++;
      for(const piece of pieces) {
        if(terrace){append('roof',piece,materialAt(t));continue;}
        // Coplanar faces have a single owner; never emit duplicate horizontal lids.
        const low=piece.length?Math.min(...piece.map(v=>v[1])):Infinity;
        const high=piece.length?Math.max(...piece.map(v=>v[1])):-Infinity;
        if(high-low<EPS) {
          append(low>=roofAt-EPS?'roof':low>=2.43-EPS?'main':'base',piece,materialAt(t));
        } else {
          append('base',clip(piece,1,2.43,false),materialAt(t));
          append('main',clip(clip(piece,1,2.43,true),1,roofAt,false),materialAt(t));
          append('roof',clip(piece,1,roofAt,true),materialAt(t));
        }
      }
    }
  }
  const out={removedTriangles};
  for(const tier of TIER_NAMES) {
    const positions=[],normals=[],uvs=[],groups=[];
    for(const [material,vertices] of buckets[tier]) {
      const start=positions.length/3;
      for(const v of vertices) {
        positions.push(...v.slice(0,3));
        const len=Math.hypot(v[3],v[4],v[5])||1;
        normals.push(v[3]/len,v[4]/len,v[5]/len);uvs.push(v[6],v[7]);
      }
      if(vertices.length)groups.push([start,vertices.length,material]);
    }
    if(!positions.length){out[tier]=null;continue;}
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    if(!n)g.computeVertexNormals();
    for(const args of groups)g.addGroup(...args);
    g.computeBoundingBox();g.computeBoundingSphere();out[tier]=g;
  }
  return out;
}

/**
 * Usage: const exploded=createExplodedBuilding(THREE,built.group);
 *        built.group.add(exploded.group); exploded.setTime(absoluteSeconds);
 * The returned group uses originalModelGroup-local coordinates. Do not hide the
 * whole originalModelGroup: it also contains the campus and animated water.
 * Only the three source architecture sections and the split shrub batch toggle.
 * beginExport() temporarily closes this hollow model and returns an idempotent
 * restore callback. It does not change the camera, water or animation clock.
 */
export function createExplodedBuilding(THREE, originalModelGroup) {
  const names=['Building shell','Windows and facade joinery','Terrace balustrade'];
  const sources=names.map(name=>originalModelGroup.getObjectByName(name));
  if(sources.some(s=>!s))throw new Error(`Exploded building requires named groups: ${names.join(', ')}`);
  originalModelGroup.updateWorldMatrix(true,true);
  const inverse=new THREE.Matrix4().copy(originalModelGroup.matrixWorld).invert();
  const group=new THREE.Group();group.name='Closing exploded architectural assembly';group.visible=false;
  group.userData={description:'Inferred simple interiors; two occupied levels, not an extra story through the tall windows.',units:'metres',start:36,end:46};
  const tiers=Object.fromEntries(TIER_NAMES.map(tier=>{
    const g=new THREE.Group();g.name=`Exploded ${tier}`;g.userData.tier=tier;group.add(g);return [tier,g];
  }));
  const stats={tiers:3,sourceSections:names,sourceMeshes:0,extractedTriangles:0,removedMassTriangles:0,
    terraceLeafInstances:0,stationaryShrubInstances:0,interiorPartitions:0,interiorColumns:0,
    offsets:{base:0,main:5.6,roof:12.4},
    heightBands:{base:[0,2.43],main:[2.43,9],wingRoof:8.13,bayRoof:6.94,mainRoof:9},
    inferredInterior:true};
  const visibility=new Map(sources.map(o=>[o,o.visible]));
  const materialCopies=new Map(),sourceMaterials=new Map();
  function shellMaterial(material) {
    if(Array.isArray(material))return material.map(shellMaterial);
    sourceMaterials.set(material.name,material);
    if(!materialCopies.has(material)) {
      const m=material.clone();m.side=THREE.DoubleSide;
      materialCopies.set(material,m);
    }
    return materialCopies.get(material);
  }
  for(const section of sources) {
    section.traverse(source=>{
      if(!source.isMesh||source.isInstancedMesh)return;
      const relative=new THREE.Matrix4().multiplyMatrices(inverse,source.matrixWorld);
      const geometry=source.geometry.clone().applyMatrix4(relative);
      const parts=splitGeometryIntoTiers(THREE,geometry,{shell:section.name===names[0],terrace:section.name===names[2]});
      geometry.dispose();stats.sourceMeshes++;stats.removedMassTriangles+=parts.removedTriangles;
      const material=shellMaterial(source.material);
      for(const tier of TIER_NAMES) {
        if(!parts[tier])continue;
        const mesh=new THREE.Mesh(parts[tier],material);
        mesh.name=`${section.name} — ${tier}`;
        mesh.userData.sourceMesh=source.name;mesh.userData.extracted=true;
        mesh.visible=section.visible&&source.visible;
        mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;
        tiers[tier].add(mesh);stats.extractedTriangles+=parts[tier].attributes.position.count/3;
      }
    });
  }

  // Split only the mixed shrub batch, sharing leaf geometry and textures. Trees,
  // vines, lawns, basins, campus and water are neither cloned nor hidden.
  const shrubs=originalModelGroup.getObjectByName('Garden shrub leaves');
  if(shrubs?.isInstancedMesh) {
    const relative=new THREE.Matrix4().multiplyMatrices(inverse,shrubs.matrixWorld);
    const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),ids={base:[],roof:[]};
    for(let i=0;i<shrubs.count;i++) {
      shrubs.getMatrixAt(i,matrix);matrix.premultiply(relative);point.setFromMatrixPosition(matrix);
      const onTerrace=point.y>7.8&&point.y<9.3&&Math.abs(point.x)<5&&point.z>2&&point.z<3.5;
      ids[onTerrace?'roof':'base'].push(i);
    }
    if(ids.roof.length) {
      visibility.set(shrubs,shrubs.visible);
      for(const tier of ['base','roof']) {
        if(!ids[tier].length)continue;
        const mesh=new THREE.InstancedMesh(shrubs.geometry,shrubs.material,ids[tier].length);
        mesh.name=tier==='roof'?'Terrace shrubs attached to roof':'Unchanged garden shrub instances';
        mesh.visible=shrubs.visible;mesh.castShadow=shrubs.castShadow;mesh.receiveShadow=shrubs.receiveShadow;
        const color=new THREE.Color();
        ids[tier].forEach((old,i)=>{
          shrubs.getMatrixAt(old,matrix);matrix.premultiply(relative);mesh.setMatrixAt(i,matrix);
          if(shrubs.instanceColor){shrubs.getColorAt(old,color);mesh.setColorAt(i,color);}
        });
        mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
        mesh.computeBoundingBox();mesh.computeBoundingSphere();tiers[tier].add(mesh);
      }
      stats.terraceLeafInstances=ids.roof.length;stats.stationaryShrubInstances=ids.base.length;
    }
  }

  const plaster=new THREE.MeshStandardMaterial({name:'Inferred interior warm lime plaster',color:'#d5cbb8',roughness:.94});
  const structural=sourceMaterials.get('Pale weathered concrete')||new THREE.MeshStandardMaterial({name:'Interior pale concrete',color:'#beb8a5',roughness:.91});
  const floorMaterial=sourceMaterials.get('Light dressed granite coping')||structural;
  const railMaterial=sourceMaterials.get('Dark mahogany painted window frame')||structural;
  const batches=new Map();
  function solid(tier,label,x,y,z,w,h,d,material=plaster) {
    const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);
    const key=`${tier}|${label}|${material.uuid}`;
    if(!batches.has(key))batches.set(key,{tier,label,material,geometries:[]});
    batches.get(key).geometries.push(g);
  }
  function wall(tier,x,z,w,d,bottom,height) {
    solid(tier,'Simple interior partitions',x,bottom+height/2,z,w,height,d);stats.interiorPartitions++;
  }
  function slab(tier,name,points,top,thickness,opening=false,material=floorMaterial) {
    const shape=new THREE.Shape();
    points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    if(opening) {
      const hole=new THREE.Path();hole.moveTo(3.4,3.1);hole.lineTo(5.6,3.1);hole.lineTo(5.6,7.6);hole.lineTo(3.4,7.6);hole.closePath();shape.holes.push(hole);
    }
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1,curveSegments:1});
    geometry.rotateX(-Math.PI/2);geometry.translate(0,top-thickness,0);
    const p=geometry.attributes.position,uv=geometry.attributes.uv,n=geometry.attributes.normal;
    for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/1.3,(Math.abs(n.getY(i))>.5?p.getZ(i):p.getY(i))/1.3);
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
    tiers[tier].add(mesh);return mesh;
  }
  const footprint=[[-16.65,-8.92],[16.65,-8.92],[16.65,-.08],[7.7,-.08],[7.7,1.15],[5.65,3.4],[-5.65,3.4],[-7.7,1.15],[-7.7,-.08],[-16.65,-.08]];
  slab('base','Basement ground floor',footprint,.10,.12);
  slab('main','Main floor slab with stair opening',footprint,2.45,.18,true);
  const rectangle=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
  slab('roof','Hall roof thin interior soffit',rectangle(-9.86,9.86,-8.96,-.1),9.04,.14,false,plaster);
  for(const s of [-1,1])slab('roof','Wing roof thin interior soffit',rectangle(s<0?-16.62:10.08,s<0?-10.08:16.62,-8.94,-.1),8.15,.14,false,plaster);
  slab('roof','Bay terrace thin interior soffit',[[-7.67,-.22],[-7.67,1.15],[-5.63,3.4],[5.63,3.4],[7.67,1.15],[7.67,-.22]],6.94,.06,false,plaster);

  // Thin perimeter linings, never another solid building-sized box. These
  // inside faces stop shy of the source facade; hidden elevations are inferred.
  for(const [tier,bottom,height] of [['base',.1,2.13],['main',2.45,5.49]]) {
    solid(tier,'Interior perimeter linings',0,bottom+height/2,-8.86,33.12,height,.12);
    for(const s of [-1,1]) {
      solid(tier,'Interior perimeter linings',s*16.56,bottom+height/2,-4.48,.12,height,8.65);
      solid(tier,'Interior perimeter linings',s*12.22,bottom+height/2,-.13,8.55,height,.12);
    }
    const bay=[[-7.65,-.18],[-7.65,1.12],[-5.62,3.34],[5.62,3.34],[7.65,1.12],[7.65,-.18]];
    const bh=tier==='base'?height:4.33;
    for(let i=0;i<bay.length-1;i++) {
      const a=bay[i],b=bay[i+1],dx=b[0]-a[0],dz=b[1]-a[1];
      const g=new THREE.BoxGeometry(Math.hypot(dx,dz),bh,.12);
      g.rotateY(-Math.atan2(dz,dx));g.translate((a[0]+b[0])/2,bottom+bh/2,(a[1]+b[1])/2);
      const key=`${tier}|bay-linings`;
      if(!batches.has(key))batches.set(key,{tier,label:'Angled bay interior linings',material:plaster,geometries:[]});
      batches.get(key).geometries.push(g);
    }
  }
  // Side rooms and one full-height central hall. Partition tops are a cutaway
  // convention, NOT an intermediate floor across the tall facade windows.
  for(const [tier,bottom,height] of [['base',.1,1.98],['main',2.45,3.05]]) {
    for(const s of [-1,1]) {
      wall(tier,s*12.6,-5.0,7.5,.15,bottom,height);
      wall(tier,s*8.92,-6.65,.15,4.25,bottom,height);
      wall(tier,s*8.92,-1.6,.15,2.3,bottom,height);
    }
    if(tier==='base') {
      wall(tier,-4.3,-6.1,.15,5.3,bottom,height);
      wall(tier,-3.25,-3.35,5.8,.15,bottom,height);
      wall(tier,1.9,-3.35,1.4,.15,bottom,height);
    }
    for(const x of [-12,-7.2,0,7.2,12])for(const z of [-7.6,-1.3]) {
      const top=tier==='base'?2.27:Math.abs(x)>10?7.94:8.84;
      solid(tier,'Structural columns and beams',x,(bottom+top)/2,z,.25,top-bottom,.25,structural);stats.interiorColumns++;
    }
  }
  for(const z of [-7.6,-1.3]) {
    solid('main','Structural columns and beams',0,8.74,z,19.55,.26,.3,structural);
    for(const s of [-1,1])solid('main','Structural columns and beams',s*13.1,7.84,z,6.7,.22,.3,structural);
    solid('base','Structural columns and beams',0,2.17,z,32.9,.2,.26,structural);
  }
  // One real basement-to-main flight aligned with the cut slab opening.
  for(let i=0;i<13;i++) {
    const top=.1+(i+1)*(2.35/13);
    solid('base','Basement stair flight',4.5,(.1+top)/2,-3.34-i*.32,1.8,top-.1,.32,structural);
  }
  solid('base','Basement stair flight',4.5,2.39,-7.47,1.8,.12,.26,structural);
  for(const x of [3.32,5.68]) {
    solid('main','Stairwell guard rails',x,3.4,-5.35,.055,.065,4.65,railMaterial);
    for(const z of [-7.65,-6.2,-4.8,-3.05])solid('main','Stairwell guard rails',x,2.91,z,.055,.92,.055,railMaterial);
  }
  for(const {tier,label,material,geometries} of batches.values()) {
    const positions=[],normals=[],uvs=[];
    for(const original of geometries) {
      const g=original.index?original.toNonIndexed():original;
      for(const v of g.attributes.position.array)positions.push(v);
      for(const v of g.attributes.normal.array)normals.push(v);
      for(const v of g.attributes.uv.array)uvs.push(v);
      if(g!==original)g.dispose();original.dispose();
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=label;mesh.castShadow=true;mesh.receiveShadow=true;tiers[tier].add(mesh);
  }
  stats.meshes=0;stats.triangles=0;
  group.traverse(o=>{if(o.isMesh){stats.meshes++;stats.triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
  stats.assemblyHeight=24.18;
  group.userData.stats=stats;

  let lastTime=0,exportDepth=0;
  function apply(offsets) {
    group.visible=offsets.active;
    for(const [object,visible] of visibility)object.visible=offsets.active?false:visible;
    for(const tier of TIER_NAMES)tiers[tier].position.y=offsets[tier];
    group.updateWorldMatrix(true,true);
  }
  function setTime(t) {
    lastTime=Number.isFinite(t)?t:0;
    apply(explodedOffsets(exportDepth?46:lastTime));
  }
  function reset(){setTime(0);}
  function beginExport() {
    exportDepth++;apply(explodedOffsets(46));let restored=false;
    return ()=>{
      if(restored)return;restored=true;exportDepth--;
      apply(explodedOffsets(exportDepth?46:lastTime));
    };
  }
  return {group,setTime,reset,stats,beginExport};
}
