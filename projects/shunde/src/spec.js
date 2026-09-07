export const DURATION=46;
// Photographic calibration, not a survey: native reference y≈1164/1012/796/574/241/88.
// Chosen working scale only; depth and unseen elevations remain hypotheses.
export const SHUNDE=Object.freeze({name:'舜德楼',version:3,width:66.56,depth:58,height:22.5,frontZ:5,baseY:.9,
 dimensionsStatus:'estimated-from-photos',interiorStatus:'inferred-not-surveyed',
 facadeBands:[
  {name:'lowest observable window band',base:.9,height:3.0,windowCenter:2.85,windowHeight:1.30},
  {name:'lower middle observable window band',base:3.9,height:4.4,windowCenter:6.59,windowHeight:2.14},
  {name:'upper middle observable window band',base:8.3,height:4.4,windowCenter:10.94,windowHeight:2.16},
  {name:'top regular window band and broad parapet',base:12.7,height:6.5,windowCenter:15.35,windowHeight:2.16}],
 roofBand:{kind:'recessed-narrow-strip',base:19.2,windowCenter:19.52,windowHeight:.58,fasciaBottom:19.94,fasciaTop:22.1},
 facade:{bayCount:16,bayWidth:4.16,opening:2.79,pierWidth:1.37},
 entrance:{halfWidth:7.65,top:12.7,columnX:3.84,columnRadius:.48,portalWidth:5.96,portalTop:9.1,portalHeadHeight:2.04},
 arcEnabled:true,
});
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function assemblyAt(t){if(t<36)return 0;if(t<39.5)return ease((t-36)/3.5);if(t<=42)return 1;return 1-ease((t-42)/3.5);}
export function shundeCameraAt(seconds){
 const t=Math.max(0,Math.min(DURATION,seconds));let a,b,target,fov=44,q;
 if(t<8){q=ease(t/8);a=[-2,4.7,67];b=[1,5,63];target=[0,11.2,4];}
 else if(t<16){q=ease((t-8)/8);a=[0,4.0,46];b=[2,4.3,41];target=[0,10.7,4];fov=45;}
 else if(t<24){q=ease((t-16)/8);a=[25,10,63];b=[31,12,59];target=[0,10,0];fov=45;}
 else if(t<31){q=ease((t-24)/7);a=[-3,4.2,29];b=[1,4.5,28];target=[0,7.1,3.8];fov=46;}
 else if(t<36){q=ease((t-31)/5);a=[-69,15,-80];b=[-61,12,-72];target=[-13,10,-24];fov=44;}
 else{return {position:[-74,70,-108],target:[0,21,-24],fov:45};}
 return {position:mix(a,b,q),target,fov};
}
