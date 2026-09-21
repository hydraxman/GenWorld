import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('GLB disk verification counts instantiated mesh objects, not deduplicated resources',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'shunde-glb-count-'));
 try{
  // Synthetic regression fixture only: two scene nodes reuse one triangle mesh.
  const data={asset:{version:'2.0'},scenes:[{nodes:[0,1]}],scene:0,nodes:[{mesh:0},{mesh:0}],meshes:[{primitives:[{attributes:{},material:0}]}],materials:[{}],images:[],bufferViews:[],accessors:[],buffers:[{byteLength:0}]};
  let json=Buffer.from(JSON.stringify(data));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const bytes=Buffer.alloc(28+json.length);bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(json.length,12);bytes.writeUInt32LE(0x4e4f534a,16);json.copy(bytes,20);bytes.writeUInt32LE(0,20+json.length);bytes.writeUInt32LE(0x004e4942,24+json.length);
  await fs.writeFile(path.join(dir,'Shunde-courtyard-context.glb'),bytes);
  await fs.writeFile(path.join(dir,'glb-verification.json'),JSON.stringify({glb:{instances:0,meshes:2,bytes:bytes.length}}));
  const script=fileURLToPath(new URL('../scripts/verify_glb.py',import.meta.url));
  const run=spawnSync(process.env.PYTHON||'python3',[script],{encoding:'utf8',env:{...process.env,SHUNDE_OUTPUT:dir},timeout:30000});
  assert.equal(run.status,0,run.stderr||String(run.error));
  const report=JSON.parse(await fs.readFile(path.join(dir,'glb-disk-check.json'),'utf8'));
  assert.equal(report.meshes,2);assert.equal(report.meshResources,1);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
