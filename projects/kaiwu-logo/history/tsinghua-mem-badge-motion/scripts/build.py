"""Build exact-source SVG light studies; no source geometry modifications."""
from pathlib import Path
import re, json, hashlib
P=Path(__file__).resolve().parent.parent
source=(P/'inputs/Tsinghua-MEM-2023-Transparent.svg').read_text()
paths=re.findall(r'<path d="([^"]+)"',source)
assert len(paths)==53
geometry='\n'.join('<path d="'+d+'"/>' for d in paths)
gsap=(P/'assets/gsap.min.js').read_text()
svg='''<svg id="badge-stage" xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 960 960" aria-label="清华大学MEM工程管理导引课程 2023">
<defs>
<g id="source-geometry" transform="translate(0 640) scale(.01 -.01)">GEOMETRY</g>
<radialGradient id="a-wash"><stop stop-color="#b677e5" stop-opacity=".68"/><stop offset=".66" stop-color="#713895" stop-opacity=".38"/><stop offset="1" stop-color="#421458" stop-opacity="0"/></radialGradient>
<radialGradient id="a-hot"><stop stop-color="#e7b9ff" stop-opacity=".95"/><stop offset=".28" stop-color="#b56cf0" stop-opacity=".58"/><stop offset="1" stop-color="#8342c4" stop-opacity="0"/></radialGradient>
<radialGradient id="beam-color"><stop stop-color="#dfd0ff"/><stop offset=".55" stop-color="#b795e9"/><stop offset="1" stop-color="#9976e7"/></radialGradient>
<linearGradient id="spectrum" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#714185" stop-opacity="0"/><stop offset=".22" stop-color="#c886ec" stop-opacity=".2"/><stop offset=".40" stop-color="#bcabff" stop-opacity=".65"/><stop offset=".52" stop-color="#a8e9f3" stop-opacity=".9"/><stop offset=".61" stop-color="#eab8f3" stop-opacity=".7"/><stop offset=".77" stop-color="#d38bab" stop-opacity=".24"/><stop offset="1" stop-color="#714185" stop-opacity="0"/></linearGradient>
<filter id="soft-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="16"/></filter>
<filter id="beam-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.3"/></filter>
<filter id="edge" x="-5%" y="-5%" width="110%" height="110%"><feMorphology in="SourceAlpha" operator="dilate" radius=".8" result="d"/><feComposite in="d" in2="SourceAlpha" operator="out" result="e"/><feFlood flood-color="#e2d5ff"/><feComposite in2="e" operator="in"/></filter>
<mask id="backlight-mask" maskUnits="userSpaceOnUse" x="-180" y="-180" width="1000" height="1000"><rect x="-180" y="-180" width="1000" height="1000" fill="white"/><circle cx="320" cy="320" r="300" fill="black"/></mask>
<mask id="source-mask" maskUnits="userSpaceOnUse" x="-100" y="-100" width="840" height="840"><use href="#source-geometry" fill="white"/></mask>
<mask id="holes-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="640"><circle cx="318.5" cy="319" r="212" fill="white"/><circle cx="318.5" cy="319" r="267" fill="none" stroke="white" stroke-width="58"/><use href="#source-geometry" fill="black"/></mask>
<g id="apertures" mask="url(#holes-mask)"><rect width="640" height="640" fill="url(#beam-color)"/></g>
<mask id="travel-mask" maskUnits="userSpaceOnUse" x="-20" y="-20" width="680" height="680"><g id="c-edge-band"><rect x="-180" y="-220" width="240" height="1100" fill="url(#spectrum)" transform="rotate(-22 0 320)"/></g></mask>
</defs>
<g id="native-stage" data-layout-allow-overflow transform="translate(96 60) scale(1.2)">
<g id="a-light" class="light-layer" mask="url(#backlight-mask)">
 <circle id="a-bloom" cx="320" cy="320" r="390" fill="url(#a-wash)"/>
 <g id="a-orbit"><ellipse cx="310" cy="92" rx="270" ry="126" fill="url(#a-hot)"/><ellipse cx="333" cy="576" rx="244" ry="115" fill="url(#a-hot)" opacity=".64"/></g>
 <circle id="a-rim" cx="320" cy="320" r="306" stroke="#b888dc" stroke-width="12" opacity=".4" fill="none" filter="url(#soft-glow)"/>
</g>
<g id="b-light" class="light-layer" opacity="0">
 <circle id="b-aura" cx="320" cy="320" r="380" fill="url(#a-wash)" opacity=".34"/>
 RAYS
 <use id="b-core" href="#apertures" opacity=".5"/>
</g>
<g id="c-under" class="light-layer" opacity="0"><circle cx="320" cy="320" r="370" fill="url(#a-wash)" opacity=".26"/><g id="c-orbit"><ellipse cx="515" cy="125" rx="168" ry="95" fill="url(#a-hot)" opacity=".35"/><ellipse cx="130" cy="527" rx="155" ry="99" fill="url(#a-hot)" opacity=".25"/></g></g>
<use id="logo-static" href="#source-geometry" fill="#6f337b"/>
<g id="c-light" class="light-layer" opacity="0">
 <g mask="url(#source-mask)"><g id="c-band"><rect x="-180" y="-220" width="240" height="1100" fill="url(#spectrum)" opacity=".72" transform="rotate(-22 0 320)"/></g></g>
 <g mask="url(#travel-mask)"><use href="#source-geometry" fill="white" filter="url(#edge)"/></g>
</g>
</g></svg>'''.replace('GEOMETRY',geometry)
rays=[]
for i in range(16):
    rays.append(f'<g id="b-ray-{i}" opacity="{.038+i*.0013:.4f}"><use href="#apertures" filter="url(#beam-soft)"/></g>')
