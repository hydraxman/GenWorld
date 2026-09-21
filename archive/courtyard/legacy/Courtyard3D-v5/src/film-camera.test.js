import test from 'node:test';import assert from 'node:assert/strict';
import {filmCameraAt,FILM_DURATION} from './film-camera.js';import {cameraAt} from './camera.js';
test('append 10 seconds while preserving every sampled original camera pose',()=>{assert.equal(FILM_DURATION,46);for(let t=0;t<36;t+=.1)assert.deepEqual(filmCameraAt(t),cameraAt(t));});
test('explosion camera is stable for closed/open comparison and sees the upper layers',()=>{assert.deepEqual(filmCameraAt(36),filmCameraAt(45.99));assert(filmCameraAt(40).position[1]>25);assert(filmCameraAt(40).target[1]>8);});
