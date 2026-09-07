import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createPBRTools} from './pbr.js';
export {squareGridAt} from './pbr.js';
export function createBuilder(THREE,seed=27531){
 const stats={textures:0,windows:0,trees:0,leafInstances:0,batches:0};
 const materials={},textureWorld=new Map();
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const tools=createPBRTools(THREE,{rand,stats,materials,textureWorld});
 const buckets=new Map();
 function add(group,geometry,material){
  const key=group.uuid+'|'+material.uuid;
  if(!buckets.has(key))buckets.set(key,{group,material,geometries:[]});
  buckets.get(key).geometries.push(geometry);
 }
 function box(group,name,x,y,z,w,h,d,material,rot=0){
  const g=new THREE.BoxGeometry(w,h,d);tools.worldUV(g,material);g.rotateY(rot);g.translate(x,y,z);add(group,g,material);
 }
 function cylinder(group,a,b,r0,r1,material,sides=12){
  const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p),g=new THREE.CylinderGeometry(r1,r0,v.length(),sides);
  tools.worldUV(g,material);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());add(group,g,material);
 }
 function finish(){
  for(const {group,material,geometries} of buckets.values()){
   const merged=mergeGeometries(geometries,false);if(!merged)throw new Error('Geometry merge failed '+material.name);
   const mesh=new THREE.Mesh(merged,material);mesh.name=group.name+' — '+material.name;mesh.castShadow=!/glass/i.test(material.name);mesh.receiveShadow=true;group.add(mesh);stats.batches++;
   for(const g of geometries)g.dispose();
  }
 }
 return {stats,rand,materials,textureWorld,...tools,box,cylinder,add,finish};
}
