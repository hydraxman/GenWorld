"""Encode and verify the complete 15-second orbit; no delivery side effects."""
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageChops, ImageStat, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'output/orbit15'
frames=OUT/'frames'
expected=[f'frame_{n:04d}.png' for n in range(1,361)]
actual=sorted(p.name for p in frames.glob('frame_*.png'))
assert actual==expected, {'expected':360,'found':len(actual),'missing':sorted(set(expected)-set(actual))}
for name in expected:
    with Image.open(frames/name) as image:
        assert image.size==(1280,720)
        image.verify()
manifest=json.loads((OUT/'orbit-manifest.json').read_text())
source=ROOT/'output/Shunde_Blender_PBR.blend'
assert hashlib.sha256(source.read_bytes()).hexdigest()==manifest['source_blend_sha256']
video=OUT/'舜德楼_Blender_15秒环绕.mp4'
command=['ffmpeg','-y','-framerate','24','-start_number','1','-i',str(frames/'frame_%04d.png'),'-frames:v','360','-an','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(video)]
with (OUT/'encode.log').open('w') as log:
    subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]))
v=next(s for s in probe['streams'] if s['codec_type']=='video')
assert (v['width'],v['height'],v['r_frame_rate'],int(v['nb_frames']))==(1280,720,'24/1',360)
assert float(probe['format']['duration'])==15
assert all(s['codec_type']!='audio' for s in probe['streams'])
subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(video),'-f','null','-'],check=True)
checks=OUT/'video-qa'
checks.mkdir(exist_ok=True)
indices=[0,60,120,180,240,300,359]
select='+'.join(f'eq(n\\,{n})' for n in indices)
subprocess.run(['ffmpeg','-y','-v','error','-i',str(video),'-vf','select='+select,'-fps_mode','vfr',str(checks/'sample_%02d.png')],check=True)
images=sorted(checks.glob('sample_*.png'))
assert len(images)==len(indices)
differences=[]
for a,b in zip(images,images[1:]):
    aimg=Image.open(a).convert('RGB');bimg=Image.open(b).convert('RGB')
    differences.append(sum(ImageStat.Stat(ImageChops.difference(aimg,bimg)).mean)/3)
assert min(differences)>3, 'Encoded view not moving'
contact=Image.new('RGB',(1920,640),'#18272d');d=ImageDraw.Draw(contact)
font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',22)
for i,(path,index) in enumerate(zip(images,indices)):
    x=(i%4)*480;y=(i//4)*320
    d.text((x+12,y+10),f'{index/24:.2f}s',font=font,fill='white')
    image=Image.open(path).convert('RGB');image.thumbnail((480,270),Image.Resampling.LANCZOS)
    contact.paste(image,(x,y+45))
contact.save(checks/'contact.jpg',quality=94)
Image.open(images[0]).convert('RGB').save(OUT/'cover.jpg',quality=94)
report={'pass':True,'file':str(video),'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'bytes':video.stat().st_size,'duration':15,'fps':24,'frames':360,'size':[1280,720],'codec':v['codec_name'],'pix_fmt':v['pix_fmt'],'audio':'none','strict_full_decode':True,'source_blend_unchanged':True,'frame_sequence_complete':True,'motion_difference_mae':differences,'visual_review':'pending','remote_delivery':'pending'}
(OUT/'video-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
