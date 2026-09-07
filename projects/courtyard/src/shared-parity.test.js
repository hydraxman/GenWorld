import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const shared=new URL('../../../shared/',import.meta.url);
const original=new URL('file:///Users/bryannathan/Desktop/Courtyard3D-v6/');
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
test('shared V6 leaf geometry is byte-identical, curved and not a triangle',async()=>{
 assert.ok(fs.existsSync(new URL('leaves.js',shared)),'shared leaf API must exist');
 const THREE=await import('three');
 const old=await import(new URL('src/leaves.js',original));
 const next=await import(new URL('leaves.js',shared));
 for(const scale of [1,.5]){
  const a=old.createLeafGeometry(THREE,scale),b=next.createLeafGeometry(THREE,scale);
  assert.ok(b.attributes.position.count>30);assert.ok(b.index.count>30);
  assert.deepEqual(b.attributes.position.array,a.attributes.position.array);
  assert.deepEqual(b.attributes.uv.array,a.attributes.uv.array);
  assert.deepEqual(b.index.array,a.index.array);
  assert.ok([...b.attributes.position.array].filter((_,i)=>i%3===2).some(z=>z>0));
 }
});
test('camera and film-camera remain byte-identical to immutable V6',()=>{
 for(const name of ['camera.js','film-camera.js'])assert.equal(digest(new URL(name,import.meta.url)),digest(new URL('src/'+name,original)));
});
