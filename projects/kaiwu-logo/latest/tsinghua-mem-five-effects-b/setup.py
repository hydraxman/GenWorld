from pathlib import Path
import shutil, json, subprocess, hashlib
P=Path(__file__).resolve().parent
S=P.parent/'tsinghua-mem-awakening-wide'
for mode in ['03','04']:
 d=P/mode
 for name in ['vendor','inputs']:
  shutil.copytree(S/name,d/name,dirs_exist_ok=True)
 for name in ['scripts','assets','deliverables','qa','frames']:(d/name).mkdir(parents=True,exist_ok=True)
 for f in ['scripts/SelectiveExtrudeGeometry.js','assets/gsap.min.js']:
  shutil.copy2(S/f,d/f)
 src=(S/'scripts/scene.js').read_text()
 src=src.replace("import {makeGalaxy} from './galaxy.js';", "import {makeBackground,makeEffects} from './effects.js';\nconst MODE="+repr(mode)+";")
 src=src.replace('Math.min(12,Number(t))','Math.min(5,Number(t))')
 src=src.replace('const galaxy=makeGalaxy();','const galaxy=makeBackground(MODE);')
 src=src.replace('duration:12','duration:5').replace("background:'6-octave advected nebula, 3 star parallax layers, 12 side meteors'","background:MODE==='03'?'Advected star dust cloud with convergent surface particles':'Continuous iridescent liquid field, radial optical waves'")
 a=src.index(' function draw(t)');b=src.index(' window.__sceneDebug=')
 src=src[:a]+''' const fx=makeEffects(THREE,MODE,badge,groups,[face,side],renderer);
 function draw(t){
  const open=phase(t,.35,2.6),settle=phase(t,.2,3.5),cam=phase(t,.1,3.4),early=1-cam;
  groups.leftPage.rotation.set(0,(MODE==='03'?.48:1.30)*(1-open),0);groups.rightPage.rotation.set(0,-(MODE==='03'?.48:1.30)*(1-open),0);
  groups.leftPage.position.set(0,0,.22*(1-settle));groups.rightPage.position.copy(groups.leftPage.position);
  groups.circuits.rotation.set(.07*(1-settle),-.12*(1-settle),-.16*(1-settle));groups.circuits.position.set(0,0,-.14*(1-settle));
  groups.letterBand.rotation.set(.12*(1-settle),-.18*(1-settle),-.45*(1-settle));groups.letterBand.position.set(0,0,.1*(1-settle));
  groups.braidedRim.rotation.set(-.1*(1-settle),.25*(1-settle),.6*(1-settle));groups.braidedRim.position.set(0,0,-.25*(1-settle));
  badge.rotation.set(.05*early,.1*early,-.1*early);
  const az=(MODE==='03'?.42:.65)*(1-cam),el=.18*(1-cam);camera.position.set(12*Math.sin(az)*Math.cos(el),12*Math.sin(el),12*Math.cos(az)*Math.cos(el));camera.lookAt(0,0,0);camera.zoom=.90+.10*cam;camera.updateProjectionMatrix();
  const progress=clamp((t-2.8)/1.3),angle=Math.PI/2-progress*Math.PI*2,active=t>=2.8&&t<4.1,strength=active?Math.sin(Math.PI*progress)**.6:0;
  sweep.position.set(3.7*Math.cos(angle),3.7*Math.sin(angle),2.2);sweep.intensity=34*strength;sweep2.position.set(3*Math.cos(angle-.20),3*Math.sin(angle-.20),1.3);sweep2.intensity=8*strength;scene.environmentRotation.z=active?-progress*Math.PI*2:0;
  fx.update(t);scene.updateMatrixWorld(true);let maxError=0;for(const[name,pts]of Object.entries(landmarks))for(const p of pts){let v=new THREE.Vector3(...p),w=v.clone();groups[name].localToWorld(w);maxError=Math.max(maxError,v.distanceTo(w))}
  window.sceneMetrics.pose={time:t,leftPageAngle:groups.leftPage.rotation.y,rightPageAngle:groups.rightPage.rotation.y,camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),zoom:camera.zoom},assemblyErrorWorld:maxError,gloss:{progress,strength},stage:t<2.8?'reveal':t<4.1?'settle + gloss':'static final hold',backgroundTime:t,reveal:fx.metrics(t)};
  galaxy.draw(t,open);fx.begin();renderer.clear();renderer.render(galaxy.scene,galaxy.camera);renderer.clearDepth();renderer.render(scene,camera);fx.finish(t);
 }
''' +src[b:]
 src=src.replace('sweep,sweep2,geometryData','sweep,sweep2,fx,geometryData')
 (d/'scripts/scene.js').write_text(src)
 (d/'hyperframes.json').write_text(json.dumps({'paths':{'assets':'assets','blocks':'compositions'},'authoringSkill':'motion-graphics'}))
 (d/'meta.json').write_text(json.dumps({'id':'mem-effect-'+mode,'name':'Tsinghua MEM '+mode}))
print('Isolated source copies created: 03/04; original source not modified')
