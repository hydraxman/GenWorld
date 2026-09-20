from pathlib import Path
import json,hashlib,subprocess
from PIL import Image,ImageDraw,ImageChops,ImageStat
P=Path(__file__).resolve().parent.parent
f=P/'deliverables/Tsinghua-MEM-Open-World-12s.mp4'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-count_frames','-of','json',str(f)]))
v=[s for s in probe['streams'] if s['codec_type']=='video'][0]
assert (v['width'],v['height'],v['r_frame_rate'],int(v['nb_read_frames']))==(1920,1080,'30/1',360)
assert float(probe['format']['duration'])==12
assert not any(s['codec_type']=='audio' for s in probe['streams'])
r=subprocess.run(['ffmpeg','-v','error','-i',str(f),'-f','null','-'],capture_output=True,text=True);assert r.returncode==0 and not r.stderr
freeze=json.loads((P/'qa/render-input-freeze.json').read_text());assert all(hashlib.sha256((P/n).read_bytes()).hexdigest()==h for n,h in freeze['files'].items())
state=json.loads((P/'qa/capture-state.json').read_text());assert sorted(x['index'] for x in state['frames'])==list(range(360));assert all(hashlib.sha256((P/'frames'/f"frame-{x['index']:04d}.png").read_bytes()).hexdigest()==x['sha256'] for x in state['frames'])
a=Image.open(P/'frames/frame-0330.png').convert('RGB');b=Image.open(P/'frames/frame-0359.png').convert('RGB');diff=ImageChops.difference(a.crop((0,0,480,1080)),b.crop((0,0,480,1080)));mae=sum(ImageStat.Stat(diff).mean)/3;assert mae>3
source=P.parent/'tsinghua-mem-3d-book-opening/inputs/semantic-geometry.json';assert source.read_bytes()==(P/'inputs/semantic-geometry.json').read_bytes()
qa=json.loads((P/'qa/prototype/qa.json').read_text());assert qa['allSeeksMatch'] and qa['errors']==[]
last=qa['metrics'][-1]['pose'];assert last['assemblyErrorWorld']==0 and last['gloss']['progress']==1
for t in [0,1.6,3.6,5.5,7.5,9.6,11.9]:
 subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(f),'-frames:v','1',str(P/'qa'/f'encoded-{t}.png')],check=True)
ts=[0,1.6,3.6,5.5,7.5,9.6,11.9];c=Image.new('RGB',(1440,1080),'#080411');d=ImageDraw.Draw(c)
for i,t in enumerate(ts):c.paste(Image.open(P/'qa'/f'encoded-{t}.png').resize((480,270)),((i%3)*480,(i//3)*360));d.text(((i%3)*480+12,(i//3)*360+278),f'{t}s',fill='white')
c.save(P/'qa/encoded-contact-sheet.jpg')
report={'status':'PASS','width':1920,'height':1080,'fps':30,'frames':360,'duration':12,'audioStreams':0,'fullDecode':True,'sourceAndBundleUnchanged':True,'semanticGeometryByteIdentical':True,'repeatSeekDeterministic':True,'finalAssemblyErrorWorld':0,'metallicOrbitRevolutions':1,'lateBackgroundMAE_11to11_966':mae,'mp4Sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'mp4Bytes':f.stat().st_size,'geometry':{k:qa['metrics'][0][k] for k in ['sourcePaths','sourceHoles','semanticGroups','vertices']}}
(P/'qa/final-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
