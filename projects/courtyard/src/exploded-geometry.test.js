import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Dynamic import makes the initial RED an explicit missing-feature assertion.
const api = await import('./exploded.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});

test('absolute closing timeline opens roof first, holds, and closes main first', () => {
  assert.equal(typeof api.explodedOffsets, 'function', 'missing absolute-time explodedOffsets');
  const at = api.explodedOffsets;
  assert.deepEqual(at(35.999), {active:false, base:0, main:0, roof:0});
  for (const t of [36, 36.7, 45.2, 46, 100]) {
    assert.deepEqual(at(t), {active:true, base:0, main:0, roof:0});
  }
  assert(at(37.1).roof > 0);
  assert.equal(at(37.1).main, 0);
  for (const t of [40, 41, 42.3]) {
    assert.deepEqual(at(t), {active:true, base:0, main:5.6, roof:12.4});
  }
  assert(at(42.9).main < 5.6);
  assert.equal(at(42.9).roof, 12.4);
  for (let t=36.7; t<40; t+=.031) {
    assert(at(t+.031).main >= at(t).main);
    assert(at(t+.031).roof >= at(t).roof);
    assert(at(t).roof >= at(t).main);
  }
  assert.deepEqual(at(NaN), at(0));
  assert.deepEqual(at(Infinity), at(0));
});

function area(geometry) {
  if (!geometry) return 0;
  const p=geometry.attributes.position, a=new THREE.Vector3(), b=new THREE.Vector3(), c=new THREE.Vector3();
  let result=0;
  for(let i=0;i<p.count;i+=3) {
    a.fromBufferAttribute(p,i); b.fromBufferAttribute(p,i+1); c.fromBufferAttribute(p,i+2);
    result+=b.sub(a).cross(c.sub(a)).length()/2;
  }
  return result;
}

test('triangle bands clip tall geometry, conserve area/UVs and never modify source buffers',()=>{
  assert.equal(typeof api.splitGeometryIntoTiers,'function','missing geometry band splitter');
  const source=new THREE.BoxGeometry(2,10,2).translate(0,5,-4);
  const snapshot=source.attributes.position.array.slice();
  const out=api.splitGeometryIntoTiers(THREE,source);
  assert(Math.abs(['base','main','roof'].reduce((n,k)=>n+area(out[k]),0)-88)<1e-4);
  for(const [key,min,max] of [['base',0,2.43],['main',2.43,9],['roof',9,10]]) {
    const g=out[key];g.computeBoundingBox();
    assert(Math.abs(g.boundingBox.min.y-min)<1e-5);
    assert(Math.abs(g.boundingBox.max.y-max)<1e-5);
    assert.equal(g.attributes.position.count,g.attributes.uv.count);
    assert([...g.attributes.uv.array].every(Number.isFinite));
    for(let i=0;i<g.attributes.normal.count;i++) {
      assert(Math.abs(new THREE.Vector3().fromBufferAttribute(g.attributes.normal,i).length()-1)<1e-5);
    }
  }
  assert.deepEqual(source.attributes.position.array,snapshot);
});

test('solid source mass becomes uncapped shell; wings and bay keep their real roof heights',()=>{
  assert.equal(typeof api.splitGeometryIntoTiers,'function');
  const central=new THREE.BoxGeometry(20,6.68,9.1).translate(0,5.77,-4.55);
  const out=api.splitGeometryIntoTiers(THREE,central,{shell:true});
  assert(out.removedTriangles>=4,'top/bottom mass caps must be removed');
  for(const key of ['base','main','roof']) {
    const g=out[key];if(!g)continue;
    const n=g.attributes.normal;
    for(let i=0;i<n.count;i++) assert(Math.abs(n.getY(i))<.01,'mass caps must not cover the rooms');
  }
  const wing=new THREE.BoxGeometry(6.7,5.75,9.1).translate(13.35,5.31,-4.55);
  const w=api.splitGeometryIntoTiers(THREE,wing,{shell:true});w.main.computeBoundingBox();
  assert(Math.abs(w.main.boundingBox.max.y-8.13)<1e-5);
  const bay=new THREE.BoxGeometry(15.6,4.61,3.75).translate(0,4.755,1.625);
  const b=api.splitGeometryIntoTiers(THREE,bay,{shell:true});b.main.computeBoundingBox();
  assert(Math.abs(b.main.boundingBox.max.y-6.94)<1e-5);
});

function fixture() {
  const original=new THREE.Group();
  const material=new THREE.MeshStandardMaterial({name:'Weathered deep brick red'});
  for(const name of ['Building shell','Windows and facade joinery','Terrace balustrade']) {
    const section=new THREE.Group();section.name=name;original.add(section);
    const g=name==='Building shell'?new THREE.BoxGeometry(20,6.68,9.1).translate(0,5.77,-4.55):
      name==='Terrace balustrade'?new THREE.BoxGeometry(8,.1,.1).translate(0,8.8,3.67):
      new THREE.BoxGeometry(1,5.42,.1).translate(8.8,5.36,.1);
    section.add(new THREE.Mesh(g,material));
  }
  const garden=new THREE.Group();garden.name='Unrelated garden';original.add(garden);
  const shrubs=new THREE.InstancedMesh(new THREE.PlaneGeometry(.2,.2),material,3);
  shrubs.name='Garden shrub leaves';original.add(shrubs);
  for(const [i,x,y,z] of [[0,0,8.55,2.75],[1,15,1,20],[2,-4,8.55,2.75]]) {
    shrubs.setMatrixAt(i,new THREE.Matrix4().makeTranslation(x,y,z));
    shrubs.setColorAt(i,new THREE.Color(i===1?'green':'lime'));
  }
  return {original,shrubs,material,garden};
}

test('closing assembly isolates source sections, keeps foliage attached and seeks/restores deterministically',()=>{
  assert.equal(typeof api.createExplodedBuilding,'function','missing closing assembly controller');
  const {original,shrubs,material,garden}=fixture();
  const sections=original.children.filter(o=>o.isGroup&&o!==garden);
  const shellBuffer=sections[0].children[0].geometry.attributes.position.array.slice();
  const leavesBuffer=shrubs.instanceMatrix.array.slice();
  const built=api.createExplodedBuilding(THREE,original);original.add(built.group);
  assert.equal(built.group.visible,false);
  assert(sections.every(s=>s.visible));assert(shrubs.visible);assert(original.visible);
  built.setTime(41);
  assert(built.group.visible);assert(sections.every(s=>!s.visible));assert(!shrubs.visible);
  assert(original.visible&&garden.visible,'campus and water must remain visible');
  const tiers=Object.fromEntries(built.group.children.map(o=>[o.userData.tier,o]));
  assert.equal(tiers.main.position.y,5.6);assert.equal(tiers.roof.position.y,12.4);
  assert.equal(built.stats.terraceLeafInstances,2);
  const roofLeaves=tiers.roof.children.find(o=>o.isInstancedMesh);
  const groundLeaves=tiers.base.children.find(o=>o.isInstancedMesh);
  assert.equal(roofLeaves.count,2);assert.equal(groundLeaves.count,1);
  assert.equal(roofLeaves.geometry,shrubs.geometry);
  const first=new THREE.Matrix4();roofLeaves.getMatrixAt(0,first);
  assert(Math.abs(first.elements[13]-8.55)<1e-5);
  const snapshot=tiers.main.matrixWorld.clone();
  for(const t of [46,36,43,12,40,41])built.setTime(t);
  assert.deepEqual(tiers.main.matrixWorld.elements,snapshot.elements);
  built.setTime(46);assert.equal(tiers.main.position.y,0);assert.equal(tiers.roof.position.y,0);
  built.setTime(35.99);assert(!built.group.visible);assert(sections.every(s=>s.visible));assert(shrubs.visible);
  assert.deepEqual(sections[0].children[0].geometry.attributes.position.array,shellBuffer);
  assert.deepEqual(shrubs.instanceMatrix.array,leavesBuffer);
  assert.equal(material.side,THREE.FrontSide,'source materials must remain untouched');
  built.setTime(41);
  const restore=built.beginExport();
  assert.equal(tiers.main.position.y,0);assert.equal(tiers.roof.position.y,0);
  restore();assert.equal(tiers.main.position.y,5.6);assert.equal(tiers.roof.position.y,12.4);
  restore();assert.equal(tiers.main.position.y,5.6,'export restore is idempotent');
  built.reset();assert(!built.group.visible);assert(sections.every(s=>s.visible));
});

test('interior floor is a thin slab with a real stair opening; tall windows remain in one main tier',()=>{
  assert.equal(typeof api.createExplodedBuilding,'function');
  const {original}=fixture();const built=api.createExplodedBuilding(THREE,original);original.add(built.group);
  built.setTime(46);
  const floor=built.group.getObjectByName('Main floor slab with stair opening');
  assert(floor?.isMesh,'missing actual main slab geometry');
  const down=new THREE.Vector3(0,-1,0);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(4.5,3,-5),down).intersectObject(floor).length,0,'stairwell cannot be covered');
  assert(new THREE.Raycaster(new THREE.Vector3(0,3,-5),down).intersectObject(floor).length>0,'floor outside stairwell must exist');
  floor.geometry.computeBoundingBox();
  assert(floor.geometry.boundingBox.max.y-floor.geometry.boundingBox.min.y<.3);
  const main=built.group.children.find(g=>g.userData.tier==='main');
  const window=main.getObjectByName('Windows and facade joinery — main');
  window.geometry.computeBoundingBox();
  assert(Math.abs(window.geometry.boundingBox.max.y-window.geometry.boundingBox.min.y-5.42)<1e-5);
  assert(built.group.getObjectByName('Basement stair flight'));
  assert(built.stats.interiorPartitions>0&&built.stats.interiorColumns>0);
});

