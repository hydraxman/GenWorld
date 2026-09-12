import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createShundeModel} from './model.js';
import {FOOTPRINT,SOURCE_ENU} from './footprint.js';
const m=createShundeModel(THREE,{textured:false,foliage:false});m.group.updateMatrixWorld(true);
function down(x,z){return new THREE.Raycaster(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0)).intersectObject(m.building,true);}
test('approved courtyard recess and NORTH opening are unbuilt at roof, slab and foundation',()=>{
 for(const [x,z] of [[38,-3],[38,5],[38,18],[38,32],[0,30]])assert.equal(down(x,z).length,0,`unbuilt ${x},${z}`);
 assert.ok(down(15,12).length,'attached circular projection');
 assert.ok(down(0,55).length,'southern context wing');
 assert.ok(down(90,25).length,'eastern context wing');
 assert.ok(down(-30,25).length,'western wing');
});
test('court-level cylinder is an attached opaque curved facade, not just roof plates',()=>{
 const ray=new THREE.Raycaster(new THREE.Vector3(18,10,40),new THREE.Vector3(0,0,-1));
 assert.ok(ray.intersectObject(m.building,true).some(h=>h.distance<24),'circular court wall must exist');
});

test('all original western chain vertices survive without arbitrary flattening',()=>{
 for(let i=12;i<=16;i++)assert.deepEqual(FOOTPRINT[i],[SOURCE_ENU[i][0],-SOURCE_ENU[i][1]]);
});
test('courtyard-side window ray first sees glazing, not opaque backer',()=>{
 const g=m.group.getObjectByName('Boundary 17-18');
 const a=FOOTPRINT[17],b=FOOTPRINT[18],L=Math.hypot(b[0]-a[0],b[1]-a[1]),w=L/Math.round(L/4.15);
 const origin=g.localToWorld(new THREE.Vector3(w*.5+.2,6.2,-2));
 const direction=new THREE.Vector3(0,0,1).transformDirection(g.matrixWorld);
 const hits=new THREE.Raycaster(origin,direction,0,3).intersectObject(g,true);
 assert.match(hits[0]?.object.material.name||'',/glazing/);
});
