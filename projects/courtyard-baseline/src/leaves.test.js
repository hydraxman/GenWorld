import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createLeafGeometry} from './leaves.js';
import fs from 'node:fs';
test('photographed leaf has lobed outline, UVs and curvature instead of triangular blade',()=>{const g=createLeafGeometry(THREE);const p=g.attributes.position;assert(p.count>20);assert(p.count<250);assert.equal(g.attributes.uv.count,p.count);g.computeBoundingBox();assert(g.boundingBox.max.z-g.boundingBox.min.z>.01);assert(g.index.count>30);assert([...p.array].every(Number.isFinite));});
test('camera and lighting are unchanged from V3',async()=>{const {createHash}=await import('node:crypto');const baseline=JSON.parse(fs.readFileSync('qa/v3-baseline.json','utf8'));for(const n of ['camera.js','water.js','illumination.js'])assert.equal(createHash('sha256').update(fs.readFileSync('src/'+n)).digest('hex'),baseline[n]);});
