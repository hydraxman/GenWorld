import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {groundHeight,walkwayAt,CAMPUS_SIZE} from './campus.js';
import {WATER_COLOR,WATER_OPACITY} from './water.js';
test('water is colored and not transparent',()=>{
 assert.equal(WATER_COLOR,'#4d8586');assert.equal(WATER_OPACITY,1);
});
test('approved V1 camera file is byte-for-byte unchanged',()=>{
 const baseline=JSON.parse(readFileSync(new URL('../qa/v1-baseline.json',import.meta.url)));
 assert.equal(createHash('sha256').update(readFileSync(new URL('./camera.js',import.meta.url))).digest('hex'),baseline.camera_sha256);
});
test('continuous campus ground meets both paving levels',()=>{
 assert.equal(groundHeight(0),-0.065);assert.equal(groundHeight(50),-0.605);
 for(let z=-100;z<100;z+=.1){assert(Number.isFinite(groundHeight(z)));assert(Math.abs(groundHeight(z+.1)-groundHeight(z))<.03);}
 assert(CAMPUS_SIZE>=250);
});
test('planting excludes approach and campus sidewalks',()=>{
 assert(walkwayAt(0,70));assert(walkwayAt(34,10));assert(walkwayAt(20,53));assert(walkwayAt(20,-27));assert(!walkwayAt(24,15));
});
