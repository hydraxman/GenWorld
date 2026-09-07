"""Verify immutable cameras, leaf bytes, and source geometry modules against V6."""
from pathlib import Path
import hashlib,json
old=Path('/Users/bryannathan/Desktop/Courtyard3D-v6')
project=Path(__file__).parent
shared=project.parent.parent/'shared'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
result={'cameraFiles':{},'unchangedGeometryFiles':{},'sharedLeafFiles':{}}
for name in ['camera.js','film-camera.js']:
    assert digest(project/'src'/name)==digest(old/'src'/name)
    result['cameraFiles'][name]=digest(project/'src'/name)
for name in ['campus.js','exploded.js','water.js','pools.js']:
    assert digest(project/'src'/name)==digest(old/'src'/name)
    result['unchangedGeometryFiles'][name]=digest(project/'src'/name)
for f in sorted((old/'assets/leaves').iterdir()):
    if not f.is_file():continue
    assert digest(f)==digest(shared/'assets/leaves'/f.name)==digest(project/'assets/leaves'/f.name)
    result['sharedLeafFiles'][f.name]=digest(f)
result['sharedIlluminationIdentical']=digest(shared/'illumination.js')==digest(old/'src/illumination.js')
assert result['sharedIlluminationIdentical']
(project/'qa/glass/baseline-check.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
