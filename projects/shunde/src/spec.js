export const DURATION=46;
export const SHUNDE=Object.freeze({name:'舜德楼',width:62,depth:30,height:21.5,frontZ:5,baseY:.8,floorHeights:[4.1,4.2,4.2,4.2,3.0],dimensionsStatus:'estimated-from-photos',interiorStatus:'inferred-not-surveyed'});
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function assemblyAt(t){if(t<36)return 0;if(t<39.5)return ease((t-36)/3.5);if(t<=42)return 1;return 1-ease((t-42)/3.5);}
export function shundeCameraAt(seconds){
 const t=Math.max(0,Math.min(DURATION,seconds));let a,b,target,fov=44,q;
 if(t<8){q=ease(t/8);a=[-45,18,59];b=[-25,14,62];target=[0,9,-2];}
 else if(t<16){q=ease((t-8)/8);a=[0,8.5,48];b=[4,7,33];target=[0,9,3];fov=43;}
 else if(t<24){q=ease((t-16)/8);a=[52,28,40];b=[58,31,17];target=[2,10,-7];fov=45;}
 else if(t<31){q=ease((t-24)/7);a=[15,11,23];b=[-4,8,24];target=[0,8.4,3];fov=46;}
 else if(t<36){q=ease((t-31)/5);a=[-20,18,64];b=[-10,17,60];target=[0,10,-3];fov=44;}
 else{return {position:[28,37,68],target:[0,19,-7],fov:45};}
 return {position:mix(a,b,q),target,fov};
}