svg=svg.replace('RAYS','\n'.join(rays))
css='''*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:transparent}#root{position:relative;width:100%;height:100%;overflow:hidden}.backdrop{position:absolute;inset:0;background:#090710}.clip{position:absolute;inset:0}#badge-stage{position:absolute;inset:0;width:100%;height:100%;display:block}.caption{position:absolute;left:0;right:0;bottom:5.7%;text-align:center;color:#e4d6ef;font:500 17px/1.6 sans-serif;letter-spacing:.22em;pointer-events:none}.caption small{display:block;font:400 12px/1.7 sans-serif;letter-spacing:.12em;color:#b9a7c8;margin-top:5px}#caption-b,#caption-c{opacity:0}'''
script='''const tl=gsap.timeline({paused:true});
tl.addLabel('A / BACKLIGHT',0).addLabel('B / TRANSMITTED LIGHT',6).addLabel('C / IRIDESCENT SWEEP',12);
// Only light layers animate. #logo-static and its ancestor transform never change.
tl.fromTo('#a-bloom',{opacity:.46},{opacity:.95,duration:2.8,ease:'sine.inOut',repeat:1,yoyo:true},0);
tl.fromTo('#a-orbit',{rotation:-22,svgOrigin:'320 320'},{rotation:44,svgOrigin:'320 320',duration:6,ease:'sine.inOut'},0);
tl.fromTo('#a-rim',{opacity:.2},{opacity:.6,duration:2.7,ease:'sine.inOut',repeat:1,yoyo:true},.1);
tl.set('#a-light,#caption-a',{opacity:0},6);
tl.set('#b-light,#caption-b',{opacity:1},6);
tl.fromTo('#b-core',{opacity:.3},{opacity:.88,duration:2.65,ease:'sine.inOut',repeat:1,yoyo:true},6.15);
tl.fromTo('#b-aura',{opacity:.2},{opacity:.58,duration:2.65,ease:'sine.inOut',repeat:1,yoyo:true},6.15);
for(let i=0;i<16;i++){
 const low=1+i*.005,high=1+i*.026;
 tl.fromTo('#b-ray-'+i,{scale:low,svgOrigin:'318.5 319',opacity:.028+i*.0011},{scale:high,svgOrigin:'318.5 319',opacity:.060+i*.0018,duration:2.7,ease:'sine.inOut',repeat:1,yoyo:true},6.15);
}
tl.set('#b-light,#caption-b',{opacity:0},12);
tl.set('#c-light,#c-under,#caption-c',{opacity:1},12);
// Adapted from the installed shimmer-sweep primitive; masked to the original SVG paths.
tl.fromTo('#c-band,#c-edge-band',{x:-400},{x:880,duration:4.8,ease:'sine.inOut'},12);
tl.fromTo('#c-orbit',{rotation:0,svgOrigin:'320 320'},{rotation:46,svgOrigin:'320 320',duration:6,ease:'sine.inOut'},12);

window.__timelines=window.__timelines||{};window.__timelines['tsinghua-mem-badge']=tl;
window.renderAt=(t)=>{tl.pause();tl.totalTime(Math.max(0,Math.min(18,Number(t))),true);};
window.renderAt(0);window.animationReady=true;'''
base='''<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tsinghua MEM · Light Studies</title><style>CSS</style></head><body><div id="root" data-composition-id="tsinghua-mem-badge" data-duration="18" data-width="960" data-height="960" data-fps="30"><div class="backdrop"></div><div class="clip" id="badge-artwork" data-start="0" data-duration="18" data-track-index="0">SVG</div><div class="caption" id="caption-a">A / BACKLIGHT<small>PURPLE HALO</small></div><div class="caption" id="caption-b">B / TRANSMITTED LIGHT<small>LIGHT THROUGH THE ORIGINAL CUTOUTS</small></div><div class="caption" id="caption-c">C / IRIDESCENT SWEEP<small>FLOWING LIGHT · UNCHANGED GEOMETRY</small></div></div><script src="assets/gsap.min.js"></script><script>SCRIPT</script></body></html>'''.replace('CSS',css).replace('SVG',svg).replace('SCRIPT',script)
(P/'index.html').write_text(base)
(P/'assets/animation.js').write_text(script)
(P/'assets/light-stage.svg').write_text(svg)
player_css='''html,body{height:auto;min-height:100%;background:#090710;color:#e8dfee;font-family:sans-serif}body{display:flex;flex-direction:column;align-items:center;padding:16px}#root{width:min(90vw,78vh,960px);height:min(90vw,78vh,960px);flex:none}.player{max-width:760px;width:90vw;padding:12px 0}.modes{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}button{border:1px solid #55435e;background:#211628;color:#e8dfee;border-radius:8px;padding:9px 14px;cursor:pointer;font-size:14px}button.active{border-color:#c2a1d5;background:#44284f}.transport{display:flex;align-items:center;gap:12px}input{flex:1;accent-color:#be90d2}output{font:12px monospace;min-width:68px}.note{font-size:12px;color:#aa96b8;line-height:1.7;margin:12px 0 0}.caption{font-size:clamp(10px,1.7vw,17px)}.caption small{font-size:clamp(8px,1.2vw,12px)}'''
player='''<div class="player"><div class="modes"><button data-variant="A" class="active">A · 背景辉光</button><button data-variant="B">B · 内透光束</button><button data-variant="C">C · 流彩掠光</button><button data-variant="ALL">全部 18s</button></div><div class="transport"><button id="play">播放</button><button id="replay">重播</button><input id="scrub" aria-label="时间轴" type="range" min="0" max="6" step="0.001" value="0"><output id="time">0.00 / 6</output></div><p class="note">原徽章的 53 条矢量路径保持静止；只改变光。紫色实形、中文、2023 与电路细节全部来自提供的 SVG。无需联网，可拖动时间轴。</p></div>'''
playerjs='''let start=0,end=6;const play=document.getElementById('play'),scrub=document.getElementById('scrub'),time=document.getElementById('time');
function stopTime(){return start===0&&end===18?18:end-1/3000;}
function sync(){if(tl.time()>=stopTime()){tl.pause();tl.totalTime(stopTime(),true);play.textContent='播放';}scrub.value=tl.time()-start;time.textContent=(tl.time()-start).toFixed(2)+' / '+(end-start);}
tl.eventCallback('onUpdate',sync);
document.querySelectorAll('[data-variant]').forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.variant;start=({A:0,B:6,C:12,ALL:0})[v];end=v==='ALL'?18:start+6;scrub.max=end-start;window.renderAt(start);sync();play.textContent='播放';document.querySelectorAll('[data-variant]').forEach(x=>x.classList.toggle('active',x===b));}));
play.addEventListener('click',()=>{if(tl.paused()){if(tl.time()>=stopTime()-1e-5)tl.totalTime(start,true);tl.play();play.textContent='暂停';}else{tl.pause();play.textContent='播放';}});
document.getElementById('replay').addEventListener('click',()=>{tl.totalTime(start,true);tl.play();play.textContent='暂停';});
scrub.addEventListener('input',()=>{window.renderAt(start+Number(scrub.value));play.textContent='播放';sync();});sync();'''
standalone=base.replace('<script src="assets/gsap.min.js"></script>','<script>'+gsap+'</script>').replace('</head>','<style>'+player_css+'</style></head>').replace('</body>',player+'<script>'+playerjs+'</script></body>')
(P/'deliverables/Tsinghua-MEM-Light-Studies.html').write_text(standalone)
(P/'shot-plan.json').write_text(json.dumps({'source':'inputs/Tsinghua-MEM-2023-Transparent.svg','category':'logo-light-studies','duration':18,'fps':30,'dimensions':[960,960],'variants':[{'id':'A','start':0,'end':6,'effect':'moving purple backlight'},{'id':'B','start':6,'end':12,'effect':'actual cutout projection rays'},{'id':'C','start':12,'end':18,'effect':'source-masked iridescent band and edge'}],'source_paths':53,'asset_needs':[]},indent=2))
print('Built index.html, source-derived SVG, registered timeline, offline selector.')
