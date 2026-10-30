import {Reflector} from 'three/addons/objects/Reflector.js';
import {POOLS,waterLevel} from './pools.js';
export const WATER_COLOR='#4d8586';
export const WATER_OPACITY=1;
export const WATER_REFLECTION_MODE='planar-reflection';
export function createWaterShader(THREE){
 return {name:'Blue green water with real planar building reflection',uniforms:{
  color:{value:new THREE.Color(WATER_COLOR)},tDiffuse:{value:null},textureMatrix:{value:new THREE.Matrix4()},time:{value:0},eye:{value:new THREE.Vector3()},reflectionEnabled:{value:1}
 },vertexShader:`
 uniform mat4 textureMatrix;varying vec4 reflectionUv;varying vec3 worldPosition;
 void main(){reflectionUv=textureMatrix*vec4(position,1.);worldPosition=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
 `,fragmentShader:`
 uniform vec3 color;uniform sampler2D tDiffuse;uniform float time;uniform vec3 eye;uniform float reflectionEnabled;
 varying vec4 reflectionUv;varying vec3 worldPosition;
 void main(){
  vec2 uv=reflectionUv.xy/reflectionUv.w;
  float a=worldPosition.x*3.1+worldPosition.z*1.8+time*.28;
  float b=worldPosition.x*6.8-worldPosition.z*3.7+time*.19;
  vec2 ripple=vec2(sin(a)+.3*sin(b),cos(a*.8)+.25*cos(b));
  vec3 normal=normalize(vec3(ripple.x*.018,1.,ripple.y*.014));
  vec3 viewDirection=normalize(eye-worldPosition);
  float facing=max(dot(viewDirection,normal),0.);
  float fresnel=.02+.98*pow(1.-facing,5.);
  float strength=(.30+.65*fresnel)*reflectionEnabled;
  vec3 reflection=texture2D(tDiffuse,uv+ripple*.00045).rgb;
  vec3 deepWater=color*.78;
  vec3 outgoing=mix(deepWater,reflection,strength);
  vec3 sunDirection=normalize(vec3(-24.,43.,32.));
  float sparkle=pow(max(dot(reflect(-sunDirection,normal),viewDirection),0.),180.);
  outgoing+=vec3(1.,.92,.77)*sparkle*.55;
  gl_FragColor=vec4(outgoing,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
 `};
}
export function createWater(THREE){
 const group=new THREE.Group();group.name='Live planar reflection water';
 const reflectors=[];
 const shader=createWaterShader(THREE);
 const exportMat=new THREE.MeshPhysicalMaterial({name:'Blue-green water (planar reflection provided by viewer)',color:WATER_COLOR,roughness:.12,metalness:.15,clearcoat:1,clearcoatRoughness:.15,transparent:false,opacity:WATER_OPACITY});
 for(const pool of POOLS){
  const reflector=new Reflector(new THREE.PlaneGeometry(pool.w-.025,pool.d-.025),{color:WATER_COLOR,textureWidth:1024,textureHeight:1024,clipBias:.002,multisample:2,shader});
  reflector.rotation.x=-Math.PI/2;reflector.position.set(0,waterLevel(pool),pool.z);reflector.name='Planar building reflection pool';reflector.userData.reflectionPasses=0;
  const capture=reflector.onBeforeRender;
  reflector.onBeforeRender=function(renderer,scene,camera){
   if(scene.overrideMaterial||this.material.uniforms.reflectionEnabled.value===0)return;
   this.material.uniforms.eye.value.setFromMatrixPosition(camera.matrixWorld);
   const states=reflectors.map(r=>r.visible);reflectors.forEach(r=>{r.visible=false;});
   try{capture.call(this,renderer,scene,camera);this.userData.reflectionPasses++;}finally{reflectors.forEach((r,i)=>{r.visible=states[i];});}
  };
  reflectors.push(reflector);group.add(reflector);
 }
 return {group,stats:{waterSurfaces:3,waterColor:WATER_COLOR,waterOpacity:WATER_OPACITY,reflectionMode:WATER_REFLECTION_MODE},
  setTime(time){for(const r of reflectors)r.material.uniforms.time.value=time;},
  setEnabled(value){for(const r of reflectors)r.material.uniforms.reflectionEnabled.value=value?1:0;},
  passes(){return reflectors.map(r=>r.userData.reflectionPasses);},
  beginExport(){const original=reflectors.map(r=>r.material);reflectors.forEach(r=>{r.material=exportMat;});return ()=>reflectors.forEach((r,i)=>{r.material=original[i];});}
 };
}
