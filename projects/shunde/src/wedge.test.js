// Regression for the retired wedge: it must never fill the approved courtyard.
import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {createShundeModel} from './model.js';
const m=createShundeModel(THREE,{textured:false,foliage:false});
test('north access is an exterior-connected recess across a corridor, not a roof hole',()=>{
 for(const x of [35,38,41,44])for(let z=-20;z<=35;z+=2.5){const hits=new THREE.Raycaster(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0)).intersectObject(m.building,true);assert.equal(hits.length,0,`corridor ${x},${z}`);}
});
test('east contextual short return facades are enclosed at occupied heights',()=>{
 for(const n of ['Boundary 18-19','Boundary 19-20','Boundary 2-3']){const g=m.building.getObjectByName(n);assert.ok(g);for(const y of [2,6,10,16,21]){const origin=g.localToWorld(new THREE.Vector3(1,y,-2)),direction=new THREE.Vector3(0,0,1).transformDirection(g.matrixWorld);assert.ok(new THREE.Raycaster(origin,direction,0,3).intersectObject(g,true).length,`${n} at ${y}`);}}
});
