import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createShundeModel} from './model.js';
const m=createShundeModel(THREE,{textured:false,foliage:false});
test('combined source context scope, photo identity and uncertainty are explicit',()=>{assert.match(m.group.userData.scope,/combined Weilun/);assert.match(m.group.userData.scope,/partition unknown/);assert.equal(m.stats.porticoColumns,2);assert.ok(m.stats.windows>100);assert.equal(m.context.userData.inferred,true);});
test('finite real geometry and bounded batches',()=>{let count=0;m.group.traverse(o=>{if(o.isMesh){count++;assert.ok(o.geometry.attributes.position.count>0);assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));}});assert.ok(count>40&&count<400);});
test('time seeks cannot move walls or change closed model bounds',()=>{const before=new THREE.Box3().setFromObject(m.building);for(const t of [0,20,3,24,11]){m.setTime(t);assert.deepEqual(new THREE.Box3().setFromObject(m.building),before);}});
test('north entry normal faces geographic NORTH and physical columns are north of body',()=>{assert.ok(m.portico.userData.outwardNormal[2]<-.99);let steps=0;m.portico.traverse(o=>{if(o.userData.role==='entrance-step')steps++;});assert.equal(steps,6);const b=new THREE.Box3().setFromObject(m.portico);assert.ok(b.min.z<-9);});
