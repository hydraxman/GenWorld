/* Deterministic optical studies. Geometry stays stationary; source holes stay holes. */
const names=['01 / STARFIELD · METAL','02 / NEBULA · IRIDESCENCE','03 / AURORA · GLASS','04 / MILKY WAY · TRANSMISSION','05 / STAR TRAILS · CONTOUR','06 / METEORS · GLINT','07 / DAWN · PEARL'];
const cv=document.getElementById('sky'),ctx=cv.getContext('2d',{alpha:false});
let seed=20230901;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const stars=Array.from({length:390},()=>({x:rand()*1080-60,y:rand()*1080-60,r:.35+rand()**4*1.8,a:.16+rand()*.67,p:rand()*6.283,d:rand()}));
const trails=Array.from({length:135},()=>({r:120+rand()*1040,a:rand()*6.283,len:.035+rand()*.17,w:.45+rand()*.65,p:rand()}));
const galaxy=Array.from({length:1300},()=>{const x=rand()*1080-60;return{x,y:930-x+((rand()+rand()+rand())/3-.5)*380,r:.3+rand()*.7,a:.15+rand()*.45}});
const $=id=>document.getElementById(id),set=(id,k,v)=>$(id).setAttribute(k,v);
const imgs={};let lastV=-1;
function wash(top,bottom){const g=ctx.createLinearGradient(0,0,0,960);g.addColorStop(0,top);g.addColorStop(1,bottom);ctx.fillStyle=g;ctx.fillRect(0,0,960,960);}
function glow(x,y,rx,ry,color,alpha=1){ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();}
function starfield(t,density=1){ctx.save();for(let i=0;i<stars.length*density;i++){const s=stars[i];const x=s.x+Math.sin(t*.14+s.p)*5*s.d,y=s.y+t*s.d*.9;const dim=Math.hypot(x-480,y-440)<335?.43:1;ctx.globalAlpha=s.a*(.7+.3*Math.sin(t*.6+s.p)**2)*dim;ctx.fillStyle=s.d>.65?'#c9deff':'#f1d9ee';ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill();if(s.r>1.6){ctx.globalAlpha*=.3;ctx.fillRect(x-5,y-.35,10,.7);ctx.fillRect(x-.35,y-5,.7,10);}}ctx.restore();}
function aurora(t){wash('#122d49','#203850');glow(600,180,600,410,'#255b72',.7);ctx.save();ctx.globalCompositeOperation='screen';for(let layer=0;layer<3;layer++){for(let x=-80;x<1060;x+=4){const wave=155+layer*68+76*Math.sin(x*.006+t*.32+layer)+35*Math.sin(x*.016-t*.25);const height=130+85*(.5+.5*Math.sin(x*.011+layer));const g=ctx.createLinearGradient(0,wave-height,0,wave+60);g.addColorStop(0,'transparent');g.addColorStop(.63,layer===1?'rgba(104,161,213,.035)':'rgba(70,221,176,.055)');g.addColorStop(.9,layer===1?'rgba(128,120,239,.19)':'rgba(101,235,186,.26)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x,wave-height,4,height+60);}}ctx.restore();starfield(t,.48);}
function meteors(t){wash('#202545','#172b46');glow(780,120,600,540,'#3e477b',.68);starfield(t,.8);let energy=0;[.6,2.45,4.4].forEach((start,i)=>{let p=(t-start)/1.25;if(p<0||p>1)return;let a=Math.sin(p*Math.PI);energy=Math.max(energy,a);let x=70+i*220+p*310,y=68+i*15+p*195;const g=ctx.createLinearGradient(x-155,y-96,x,y);g.addColorStop(0,'transparent');g.addColorStop(.83,'rgba(183,193,236,'+a*.48+')');g.addColorStop(1,'rgba(238,229,255,'+a*.85+')');ctx.strokeStyle=g;ctx.lineWidth=1.45;ctx.beginPath();ctx.moveTo(x-155,y-96);ctx.lineTo(x,y);ctx.stroke();glow(x,y,9,7,'#e4daff',a*.7);});return energy;}
function dawn(t){wash('#9cb6d9','#f1d3cb');glow(780,250,570,460,'#ffedce',.82);glow(130,480,550,340,'#baadce',.45);ctx.save();ctx.globalAlpha=.64;ctx.drawImage(imgs.clouds,-180+t*3,490,1320,600);ctx.globalAlpha=.44;ctx.drawImage(imgs.clouds,-130-t*2,650,1400,460);ctx.restore();for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(-20,760+i*31);for(let x=-20;x<=990;x+=15){let y=750+i*33+25*Math.sin(x*.004+i*1.7+t*.07)+10*Math.sin(x*.014+i);ctx.lineTo(x,y)}ctx.lineTo(990,960);ctx.lineTo(-20,960);ctx.closePath();const g=ctx.createLinearGradient(0,740+i*23,0,960);g.addColorStop(0,i%2?'rgba(248,226,221,.30)':'rgba(217,215,237,.38)');g.addColorStop(1,'rgba(229,220,231,.02)');ctx.fillStyle=g;ctx.fill();}}
function paint(time){if(!imgs.nebula)return;let global=Math.max(0,Math.min(41.999999,Number(time)));const v=Math.floor(global/6),t=global-v*6;let energy=0;
ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
if(v===0){wash('#17233f','#28345b');glow(720,170,530,600,'#38427b',.65);glow(120,830,600,540,'#3b386d',.42);starfield(t);}
if(v===1){ctx.drawImage(imgs.nebula,-112+Math.sin(t*.15)*16,-110+t*2.2,1180,1180);glow(805,200,320,340,'#be5caa',.25);starfield(t,.74);}
if(v===2)aurora(t);
if(v===3){ctx.drawImage(imgs.milky,-85+t*1.5,-85+t*.8,1130,1130);ctx.save();for(const s of galaxy){ctx.globalAlpha=s.a;ctx.fillStyle='#cdd7f8';ctx.fillRect(s.x+t,s.y-t*.6,s.r,s.r);}ctx.restore();starfield(t,.55);}
if(v===4){wash('#182e45','#303451');glow(195,215,760,650,'#286474',.34);ctx.save();ctx.translate(185,218);ctx.rotate(t*.009);for(const s of trails){ctx.strokeStyle=`rgba(${s.p>.5?'151,203,222':'200,178,230'},${.19+s.p*.38})`;ctx.lineWidth=s.w;ctx.beginPath();ctx.arc(0,0,s.r,s.a,s.a+s.len);ctx.stroke();const x=Math.cos(s.a+s.len)*s.r,y=Math.sin(s.a+s.len)*s.r;ctx.fillStyle='#cedaea';ctx.globalAlpha=.5;ctx.fillRect(x,y,1,1);ctx.globalAlpha=1;}ctx.restore();}
if(v===5)energy=meteors(t);
if(v===6)dawn(t);
// Soft central illumination control is behind the badge, never painted into paths.
if(v!==6)glow(480,440,440,420,'#141730',.20);
set('cutout-light','opacity',v===3?.68+.18*Math.sin(t*.7):0);
set('cutout-orb','cx',270+90*Math.sin(t*.55));set('cutout-orb','cy',270+80*Math.cos(t*.4));
set('sweep','opacity',v===0?.9:v===2?.23:v===5?energy*.63:0);
const sx=v===5?(-100+((t*1.35)%1.85)*520):(-290+t*205);
set('sweep','transform',`translate(${sx} 0)`);
set('rainbow','opacity',v===1?.87:v===6?.20:0);set('rainbow','transform',`translate(${v===6?180+Math.sin(t*.45)*160:-280+t*170} 0)`);
set('pearl-orb','opacity',v===6?.48:v===2?.12:0);set('pearl-orb','cx',120+340*(.5+.5*Math.sin(t*.46-.8)));set('pearl-orb','cy',160+70*Math.cos(t*.3));
set('rim','opacity',v===2?.40:v===6?.14:v===4?.20:.16);
set('travel-rim','opacity',v===4?1:v===2?.70:0);const angle=t*.86-1.0;set('edge-spot','cx',320+260*Math.cos(angle));set('edge-spot','cy',320+260*Math.sin(angle));
if(lastV!==v){$('label').textContent=names[v];$('label').style.color=v===6?'#453553':'#f3eefb';const stops=$('purple').querySelectorAll('stop');let palette=v===6?['#59366d','#806092','#6a467b','#4c2d5f']:v===3?['#352041','#5b326b','#432352','#2d1a3c']:v===2?['#603d80','#9068b0','#75488e','#4a315f']:['#673477','#a36cba','#79418e','#4d255e'];stops.forEach((s,i)=>s.setAttribute('stop-color',palette[i]));lastV=v;}
$('spark').style.opacity=v===6?'0':String(.38+.3*Math.sin(global*.42)**2);$('spark').style.transform=`translate(${Math.sin(global*.12)*8}px,${Math.cos(global*.16)*6}px)`;
window.sceneMetrics={version:String(v+1).padStart(2,'0'),name:names[v],localTime:t,absoluteTime:global,sourcePaths:53,logoTransform:$('fixed-logo').getAttribute('transform'),seed:20230901};if(window.onStudyFrame)window.onStudyFrame(global);
}
Promise.all(['nebula','milky','clouds'].map(k=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{imgs[k]=im;resolve()};im.onerror=reject;im.src=({nebula:'assets/nebula.png',milky:'assets/milky.png',clouds:'assets/clouds.png'})[k];}))).then(()=>{
let current=0;const clock={get t(){return current},set t(t){current=t;paint(t)}};
const tl=gsap.timeline({paused:true});tl.to(clock,{t:42,duration:42,ease:'none'},0);window.__timelines=window.__timelines||{};window.__timelines['mem-seven']=tl;
window.renderAt=t=>{tl.pause();tl.totalTime(Math.max(0,Math.min(42,Number(t))),true);paint(Math.min(41.999999,Number(t)));};window.renderAt(0);window.animationReady=true;
});
