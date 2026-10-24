import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const shared=new URL('../../../shared/',import.meta.url);
const original=new URL('../../courtyard-baseline/',import.meta.url);
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
test('repository V6 parity baseline remains immutable',()=>{
 // Initial commit f4f30eb48fe2f4266f5730aba3354485f4d32bd9; all six files
 // were verified byte-identical to the original V6 checkout before migration.
 const hashes={
  'src/model.js':'1cd978f5704ab2f1843658172bbd7e88f50bb9c9b968192311458b8d10ce7b82',
  'src/pools.js':'ecf102e9cda12dc05b06d00b756bdd2ce49dfc2e4c765504aa27eb4664411e43',
  'src/leaves.js':'0a52c70ed2aa7a26da914373c090e7c11ce15b641c41067a684e99c185fede86',
  'assets/leaves/outline.json':'11dc4fdf3b5d747d98c3dad9ae9685ac52d3108658a782200cca8b044ee33aaa',
  'src/camera.js':'c1fc30479a8e914d36d2ae333eaf6b2e1d0834621d119e41ca9be278a9611e03',
  'src/film-camera.js':'b0fd1327feeaf0b883c29bbae6cf62e818fb4f0c1a93d90872917aa50f88ce70',
 };
 for(const [name,hash] of Object.entries(hashes))assert.equal(digest(new URL(name,original)),hash,name);
});
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
