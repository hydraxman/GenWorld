from pathlib import Path
import zipfile,json,hashlib
r=Path(__file__).resolve().parent
source=[p for n in ['src','assets','segments'] for p in (r/n).rglob('*') if p.is_file()]
source += [r/n for n in ['README.md','MODEL_NOTES.md','design.md','index.html','viewer.html','meta.json','hyperframes.json','package.json','package-lock.json','qa-browser.mjs','qa-viewer.mjs','qa-reflection.mjs','qa-exploded.mjs','prepare-leaf.py','repack-glb.py','finalize-video.py','package-delivery.py','qa/v1-baseline.json','qa/v3-baseline.json','qa/v5-baseline.json','qa/exploded-check.json','qa/final-verification.json','qa/sources/maple.html']]
out=r/'output/庭院建筑_V6_源码与查看器.zip'
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in source:
  assert p.is_file(),str(p)
  z.write(p,'Courtyard3D-v6/'+str(p.relative_to(r)))
 z.write(r/'node_modules/three/LICENSE','Courtyard3D-v6/licenses/THREE.txt');z.writestr('Courtyard3D-v6/licenses/GSAP.txt','GSAP Standard no-charge license https://gsap.com/standard-license. Original header retained in assets/gsap.min.js.')
with zipfile.ZipFile(out) as z:assert z.testzip() is None;count=len(z.namelist())
assert out.stat().st_size<30_000_000
record={'file':out.name,'bytes':out.stat().st_size,'entries':count,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}
(r/'qa/package-check.json').write_text(json.dumps(record,ensure_ascii=False,indent=2));print(json.dumps(record,ensure_ascii=False))
