import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createShundeModel} from './model.js';
import {SHUNDE} from './spec.js';
import * as environment from './environment.js';
import * as pbr from './pbr.js';
test('brown marble is continuous multiscale mineral noise with sparse light veins, not square colour cells',()=>{
 assert.equal(typeof pbr.marbleRGB,'function');
 let pale=0,warm=0;const values=[];
 for(let y=0;y<1;y+=.007)for(let x=0;x<1;x+=.007){const c=pbr.marbleRGB(x,y,[63,48,40]);values.push(c[0]);if(c[0]>130)pale++;if(c[0]>c[1]&&c[1]>c[2])warm++;}
 assert.ok(pale>values.length*.005&&pale<values.length*.15,'sparse pale mineral veins');assert.equal(warm,values.length);
 assert.ok(Math.max(...values)-Math.min(...values)>80);
 const a=pbr.marbleRGB(.341,.271,[63,48,40]),b=pbr.marbleRGB(.341001,.271,[63,48,40]);assert.ok(Math.abs(a[0]-b[0])<.1,'continuous field');
});
test('procedural sky has bright structured clouds and blue gaps at facade-reflected low elevations',()=>{
 assert.equal(typeof environment.skyRGB,'function');
 const samples=[];for(let y=.32;y<.49;y+=.008)for(let x=0;x<1;x+=.01)samples.push(environment.skyRGB(x,y));
 assert.ok(samples.filter(c=>c[0]>215&&c[1]>215).length>samples.length*.08,'white clouds');
 assert.ok(samples.filter(c=>c[2]-c[0]>50).length>samples.length*.15,'clear blue gaps');
 assert.deepEqual(environment.skyRGB(.42,.38),environment.skyRGB(.42,.38));
});
test('reflection backdrop supplies deterministic real tree geometry ahead of the facade, behind every film camera',()=>{
 assert.equal(typeof environment.createReflectionGrove,'function');
 const a=environment.createReflectionGrove(THREE),b=environment.createReflectionGrove(THREE);
 const bounds=new THREE.Box3().setFromObject(a);assert.ok(bounds.min.z>85);assert.ok(bounds.max.y>24);assert.ok(bounds.max.y<40);
 const meshes=[];a.traverse(o=>{if(o.isInstancedMesh)meshes.push(o);});assert.equal(meshes.length,1);assert.ok(meshes[0].count>200&&meshes[0].count<1500);
 const other=[];b.traverse(o=>{if(o.isInstancedMesh)other.push(o);});assert.deepEqual(meshes[0].instanceMatrix.array,other[0].instanceMatrix.array);
 assert.equal(meshes[0].material.map,null,'not a photograph plane');
});
const model=()=>createShundeModel(THREE,{textured:false,foliage:false});
test('six short yellow-black warning strips contact the stair nosings without floating',()=>{
 const m=model(),steps=m.portico.children.filter(g=>g.userData.role==='entrance-step');
 for(const step of steps){
  const strip=step.children.find(g=>g.userData.role==='stair-warning');assert.ok(strip,'warning strip on each step');
  const b=new THREE.Box3().setFromObject(strip),size=b.getSize(new THREE.Vector3());
  assert.ok(b.min.x>0&&b.max.x<3.5,'central-right, not a full-width band');
  assert.ok(size.x>1&&size.x<1.4);assert.ok(size.y<=.01);
  assert.ok(Math.abs(b.min.y-step.userData.top)<.004,'touches tread');
  const mats=strip.children.map(o=>o.material?.name);assert.ok(mats.includes('Warning yellow'));assert.ok(mats.includes('Warning charcoal'));
  const ray=new THREE.Raycaster(new THREE.Vector3(b.min.x+.01,step.userData.top+.1,(b.min.z+b.max.z)/2),new THREE.Vector3(0,-1,0));
  assert.ok(ray.intersectObject(step.children.find(o=>o.isMesh),true).some(h=>Math.abs(h.point.y-step.userData.top)<.002),'solid tread directly below');
 }
});
test('ground band keeps its window head but uses short panes and visible round wing supports',()=>{
 const m=model(),b=SHUNDE.facadeBands[0];
 assert.ok(b.windowHeight>=1.25&&b.windowHeight<=1.4,'short ground pane');
 assert.ok(Math.abs(b.windowCenter+b.windowHeight/2-3.5)<.01,'preserved window head');
 const supports=[];m.tiers[0].traverse(o=>{if(o.userData.role==='short-round-wing-support')supports.push(o);});
 assert.equal(supports.length,4);
 for(const o of supports){const box=new THREE.Box3().setFromObject(o),size=box.getSize(new THREE.Vector3());assert.ok(size.y>2.7&&size.y<3.1);assert.ok(size.x>.9&&size.x<1.4);assert.ok(box.min.y>=.89);assert.ok(Math.abs(box.max.z-5.25)<.03);}
 const ray=new THREE.Raycaster(new THREE.Vector3(-8.32,1.5,10),new THREE.Vector3(0,0,-1));
 const hits=ray.intersectObject(m.tiers[0],true);assert.ok(hits.length);assert.match(hits[0].object.material.name,/round column stone/,'no floor-height square pier in front of cylinder');
 // Typical upper pier front sits only ~0.28m beyond the glazing front, not 0.7m.
 const upper=m.tiers[1].children.find(o=>o.isMesh&&/Pale warm-gray/.test(o.material.name));
 assert.ok(new THREE.Box3().setFromObject(upper).max.z<=5.29);
});
