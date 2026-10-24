import test from 'node:test';import assert from 'node:assert/strict';
import {POOLS,poolSupport,waterLevel,mirrorPoint} from './pools.js';
import {WATER_REFLECTION_MODE} from './water.js';
test('all three basin supports intersect grade and slab with no air gap',()=>{
 assert.equal(POOLS.length,3);
 for(const p of POOLS){const s=poolSupport(p);assert(s.bottom<-.065);assert(s.top>=p.floor);assert(s.width>=p.w+.64);assert(s.depth>=p.d+.65);assert(waterLevel(p)>p.floor&&waterLevel(p)<p.floor+.79);}
});
test('water uses live planar reflections and reflected points obey equal distance',()=>{
 assert.equal(WATER_REFLECTION_MODE,'planar-reflection');
 for(const p of POOLS){const level=waterLevel(p),point=[1,8,0],reflected=mirrorPoint(point,level);assert.equal(reflected[0],point[0]);assert.equal(reflected[2],point[2]);assert(Math.abs((point[1]-level)+(reflected[1]-level))<1e-9);}
});
