import test from 'node:test';import assert from 'node:assert/strict';
import {filmCameraAt,FILM_DURATION} from './film-camera.js';import {cameraAt} from './camera.js';
import fs from 'node:fs';import crypto from 'node:crypto';
test('append 10 seconds while preserving every sampled original camera pose',()=>{assert.equal(FILM_DURATION,46);for(let t=0;t<36;t+=.1)assert.deepEqual(filmCameraAt(t),cameraAt(t));});
test('ending uses a closer, slightly raised front camera, not overhead',()=>{const c=filmCameraAt(40.5);assert.deepEqual(c,filmCameraAt(36));assert.deepEqual(c,filmCameraAt(45.99));assert(Math.abs(c.position[0])<=12);assert(c.position[1]>=15&&c.position[1]<=25);assert(c.position[2]<=35);assert(c.target[1]>=10);const elev=Math.atan2(c.position[1]-c.target[1],Math.hypot(c.position[0]-c.target[0],c.position[2]-c.target[2]));assert(elev<Math.PI/9);});
test('explosion geometry and timings stay identical to V5',()=>{const digest=s=>crypto.createHash('sha256').update(s).digest('hex');assert.equal(digest(fs.readFileSync('src/exploded.js')),JSON.parse(fs.readFileSync('qa/v5-baseline.json','utf8')).exploded_sha256);});
