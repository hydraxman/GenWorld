export const POOLS=Object.freeze([
 {z:12.8,w:5.1,d:5,floor:1.02},
 {z:19.25,w:6.45,d:7.35,floor:.57},
 {z:27.7,w:8.1,d:9.1,floor:.14},
]);
export const FOUNDATION_BOTTOM=-.18;
export function poolSupport(pool){return {bottom:FOUNDATION_BOTTOM,top:pool.floor+.025,width:pool.w+.64,depth:pool.d+.65};}
export function waterLevel(pool){return pool.floor+.64;}
export function mirrorPoint(point,level){return [point[0],2*level-point[1],point[2]];}
