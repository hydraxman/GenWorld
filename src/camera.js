export const DURATION=36;
export const SHOTS=[
 {start:0,end:8,name:'庭院正面推进',from:[0,4.3,49],to:[1.5,5.1,38],lookFrom:[0,4.6,4],lookTo:[0,4.9,3],fov:48},
 {start:8,end:15,name:'建筑斜侧面环绕',from:[18.5,10,27],to:[16,8.3,20],lookFrom:[1,5.5,-0.5],lookTo:[0,5.4,1],fov:46},
 {start:15,end:22,name:'廊架下的步行视角',from:[-11.5,2,31],to:[-11.5,2.2,18],lookFrom:[-1,4.2,0],lookTo:[0,4.8,0],fov:56},
 {start:22,end:28,name:'中央立面与露台细节',from:[10,7.7,15.7],to:[-1.5,8,16],lookFrom:[0.5,6.3,1.3],lookTo:[-0.4,6.5,0.8],fov:44},
 {start:28,end:36,name:'庭院与建筑俯瞰',from:[-25,23,41],to:[-12,28,43],lookFrom:[0,2.7,12],lookTo:[0,2.7,11],fov:50},
];
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function cameraAt(time){
 const t=Math.max(0,Math.min(DURATION-0.000001,Number.isFinite(time)?time:0));
 const s=SHOTS.find(x=>t>=x.start&&t<x.end)||SHOTS.at(-1);
 const u=(t-s.start)/(s.end-s.start);
 const smooth=u*u*(3-2*u);
 return {position:mix(s.from,s.to,smooth),target:mix(s.lookFrom,s.lookTo,smooth),fov:s.fov,shot:s.name};
}
