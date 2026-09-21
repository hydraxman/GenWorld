export const DURATION=24;
// Photographic calibration, not a survey: native reference y≈1164/1012/796/574/241/88.
// Chosen working scale only; depth and unseen elevations remain hypotheses.
export const SHUNDE=Object.freeze({name:'舜德楼',version:4,width:66.56,depth:58,height:22.5,frontZ:5,baseY:.9,
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
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function assemblyAt(){return 0;}
export function shundeCameraAt(seconds){
 const t=Math.max(0,Math.min(DURATION,seconds));
 if(t<8)return {position:mix([-14,5.2,-73],[-6,5.5,-67],ease(t/8)),target:[-8,10,-7],fov:44,chapter:'01 / 北向主入口'};
 if(t<16)return {position:mix([52,118,116],[73,106,102],ease((t-8)/8)),target:[28,3,25],fov:52,chapter:'02 / 内院与北侧开口 · 组合体量'};
 return {position:mix([43,3.7,44],[40,4.0,42],ease((t-16)/8)),target:[7,10.5,13],fov:61,chapter:'03 / 院内望向西北 · 圆筒与斜向玻璃厅'};
}
