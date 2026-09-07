import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createShundeModel} from './model.js';
import {lowFootprint} from './rear.js';
const build=()=>createShundeModel(THREE,{textured:false,foliage:false});

test('photo-left hall exterior is a straight segment, not a second arc',()=>{
 const [a,b]=[[28,-6],[1.4,-15]];
 // The last boundary runs from the outside endpoint directly back to the cylinder.
 const boundary=lowFootprint.slice(2);
 for(const p of boundary){
  const cross=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  assert.ok(Math.abs(cross)<1e-8,'all exterior hall vertices must be collinear');
 }
 const m=build(),roles=[];m.building.traverse(o=>roles.push(o.userData.role));
 assert.ok(!roles.includes('low-curved-wing'));
 assert.ok(roles.includes('rear-straight-tall-hall'));
});

test('tall glazed hall has no intermediate floor cutting its window height',()=>{
 const m=build();
 const hits=new THREE.Raycaster(new THREE.Vector3(14.7,7,-9),new THREE.Vector3(0,-1,0)).intersectObject(m.tiers[1],true);
 assert.equal(hits.length,0,'no first intermediate slab across the double-height hall');
 const hall=[];m.building.traverse(o=>{if(o.userData.role==='rear-straight-tall-hall')hall.push(o);});
 assert.equal(hall.length,1);
 const glazing=[];hall[0].traverse(o=>{if(o.isMesh&&/glass/i.test(o.material.name))glazing.push(o);});
 assert.ok(glazing.length);
 for(const mesh of glazing){const bounds=new THREE.Box3().setFromObject(mesh);assert.ok(bounds.max.y-bounds.min.y>6,'continuous tall glazing, not stacked storey windows');}
});
