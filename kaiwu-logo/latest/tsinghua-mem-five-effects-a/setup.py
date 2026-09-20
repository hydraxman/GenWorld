from pathlib import Path
import shutil,json,hashlib,subprocess
P=Path(__file__).parent
S=Path('/Users/bryannathan/.hermes/workspace/videos/tsinghua-mem-awakening-wide')
commit='23b6d2c0ab10b949c7891b3e76b2f801dff186a3'
refs=[]
for id,name,slug,mechanism in [('01','星际穿越','hyperspeed','Perspective depth convergence; long forward-traveling light streaks; curved trajectories and acceleration, derived from the road/lane light-pair and distortion description. Original implementation here uses cylindrical depth lanes rather than a road.'),('02','极光织带','aurora','Soft luminous color-ramped curtains; time-varying wave height and feathered blend. Original implementation here uses five analytical sine-fold ribbons and vertical interference rays, not the component simplex-noise shader.')]:
 refs.append({'id':id,'name':name,'page':'https://reactbits.dev/backgrounds/'+slug,'source_url':f'https://raw.githubusercontent.com/DavidHDev/react-bits/{commit}/src/content/Backgrounds/{slug.capitalize()}/{slug.capitalize()}.jsx','commit':commit,'access':'Official page HTTP 200; pinned source HTTP 200 and read for mechanism study. Browser CDP dependency unavailable, direct official HTTP used.','borrowed_mechanisms':mechanism,'implementation':'Independently authored film-specific Three.js background, no copied React Bits component or port','source_sha256':hashlib.sha256((P/'reference-evidence'/f'{slug}-source.txt').read_bytes()).hexdigest(),'license':'MIT + Commons Clause; component redistribution prohibited; downloaded research source excluded from delivery source_paths'})
 d=P/id
 for sub in ['scripts','inputs','assets','deliverables','qa']:(d/sub).mkdir(parents=True,exist_ok=True)
 shutil.copytree(S/'vendor',d/'vendor',dirs_exist_ok=True)
 for f in ['semantic-geometry.json'] : shutil.copy2(S/'inputs'/f,d/'inputs'/f)
 shutil.copy2('/Users/bryannathan/.hermes/outputs/tsinghua-mem-badge-vector/Tsinghua-MEM-2023-Transparent.svg',d/'inputs/source.svg')
 shutil.copy2(S/'scripts/SelectiveExtrudeGeometry.js',d/'scripts/SelectiveExtrudeGeometry.js')
 shutil.copy2(S/'assets/gsap.min.js',d/'assets/gsap.min.js')
 scene=(S/'scripts/scene.js').read_text().replace("'./galaxy.js'","'./background.js'").replace('Math.min(12,Number(t))','Math.min(5,Number(t))').replace('duration:12','duration:5')
 scene=scene.replace('phase(t,1.8,6.0)','phase(t,.12,1.85)').replace('phase(t,0,7.5)','phase(t,0,2.65)').replace('phase(t,4.8,8)','phase(t,1.55,2.8)').replace('phase(t,0,3.8)','phase(t,0,1.7)')
 scene=scene.replace('(t-8)/3','(t-2.8)/1.45').replace('t>=8&&t<11','t>=2.8&&t<4.25').replace("t<8?'pending':t<11?'orbit'","t<2.8?'pending':t<4.25?'orbit'")
 scene=scene.replace("t<2?'layered rotation':t<6?'hinged opening':t<8?'front alignment':t<11?'one metallic orbit'","t<.2?'layered rotation':t<1.85?'hinged opening':t<2.8?'front alignment':t<4.25?'one metallic orbit'")
 scene=scene.replace("'6-octave advected nebula, 3 star parallax layers, 12 side meteors'",repr(mechanism))
 (d/'scripts/scene.js').write_text(scene)
 build=(S/'scripts/build.py').read_text().replace('t:12,duration:12','t:5,duration:5').replace('tsinghua-mem-awakening-wide','tsinghua-mem-effect-'+id).replace('data-duration="12"','data-duration="5"').replace('max="12"','max="5"').replace(' / 12',' / 5').replace('>=12','>=5').replace('Tsinghua-MEM-Awakening-Wide','Tsinghua-MEM-'+id).replace('Built 12-second','Built 5-second').replace('Awakening · Flowing Galaxy',name).replace('Awakening · Flowing Galaxy',name)
 build=build.replace('#root{position:relative;width:100%;height:100%;overflow:hidden}','#root{position:relative;width:1920px;height:1080px;overflow:hidden}')
 (d/'scripts/build.py').write_text(build)
 (d/'BRIEF.md').write_text(f'# {id} {name}\n5 seconds, 1920x1080, 30fps, silent. Original source-exact apertures and approved enamel PBR retained. Open .12–1.85s, frontal settle 2.8s, single gloss orbit 2.8–4.25s, stable complete badge 4.25–5s; background continues.\n'+mechanism+'\n')
(P/'references.json').write_text(json.dumps({'references':refs,'license_url':f'https://raw.githubusercontent.com/DavidHDev/react-bits/{commit}/LICENSE.md','research_evidence_internal_only':'reference-evidence/; do not redistribute copied reference components'},ensure_ascii=False,indent=2))
print('Prepared two isolated compositions, exact shared geometry and reference record')
