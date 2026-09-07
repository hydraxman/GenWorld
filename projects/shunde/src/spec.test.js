import test from 'node:test';
import assert from 'node:assert/strict';
import {SHUNDE,assemblyAt,shundeCameraAt,DURATION} from './spec.js';
test('correct building name and source uncertainty remain explicit',()=>{
 assert.equal(SHUNDE.name,'舜德楼');assert.equal(DURATION,46);
 assert.equal(SHUNDE.dimensionsStatus,'estimated-from-photos');
 assert.equal(SHUNDE.interiorStatus,'inferred-not-surveyed');
 assert.ok(SHUNDE.width>SHUNDE.height);assert.ok(SHUNDE.facadeBands.every(x=>x.height>0));
});
test('all film poses are deterministic finite and have framing range',()=>{
 for(let t=0;t<=46;t+=.1){const a=shundeCameraAt(t),b=shundeCameraAt(t);assert.deepEqual(a,b);assert.ok([...a.position,...a.target,a.fov].every(Number.isFinite));assert.ok(a.fov>=35&&a.fov<=55);}
 assert.deepEqual(shundeCameraAt(-1),shundeCameraAt(0));assert.deepEqual(shundeCameraAt(99),shundeCameraAt(46));
});
test('exploded ending closes exactly and does not affect exterior segment',()=>{
 assert.equal(assemblyAt(0),0);assert.equal(assemblyAt(35.999),0);assert.equal(assemblyAt(36),0);assert.equal(assemblyAt(40),1);assert.equal(assemblyAt(42),1);assert.equal(assemblyAt(46),0);
 for(let t=0;t<46;t+=.07)assert.ok(assemblyAt(t)>=0&&assemblyAt(t)<=1);
});
