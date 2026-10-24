import * as THREE from '../vendor/three/build/three.module.js';
// Independently authored sine-folded silk light curtains, no copied reference shader.
export function makeGalaxy(){
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);const uniforms={t:{value:0},opening:{value:0}};
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms,depthWrite:false,depthTest:false,vertexShader:'varying vec2 uvp;void main(){uvp=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float;
 varying vec2 uvp;uniform float t;uniform float opening;
 void main(){vec2 p=uvp;float x=p.x*2.-1.;float y=p.y;vec3 color=vec3(.006,.014,.026);
 // Distinct broad horizontal folded ribbons and hanging vertical rays.
 for(int i=0;i<5;i++){float k=float(i);float flow=t*(.52+k*.055);float u=x*2.5+flow+k*1.7;
 float edge=.57+.16*sin(u)+.07*sin(u*2.1-flow*.7)+k*.053;
 float fold=.6+.4*sin(x*13.-flow*1.9+k*1.1);float rays=.58+.22*sin(x*75.+sin(x*8.+flow)*5.-flow*1.3+k)+.2*sin(x*141.-flow*2.2+k*3.);
 float d=y-edge;float curtain=exp(-abs(d)*8.)*(.55+.45*fold)*(.68+.32*rays);
 float lip=exp(-abs(d)*105.)*.72;float falling=exp(-max(0.,-d)*7.)*smoothstep(.03,-.04,d)*.34*rays;
 vec3 c=mix(vec3(.12,.24,.65),vec3(.12,.9,.66),.5+.5*sin(x*1.8+k*.85+flow*.2));c=mix(c,vec3(.65,.31,.85),.16+.14*sin(k+flow));
 color+=c*(curtain*.40+lip*.32+falling*.38);
 }
 // A separate low silk arc crosses the wings rather than converging in depth.
 float low=.17+.085*sin(x*3.4-t*.65)+.035*sin(x*7.+t*.8);float line=exp(-abs(y-low)*60.);color+=vec3(.18,.48,.48)*line*.3;
 float mask=1.-.48*exp(-pow(x/.40,4.)-pow((y-.5)/.35,4.));color*=mask;
 float vig=1.-.27*length((p-.5)*vec2(1.,.6));color*=vig;gl_FragColor=vec4(color,1.);
 }`}));scene.add(mesh);
 return {scene,camera,draw(time,open){uniforms.t.value=time;uniforms.opening.value=open;},mechanism:'5 layered analytical wave curtains, vertically hanging interference rays and independent low silk arc'};
}
