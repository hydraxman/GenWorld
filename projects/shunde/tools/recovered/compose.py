"""Compose actual H3 footage with verified narration and exact Chinese text."""
import argparse
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--font', type=Path, required=True, help='Path to a Chinese-capable TTF/OTF/TTC font')
p.add_argument('--video', type=Path, required=True)
p.add_argument('--crop', type=int, nargs=4, metavar=('X','Y','W','H'), required=True)
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
root = a.out.parent
x,y,w,h = a.crop
assert w%2 == 0 and h%2 == 0
caption = Image.new('RGBA',(w,h),(0,0,0,0))
draw = ImageDraw.Draw(caption)
font = ImageFont.truetype(str(a.font),38)
text = '这里是清华大学舜德楼'
box = draw.textbbox((0,0),text,font=font,stroke_width=1)
tw = box[2]-box[0]
tx = (w-tw)//2
baseline = h-79
draw.rounded_rectangle((tx-22,baseline-9,tx+tw+22,baseline+51),radius=9,fill=(0,0,0,135))
draw.text((tx,baseline),text,font=font,fill=(255,255,255,255),stroke_width=1,stroke_fill=(0,0,0,120))
caption.save(root/'caption.png')
filter_text = f'[0:v]crop={w}:{h}:{x}:{y}:exact=1,setsar=1,fps=24,trim=end_frame=120,setpts=PTS-STARTPTS[v];[v][2:v]overlay=0:0:enable=\'between(t,0.45,4.65)\'[outv];[1:a]adelay=550:all=1,apad,atrim=duration=5,asetpts=PTS-STARTPTS[outa]'
cmd = ['ffmpeg','-y','-i',str(a.video),'-i',str(root/'narration.mp3'),'-loop','1','-i',str(root/'caption.png'),'-filter_complex',filter_text,'-map','[outv]','-map','[outa]','-t','5','-frames:v','120','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(a.out)]
subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL,stderr=(root/'compose.log').open('w'))
subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(a.out),'-f','null','-'],check=True)
info = json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(a.out)]))
v = next(s for s in info['streams'] if s['codec_type']=='video')
audio = next(s for s in info['streams'] if s['codec_type']=='audio')
assert v['nb_read_frames']=='120' and v['avg_frame_rate']=='24/1'
assert abs(float(info['format']['duration'])-5)<0.01
assert (v['width'],v['height'])==(w,h)
(root/'final-probe.json').write_text(json.dumps(info,indent=2))
for t in [0,1,2.5,4.9]:
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(a.out),'-frames:v','1',str(root/f'final-{t}s.jpg')],check=True)
print(json.dumps({'pass':True,'video':str(a.out),'duration':info['format']['duration'],'frames':v['nb_read_frames'],'size':[w,h],'audio':audio['codec_name']},ensure_ascii=False))