test('beginExport produces a real closed GLB, reloads successfully and restores the open assembly',async()=>{
  const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const savedReader=globalThis.FileReader;
  // Node has Blob but not FileReader; implement only the real Blob read boundary.
  globalThis.FileReader=class {
    readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
    readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
  };
  try {
    const {original}=fixture();const built=api.createExplodedBuilding(THREE,original);
    const scene=new THREE.Group();scene.add(original,built.group);built.setTime(41);
    const restore=built.beginExport();let bytes;
    try {
      bytes=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});
    } finally {restore();}
    assert(bytes.byteLength>1000);
    assert.equal(built.group.children.find(o=>o.userData.tier==='roof').position.y,12.4);
    const parsed=await new GLTFLoader().parseAsync(bytes,'');
    const exportedTiers=[];parsed.scene.traverse(o=>{if(o.userData.tier)exportedTiers.push(o);});
    assert.equal(exportedTiers.length,3);
    assert(exportedTiers.every(o=>o.position.y===0));
    assert(parsed.scene.getObjectByName('Main_floor_slab_with_stair_opening'));
    assert.equal(parsed.scene.getObjectByName('Garden_shrub_leaves'),undefined,'hidden unsplit leaves must not be exported');
  } finally {
    if(savedReader===undefined)delete globalThis.FileReader;else globalThis.FileReader=savedReader;
  }
});

