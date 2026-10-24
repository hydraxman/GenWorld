import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createShundeModel} from './model.js';
import {shundeCameraAt} from './spec.js';
import {FOOTPRINT} from './footprint.js';

const m=createShundeModel(THREE,{textured:false,foliage:false});
const bounds=o=>new THREE.Box3().setFromObject(o);
const byRole=role=>{const found=[];m.building.traverse(o=>{if(o.userData.role===role)found.push(o);});return found;};
test('photo-left attached red-brown fin, projecting cap and stacked railed platforms are actual geometry',()=>{
 const [detail]=byRole('court-cylinder-balconies');assert.ok(detail,'missing cylinder photo-left assembly');
 const [fin]=byRole('court-vertical-fin'),[cap]=byRole('court-fin-cap'),platforms=byRole('court-balcony-platform');
 assert.ok(fin&&cap);assert.ok(platforms.length>=2,'stacked platforms, not a surveyed count assertion');
 const f=bounds(fin),c=bounds(cap);assert.ok(f.max.y-f.min.y>15);assert.ok(f.max.x-f.min.x<1.3);
 assert.ok(c.max.x-c.min.x>f.max.x-f.min.x+1,'projecting cap');
 const camera=new THREE.PerspectiveCamera();Object.assign(camera,{fov:61,aspect:16/9});const pose=shundeCameraAt(20);camera.position.set(...pose.position);camera.lookAt(...pose.target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const arcCenter=bounds(m.arc).getCenter(new THREE.Vector3()).project(camera);
 for(const platform of platforms){
  const b=bounds(platform),p=b.getCenter(new THREE.Vector3());assert.ok(p.clone().project(camera).x<arcCenter.x,'platform lies PHOTO-LEFT, not east of cylinder');
  const contact=new THREE.Raycaster(new THREE.Vector3(b.min.x-.1,p.y,b.min.z+.3),new THREE.Vector3(1,0,0),0,b.max.x-b.min.x+.1).intersectObject(m.arc,true);
  assert.ok(contact.length,'actual arc surface passes through the deck attachment, not floating');
  assert.ok(new THREE.Raycaster(new THREE.Vector3(p.x,b.max.y+1,p.z),new THREE.Vector3(0,-1,0),0,2).intersectObject(platform,true).length,'real deck');
 }
 const rails=byRole('court-balcony-railing');assert.equal(rails.length,platforms.length);
 for(const rail of rails){assert.ok(bounds(rail).getSize(new THREE.Vector3()).y>.85);assert.ok(rail.children.some(o=>o.isMesh&&o.material.color.r>.5),'light metal rails');}
});

test('red fin ends above grade on slim pale supports with open space below',()=>{
 const [fin]=byRole('court-vertical-fin'),[cap]=byRole('court-fin-cap'),[supports]=byRole('court-fin-supports');
 const b=bounds(fin);assert.ok(b.min.y>2.8,'red blade must not run down to ground');
 assert.ok(b.max.y>bounds(cap).max.y+.4,'blade projects above cap');assert.ok(supports,'slim pale supports');
 assert.ok(bounds(supports).max.y>=b.min.y-.02);
 const center=b.getCenter(new THREE.Vector3());
 assert.equal(new THREE.Raycaster(new THREE.Vector3(center.x,1.5,b.max.z+1),new THREE.Vector3(0,0,-1),0,4).intersectObject(fin,true).length,0);
});

test('fin is visible from every approved courtyard shot, not merely projected left behind the cylinder',()=>{
 const [fin]=byRole('court-vertical-fin'),[assembly]=byRole('court-cylinder-balconies'),b=bounds(fin);
 for(const t of [16,20,23.9])for(const y of [10,17]){
  const origin=new THREE.Vector3(...shundeCameraAt(t).position),target=new THREE.Vector3((b.min.x+b.max.x)/2,y,b.max.z-.02);
  const hits=new THREE.Raycaster(origin,target.sub(origin).normalize()).intersectObject(m.building,true);
  let node=hits[0]?.object;while(node&&node!==assembly)node=node.parent;
  assert.ok(node===assembly,`fin occluded at t=${t}, y=${y} by ${hits[0]?.object.name}`);
 }
});

test('garden doors have full-height bidirectional passage through glazing AND foundation, connected to gravel paths',()=>{
 for(const edge of [11,13]){
  const g=m.west.getObjectByName(`Boundary ${edge}-${edge+1}`),a=FOOTPRINT[edge],b=FOOTPRINT[edge+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(const x of [L/2-.8,L/2,L/2+.8])for(const y of [.075,.25,.8,1.6,2.79])for(const sign of [-1,1]){
   const origin=g.localToWorld(new THREE.Vector3(x,y,sign===1?-1.9:2.8));
   const dir=new THREE.Vector3(0,0,sign).transformDirection(g.matrixWorld);
   const hits=new THREE.Raycaster(origin,dir,0,4.7).intersectObject(m.building,true);
   assert.equal(hits.length,0,`s${edge} doorway blocked at x=${x}, y=${y}: ${hits.map(h=>h.object.name)}`);
  }
  const door=g.children.find(o=>o.userData.role==='garden-door');assert.ok(door,'explicit framed door assembly');
  assert.ok(door.children.some(o=>o.userData.role==='open-glazed-door-leaf'),'conservative open door leaves');
  for(const z of [-1.9,-.5,0,1,2.8]){
   const p=g.localToWorld(new THREE.Vector3(L/2,.3,z));
   const hits=new THREE.Raycaster(p,new THREE.Vector3(0,-1,0),0,.4).intersectObject(m.group,true);
   assert.ok(hits.length&&hits[0].point.y>=.04&&hits[0].point.y<=.065,'continuous low threshold, not a 0.9m blocking plinth');
  }
  const start=g.localToWorld(new THREE.Vector3(L/2,0,-1.8));
  const route=edge===11?[[start.x,start.z],[-1.4,18],[-2,28],[0,37]]:[[start.x,start.z],[-12,35],[-14,44]];
  const curve=new THREE.CatmullRomCurve3(route.map(([x,z])=>new THREE.Vector3(x,0,z)));
  for(const p of curve.getPoints(80)){
   const hits=new THREE.Raycaster(new THREE.Vector3(p.x,.2,p.z),new THREE.Vector3(0,-1,0),0,.25).intersectObject(m.group,true);
   assert.match(hits[0]?.object.material.name||'',/paving|gravel/i,'continuous paved connection to original garden path');
  }
 }
});

test('approved camera source and original instanced foliage remain byte-identical',()=>{
 const hash=data=>createHash('sha256').update(data).digest('hex');
 assert.equal(hash(readFileSync(new URL('./spec.js',import.meta.url))),'4689b7bcb5d2cf4d6c068904e30ee6f23272b118c7ec6a15dea8a0df49a9ab66');
 const planted=createShundeModel(THREE,{textured:false}),h=createHash('sha256');
 planted.campus.traverse(o=>{if(o.isInstancedMesh){h.update(o.name);h.update(Buffer.from(o.instanceMatrix.array.buffer));if(o.instanceColor)h.update(Buffer.from(o.instanceColor.array.buffer));h.update(JSON.stringify(o.matrixWorld.toArray()));}});
 h.update(JSON.stringify(planted.campus.getObjectByName('North forecourt planting').matrixWorld.toArray()));
 assert.equal(h.digest('hex'),'57a541acbd6d4e563094c8bfa2a52c22c9c26114ff80b39e422c6f87f326b085');
});
