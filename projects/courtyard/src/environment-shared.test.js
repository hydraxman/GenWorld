import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
const shared=new URL('../../../shared/',import.meta.url);
test('shared environment installs V6 light rig without changing source values',async()=>{
 assert.ok(fs.existsSync(new URL('environment.js',shared)),'shared environment must exist');
 const {addCampusLights,makeEnvironment}=await import(new URL('environment.js',shared));
 assert.equal(typeof makeEnvironment,'function');
 const scene=new THREE.Scene();const {hemi,sun,fill}=addCampusLights(THREE,scene);
 assert.equal(scene.children.length,4);assert.equal(hemi.intensity,.9);assert.equal(sun.intensity,2.8);assert.equal(fill.intensity,.28);
 assert.deepEqual(sun.position.toArray(),[-24,43,32]);assert.deepEqual(sun.target.position.toArray(),[0,1,9]);
 assert.equal(sun.shadow.mapSize.x,4096);assert.equal(sun.shadow.normalBias,.035);
});
