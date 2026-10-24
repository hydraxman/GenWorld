import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createShundeModel} from './model.js';

const m=createShundeModel(THREE,{textured:false});
const front=m.campus.getObjectByName('North forecourt planting');
const needles=front.getObjectByName('Instanced curved pine needle fascicles');
const leaves=m.campus.getObjectByName('Garden foliage — instanced real leaf silhouettes');
const clearance=.25;
const v=new THREE.Vector3(),instance=new THREE.Matrix4(),world=new THREE.Matrix4();

// Project actual architectural triangles, including the smoothed courtyard,
// wall thickness, pergola, north facade and steps. A global building AABB would
// incorrectly fill the open courtyard. Projection is deliberately conservative:
// trees must stay outside the built footprint even below an overhanging roof.
const architecture=[];
m.building.traverse(o=>{
 if(!o.isMesh)return;
 const position=o.geometry.attributes.position,index=o.geometry.index,triangles=[];
 for(let i=0;i<index.count;i+=3){
  const points=[0,1,2].map(k=>{
   const p=new THREE.Vector3().fromBufferAttribute(position,index.getX(i+k)).applyMatrix4(o.matrixWorld);
   p.y=0;return p;
  });
  const triangle=new THREE.Triangle(...points);
  triangles.push({triangle,bounds:new THREE.Box3().setFromPoints(points)});
 }
 architecture.push({name:o.name,triangles,bounds:new THREE.Box3().setFromObject(o)});
 architecture.at(-1).bounds.min.y=architecture.at(-1).bounds.max.y=0;
});

function overlapsBuilding(bounds){
 const box=bounds.clone();box.min.y=box.max.y=0;box.expandByScalar(clearance);
 for(const part of architecture){
  if(!box.intersectsBox(part.bounds))continue;
  for(const {triangle,bounds} of part.triangles){
   if(box.intersectsBox(bounds)&&box.intersectsTriangle(triangle))return part.name;
  }
 }
 return null;
}

// Transform every needle/leaf vertex by BOTH instance and world matrices; an
// InstancedMesh origin or trunk-only bound misses the offending lateral crown.
function vertexBounds(mesh,start=0,end=mesh.isInstancedMesh?mesh.count:1){
 const bounds=new THREE.Box3(),position=mesh.geometry.attributes.position;
 for(let i=start;i<end;i++){
  if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);world.multiplyMatrices(mesh.matrixWorld,instance);}
  else world.copy(mesh.matrixWorld);
  for(let j=0;j<position.count;j++)bounds.expandByPoint(v.fromBufferAttribute(position,j).applyMatrix4(world));
 }
 return bounds;
}

test('all six front pine crowns and branches clear the actual building footprint',()=>{
 assert.equal(needles.count,12960);
 const trees=front.children.filter(o=>o.name==='Pine — irregular lateral branch architecture');
 assert.equal(trees.length,6);
 const overlaps=[];
 for(let i=0;i<trees.length;i++){
  const bark=trees[i].children.find(o=>o.isMesh&&o.material.name==='Pine bark');
  assert.ok(bark,'merged trunk and lateral branch geometry exists');
  for(const [kind,bounds] of [
   ['needles',vertexBounds(needles,i*2160,(i+1)*2160)],
   ['trunk/branches',vertexBounds(bark)]
  ]){
   const hit=overlapsBuilding(bounds);
   if(hit)overlaps.push(`pine ${i} ${kind}: ${hit}`);
  }
 }
 assert.deepEqual(overlaps,[],`Require ${clearance}m projected clearance:\n${overlaps.join('\n')}`);
});

test('all nine garden tree crowns and branch triangles clear the actual courtyard boundary',()=>{
 assert.equal(leaves.count,20700);
 assert.equal(m.stats.trees,15);
 assert.equal(m.stats.leafInstances,42460);
 const overlaps=[];
 for(let i=0;i<9;i++){
  const hit=overlapsBuilding(vertexBounds(leaves,i*2300,(i+1)*2300));
  if(hit)overlaps.push(`garden tree ${i} leaves: ${hit}`);
 }
 // Garden bark is one merged mesh spanning the whole campus. Check every
 // triangle separately rather than filling the gaps between separate trees.
 const bark=m.campus.children.find(o=>o.isMesh&&o.material.name==='Garden tree bark');
 assert.ok(bark,'garden trunks and all lateral branches exist');
 const position=bark.geometry.attributes.position,index=bark.geometry.index;
 for(let i=0;i<index.count;i+=3){
  const bounds=new THREE.Box3();
  for(let k=0;k<3;k++)bounds.expandByPoint(v.fromBufferAttribute(position,index.getX(i+k)).applyMatrix4(bark.matrixWorld));
  const hit=overlapsBuilding(bounds);
  if(hit)overlaps.push(`garden bark triangle ${i/3}: ${hit}`);
 }
 assert.deepEqual(overlaps,[],`Require ${clearance}m projected clearance:\n${overlaps.join('\n')}`);
});
