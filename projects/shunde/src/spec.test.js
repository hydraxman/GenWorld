import test from 'node:test';import assert from 'node:assert/strict';
import {SHUNDE,assemblyAt,shundeCameraAt,DURATION} from './spec.js';
test('photo calibration uses four observed bands plus clerestory, not OSM six levels',()=>{assert.equal(SHUNDE.name,'舜德楼');assert.equal(SHUNDE.facadeBands.length,4);assert.equal(SHUNDE.roofBand.kind,'recessed-narrow-strip');assert.equal(SHUNDE.dimensionsStatus,'estimated-from-photos');});
test('all poses are finite, deterministic and clamped',()=>{for(let t=0;t<=DURATION;t+=.125){const p=shundeCameraAt(t);assert.deepEqual(p,shundeCameraAt(t));assert.ok([...p.position,...p.target,p.fov].every(Number.isFinite));assert.ok(p.fov>=35&&p.fov<=65);}assert.deepEqual(shundeCameraAt(-1),shundeCameraAt(0));assert.deepEqual(shundeCameraAt(99),shundeCameraAt(DURATION));});
test('courtyard film never explodes inferred interiors',()=>{for(let t=0;t<60;t+=.25)assert.equal(assemblyAt(t),0);});
