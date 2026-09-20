from pathlib import Path
import re,json,hashlib,shutil,base64
import numpy as np
from PIL import Image,ImageFilter
P=Path(__file__).resolve().parent.parent
for d in ['inputs','assets','deliverables','proof','renders']: (P/d).mkdir(exist_ok=True)
src=Path('/Users/bryannathan/.hermes/outputs/tsinghua-mem-badge-vector/Tsinghua-MEM-2023-Transparent.svg')
if not (P/'inputs/logo.svg').exists(): shutil.copy2(src,P/'inputs/logo.svg')
s=(P/'inputs/logo.svg').read_text(); assert hashlib.sha256((P/'inputs/logo.svg').read_bytes()).hexdigest()=='89bdad7d41062bf6b2cf4ed340d79ba62499126fb1f785b725ed4c76813c038c'
assert len(re.findall(r'<path ',s))==53
if not (P/'assets/gsap.min.js').exists(): shutil.copy2('/Users/bryannathan/.hermes/workspace/videos/tsinghua-mem-badge-motion/assets/gsap.min.js',P/'assets/gsap.min.js')
# Seeded multifractal textures, created once locally. No generated logo, no network.
N=1200; rng=np.random.default_rng(20230901)
def noise(seed):
 r=np.random.default_rng(seed); a=np.zeros((N,N),np.float32); weight=0
 for size,amp in [(4,1),(8,.52),(16,.29),(32,.16),(64,.085),(128,.04),(256,.019)]:
  im=Image.fromarray(np.uint8(r.random((size,size))*255)).resize((N,N),Image.Resampling.BICUBIC)
  a+=np.asarray(im,dtype=np.float32)/255*amp;weight+=amp
 return a/weight
if not (P/'assets/nebula.png').exists():
 y,x=np.mgrid[0:N,0:N]/N; n=noise(73); n2=noise(19)
 cloud=np.clip((n-.32)*2.8,0,1); ribbon=np.exp(-((y-.25-.25*np.sin(x*5.8))/.23)**2)
 color=np.zeros((N,N,3)); color[:]=[20,22,58]
 color+=cloud[:,:,None]*ribbon[:,:,None]*np.array([142,40,122]);color+=np.clip(n2-.42,0,1)[:,:,None]*np.array([70,115,165])
 Image.fromarray(np.uint8(np.clip(color,0,255))).save(P/'assets/nebula.png')
 # Slant dust lane and granular Milky Way: separate morphology from the nebula.
 v=(y-.90+.94*x); band=np.exp(-(v/.19)**2); dust=np.exp(-((v+.025+.026*np.sin(x*19))/.027)**2)
 milky=np.zeros((N,N,3));milky[:]=[20,29,62];milky+=((.28+.95*n)*band)[:,:,None]*np.array([95,87,140]);milky-= (dust*(.35+.4*n2))[:,:,None]*np.array([65,60,85])
 Image.fromarray(np.uint8(np.clip(milky,0,255))).save(P/'assets/milky.png')
 # Alpha cloud texture with irregular billows, not a reused colorized night cloud.
 alpha=np.clip((n2-.40)*3.6,0,.8); rgba=np.zeros((N,N,4),np.uint8);rgba[:,:,:3]=[255,241,231];rgba[:,:,3]=np.uint8(alpha*255)
 Image.fromarray(rgba).save(P/'assets/clouds.png')
