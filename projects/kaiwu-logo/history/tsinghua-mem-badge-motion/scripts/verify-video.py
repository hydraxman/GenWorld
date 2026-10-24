from pathlib import Path
import subprocess,json,hashlib
from PIL import Image,ImageDraw,ImageChops,ImageStat
P=Path(__file__).resolve().parent.parent
D=P/'deliverables';Q=P/'qa';video=D/'Tsinghua-MEM-Light-Comparison-18s.mp4'
def run(args):
    return subprocess.run(args,check=True,capture_output=True,text=True).stdout
report={'files':[],'full_decode':{},'motion':[]}
for name,start in [('A-Backlight',0),('B-Transmitted-Light',6),('C-Iridescent-Sweep',12)]:
    out=D/f'Tsinghua-MEM-{name}-6s.mp4'
    run(['ffmpeg','-y','-v','error','-ss',str(start),'-i',str(video),'-t','6','-map','0:v:0','-c:v','libx264','-crf','16','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart','-an',str(out)])
for path in [video,*sorted(D.glob('*-6s.mp4'))]:
    data=json.loads(run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)]))
    s=data['streams'][0];duration=float(data['format']['duration']);expected=18 if path==video else 6
    assert len(data['streams'])==1 and s['codec_type']=='video'
    assert (s['width'],s['height'],s['r_frame_rate'],int(s['nb_frames']),duration)==(960,960,'30/1',expected*30,float(expected))
    run(['ffmpeg','-v','error','-i',str(path),'-f','null','-'])
    report['full_decode'][path.name]='passed'
    report['files'].append({'name':path.name,'codec':s['codec_name'],'duration':duration,'width':960,'height':960,'fps':30,'frames':int(s['nb_frames']),'audio':False,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
images=[]
for t in [1,3,5,7,9,11,13,15,17]:
    out=Q/f'video-{t:02d}s.png'
    run(['ffmpeg','-y','-v','error','-ss',str(t),'-i',str(video),'-frames:v','1',str(out)])
    images.append((t,Image.open(out).convert('RGB')))
sheet=Image.new('RGB',(960,1032),'#090710');draw=ImageDraw.Draw(sheet)
for i,(t,img) in enumerate(images):
    x=(i%3)*320;y=(i//3)*344
    sheet.paste(img.resize((320,320),Image.Resampling.LANCZOS),(x,y))
    draw.text((x+12,y+322),f'{"ABC"[i//3]} / {t%6:02d}s  (reel {t:02d}s)',fill='#e4d6ef')
sheet.save(D/'contact-sheet.jpg',quality=94)
for i,name in enumerate(['A','B','C']):
    a=images[i*3][1];b=images[i*3+1][1]
    diff=ImageChops.difference(a,b)
    mean=sum(ImageStat.Stat(diff).mean)/3
    assert mean>.25,(name,mean)
    report['motion'].append({'variant':name,'sample_times':[images[i*3][0],images[i*3+1][0]],'mean_absolute_RGB_delta':mean,'passed':True})
# The source alpha stencil must remain exactly identical, including all antialiasing.
a=Image.open(Q/'stencil-actual.png').convert('RGBA');b=Image.open(Q/'stencil-reference.png').convert('RGBA')
report['stencil_pixel_exact']=a.tobytes()==b.tobytes();assert report['stencil_pixel_exact']
report['entry_sha256']=hashlib.sha256((P/'index.html').read_bytes()).hexdigest()
report['standalone_html_sha256']=hashlib.sha256((D/'Tsinghua-MEM-Light-Studies.html').read_bytes()).hexdigest()
report['source_sha256']=hashlib.sha256((P/'inputs/Tsinghua-MEM-2023-Transparent.svg').read_bytes()).hexdigest()
report['passed']=True
(Q/'video-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
