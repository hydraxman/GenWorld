from pathlib import Path
import subprocess,json,hashlib
from PIL import Image,ImageDraw,ImageChops,ImageStat,ImageFilter
P=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
entries=[]
for mode,title in [('03','星尘凝徽'),('04','折光涟漪')]:
 d=P/mode;qa=d/'qa';mp4=d/f'deliverables/Tsinghua-MEM-{mode}-5s.mp4'
 enc=subprocess.run(['ffmpeg','-hide_banner','-y','-framerate','30','-i',str(d/'frames/frame-%04d.png'),'-frames:v','150','-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart','-an',str(mp4)],capture_output=True,text=True)
 (qa/'encode.log').write_text(enc.stderr);assert enc.returncode==0,enc.stderr
 probe=subprocess.run(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(mp4)],check=True,capture_output=True,text=True);meta=json.loads(probe.stdout);(qa/'ffprobe.json').write_text(json.dumps(meta,indent=2))
 assert len(meta['streams'])==1
 s=meta['streams'][0];assert (s['width'],s['height'],s['r_frame_rate'],int(s['nb_read_frames']),float(s['duration']))==(1920,1080,'30/1',150,5.0)
 decode=subprocess.run(['ffmpeg','-hide_banner','-v','error','-i',str(mp4),'-f','null','-'],capture_output=True,text=True);(qa/'full-decode.log').write_text(decode.stderr);assert decode.returncode==0 and not decode.stderr
 for frame in [21,50,123,149]:
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(mp4),'-vf',f'select=eq(n\\,{frame})','-vsync','0','-frames:v','1',str(qa/f'encoded-frame-{frame:03}.png')],check=True)
 frozen=json.loads((qa/'render-input-freeze.json').read_text())['files'];assert all(sha(d/f)==h for f,h in frozen.items())
 capture=json.loads((qa/'capture-state.json').read_text());assert capture['source_unchanged'];assert [f['index'] for f in capture['frames']]==list(range(150));assert all(sha(d/'frames'/f"frame-{f['index']:04}.png")==f['sha256'] for f in capture['frames'])
 original=P.parent/'tsinghua-mem-awakening-wide'
 preserved={f:sha(d/f)==sha(original/f) for f in ['inputs/semantic-geometry.json','inputs/Tsinghua-MEM-2023-Transparent.svg','scripts/SelectiveExtrudeGeometry.js']};assert all(preserved.values())
 check=json.loads((qa/'hyperframes-check.json').read_text());assert check['ok'];seek=json.loads((qa/'prototype-verification.json').read_text());assert seek['seekPassed'] and seek['holdBadgeIdentical']
 left=Image.open(qa/'encoded-frame-123.png');right=Image.open(qa/'encoded-frame-149.png');background={}
 for name,box in [('left',(0,0,440,1080)),('right',(1480,0,1920,1080))]:
  a=left.crop(box).filter(ImageFilter.GaussianBlur(18));b=right.crop(box).filter(ImageFilter.GaussianBlur(18));background[name]=sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
 assert min(background.values())>1
 report={'id':mode,'title':title,'width':1920,'height':1080,'fps':30,'frames':150,'duration':5.0,'audioStreams':0,'fullDecodePassed':True,'renderInputsUnchanged':True,'sourceGeometryPreserved':preserved,'hfCheckPassed':True,'randomSeekPixelEqualityPassed':True,'isolatedBadgeFinalHoldIdentical':True,'finalHoldSeconds':.9,'backgroundLowFrequencyMAE':background,'mp4SHA256':sha(mp4),'mp4Bytes':mp4.stat().st_size}
 (qa/'final-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 entries.append({'id':mode,'title':title,'mp4':str(mp4),'offlineHTML':str(d/f'deliverables/Tsinghua-MEM-{mode}.html'),'verification':str(qa/'final-verification.json'),'sha256':report['mp4SHA256'],'width':1920,'height':1080,'fps':30,'frames':150,'durationSeconds':5,'audio':False,'holdStartSeconds':4.1})
 print(json.dumps(report,ensure_ascii=False))
assert [x['id'] for x in entries]==['03','04']
(P/'manifest.json').write_text(json.dumps({'schemaVersion':1,'effects':entries,'references':'refs/REFERENCES.md','method':'Sequential deterministic absolute-time Chromium WebGL frames + FFmpeg encoding; no screen recording','count':2},ensure_ascii=False,indent=2))
contact=Image.new('RGB',(1440,580));draw=ImageDraw.Draw(contact)
for i,mode in enumerate(['03','04']):
 for j,frame in enumerate([21,50,149]):
  contact.paste(Image.open(P/mode/'qa'/f'encoded-frame-{frame:03}.png').resize((480,270)),(j*480,i*290));draw.text((j*480+10,i*290+273),mode+' / '+str(frame)+'/150',fill='white')
contact.save(P/'final-contact.png')
# Refresh old prototype sheet so reviewers do not see obsolete dark 04.
prototype=Image.new('RGB',(1440,580));draw=ImageDraw.Draw(prototype)
for i,mode in enumerate(['03','04']):
 for j,t in enumerate(['0.7','1.65','4.6']):
  prototype.paste(Image.open(P/mode/'qa'/f'prototype-{t}.png').resize((480,270)),(j*480,i*290));draw.text((j*480+10,i*290+273),mode+' / '+t+'s',fill='white')
prototype.save(P/'prototype-contact.png')
print('FINAL manifest entries exactly:',[x['id'] for x in entries])
