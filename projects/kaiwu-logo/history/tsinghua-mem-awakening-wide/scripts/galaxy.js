import * as THREE from '../vendor/three/build/three.module.js';
export function makeGalaxy(){
 const scene=new THREE.Scene(),camera=new THREE.Camera();
 const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{time:{value:0},opening:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`
 precision highp float;
 varying vec2 vUv;uniform float time;uniform float opening;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
 float fbm(vec2 p){float n=0.,a=.53;for(int i=0;i<6;i++){n+=a*noise(p);p=rot(.63)*p*2.03+vec2(17.1,9.2);a*=.49;}return n;}
 float stars(vec2 p,float scale,float seed,float speed){p=rot(.11)*p*scale+vec2(time*speed+opening*sign(p.x)*-8.,time*speed*.22);vec2 id=floor(p),f=fract(p)-.5;vec2 off=vec2(hash(id+seed),hash(id+seed+8.))-.5;float h=hash(id+seed+33.);float d=length(f-off*.76);float s=exp(-d*d/(.000025+h*h*.0006));return s*step(.82,h)*(.4+.6*h)*(.85+.15*sin(time*2.+h*25.));}
 void main(){
 vec2 p=(vUv-.5)*vec2(1.7777778,1.);float r=length(p);float side=smoothstep(.29,.58,r);
 // Advection and angular shear: large coherent clouds separate with the book.
 vec2 q=p;float outward=opening*.36; q.x-=sign(p.x)*outward;
 q=rot(.18*time+.46*opening*exp(-r*1.3))*q;
 q.y+=.13*sin(p.x*3.8-time*.8);q.x+=.13*sin(p.y*4.+time*.46);
 vec2 w=vec2(fbm(q*3.+vec2(time*.13,-time*.17)),fbm(q*3.+vec2(8.2,time*.16)));
 float cloud=fbm(q*5.+w*3.3+vec2(-time*.23,time*.09));
 float fine=fbm(q*15.+w*4.-time*.12);
 float filament=pow(max(0.,1.-abs(cloud-.53)*4.),3.);
 float band=exp(-pow((p.y-.20*sin(p.x*3.1-time*.25)-.06)*2.45,2.));
 float density=smoothstep(.23,.77,cloud)*band;
 vec3 col=vec3(.009,.012,.03);
 vec3 cold=mix(vec3(.065,.09,.22),vec3(.24,.21,.40),smoothstep(.25,.74,w.x));
 vec3 warm=vec3(.39,.23,.32);
 col+=mix(cold,warm,smoothstep(.46,.72,fine))*density*(.6+1.6*filament)*side;
 col+=vec3(.13,.19,.28)*pow(fine,4.)*band*side*.9;
 // Interleaved dark dust lanes are advected with their surrounding nebula.
 float lane=smoothstep(.54,.70,fbm(q*8.+w*5.));col*=1.-lane*.63*side;
 float starBand=exp(-pow((p.y-.18*sin(p.x*3.1-time*.25)-.06)*7.,2.));float st=stars(p,290.,51.,1.2)*starBand*.8+stars(p,155.,2.,1.8)*.65+stars(p,87.,12.,3.2)*.8+stars(p,42.,31.,4.8)*.95;
 col+=vec3(.73,.80,1.)*st*(.12+.88*side);
 // Twelve long-tail rapid meteors, confined to the two wings.
 for(int i=0;i<12;i++){
 float fi=float(i),start=.30+fi*.97,life=.68,age=(time-start)/life;
 float visible=step(0.,age)*step(age,1.);float sg=mod(fi,2.)<.5?-1.:1.;
 vec2 head=vec2(sg*(.39+age*.72),.41-age*.52+.12*sin(fi*2.3));
 vec2 dir=normalize(vec2(sg*.72,-.52));vec2 d=p-head;float along=dot(d,dir),crossD=abs(d.x*dir.y-d.y*dir.x);
 float tail=exp(-crossD*crossD/.000006)*exp(along*13.)*step(along,0.)*step(-.42,along);
 float core=exp(-dot(d,d)/.000019);float halo=exp(-crossD*crossD/.00012)*exp(along*18.)*step(along,0.)*step(-.36,along);
 float edge=smoothstep(.37,.44,abs(p.x));col+=(vec3(.63,.75,1.)*(tail*.94+halo*.09)+vec3(1.,.90,.81)*core*1.5)*visible*edge;
 }
 col*=1.-.34*smoothstep(.65,1.05,r);col+=hash(gl_FragCoord.xy)*.003;
 gl_FragColor=vec4(col,1.);
 }`});
 scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));return {scene,camera,material,draw(t,o){material.uniforms.time.value=t;material.uniforms.opening.value=o;}};
}
