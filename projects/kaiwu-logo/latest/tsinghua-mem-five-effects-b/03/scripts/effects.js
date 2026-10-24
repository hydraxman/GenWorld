import * as THREE from '../vendor/three/build/three.module.js';
// Film-specific original shaders, absolute time only. No reference-project code.
const planeVS=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const dustField=`
precision highp float;varying vec2 vUv;uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(53.81,197.41)))*28349.39);}
float field(vec2 p){vec2 k=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(k),hash(k+vec2(1,0)),f.x),mix(hash(k+vec2(0,1)),hash(k+1.),f.x),f.y);}
mat2 rot(float t){return mat2(cos(t),-sin(t),sin(t),cos(t));}
float cloud(vec2 p){float a=.55,n=0.;for(int i=0;i<5;i++){n+=a*field(p);p=rot(.64)*p*2.13+12.;a*=.47;}return n;}
void main(){vec2 p=(vUv-.5)*vec2(1.7777778,1.);float r=length(p),wing=smoothstep(.25,.52,r);
vec2 q=rot(time*.31)*p/(1.+.10*time);q+=vec2(time*.24,-time*.15);q+=.19*vec2(sin(p.y*5.-time*1.3),cos(p.x*4.+time));
vec2 w=vec2(cloud(q*2.8),cloud(q*2.8+7.));float n=cloud(q*5.+w*2.4),d=cloud(q*12.+w*3.);
float ribbon=exp(-pow((p.y-.19*sin(p.x*4.-time*.7))*2.6,2.));float dust=pow(max(0.,1.-abs(n-.53)*3.8),4.);
vec3 col=vec3(.012,.013,.027);col+=mix(vec3(.13,.21,.31),vec3(.35,.18,.31),w.x)*ribbon*(.35+1.1*dust)*wing;col+=vec3(.43,.33,.21)*pow(d,3.)*wing*1.3;col*=1.-smoothstep(.52,.73,n)*.65;
for(int l=0;l<3;l++){float fl=float(l);vec2 s=rot(.2*time/(fl+1.))*p*(90.-fl*27.)/(1.+time*.20)+vec2(time*(2.+fl),time*.4);vec2 id=floor(s),a=fract(s)-.5;float h=hash(id+fl*10.);a-=(vec2(hash(id),hash(id+9.))-.5)*.7;float star=exp(-dot(a,a)/(.00009+.0003*h));col+=vec3(.64,.79,1.)*star*step(.89,h)*(.2+wing);}
// long converging dust streaks: fast coherent flow rather than flicker
for(int i=0;i<22;i++){float k=float(i),a=k*2.399+.16*time;float age=fract(time*.64+k*.153);float rad=mix(1.25,.28,age);vec2 dir=vec2(cos(a),sin(a)*.62),head=dir*rad;vec2 delta=p-head;vec2 nd=normalize(dir);float along=dot(delta,nd),across=abs(delta.x*nd.y-delta.y*nd.x);float tail=exp(-across*across/.000004)*exp(-along*22.)*step(0.,along)*step(along,.22);col+=mix(vec3(.40,.62,1.),vec3(1.,.68,.31),mod(k,3.)/2.)*tail*wing*sin(age*3.14159)*.72;}
col*=1.-.28*smoothstep(.5,1.1,r);gl_FragColor=vec4(col,1.);}`;
const liquidField=`
precision highp float;varying vec2 vUv;uniform float time;
float heightAt(vec2 p){float r=length(p);float angle=atan(p.y,p.x);return .32*sin(15.*r-time*4.8+.7*sin(angle*3.+time*.6))+.20*sin(p.x*6.+p.y*4.-time*1.8)+.14*cos(p.y*9.-p.x*3.+time*2.2)+.09*sin(27.*r-time*7.);}
vec3 spectrum(float x){return .5+.5*cos(x+vec3(.0,2.1,4.2));}
void main(){vec2 p=(vUv-.5)*vec2(1.7777778,1.);p*=1.6;float r=length(p);float h=heightAt(p);float dx=(heightAt(p+vec2(.005,0))-h)/.005,dy=(heightAt(p+vec2(0,.005))-h)/.005;vec3 normal=normalize(vec3(-dx*.15,-dy*.15,1.));
vec2 refractUV=p+normal.xy*.23;float layer=2.8*refractUV.x+1.3*refractUV.y+time*.7+h*2.;vec3 irid=spectrum(layer+normal.x*3.-normal.y*2.);
vec3 base=mix(vec3(.045,.10,.17),vec3(.28,.36,.43),.5+.5*normal.y);vec3 col=base+irid*.19;
float silver=pow(max(0.,dot(normal,normalize(vec3(-.55,.7,1.)))),18.);float gold=pow(max(0.,dot(normal,normalize(vec3(.72,-.2,1.)))),28.);col+=vec3(.48,.69,.76)*silver*.65+vec3(.72,.45,.21)*gold*.64;
float ripple=.5+.5*sin(r*24.-time*5.2+.5*sin(atan(p.y,p.x)*2.+time));col+=vec3(.35,.46,.57)*pow(ripple,12.)*.13;
// Keep a dark quiet window behind the purple metal, never a flat occluding disk.
float quiet=smoothstep(.36,.88,r);col*=.27+.73*quiet;float ring=exp(-pow((r-(.1+min(time/2.1,1.)*.92))/.026,2.))*(1.-smoothstep(2.1,3.0,time));col+=vec3(.42,.71,.87)*ring*.65;
col*=1.-.22*smoothstep(.9,1.8,r);gl_FragColor=vec4(col,1.);}`;
export function makeBackground(mode){const scene=new THREE.Scene(),camera=new THREE.Camera();const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{time:{value:0}},vertexShader:planeVS,fragmentShader:mode==='03'?dustField:liquidField});scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));return{scene,camera,material,draw(t){material.uniforms.time.value=t;}};}
const nGLSL=`float revealNoise(vec2 p){return clamp(.5+.19*sin(p.x*4.1+sin(p.y*3.9))+.16*cos(p.y*6.2+p.x*2.2)+.10*sin(p.x*13.7-p.y*10.1),0.,1.);}`;
export function makeEffects(T,mode,badge,groups,materials,renderer){
 const uTime={value:0};
 for(const mat of materials){const original=mat.onBeforeCompile.bind(mat);mat.onBeforeCompile=shader=>{original(shader);shader.uniforms.effectTime=uTime;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 fxPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nfxPosition=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 fxPosition;uniform float effectTime;\n'+nGLSL);const code=mode==='03'?`
float threshold=(effectTime-.45)/2.3;float grain=revealNoise(fxPosition.xy);if(grain>threshold)discard;float edge=(1.-smoothstep(.0,.065,threshold-grain))*(1.-smoothstep(2.65,2.9,effectTime));outgoingLight+=vec3(.55,.70,1.)*edge*2.3;`:`
float radius=max(0.,(effectTime-.12)/2.25)*4.;float rr=length(fxPosition.xy);if(rr>radius)discard;float rim=exp(-pow((rr-radius)/.10,2.))*(1.-smoothstep(2.2,2.6,effectTime));outgoingLight+=vec3(.36,.72,.81)*rim*1.4;`;
shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',code+'\n#include <opaque_fragment>');};mat.customProgramCacheKey=()=>mode+'-original-film-v1';}
 let particleCount=0;const clouds=[];
 if(mode==='03'){
  let seed=61387;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,uniforms:{effectTime:uTime},vertexShader:`uniform float effectTime;attribute float seed;varying float opacity;varying float hue;${nGLSL}
void main(){float noise=revealNoise(position.xy);float arrive=.45+2.3*noise;float travel=clamp((arrive-effectTime)/1.25,0.,1.);float angle=seed*26.+travel*2.7;vec3 p=position+vec3(cos(angle)*travel*(4.+seed*3.),sin(angle)*travel*(3.+seed*2.),travel*(seed*4.-1.));float alive=smoothstep(-.18,.08,arrive-effectTime);opacity=alive*(1.-smoothstep(2.72,2.92,effectTime));hue=seed;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(24.+seed*28.)/(-mv.z);}`,fragmentShader:`precision highp float;varying float opacity;varying float hue;void main(){float r=length(gl_PointCoord-.5);float a=exp(-r*r*17.)*opacity;if(a<.015)discard;vec3 col=mix(vec3(.45,.67,1.),vec3(1.,.78,.44),hue);gl_FragColor=vec4(col,a);}`});
  for(const group of Object.values(groups)){const verts=[],seeds=[];for(const mesh of [...group.children]){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i+=3){if(Math.abs(p.getZ(i))>.01||Math.abs(p.getZ(i+1))>.01||Math.abs(p.getZ(i+2))>.01)continue;const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);const area=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a)).length()*.5;const number=Math.max(1,Math.ceil(area*530));for(let j=0;j<number;j++){let u=rand(),v=rand();if(u+v>1){u=1-u;v=1-v;}const point=a.clone().addScaledVector(new T.Vector3().subVectors(b,a),u).addScaledVector(new T.Vector3().subVectors(c,a),v);verts.push(point.x,point.y,point.z+.025);seeds.push(rand());}}}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('seed',new T.Float32BufferAttribute(seeds,1));const cloud=new T.Points(geo,material);cloud.frustumCulled=false;group.add(cloud);clouds.push(cloud);particleCount+=seeds.length;}
 }
 // Full scene refraction for 04: no history buffer, no accumulated simulation.
 let target,post,postCamera,postMaterial;
 if(mode==='04'){target=new T.WebGLRenderTarget(1920,1080,{type:T.HalfFloatType,depthBuffer:true,samples:4});post=new T.Scene();postCamera=new T.Camera();postMaterial=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:true,uniforms:{image:{value:target.texture},effectTime:uTime},vertexShader:planeVS,fragmentShader:`precision highp float;varying vec2 vUv;uniform sampler2D image;uniform float effectTime;void main(){vec2 p=(vUv-.5)*vec2(1.7777778,1.);float r=length(p);float decay=1.-smoothstep(1.5,3.5,effectTime);float wave=sin(r*35.-effectTime*6.)*exp(-r*.6);vec2 delta=normalize(p+vec2(.0001))*wave*.014*decay;delta.x/=1.7777778;vec2 uv=clamp(vUv+delta,vec2(.001),vec2(.999));vec3 col=texture2D(image,uv).rgb;gl_FragColor=vec4(col,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`});post.add(new T.Mesh(new T.PlaneGeometry(2,2),postMaterial));}
 return {particleCount,update(t){uTime.value=t;for(const c of clouds)c.visible=t<2.93;},metrics(t){return {method:mode==='03'?'reverse emissive noise + surface particles':'radial solid reveal + full-scene wave refraction',particleCount,particlesVisible:mode==='03'&&t<2.93,fullyRevealed:t>=2.93,refractionSettled:mode==='03'||t>=3.5,holdStart:4.1};},begin(){if(target)renderer.setRenderTarget(target);},finish(){if(target){renderer.setRenderTarget(null);renderer.clear();renderer.render(post,postCamera);}}};
}