# Feather the cloud texture's top/bottom boundary before compositing each layer.
cy,cx=np.mgrid[0:N,0:N]/(N-1)
smooth=lambda u: np.clip(u,0,1)**2*(3-2*np.clip(u,0,1))
cloud_alpha=np.clip((noise(19)-.40)*3.6,0,.8)*smooth(cy/.19)*smooth((1-cy)/.19)*smooth(cx/.055)*smooth((1-cx)/.055)
cloud_rgba=np.zeros((N,N,4),np.uint8);cloud_rgba[:,:,:3]=[255,241,231];cloud_rgba[:,:,3]=np.uint8(cloud_alpha*255)
Image.fromarray(cloud_rgba).save(P/'assets/clouds.png')
geo=s[s.index('<g transform='):s.rindex('</svg>')].replace('fill="#6f337b"','fill="inherit"',1)
svg='''<svg id="badge" viewBox="0 0 960 960" xmlns="http://www.w3.org/2000/svg" aria-label="清华大学MEM工程管理导引课程 2023"><defs><g id="geometry">GEOMETRY</g>
<linearGradient id="purple" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#673477"/><stop offset=".42" stop-color="#a36cba"/><stop offset=".7" stop-color="#79418e"/><stop offset="1" stop-color="#4d255e"/></linearGradient>
<linearGradient id="spec" x1="0" x2="1"><stop stop-color="#ece6ff" stop-opacity="0"/><stop offset=".36" stop-color="#cfb9ef" stop-opacity=".12"/><stop offset=".48" stop-color="#ffffff" stop-opacity=".78"/><stop offset=".53" stop-color="#c7dbff" stop-opacity=".55"/><stop offset=".61" stop-color="#8576b8" stop-opacity=".08"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<linearGradient id="iridescent"><stop stop-color="#74d5e9" stop-opacity="0"/><stop offset=".28" stop-color="#69cddd" stop-opacity=".6"/><stop offset=".5" stop-color="#b8a5f1" stop-opacity=".46"/><stop offset=".7" stop-color="#f2b3df" stop-opacity=".72"/><stop offset="1" stop-color="#e2c2f0" stop-opacity="0"/></linearGradient>
<radialGradient id="pearl"><stop stop-color="#f7e6e4" stop-opacity=".64"/><stop offset=".4" stop-color="#c7c9ee" stop-opacity=".27"/><stop offset="1" stop-color="#e3ddff" stop-opacity="0"/></radialGradient>
<radialGradient id="transmit"><stop stop-color="#d7c8ff" stop-opacity=".9"/><stop offset=".5" stop-color="#a0afee" stop-opacity=".45"/><stop offset="1" stop-color="#789ff2" stop-opacity="0"/></radialGradient>
<mask id="solid" maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="640"><use href="#geometry" fill="white"/></mask>
<mask id="holes" maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="640"><circle cx="320" cy="320" r="313" fill="white"/><use href="#geometry" fill="black"/></mask>
<filter id="inner-edge" x="-5%" y="-5%" width="110%" height="110%"><feMorphology in="SourceAlpha" operator="erode" radius=".7" result="e"/><feComposite in="SourceAlpha" in2="e" operator="out" result="rim"/><feFlood flood-color="#e8e8ff"/><feComposite in2="rim" operator="in"/></filter>
<filter id="shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#120e2b" flood-opacity=".48"/></filter>
<mask id="travel" maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="640"><ellipse id="edge-spot" cx="510" cy="100" rx="170" ry="200" fill="url(#pearl)"/></mask></defs>
<g id="fixed-logo" data-layout-allow-overflow transform="translate(120 82) scale(1.125)">
<g id="cutout-light" mask="url(#holes)"><ellipse id="cutout-orb" cx="300" cy="250" rx="360" ry="300" fill="url(#transmit)"/></g>
<use id="base-logo" href="#geometry" fill="url(#purple)" filter="url(#shadow)"/>
<use id="rim" href="#geometry" fill="white" filter="url(#inner-edge)" opacity=".25"/>
<g mask="url(#solid)"><g id="sweep"><rect x="-160" y="-240" width="300" height="1120" fill="url(#spec)" transform="rotate(-24 0 320)"/></g><g id="rainbow"><rect x="-180" y="-250" width="380" height="1120" fill="url(#iridescent)" transform="rotate(28 0 320)"/></g><ellipse id="pearl-orb" cx="160" cy="120" rx="300" ry="420" fill="url(#pearl)"/></g>
<g mask="url(#travel)"><use id="travel-rim" href="#geometry" fill="white" filter="url(#inner-edge)"/></g>
</g></svg>'''.replace('GEOMETRY',geo)
(P/'assets/badge-stage.svg').write_text(svg)
css='''*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#162039}#root{position:relative;width:100%;height:100%;overflow:hidden}.clip{position:absolute;inset:0}canvas,#badge{position:absolute;width:100%;height:100%;inset:0;display:block}#label{position:absolute;top:90.2%;left:15%;width:70%;text-align:center;font:500 18px/1.4 sans-serif;letter-spacing:.18em;color:#f3eefb}#spark{position:absolute;width:3px;height:3px;border-radius:100%;background:#e2daff;left:75px;top:180px;box-shadow:0 0 9px #bcd9ff}'''
html='''<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MEM · Seven material studies</title><style>CSS</style></head><body><div id="root" data-composition-id="mem-seven" data-width="960" data-height="960" data-duration="42" data-fps="30"><div id="study" class="clip" data-start="0" data-duration="42" data-track-index="0"><canvas id="sky" width="960" height="960"></canvas>SVG<div id="spark" data-layout-ignore></div><div id="label"></div></div></div><script src="assets/gsap.min.js"></script><script src="assets/animation.js"></script></body></html>'''.replace('CSS',css).replace('SVG',svg)
html=html.replace('<script src="assets/animation.js"></script>','<script>'+(P/'assets/animation.js').read_text()+'</script>')
(P/'index.html').write_text(html)
(P/'hyperframes.json').write_text(json.dumps({'paths':{'assets':'assets','compositions':'compositions'},'authoringSkill':'motion-graphics'},indent=2))
(P/'package.json').write_text(json.dumps({'name':'tsinghua-mem-seven-studies','private':True,'scripts':{'check':'npx hyperframes@0.8.38 check','render':'npx hyperframes@0.8.38 render --fps 30 --quality delivery -o renders/seven-master.mp4'}},indent=2))
names=['Starfield / Metal','Nebula / Iridescence','Aurora / Glass','Milky Way / Transmission','Star Trails / Contour','Meteors / Glint','Dawn / Pearl']
manifest={'items':[{'id':f'{i+1:02}','name':n,'mp4':f'deliverables/{i+1:02}-{n.split(" / ")[0].lower().replace(" ","-")}.mp4','duration':6} for i,n in enumerate(names)],'comparison':'deliverables/01-07-comparison.mp4','selector':'deliverables/Seven-Studies.html','source_sha256':hashlib.sha256((P/'inputs/logo.svg').read_bytes()).hexdigest()}
(P/'deliverables/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
# Fully offline self-contained selector; all image and script bytes embedded.
js=(P/'assets/animation.js').read_text()
for name in ['nebula','milky','clouds']:
 js=js.replace('assets/'+name+'.png','data:image/png;base64,'+base64.b64encode((P/f'assets/{name}.png').read_bytes()).decode())
offline=html.replace('<script src="assets/gsap.min.js"></script>','<script>'+(P/'assets/gsap.min.js').read_text()+'</script>').replace('<script>'+(P/'assets/animation.js').read_text()+'</script>','<script>'+js+'</script>')
controls='''<style>body{background:#131929;display:flex;align-items:center;flex-direction:column;min-height:100vh;height:auto;color:#ede8fa;font-family:sans-serif;padding:16px}#root{width:min(88vw,78vh);height:min(88vw,78vh);flex:none}.controls{width:min(90vw,800px);padding:14px 0;display:flex;gap:8px;flex-wrap:wrap}button{background:#2a2440;border:1px solid #6e587f;border-radius:7px;padding:9px;color:#f6eeff;cursor:pointer}input{flex:1;min-width:180px}#label{font-size:clamp(9px,1.5vw,18px)}</style><div class="controls">BUTTONS<button id="toggle">Play</button><input id="scrub" type="range" min="0" max="6" step="0.001" value="0" aria-label="seek"><output id="time">0 / 6</output></div><script>let begin=0,end=6;const slider=document.getElementById('scrub'),out=document.getElementById('time');document.querySelectorAll('[data-version]').forEach(b=>b.onclick=()=>{begin=Number(b.dataset.version)*6;end=begin+6;window.renderAt(begin);slider.value=0});document.getElementById('toggle').onclick=()=>{const tl=window.__timelines['mem-seven'];if(tl.paused()){if(tl.time()>=end-.04)window.renderAt(begin);tl.play()}else tl.pause()};slider.oninput=()=>window.renderAt(begin+Number(slider.value));window.onStudyFrame=t=>{slider.value=t-begin;out.textContent=(t-begin).toFixed(2)+' / 6';if(t>=end-.02){window.__timelines['mem-seven'].pause();}};</script>'''.replace('BUTTONS',''.join(f'<button data-version="{i}">{i+1:02} {n.split(" / ")[0]}</button>' for i,n in enumerate(names)))
offline=offline.replace('</body>',controls+'</body>');(P/'deliverables/Seven-Studies.html').write_text(offline)
print('Built original 53-path badge, 7 studies, 42s composition, offline selector, exact 7-entry manifest.')
