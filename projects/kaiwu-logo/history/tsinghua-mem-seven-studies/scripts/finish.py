from pathlib import Path
import subprocess,json,hashlib,xml.etree.ElementTree as ET,zipfile
from PIL import Image,ImageDraw
P=Path(__file__).resolve().parent.parent
D=P/'deliverables'; Q=P/'proof'; master=P/'renders/seven-master.mp4'
def run(args):
 p=subprocess.run(args,capture_output=True,text=True)
 if p.returncode: raise RuntimeError(p.stderr or p.stdout)
 return p.stdout
manifest=json.loads((D/'manifest.json').read_text());items=manifest['items'];assert len(items)==7 and [x['id'] for x in items]==[f'{i:02}' for i in range(1,8)]
frozen=json.loads((Q/'frozen-inputs.json').read_text())
assert all(hashlib.sha256((P/f).read_bytes()).hexdigest()==h for f,h in frozen.items()),'Render inputs changed after freeze'
source=ET.parse(P/'inputs/logo.svg').getroot();ns={'s':'http://www.w3.org/2000/svg'}
# SVG stage has an HTML boolean attribute: parse via a neutral empty-value rewrite.
stage=ET.fromstring((P/'assets/badge-stage.svg').read_text().replace('data-layout-allow-overflow ', 'data-layout-allow-overflow="" '))
paths=lambda e:[x.attrib['d'] for x in e.findall('.//s:path',ns)]
assert paths(source)==paths(stage) and len(paths(stage))==53
source_transforms=[e.attrib['transform'] for e in source.iter() if 'transform' in e.attrib]
geom=next(e for e in stage.iter() if e.get('id')=='geometry'); stage_transforms=[e.attrib['transform'] for e in geom.iter() if 'transform' in e.attrib]
assert source_transforms==stage_transforms
for i,item in enumerate(items):
 output=P/item['mp4']
 run(['ffmpeg','-y','-v','error','-ss',str(i*6),'-i',str(master),'-frames:v','180','-an','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(output)])
 assert output.stat().st_size<20_000_000
run(['ffmpeg','-y','-v','error','-i',str(master),'-frames:v','1260','-an','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(P/manifest['comparison'])])
results=[]
for f,frames,duration in [(master,1260,42),*[(P/x['mp4'],180,6) for x in items],(P/manifest['comparison'],1260,42)]:
 info=json.loads(run(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(f)]))
 streams=info['streams'];assert len(streams)==1 and streams[0]['codec_type']=='video';v=streams[0]
 assert int(v['nb_read_frames'])==frames and v['width']==960 and v['height']==960 and v['r_frame_rate']=='30/1'
 assert abs(float(info['format']['duration'])-duration)<.01
 run(['ffmpeg','-v','error','-xerror','-i',str(f),'-f','null','-'])
 results.append({'file':str(f.relative_to(P)),'frames':frames,'duration':duration,'width':960,'height':960,'fps':'30/1','audio':False,'full_decode':'passed','bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
for i,item in enumerate(items):
 for tag,t in [('start',0),('middle',3),('end',179/30)]:
  run(['ffmpeg','-y','-v','error','-ss',str(t),'-i',str(P/item['mp4']),'-frames:v','1',str(Q/f'video-{item["id"]}-{tag}.png')])
for kind in ['video','browser']:
 sheet=Image.new('RGB',(1050,2590),'#131929');draw=ImageDraw.Draw(sheet)
 for i,item in enumerate(items):
  for col,(tag,t) in enumerate([('start',.25),('middle',3),('end',5.75)]):
   file=Q/(f'video-{item["id"]}-{tag}.png' if kind=='video' else f'browser-{item["id"]}-{t}.png')
   sheet.paste(Image.open(file).resize((350,350)),(col*350,i*370));draw.text((col*350+12,i*370+353),f'{item["id"]} {tag}',fill='white')
 sheet.save(D/f'{kind}-contact.jpg',quality=95)
report={'ok':True,'items':results,'single_count':len(items),'single_total_frames':sum(x['frames'] for x in results if x['duration']==6),'source_paths':53,'all_path_d_exact':True,'all_source_transforms_exact':True,'source_sha256':hashlib.sha256((P/'inputs/logo.svg').read_bytes()).hexdigest(),'frozen_inputs_unchanged':True}
(Q/'video-verification.json').write_text(json.dumps(report,indent=2))
manifest['verified']=True;manifest['verification']='proof/video-verification.json';manifest['master']='renders/seven-master.mp4';manifest['source_archive']='deliverables/Seven-Studies-source.zip';(D/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
archive=D/'Seven-Studies-source.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 files=[P/'index.html',P/'BRIEF.md',P/'README.md',P/'hyperframes.json',P/'package.json',*sorted((P/'assets').glob('*')),*sorted((P/'inputs').glob('*')),*sorted((P/'scripts').glob('*.py')),*sorted((P/'scripts').glob('*.mjs')),D/'Seven-Studies.html',D/'manifest.json',Q/'hf-check.json',Q/'browser-verification.json',Q/'video-verification.json',Q/'frozen-inputs.json']
 for f in files:z.write(f,str(f.relative_to(P)))
print(json.dumps(report,indent=2));print('SOURCE ARCHIVE',archive.stat().st_size)
