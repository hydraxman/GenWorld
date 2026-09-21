import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createShundeModel} from './model.js';import {FOOTPRINT,SOURCE_ENU} from './footprint.js';
const m=createShundeModel(THREE,{textured:false,foliage:false});
test('all 24 source vertices occur in actual shared roof and foundation geometry',()=>{
 const vertices=[];m.roof.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);vertices.push(v);}}});
 for(const [i,[x,z]] of FOOTPRINT.entries())for(const y of [.9,i>=12&&i<=15?14.8:21.95])assert.ok(vertices.some(v=>Math.abs(v.x-x)<.0001&&Math.abs(v.z-z)<.0001&&Math.abs(v.y-y)<.0001),`source vertex ${x},${z}, height ${y}`);
 assert.equal(SOURCE_ENU.length,24);
});
test('cylinder facade has varied real normals and slit apertures',()=>{
 const normals=new Set();let slots=0,piers=0;
 for(const g of m.arc.children){if(!g.name.startsWith('Curved court'))continue;
  const bounds=new THREE.Box3().setFromObject(g),p=g.worldToLocal(bounds.getCenter(new THREE.Vector3()));
  const from=g.localToWorld(new THREE.Vector3(p.x,8,-1));const dir=new THREE.Vector3(0,0,1).transformDirection(g.matrixWorld);
  const hits=new THREE.Raycaster(from,dir,0,2).intersectObject(g,true);if(hits[0]){if(/glazing/.test(hits[0].object.material.name))slots++;if(/ceramic/.test(hits[0].object.material.name))piers++;}
  const n=new THREE.Vector3(0,0,-1).transformDirection(g.matrixWorld);normals.add(n.x.toFixed(2)+','+n.z.toFixed(2));
 }
 assert.ok(normals.size>35);assert.ok(slots>=8);assert.ok(piers>40);
});