// Run model.js itself with real THREE geometry. Only the browser raster/texture
// loader boundary is stubbed: this is geometry verification, not a render test.
async function realModelGeometry() {
  const {createModel}=await import('./model.js');
  const {loadLeafTextures}=await import('./leaves.js');
  const previous=globalThis.document;
  const image=(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h});
  const context={fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},putImageData(){},getImageData(x,y,w,h){return image(w,h);},createImageData:image};
  globalThis.document={createElement(){return {width:0,height:0,getContext(){return Object.create(context);}};}};
  try {
    await loadLeafTextures({...THREE,TextureLoader:class{async loadAsync(){return new THREE.Texture();}}});
    return createModel(THREE);
  } finally {
    if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
  }
}

test('real merged V4 model: open rooms, exact extracted bounds, 300 terrace leaves, no source mutation',async t=>{
  const source=await realModelGeometry();
  const names=['Building shell','Windows and facade joinery','Terrace balustrade'];
  const sections=names.map(n=>source.group.getObjectByName(n));
  const sourceBounds=new THREE.Box3();
  for(const section of sections)sourceBounds.union(new THREE.Box3().setFromObject(section));
  const {createHash}=await import('node:crypto');
  const fingerprint=()=>{
    const hash=createHash('sha256');
    for(const section of sections)section.traverse(o=>{
      if(!o.isMesh)return;
      for(const a of Object.values(o.geometry.attributes))hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
      hash.update(`${o.material.uuid}:${o.material.side}`);
    });
    const shrubs=source.group.getObjectByName('Garden shrub leaves');hash.update(new Uint8Array(shrubs.instanceMatrix.array.buffer));
    return hash.digest('hex');
  };
  const before=fingerprint();
  const built=api.createExplodedBuilding(THREE,source.group);source.group.add(built.group);
  assert.equal(built.stats.terraceLeafInstances,300);
  assert.equal(built.stats.terraceLeafInstances+built.stats.stationaryShrubInstances,source.group.getObjectByName('Garden shrub leaves').count);
  assert(built.stats.removedMassTriangles>=20);
  assert(built.stats.meshes<80,'avoid exploding draw-call count');
  const extractedBounds=new THREE.Box3();
  built.group.traverse(o=>{if(o.userData.extracted)extractedBounds.union(new THREE.Box3().setFromObject(o));});
  assert(sourceBounds.min.distanceTo(extractedBounds.min)<1e-4);
  assert(sourceBounds.max.distanceTo(extractedBounds.max)<1e-4);
  built.setTime(41);
  const main=built.group.children.find(o=>o.userData.tier==='main');
  const base=built.group.children.find(o=>o.userData.tier==='base');
  const down=new THREE.Vector3(0,-1,0);
  for(const [x,z] of [[0,-5],[-2,1.8],[13,-3],[-12,-3]]) {
    const hits=new THREE.Raycaster(new THREE.Vector3(x,16,z),down).intersectObject(main,true);
    assert(hits.length>0,`missing floor at ${x},${z}`);
    assert(Math.abs(hits[0].point.y-8.05)<1e-4,`solid source lid hides main room at ${x},${z}: ${hits[0].point.y}`);
  }
  for(const [x,z] of [[0,-5],[-2,1.8],[13,-3],[-12,-3]]) {
    const hits=new THREE.Raycaster(new THREE.Vector3(x,4,z),down).intersectObject(base,true);
    assert(hits.length>0);
    assert(Math.abs(hits[0].point.y-.1)<1e-4,`solid source lid hides basement at ${x},${z}`);
  }
  const roof=built.group.children.find(o=>o.userData.tier==='roof');
  const roofBounds=new THREE.Box3().setFromObject(roof);
  assert(Math.abs(roofBounds.max.y-24.18)<1e-4);
  built.setTime(35.9);assert(sections.every(s=>s.visible));assert(!built.group.visible);
  assert.equal(fingerprint(),before);
  t.diagnostic(JSON.stringify({stats:built.stats,sourceBounds:{min:sourceBounds.min.toArray(),max:sourceBounds.max.toArray()},explodedRoofBounds:{min:roofBounds.min.toArray(),max:roofBounds.max.toArray()}}));
});
