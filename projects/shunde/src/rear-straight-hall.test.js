import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createShundeModel} from './model.js';
import {lowFootprint,hallLine,hallReturn} from './rear.js';
const build=()=>createShundeModel(THREE,{textured:false,foliage:false});

test('photo-left hall exterior is a straight segment, not a second arc',()=>{
 const [a,b]=[hallLine[0],hallLine.at(-1)];
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
 const hits=new THREE.Raycaster(new THREE.Vector3((hallLine[0][0]+hallLine.at(-1)[0])/2,7,(hallLine[0][1]+hallLine.at(-1)[1])/2+2),new THREE.Vector3(0,-1,0)).intersectObject(m.tiers[1],true);
 assert.equal(hits.length,0,'no first intermediate slab across the double-height hall');
 const hall=[];m.building.traverse(o=>{if(o.userData.role==='rear-straight-tall-hall')hall.push(o);});
 assert.equal(hall.length,1);
 const glazing=[];hall[0].traverse(o=>{if(o.isMesh&&/glass/i.test(o.material.name))glazing.push(o);});
 assert.ok(glazing.length);
 for(const mesh of glazing){const bounds=new THREE.Box3().setFromObject(mesh);assert.ok(bounds.max.y-bounds.min.y>6,'continuous tall glazing, not stacked storey windows');}
});

test('outer end of the tall hall has an enclosing return at every occupied height',()=>{
 const m=build(),inward=new THREE.Vector3(-1,0,0);
 for(const y of [2,6,10,13.5]){
  const midpoint=new THREE.Vector3(hallReturn[0][0],y,(hallReturn[0][1]+hallReturn[1][1])/2),origin=midpoint.clone().addScaledVector(inward,-2);
  const hits=new THREE.Raycaster(origin,inward).intersectObject(m.building,true);
  assert.ok(hits.length&&hits[0].distance<2.5,`end return missing at y=${y}`);
 }
});
