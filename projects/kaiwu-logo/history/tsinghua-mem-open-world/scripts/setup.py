from pathlib import Path
import shutil,json
P=Path(__file__).resolve().parent.parent
S=P.parent/'tsinghua-mem-3d-book-opening'
for n in ['scripts','inputs','assets','deliverables','qa','frames']: (P/n).mkdir(exist_ok=True)
shutil.copytree(S/'vendor',P/'vendor',dirs_exist_ok=True)
for n in ['scripts/SelectiveExtrudeGeometry.js','inputs/semantic-geometry.json','inputs/source-polygons.json','assets/gsap.min.js']: shutil.copy2(S/n,P/n)
shutil.copy2('/Users/bryannathan/.hermes/outputs/tsinghua-mem-badge-vector/Tsinghua-MEM-2023-Transparent.svg',P/'inputs/Tsinghua-MEM-2023-Transparent.svg')
s=(S/'scripts/scene.js').read_text()
s=s.replace("import geometryData", "import {createAtmosphere} from './atmosphere.js';\nimport geometryData")
s=s.replace("const sky=document.getElementById('sky'),ctx=sky.getContext('2d');", "const atmosphere=createAtmosphere(THREE,phase,clamp);")
s=s.replace('renderer.setSize(960,960,false)','renderer.setSize(1920,1080,false)')
s=s.replace('new THREE.OrthographicCamera(-4.15,4.15,4.15,-4.15,.1,100)','new THREE.OrthographicCamera(-7.55,7.55,4.247,-4.247,.1,100)')
s=s.replace('renderer.toneMappingExposure=1.18','renderer.toneMappingExposure=.96')
s=s.replace("color:0x6f337b,metalness:.72,roughness:.23,clearcoat:.8,clearcoatRoughness:.19,envMapIntensity:.8", "color:0x6f337b,metalness:.65,roughness:.19,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:.85")
s=s.replace("color:0x472050,metalness:.86,roughness:.23,clearcoat:.7,envMapIntensity:1.1", "color:0xc5adc5,metalness:1,roughness:.14,clearcoat:1,envMapIntensity:1.35")
a=s.index(' let seed='); b=s.index(' window.sceneMetrics=',a)
s=s[:a]+s[b:]
a=s.index(' function draw(t)'); b=s.index('  scene.updateMatrixWorld',a)
s=s[:a]+''' function draw(t){
  const open=phase(t,2,6),arrival=phase(t,7.3,8.65),cam=phase(t,6.4,8.65),reveal=phase(t,.75,2.2);
  groups.leftPage.rotation.set(0,1.41*(1-open),0);groups.rightPage.rotation.set(0,-1.41*(1-open),0);
  groups.leftPage.position.set(0,0,.45*(1-open));groups.rightPage.position.copy(groups.leftPage.position);
  groups.circuits.rotation.set(.15*(1-arrival),-.1*(1-arrival),-.32*(1-arrival));groups.circuits.position.set(0,0,-.48*(1-arrival));
  groups.letterBand.rotation.set(.28*(1-arrival),-.4*(1-arrival),-.9*(1-arrival));groups.letterBand.position.set(0,0,-.9*(1-arrival));
  groups.braidedRim.rotation.set(-.24*(1-arrival),.44*(1-arrival),1.32*(1-arrival));groups.braidedRim.position.set(0,0,-1.4*(1-arrival));
  groups.letterBand.scale.setScalar(1+.19*(1-arrival));groups.braidedRim.scale.setScalar(1+.29*(1-arrival));
  badge.rotation.set(.1*(1-cam),.15*(1-cam),-.12*(1-cam));badge.scale.setScalar(.82+.18*reveal);badge.position.z=-2.4*(1-reveal);
  for(const n of ['leftPage','rightPage','circuits','letterBand','braidedRim'])groups[n].visible=t>(n.includes('Page')?.7:n==='circuits'?2.8:6.8);
  const az=.61*(1-cam),el=.18*(1-cam);camera.position.set(12*Math.sin(az)*Math.cos(el),12*Math.sin(el),12*Math.cos(az)*Math.cos(el));camera.lookAt(0,0,0);camera.zoom=.95+.05*cam;camera.updateProjectionMatrix();
  const progress=clamp((t-8.7)/2.5),angle=Math.PI/2-progress*Math.PI*2;const active=t>=8.7&&t<11.2;const strength=active?Math.sin(Math.PI*progress)**.35:0;sweep.position.set(3.7*Math.cos(angle),3.7*Math.sin(angle),2.2);sweep.intensity=95*strength;sweep2.position.set(3*Math.cos(angle-.20),3*Math.sin(angle-.20),1.3);sweep2.intensity=23*strength;scene.environmentRotation.z=active?-progress*Math.PI*2:0;
''' + s[b:]
s=s.replace("phase:t<8?'pending':t<11?'orbit':'complete'", "phase:t<8.7?'pending':t<11.2?'orbit':'complete'")
s=s.replace("stage:t<2?'layered rotation':t<6?'hinged opening':t<8?'front alignment':t<11?'one metallic orbit':'static final hold'", "nebulaSplit:open,pathOrder:phase(t,5,8),stage:t<2?'chaotic nebula traversal':t<5?'book opens / heavens part':t<8?'insight: disorder becomes directed circuitry':t<8.7?'outer rings settle':t<11.2?'one metallic orbit':'badge holds / world flows'")
s=s.replace('drawSky(t);renderer.render(scene,camera);','atmosphere.draw(t);renderer.render(scene,camera);')
s=s.replace('landmarks};window.__drawScene','landmarks,atmosphere};window.__drawScene')
(P/'scripts/scene.js').write_text(s)
(P/'BRIEF.md').write_text('''# 开卷见天地 — approved prototype
12s, 1920×1080, 30fps, silent. No added lettering. Source color #6f337b; source-derived 53 SVG paths / 164 apertures. True selectively beveled extrusion, opposed page hinges, metallic sides, environment reflections.
0–2: camera travels through turbulent large-scale purple gas.
2–6: leaves open; cloud curtains split; spine leaks light.
5–8: chaotic intersecting energy streams resolve into directed elbowed circuit paths.
8–12: original outer braid and letter ring settle; frontal camera; one physical metallic highlight orbit. World continues flowing in final hold; meteor lanes outside lettering.
No sourced stock, no narration, no generated text.
''')
print(P)
