export function createAtmosphere(THREE,phase,clamp){
 const sky=new THREE.WebGLRenderer({canvas:document.getElementById('sky'),antialias:false,preserveDrawingBuffer:true});sky.setSize(1280,720,false);sky.setPixelRatio(1);
 const scene=new THREE.Scene(),camera=new THREE.Camera();
 const mat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uSplit:{value:0}},vertexShader:`varying vec2 uvv;void main(){uvv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`precision highp float;
 varying vec2 uvv;uniform float uTime;uniform float uSplit;
 float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.27,.43));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float fbm(vec3 p){float a=.53,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+vec3(7.1,3.9,1.3);a*=.49;}return s;}
 void main(){vec2 q=(uvv-.5)*vec2(3.5556,2.);float t=uTime;float rush=1.-smoothstep(1.5,3.,t);float z=t*.21+min(t,2.)*.60;
 vec3 col=vec3(.012,.007,.027);float center=smoothstep(.35,1.25,length(q*vec2(1.,.82)));float protect=mix(1.,.12+.88*center,uSplit);
 for(int j=0;j<3;j++){float k=float(j);float travel=1.+.7*(1.-smoothstep(0.,2.6,t));vec2 pp=q*(1.12+k*.23)*travel;float softsign=q.x/sqrt(q.x*q.x+.25);pp.x-=softsign*uSplit*.85;pp+=vec2(sin(t*.24+k)*.20+min(t,2.)*.16,t*(.085+k*.025));
 float swirl=fbm(vec3(pp*.9,z*.36+k*3.));vec2 warp=vec2(fbm(vec3(pp*1.8+4.,z*.3)),fbm(vec3(pp*1.8-9.,z*.27)))-.5;
 vec3 p=vec3(pp*2.+warp*2.8,z+k*3.7);float gas=fbm(p);float ridge=pow(1.-abs(2.*fbm(p*1.7+gas*2.)-1.),5.);
 float shape=smoothstep(.27,.73,gas+sin(pp.x*1.2+pp.y*.8+swirl*6.)*.12);float dust=smoothstep(.35,.68,fbm(p*3.2));
 vec3 violet=mix(vec3(.16,.035,.33),vec3(.49,.19,.63),ridge);violet=mix(violet,vec3(.20,.16,.46),smoothstep(.15,.7,pp.y)*.5);
 col+=violet*shape*(.26+ridge*.72+dust*.22)*protect*(.66-k*.13);
 col*=1.-dust*shape*.20;
 }
 float curtainY=.71+.12*sin(q.x*2.1-t*.38)+.045*sin(q.x*5.4+t*.62);float ribbon=exp(-pow((q.y-curtainY)/.12,2.));float fold=.45+.55*fbm(vec3(q.x*5.,q.y*2.,t*.17));col+=vec3(.15,.07,.25)*ribbon*fold;
 float slit=exp(-abs(q.x)*28.)*exp(-q.y*q.y*2.7)*sin(3.14159*clamp((t-2.)/4.,0.,1.));col+=vec3(.67,.40,.84)*slit*.5;
 float vign=1.-.20*pow(length(uvv-.5),1.3);col*=vign;col+= (hash(vec3(gl_FragCoord.xy,2.))-.5)/280.;gl_FragColor=vec4(col,1.);
 }`});scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat));
 const fx=document.getElementById('energy'),ctx=fx.getContext('2d'),W=1920,H=1080;
 let seed=232303;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};const stars=Array.from({length:260},()=>({x:rand()*W,y:rand()*H,r:.35+rand()*.9,a:.13+rand()*.4}));
 function pathPoint(u,i,side,t,order){const lane=(i-4.5)*42;const x=side===-1?80+u*480:1840-u*480;const y=540+lane;const bend=u<.46?0:u<.72?(u-.46)/.26:1;const targetY=y+(i%2?85:-85)*bend;const chaosX=x+Math.sin(u*8+i*2+t*.7)*105;const chaosY=y+Math.sin(u*10+i*1.7-t*.8)*135+Math.cos(u*6+t)*60;return [chaosX*(1-order)+x*order,chaosY*(1-order)+targetY*order];}
 function draw(t){mat.uniforms.uTime.value=t;mat.uniforms.uSplit.value=phase(t,2,6);sky.render(scene,camera);ctx.clearRect(0,0,W,H);
 const split=phase(t,2,6),order=phase(t,5,8),energy=phase(t,3.7,4.7)*(1-phase(t,8.1,9.3));
 for(const s of stars){const x=(s.x+t*(s.r*11+8))%W,y=(s.y+t*s.r*4)%H;const safe=Math.hypot((x-960)/1.05,y-540)>440?1:.08;ctx.fillStyle=`rgba(222,204,243,${s.a*safe})`;ctx.fillRect(x,y,s.r,s.r);}
 ctx.save();ctx.globalCompositeOperation='screen';
 if(energy>0){for(const side of [-1,1])for(let i=0;i<10;i++){ctx.beginPath();for(let n=0;n<=80;n++){const p=pathPoint(n/80,i,side,t,order);n?ctx.lineTo(...p):ctx.moveTo(...p)}ctx.strokeStyle=`rgba(${i%3===0?'192,167,238':'132,88,206'},${energy*(.27+.24*order)})`;ctx.lineWidth=2.3+order*1.2;ctx.shadowBlur=14;ctx.shadowColor='#a387e0';ctx.stroke();
 const u=((t*(.32+.08*order)+i*.117)%1),p=pathPoint(u,i,side,t,order);ctx.beginPath();for(let n=0;n<=12;n++){const p2=pathPoint(Math.max(0,u-n*.006),i,side,t,order);n?ctx.lineTo(...p2):ctx.moveTo(...p2)}ctx.strokeStyle=`rgba(230,213,255,${energy*.9})`;ctx.lineWidth=3.2;ctx.stroke();ctx.beginPath();ctx.arc(p[0],p[1],3,0,Math.PI*2);ctx.fillStyle=`rgba(245,225,255,${energy})`;ctx.fill();}}
 // The spine's broad soft spill lives behind the source apertures, never on top.
 const spine=Math.sin(Math.PI*phase(t,2,6));if(spine>0){let g=ctx.createRadialGradient(960,540,1,960,540,240);g.addColorStop(0,`rgba(213,164,255,${spine*.30})`);g.addColorStop(.25,`rgba(150,93,228,${spine*.14})`);g.addColorStop(1,'rgba(94,38,161,0)');ctx.fillStyle=g;ctx.fillRect(660,200,600,700);ctx.shadowBlur=22;ctx.shadowColor='#d7afff';ctx.fillStyle=`rgba(239,205,255,${spine*.55})`;ctx.fillRect(958,365,4,340);}
 const events=[{s:8.75,y:192,side:-1},{s:10.12,y:831,side:1},{s:11.16,y:286,side:-1}];for(const m of events){const p=(t-m.s)/.45;if(p<0||p>1)continue;const x=m.side<0?-180+p*770:2100-p*770;const y=m.y+p*55;const g=ctx.createLinearGradient(x-m.side*140,y-10,x,y);g.addColorStop(0,'rgba(176,139,230,0)');g.addColorStop(1,'rgba(237,220,255,.85)');ctx.strokeStyle=g;ctx.lineWidth=2;ctx.shadowBlur=9;ctx.beginPath();ctx.moveTo(x-m.side*140,y-10);ctx.lineTo(x,y);ctx.stroke();}
 ctx.restore();
 }
 return {draw,sky,mat,pathPoint};
}
