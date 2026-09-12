import test from 'node:test';import assert from 'node:assert/strict';
import {DURATION,shundeCameraAt} from './spec.js';
test('24 second route has north front, elevated topology, and south/SE court view',()=>{
 assert.equal(DURATION,24);
 const a=shundeCameraAt(3),b=shundeCameraAt(11),c=shundeCameraAt(20);
 assert.ok(a.position[2]<-20&&a.target[2]<0);
 assert.ok(b.position[1]>65);
 assert.ok(c.position[0]>c.target[0]&&c.position[2]>c.target[2]&&c.position[1]<6);
 assert.deepEqual(shundeCameraAt(20),shundeCameraAt(20));
});
