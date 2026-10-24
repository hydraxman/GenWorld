import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createShundeModel} from './model.js';import {FOOTPRINT} from './footprint.js';
const m=createShundeModel(THREE,{textured:false,foliage:false});
test('short connector s11 survives separately from cylinder, west s12–15 remain individual straight faces',()=>{
 for(let i=11;i<=15;i++){const g=m.west.getObjectByName(`Boundary ${i}-${i+1}`);assert.ok(g);const a=FOOTPRINT[i],b=FOOTPRINT[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);const end=g.localToWorld(new THREE.Vector3(L,0,0));assert.ok(Math.hypot(end.x-b[0],end.z-b[1])<1e-7);}
 assert.equal(m.arc.getObjectByName('Boundary 11-12'),undefined);
});
test('tall hall glazing has real open volume behind, no intermediate floors',()=>{
 for(let i=11;i<=15;i++){const g=m.west.getObjectByName(`Boundary ${i}-${i+1}`),a=FOOTPRINT[i],b=FOOTPRINT[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const p=g.localToWorld(new THREE.Vector3(L*.4,8,2));const hits=new THREE.Raycaster(p,new THREE.Vector3(0,-1,0),0,6.9).intersectObject(m.building,true);assert.equal(hits.length,0,`hall ${i} clear`);
  const glass=[];g.traverse(o=>{if(o.isMesh&&/glazing/.test(o.material.name))glass.push(o);});assert.ok(glass.length);
 }
});

test('photo-left glazed gallery roof is lower than cylinder, not a 22m generic block',()=>{
 const a=FOOTPRINT[11],b=FOOTPRINT[12],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2-2;
 const hits=new THREE.Raycaster(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0)).intersectObject(m.roof,true);
 assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-14.8)<.02,`gallery roof top ${hits[0]?.point.y}`);
 const pergola=m.west.getObjectByName('Photo-informed open pale gallery pergola');assert.ok(pergola);
});
