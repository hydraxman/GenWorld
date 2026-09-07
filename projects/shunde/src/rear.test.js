import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createShundeModel} from './model.js';
import {SHUNDE,shundeCameraAt} from './spec.js';
import {SHUNDE as V2,shundeCameraAt as cameraV2} from './fixtures/v2-spec.js';
const build=()=>createShundeModel(THREE,{textured:false,foliage:false});
const groups=(m,role)=>{const a=[];m.building.traverse(o=>{if(o.userData.role===role)a.push(o);});return a;};
const down=(g,x,z)=>new THREE.Raycaster(new THREE.Vector3(x,70,z),new THREE.Vector3(0,-1,0)).intersectObject(g,true);
test('V2 front calibration and first 31 seconds remain unchanged',()=>{
 for(const key of ['width','frontZ','baseY','facade','facadeBands','roofBand','entrance'])assert.deepEqual(SHUNDE[key],V2[key]);
 for(let t=0;t<31;t+=.125)assert.deepEqual(shundeCameraAt(t),cameraV2(t));
});
test('confirmed rear curve is geometry, not a disabled optional hypothesis',()=>{
 const m=build();assert.equal(m.arc.visible,true);assert.equal(m.arc.userData.orientationStatus,'user-confirmed-rear');
 assert.ok(groups(m,'rear-curved-wall').length>=4);assert.ok(groups(m,'rear-supports').length);assert.ok(groups(m,'rear-diagonal-wall').length>=4);
 assert.equal(m.stats.rearRectangleRemoved,true);
});
test('rear corners are cut through walls, roof, floors and foundation',()=>{
 const m=build();for(const x of [-30,30])assert.equal(down(m.building,x,-18).length,0,'old box corner must be empty at every height');
 assert.ok(down(m.building,-5,-21).length,'cylinder belongs to continuous footprint');
 for(const tier of [m.tiers[1],m.tiers[2]])assert.equal(down(tier,0,4.995).length,0,'hall opening must reach the front edge without a thin crossbeam');
 for(const role of ['footprint-slab','footprint-roof','footprint-foundation']){
  const g=groups(m,role);assert.ok(g.length,role);for(const o of g)assert.equal(down(o,30,-18).length,0);
 }
});
test('curved solid piers have varied normals and narrow windows are real holes',()=>{
 const m=build(),walls=groups(m,'rear-curved-wall'),normals=new Set();
 for(const g of walls)g.traverse(o=>{if(o.isMesh){const n=o.geometry.attributes.normal;for(let i=0;i<n.count;i++)if(Math.abs(n.getY(i))<.01)normals.add(`${n.getX(i).toFixed(2)},${n.getZ(i).toFixed(2)}`);}});
 assert.ok(normals.size>35,'real curved surfaces');
 const ray=a=>new THREE.Raycaster(new THREE.Vector3(-5+18*Math.cos(a),5.7,-15+18*Math.sin(a)),new THREE.Vector3(-Math.cos(a),0,-Math.sin(a))).intersectObject(m.building,true);
 const glazing=ray(-Math.PI/2+.035);assert.ok(glazing.length);assert.match(glazing[0].object.material.name,/glass/i,'opening not painted over solid cylinder');
 const pier=ray(-Math.PI/2+.20);assert.ok(pier.length);assert.match(pier[0].object.material.name,/ceramic/i);
});
test('all rear wall/roof assemblies explode and reclose without drifting',()=>{
 const m=build(),initial=new THREE.Box3().setFromObject(m.building);m.setTime(40);
 assert.ok(groups(m,'rear-curved-wall').some(g=>g.getWorldPosition(new THREE.Vector3()).y>7));
 assert.ok(groups(m,'footprint-roof').some(g=>g.getWorldPosition(new THREE.Vector3()).y>14));
 m.setTime(46);assert.deepEqual(new THREE.Box3().setFromObject(m.building),initial);assert.equal(m.stats.hallIntermediateSlabs,0);
});
