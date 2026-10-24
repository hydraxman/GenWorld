/* Volumetric cloud renderer: adaptation of three.js webgl_volume_cloud.html
 * Fixed upstream 0769f75f00560be7d707061ea088f27723ef9a3c. MIT, see research/three-license.txt.
 * Reused Data3DTexture volume / ray stepping / front-to-back transmittance.
 * Added tileable fBm, advected atmospheric banks, light marching, foreground protection.
 */
import * as THREE from '../vendor/three/build/three.module.js';
import {ImprovedNoise} from '../research/ImprovedNoise.js';
import skyData from '../assets/sky-data.json';
export function makeClouds(renderer){
 let skyTexture;const ready=new Promise((resolve,reject)=>{skyTexture=new THREE.TextureLoader().load(skyData.url,resolve,undefined,reject);});
 const N=128,data=new Uint8Array(N*N*N),noise=new ImprovedNoise();
 // Periodic ImprovedNoise with continuous edge blending, not stacked circle sprites.
 for(let z=0,i=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++,i++){
  const a=x/N,b=y/N,c=z/N,px=a*8,py=b*8,pz=c*8;let n=0;
  for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)n+=noise.noise(px-dx*8,py-dy*8,pz-dz*8)*(dx?a:1-a)*(dy?b:1-b)*(dz?c:1-c);
  data[i]=Math.round(Math.max(0,Math.min(1,.5+.65*n))*255);
 }
 const tex=new THREE.Data3DTexture(data,N,N,N);tex.format=THREE.RedFormat;tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.wrapS=tex.wrapT=tex.wrapR=THREE.RepeatWrapping;tex.unpackAlignment=1;tex.needsUpdate=true;
 const camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),scene=new THREE.Scene(),foreground=new THREE.Scene();
 const uniforms={volume:{value:tex},skyMap:{value:skyTexture},time:{value:0},foreground:{value:0},debugAlpha:{value:0}};
 const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
 const fragmentShader=`precision highp sampler3D;
 uniform sampler3D volume;uniform sampler2D skyMap;uniform float time,foreground,debugAlpha;varying vec2 vUv;
 float n(vec3 p){return texture(volume,p*.075).r;}
 float fbm(vec3 p){return n(p)*.54+n(p*2.03+vec3(4.7,7.1,2.3))*.27+n(p*4.11+vec3(3.1,2.6,9.2))*.13+n(p*8.23+vec3(8.,2.,4.))*.06;}
 float density(vec3 p){
  p.x+=time*.72;
  float f=fbm(p*1.35);
  float lower=1.-smoothstep(-4.6,-1.05,p.y+(f-.5)*4.4);
  float upper=smoothstep(2.3,5.9,p.y+(f-.5)*4.0+.65*sin(p.x*.36));
  float envelope=max(lower,upper*.93);
  float base=f+.36*envelope-.59;
  float d=smoothstep(-.025,.14,base)*envelope;
  // Erode fine edges while retaining dense, shadow-casting interiors.
  d=max(0.,d-(1.-n(p*9.2+5.1))*.095*(1.-d));
  float zmask=smoothstep(-4.5,-3.3,p.z)*(1.-smoothstep(3.,4.4,p.z));
  return d*zmask;
 }
 float thinDensity(vec3 p){
  p.x-=time*1.2;
  float f=fbm(p*2.1+vec3(7.,2.,3.));
  float band=exp(-pow((p.y+.6+.5*sin(p.x*.7))/.55,2.));
  float band2=.8*exp(-pow((p.y-2.3+.4*sin(p.x*.8))/.45,2.));
  return smoothstep(.48,.65,f)*max(band,band2)*exp(-p.z*p.z*.45);
 }
 void main(){
  vec2 uv=vUv;vec2 xy=(uv-.5)*vec2(20.,11.25);
  if(foreground<.5){
   vec3 rd=normalize(vec3((uv-.5)*vec2(1.90,1.07),1.));
   float pitch=.76;rd.yz=mat2(cos(pitch),-sin(pitch),sin(pitch),cos(pitch))*rd.yz;
   float lon=atan(rd.x,rd.z)/6.28318530718+.235+time*.018;
   float lat=asin(clamp(rd.y,-1.,1.))/3.14159265359+.5;
   vec3 photo=texture2D(skyMap,vec2(fract(lon),lat)).rgb;
   float blue=clamp((photo.b-photo.r)*3.2,0.,1.);
   photo=mix(photo,vec3(photo.r*.75,photo.g*1.14,photo.b*1.11),blue*.75);
   photo=mix(pow(photo,vec3(.79)),vec3(.20,.65,.94),.035);
   gl_FragColor=vec4(photo,1.);return;
  }
  vec3 sky=mix(vec3(.48,.79,.96),vec3(.13,.55,.87),pow(uv.y,.65));
  sky+=vec3(.065,.05,.02)*pow(max(0.,1.-length((uv-vec2(.78,.88))*vec2(.75,1.))),5.);
  vec3 sum=vec3(0.);float trans=1.;const int STEPS=72;float stepSize=8.8/float(STEPS);
  for(int i=0;i<STEPS;i++){
   vec3 p=vec3(xy,4.4-(float(i)+.5)*stepSize);
   p.xy*=1.+(.045*(4.4-p.z));
   float d=foreground>.5?thinDensity(p):density(p);
   if(d>.001){
    float lightD=0.;
    if(foreground<.5){
     vec3 sun=vec3(-.48,.72,.50);
     lightD=density(p+sun*.33)*.30+density(p+sun*.8)*.47+density(p+sun*1.6)*.8+density(p+sun*2.8)*1.2;
    }
    float sunlight=exp(-lightD*1.45);
    vec3 lit=mix(vec3(.43,.57,.72),vec3(1.,.99,.965),sunlight);
    lit+=vec3(.075)*pow(1.-d,2.)*sunlight;
    float alpha=1.-exp(-d*stepSize*(foreground>.5?1.1:3.5));
    sum+=trans*alpha*lit;trans*=1.-alpha;
    if(trans<.012)break;
   }
  }
  float a=1.-trans;
  if(foreground>.5){
   // Entire book and letters protected, broad feather to avoid a punched-out hole.
   float core=1.-smoothstep(.005,.10,length(max(abs(uv-.5)-vec2(.15,.235),vec2(0.))));
   float cap=mix(.14,.035,core);
   a=min(a*.32,cap);
   // Keep the foreground patchy, never a global white veil.
   a*=smoothstep(.02,.20,1.-trans);
   vec3 rgb=sum/max(1.-trans,.001);
   gl_FragColor=debugAlpha>.5?vec4(vec3(a),1.):vec4(rgb,a);
  }else{gl_FragColor=vec4(sum+trans*sky,1.);}
 }
 `;
 const mat=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,depthWrite:false,depthTest:false,toneMapped:false});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);scene.add(mesh);
 const fgMat=mat.clone();fgMat.uniforms.volume.value=tex;fgMat.uniforms.foreground.value=1;fgMat.transparent=true;foreground.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),fgMat));
 let enabled=true;
 return {ready,scene,camera,foreground,mat,fgMat,setForeground(v){enabled=!!v;},get foregroundEnabled(){return enabled;},drawBackground(t){uniforms.time.value=t;fgMat.uniforms.time.value=t;renderer.render(scene,camera);},drawForeground(){if(enabled)renderer.render(foreground,camera);},metrics(t){return {algorithm:'CC0 Poly Haven spherical sky + Data3DTexture 72-step thin-cloud raymarch and front-to-back transmittance',backgroundYawRadians:t*.018*Math.PI*2,backgroundPitchRadians:.76,foregroundAdvectionWorld:t*1.2,foregroundEnabled:enabled,foregroundPeakAlphaCap:.14,coreAlphaCap:.035,coreROI:[744,324,1176,756],noiseTexture:[N,N,N],steps:72};}};
}
