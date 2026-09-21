import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
// Repository V6 baseline; its input hashes are pinned in shared-parity.test.js.
const source=new URL('../../../src/',import.meta.url);
const shared=new URL('../../../shared/',import.meta.url);
// Canvas is an IO boundary here; deterministic geometry/rand order is real.
const ctx={fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},putImageData(){},getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4)};},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};}};
globalThis.document={createElement(){return {width:0,height:0,getContext(){return ctx;}};}};
const T={...THREE,TextureLoader:class{async loadAsync(){return new THREE.Texture();}}};
function fingerprint(root){const hash=crypto.createHash('sha256');root.traverse(o=>{hash.update(o.name);hash.update(JSON.stringify(o.matrix.toArray()));if(o.isMesh){for(const k of Object.keys(o.geometry.attributes).sort())hash.update(Buffer.from(o.geometry.attributes[k].array.buffer));if(o.geometry.index)hash.update(Buffer.from(o.geometry.index.array.buffer));if(o.instanceMatrix)hash.update(Buffer.from(o.instanceMatrix.array.buffer));if(o.instanceColor)hash.update(Buffer.from(o.instanceColor.array.buffer));}});return hash.digest('hex');}
test('shared PBR extraction preserves seeded full model geometry and instance layout',async()=>{
 assert.ok(fs.existsSync(new URL('pbr.js',shared)),'shared PBR module must exist');
 const oldLeaf=await import(new URL('leaves.js',source));await oldLeaf.loadLeafTextures(T);
 const old=await import(new URL('model.js',source));const a=old.createModel(THREE);
 const nextLeaf=await import('./leaves.js');await nextLeaf.loadLeafTextures(T);
 const next=await import('./model.js');const b=next.createModel(THREE);
 assert.deepEqual(b.stats,a.stats);assert.equal(fingerprint(b.group),fingerprint(a.group));
 console.log('V6 model geometry SHA256',fingerprint(b.group));
});
