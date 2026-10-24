import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraAt,DURATION,SHOTS} from './camera.js';
test('five measured shots cover a 36 second film without gaps',()=>{
 assert.equal(SHOTS.length,5);assert.equal(DURATION,36);
 assert.equal(SHOTS[0].start,0);assert.equal(SHOTS.at(-1).end,DURATION);
 for(let i=1;i<SHOTS.length;i++)assert.equal(SHOTS[i].start,SHOTS[i-1].end);
});
test('camera is deterministic, above ground, and in front of building',()=>{
 for(let t=0;t<=DURATION;t+=0.1){
  const c=cameraAt(t);assert.deepEqual(c,cameraAt(t));
  assert(c.position.every(Number.isFinite));assert(c.target.every(Number.isFinite));
  assert(c.position[1]>=1.7);assert(c.position[2]>4);assert(c.fov>=28&&c.fov<=58);
 }
});
test('each shot has real camera travel',()=>{
 for(const s of SHOTS){
  const a=cameraAt(s.start+0.01),b=cameraAt(s.end-0.01);
  assert(Math.hypot(...a.position.map((v,i)=>v-b.position[i]))>1);
 }
});
