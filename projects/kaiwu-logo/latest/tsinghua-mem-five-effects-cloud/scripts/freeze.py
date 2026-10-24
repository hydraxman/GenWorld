from pathlib import Path
import json,hashlib,datetime
import numpy as np
from PIL import Image,ImageFilter
P=Path(__file__).resolve().parent.parent
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
r={}
for t in [.6,2.5,4.6]:
    a=np.asarray(Image.open(P/f'qa/foreground-alpha-{t}.png').convert('RGB')).astype(float)/255
    on=np.asarray(Image.open(P/f'qa/preview-{t}.png').convert('RGB')).astype(float)
    off=np.asarray(Image.open(P/f'qa/foreground-off-{t}.png').convert('RGB')).astype(float)
    d=np.abs(on-off);roi=d[324:756,744:1176]
    r[str(t)]={'peak_alpha_8bit':float(a.max()),'core_max_alpha_8bit':float(a[324:756,744:1176].max()),'core_mean_pixel_difference_255':float(roi.mean()),'core_peak_channel_difference_255':float(roi.max()),'full_mean_pixel_difference_255':float(d.mean()),'changed_pixels':int((d.max(2)>0).sum())}
    assert a.max()<=.14+1/255
    assert a[324:756,744:1176].max()<=.035+1/255
    assert r[str(t)]['changed_pixels']>10000
(P/'qa/foreground-comparison.json').write_text(json.dumps({'coreROI':[744,324,1176,756],'quantization':'8-bit alpha screenshot; +/- 1/255','frames':r},indent=2))
original=Path('/Users/bryannathan/.hermes/outputs/tsinghua-mem-five-effects-review/research/cloud-sky-original.jpg')
md5=hashlib.md5(original.read_bytes()).hexdigest();assert md5=='3f2b19fa9c14943b34e5d4f480ba13ba'
refs={'version':'05','sources':[{'name':'Three.js webgl_volume_cloud','url':'https://threejs.org/examples/#webgl_volume_cloud','sourceURL':'https://raw.githubusercontent.com/mrdoob/three.js/0769f75f00560be7d707061ea088f27723ef9a3c/examples/webgl_volume_cloud.html','fixedCommit':'0769f75f00560be7d707061ea088f27723ef9a3c','license':'MIT','licenseFile':'research/three-license.txt','reviewed':'Official example opened and screenshot inspected; all 320 source lines read from archived pinned source.','sourceSHA256':h(P/'research/three-cloud-example.txt'),'adaptation':{'actualReuse':['Data3DTexture RedFormat linear-filtered 128^3 volume','ImprovedNoise.js copied from the same pinned upstream commit','ray-stepping volume integration','front-to-back accumulated transmission: sum += trans * alpha * light; trans *= 1-alpha'],'changes':['Periodic noise / 4-octave fBm','72 steps through thin advected foreground density','front layer drawn after extruded badge','0.14 global alpha ceiling; 0.035 over book/characters with broad feather','deterministic absolute-time seek instead of frame-counter jitter'],'notClaimed':'The main photographic background is not a procedural raymarched cloud.'}},{'name':'Poly Haven Kloofendal 48d Partly Cloudy PureSky','url':'https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky','sourceURL':'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/kloofendal_48d_partly_cloudy_puresky.jpg','license':'CC0-1.0','licenseURL':'https://polyhaven.com/license','licenseFile':'research/polyhaven-license.txt','apiEvidence':'research/polyhaven-cloud-files.json','sourceMD5':md5,'localAsset':'assets/cloud-sky-4k.jpg','localSHA256':h(P/'assets/cloud-sky-4k.jpg'),'reviewed':'Actual 4096x2048 sky image inspected; license text and source API file data read.','actualReuse':'Photographed real clouds, 4k derivative embedded into offline bundle; spherical upper-sky projection with 0.76-radian elevation, continuous 0.018 revolutions/sec yaw (32.4 degrees across 5s), selective bright-blue color grading. No lower hemisphere or artificial blurred horizon shown.'}]}
(P/'references.json').write_text(json.dumps(refs,ensure_ascii=False,indent=2))
files=[]
for directory in ['scripts','inputs','vendor','assets']:
    files += [f for f in (P/directory).rglob('*') if f.is_file()]
files += [P/'index.html',P/'research/ImprovedNoise.js',P/'research/three-license.txt',P/'deliverables/05-Blue-Sky-Cloud-Opening.html',P/'references.json']
freeze={'frozen':True,'writers':'none; sole author stopped scene/build writes before capture','frozenUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':{str(f.relative_to(P)):h(f) for f in sorted(files)}}
(P/'qa/render-input-freeze.json').write_text(json.dumps(freeze,indent=2))
print(json.dumps({'foreground':r,'sourceFilesFrozen':len(files),'originalPanoramaMD5':md5},indent=2))
