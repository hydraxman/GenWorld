import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createShundeModel} from './model.js';
import {assemblyAt,SHUNDE} from './spec.js';
const build=()=>createShundeModel(THREE,{textured:false,foliage:false});
test('photo identity: 2 tall round columns, stone portal, repetitive glazing, not photo planes',()=>{
 const m=build();assert.equal(m.stats.porticoColumns,2);assert.equal(m.stats.portals,1);assert.ok(m.stats.windows>100);
 assert.equal(m.group.userData.dimensionsStatus,'estimated-from-photos');
 const glasses=new Set();m.building.traverse(o=>{if(o.isMesh&&/glass/i.test(o.material.name))glasses.add(o.material.uuid);});assert.equal(glasses.size,1);
 const b=new THREE.Box3().setFromObject(m.building);assert.ok(b.max.x-b.min.x>=62);assert.ok(b.max.y>20);assert.ok(b.max.z-b.min.z>=SHUNDE.depth);
});
test('finite real geometry and bounded static draw calls',()=>{
 const m=build();let count=0;m.group.traverse(o=>{if(o.isMesh){count++;const p=o.geometry.attributes.position;assert.ok(p.count>0);assert.ok(Array.from(p.array).every(Number.isFinite));}});assert.ok(count>20&&count<170);
});
test('explosion is absolute-time reversible and preserves tall entrance hall',()=>{
 const m=build();const before=new THREE.Box3().setFromObject(m.building);m.setTime(40);assert.equal(assemblyAt(40),1);assert.ok(m.tiers[4].position.y>12);assert.equal(m.portico.position.y,0);
 m.setTime(1);const after=new THREE.Box3().setFromObject(m.building);assert.ok(before.min.equals(after.min)&&before.max.equals(after.max));m.setTime(40);m.setTime(46);assert.ok(m.tiers.every(x=>x.position.y===0));
 assert.equal(m.stats.hallIntermediateSlabs,0);
});
test('hidden geometry and arc placement explicitly remain inferred',()=>{
 const m=build();assert.equal(m.arc.userData.status,'inferred-placement-and-radius');assert.equal(m.stats.arcClosedCircle,false);assert.ok(m.tiers.every(t=>t.userData.interiorStatus==='inferred-not-surveyed'));
});
