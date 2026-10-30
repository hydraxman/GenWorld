import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createLeafGeometry} from './leaves.js';
import fs from 'node:fs';
test('photographed leaf has lobed outline, UVs and curvature instead of triangular blade',()=>{const g=createLeafGeometry(THREE);const p=g.attributes.position;assert(p.count>20);assert(p.count<250);assert.equal(g.attributes.uv.count,p.count);g.computeBoundingBox();assert(g.boundingBox.max.z-g.boundingBox.min.z>.01);assert(g.index.count>30);assert([...p.array].every(Number.isFinite));});
test('camera, water shader/body and shared lighting remain unchanged apart from the reusable shader factory',async()=>{
 const {createHash}=await import('node:crypto');
 const baseline=JSON.parse(fs.readFileSync(new URL('../qa/v3-baseline.json',import.meta.url),'utf8'));
 for(const n of ['camera.js','water.js','illumination.js']){
  let source=fs.readFileSync(new URL(n==='illumination.js'?'../../../shared/illumination.js':'./'+n,import.meta.url),'utf8');
  if(n==='water.js'){
   const setup="export function createWater(THREE){\n const group=new THREE.Group();group.name='Live planar reflection water';\n const reflectors=[];\n";
   source=source.replace('export function createWaterShader(THREE){\n return {',setup+' const shader={')
    .replace('}\n'+setup+' const shader=createWaterShader(THREE);\n','');
  }
  assert.equal(createHash('sha256').update(source).digest('hex'),baseline[n],n);
 }
});
