from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json,hashlib,wave,sys,numpy as np
ROOT=Path(__file__).resolve().parent
video=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'canon5d-45s-azure-narrated.mp4';out=ROOT/'final-qa';out.mkdir(exist_ok=True)
probe=json.loads(subprocess.check_output(['/opt/homebrew/bin/ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]))
v=next(x for x in probe['streams'] if x['codec_type']=='video');a=next(x for x in probe['streams'] if x['codec_type']=='audio')
assert (v['width'],v['height'],v['r_frame_rate'],int(v['nb_frames']))==(1280,720,'24/1',1080)
assert abs(float(probe['format']['duration'])-45)<.05
selected=[0,96,192,264,312,408,480,576,648,708,804,936,960,1056,1079]
expr='+'.join(f'eq(n,{n})' for n in selected)
subprocess.run(['/opt/homebrew/bin/ffmpeg','-y','-v','error','-i',str(video),'-vf',f'select={expr.replace(",",chr(92)+",")}', '-fps_mode','vfr',str(out/'frame-%02d.png')],check=True,timeout=90)
images=sorted(out.glob('frame-*.png'));assert len(images)==len(selected)
font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',16)
sheet=Image.new('RGB',(1920,5*386),'#101b25');d=ImageDraw.Draw(sheet)
for i,(path,n) in enumerate(zip(images,selected)):
 im=Image.open(path);im.load();assert im.size==(1280,720)
 sheet.paste(im.resize((640,360)),((i%3)*640,(i//3)*386+26));d.text(((i%3)*640+15,(i//3)*386+4),f'{n/24:.2f}s | frame {n}',font=font,fill='white')
sheet.save(out/'film-contact.jpg',quality=95)
raw=subprocess.check_output(['/opt/homebrew/bin/ffmpeg','-v','error','-i',str(video),'-vn','-ac','1','-ar','48000','-f','f32le','pipe:1'])
decoded=np.frombuffer(raw,dtype='<f4')
with wave.open(str(ROOT/'audio/narration_45s_48k_pcm.wav'),'rb') as w:
 assert (w.getnchannels(),w.getframerate(),w.getsampwidth())==(1,48000,2);source=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float32)/32768
size=min(len(source),len(decoded));correlation=float(np.corrcoef(source[:size],decoded[:size])[0,1]);assert correlation>.98,correlation
peak=float(np.max(np.abs(decoded)));assert peak<1,peak
subprocess.run(['/opt/homebrew/bin/ffmpeg','-v','error','-xerror','-i',str(video),'-f','null','-'],check=True,timeout=180)
metadata=json.loads((ROOT/'timeline.json').read_text());tags=sorted({x['tag'] for x in metadata if x['tag']});assert len(tags)==9
result={'duration_seconds':float(probe['format']['duration']),'size_bytes':video.stat().st_size,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'frames':int(v['nb_frames']),'fps':v['r_frame_rate'],'resolution':[v['width'],v['height']],'audio_codec':a['codec_name'],'audio_correlation_to_azure_source':correlation,'decoded_audio_peak_dbfs':float(20*np.log10(peak)),'no_clipping':True,'strict_decode':'passed','sampled_final_frames':selected,'teaching_tags':tags,'contact_sheet':str(out/'film-contact.jpg'),'visual_review':'pending'}
(ROOT/'final-qa.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))
