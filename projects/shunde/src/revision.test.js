import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SHUNDE} from './spec.js';
import {createShundeModel} from './model.js';
import {createNorthFacade} from './north-facade.js';
import * as builder from './builder.js';
const model=()=>createNorthFacade(THREE,{textured:false,foliage:false});
test('square tile joints align vertically with no running bond and have equal world pitch',()=>{
 const at=builder.squareGridAt;
 assert.equal(typeof at,'function');
 assert.deepEqual(at(.01,.15),at(.01,.25));
 assert.equal(at(.01,.15).joint,true);
 assert.equal(at(.15,.01).joint,true);
 assert.equal(at(.15,.15).joint,false);
 assert.equal(at(.15,.15).pitchX,at(.15,.15).pitchY);
});
test('foreground pines are instanced curved needle shoots on irregular lateral branches, not maple or balls',()=>{
 const a=createShundeModel(THREE,{textured:false,foliage:true}),b=createShundeModel(THREE,{textured:false,foliage:true});
 assert.equal(a.stats.foliageKind,'pine-needle-shoots');
 assert.ok(a.stats.trees>=4);assert.ok(a.stats.leafInstances>2000);
 const shoots=[];a.campus.traverse(o=>{if(o.isInstancedMesh)shoots.push(o);});
 assert.equal(shoots.length,3);assert.equal(shoots[0].geometry.userData.kind,'curved-needle-fascicles');
 assert.ok(shoots[0].geometry.attributes.position.count>300);
 assert.equal(a.stats.leafInstances,b.stats.leafInstances);
 const other=[];b.campus.traverse(o=>{if(o.isInstancedMesh)other.push(o);});assert.deepEqual(shoots[0].instanceMatrix.array,other[0].instanceMatrix.array);
});
test('broad connected six-riser apron and both correctly positioned signs exist in real geometry',()=>{
 const m=model();
 const steps=m.portico.children.filter(g=>g.userData.role==='entrance-step');
 assert.equal(steps.length,6);
 let previous=Infinity;
 for(const g of steps){const b=new THREE.Box3().setFromObject(g);assert.ok(b.max.x-b.min.x>28);assert.ok(b.max.y<previous);assert.ok(b.min.y<=0);previous=b.max.y;}
 const signs=m.portico.children.filter(g=>g.userData.role==='sign');
 assert.deepEqual(signs.map(s=>s.userData.text),['舜德楼','清华大学工业工程系']);
 const white=signs[1];assert.ok(white.userData.height<4);assert.equal(white.userData.background,'white');
 assert.ok(m.stats.portalHeightToColumnHeight>.64&&m.stats.portalHeightToColumnHeight<.72);
});
test('Photo-observable window-band proportions drive built geometry rather than a fifth storey',()=>{
 assert.equal(SHUNDE.facadeBands?.length,4);
 assert.equal(SHUNDE.roofBand?.kind,'recessed-narrow-strip');
 assert.ok(SHUNDE.roofBand.windowHeight<SHUNDE.facadeBands[1].windowHeight*.35);
 const m=model();assert.deepEqual(m.stats.facadeBands,SHUNDE.facadeBands);
 assert.equal(m.group.name,'North entrance — photo-informed proportions');
 assert.ok(m.stats.facadePierWidth>1);
 assert.ok(m.stats.openCasements>0);
 assert.equal(m.tiers.length,6);
});

test('courtyard foreground gains low layered shrubs without blocking cylinder windows',()=>{
 const m=createShundeModel(THREE,{textured:false,foliage:true}),shrubs=m.campus.getObjectByName('Layered courtyard shrub foliage');assert.ok(shrubs?.isInstancedMesh);assert.ok(shrubs.count>2000);const b=new THREE.Box3().setFromObject(shrubs);assert.ok(b.max.y<2);
});
