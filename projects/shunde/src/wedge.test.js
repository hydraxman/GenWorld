import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mainFootprint,lowFootprint,REAR} from './rear.js';
import {createShundeModel} from './model.js';
const build=()=>createShundeModel(THREE,{textured:false,foliage:false});
const down=(g,x,z)=>new THREE.Raycaster(new THREE.Vector3(x,70,z),new THREE.Vector3(0,-1,0)).intersectObject(g,true);

test('user sketch: front and deep right side make an exact right-angle wedge',()=>{
 const [left,corner,back]=mainFootprint;
 const front=new THREE.Vector2(left[0]-corner[0],left[1]-corner[1]);
 const right=new THREE.Vector2(back[0]-corner[0],back[1]-corner[1]);
 assert.equal(Math.abs(front.dot(right)),0,'front z=5 and right +X boundary must be perpendicular');
 assert.equal(corner[1],5);assert.equal(corner[0],33.28);
 assert.ok(right.length()/front.length()>.7,'right wing must have substantial depth, not the retired flattened pentagon');
 assert.ok(REAR.center[0]<-20,'cylinder is at the left junction in plan, not centered behind the frontage');
 const [innerEnd,outerEnd]=lowFootprint.slice(1,3);
 assert.equal(innerEnd[0],corner[0]);assert.equal(outerEnd[0],corner[0]);
 assert.ok(outerEnd[1]<back[1]);
});

test('the wedge exists at every structural height, with no old detached rear corners',()=>{
 const m=build();
 for(const [x,z] of [[30,-40],[10,-22],[-27,-18]]){
  for(const role of ['footprint-slab','footprint-roof','footprint-foundation']){
   const groups=[];m.building.traverse(o=>{if(o.userData.role===role)groups.push(o);});
   assert.ok(groups.some(g=>down(g,x,z).length),`${role} must occupy the new wedge at ${x},${z}`);
  }
 }
 for(const [x,z] of [[-30,-28],[-5,-40],[-18,-23]])assert.equal(down(m.building,x,z).length,0,`retired/outside contour must be empty at ${x},${z}`);
 // Right wall is not just a footprint slab: raycast at occupied window and pier heights.
 for(const y of [2,6,10,16,21]){
  const hits=new THREE.Raycaster(new THREE.Vector3(38,y,-36),new THREE.Vector3(-1,0,0)).intersectObject(m.building,true);
  assert.ok(hits.length&&hits[0].distance<5,`right facade enclosure at ${y}`);
 }
});
