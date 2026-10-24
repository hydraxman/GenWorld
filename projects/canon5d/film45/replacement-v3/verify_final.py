"""Verify exact new delivery artifact, frozen teaching content, audio and frames."""
from pathlib import Path
import subprocess,json,hashlib,wave
import numpy as np
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent
OLD=ROOT.parent
VIDEO=ROOT/'Canon5D-NewModel-Xiaoxiao2-V3.mp4'
FF='/opt/homebrew/bin/ffmpeg'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run(*args):return subprocess.check_output(args,stderr=subprocess.PIPE)
def main():
    frozen=json.loads((ROOT/'preserved-source.json').read_text())
    assert all(sha(OLD/name)==h for name,h in frozen.items()),'Prior artifacts changed'
    old=json.loads((OLD/'audio/narration_segments.json').read_text())
    new=json.loads((ROOT/'audio/narration_segments.json').read_text())
    fields=['id','text','slot_start','slot_end']
    assert [[s[k] for k in fields] for s in old['segments']]==[[s[k] for k in fields] for s in new['segments']]
    assert new['voice_id']=='zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural'
    assert json.loads((ROOT/'timeline.json').read_text())==json.loads((OLD/'timeline.json').read_text())
    p=subprocess.run([FF,'-v','error','-xerror','-i',str(VIDEO),'-f','null','-'],capture_output=True,text=True)
    assert p.returncode==0 and not p.stderr.strip(),p.stderr
    probe=json.loads(run('/opt/homebrew/bin/ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(VIDEO)))
    v=next(s for s in probe['streams'] if s['codec_type']=='video');a=next(s for s in probe['streams'] if s['codec_type']=='audio')
    assert (v['width'],v['height'],v['r_frame_rate'],int(v['nb_read_frames']))==(1280,720,'24/1',1080)
    assert abs(float(probe['format']['duration'])-45)<.01 and abs(float(a['duration'])-45)<.01
    with wave.open(str(ROOT/'audio/narration_45s_48k_pcm.wav'),'rb') as w:
        assert (w.getframerate(),w.getsampwidth(),w.getnchannels(),w.getnframes())==(48000,2,1,2160000)
        source=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768
    audio=np.frombuffer(run(FF,'-v','error','-i',str(VIDEO),'-map','0:a:0','-ar','48000','-ac','1','-f','f32le','-'),dtype='<f4')[:len(source)]
    corr=float(np.corrcoef(source,audio)[0,1]);assert corr>.99
    peak=float(np.max(np.abs(audio)));assert peak<1
    segment_corr=[]
    for s in new['segments']:
        l=round(s['slot_start']*48000);r=round(s['audio_end']*48000)
        c=float(np.corrcoef(source[l:r],audio[l:r])[0,1]);assert c>.99
        segment_corr.append({'id':s['id'],'correlation':c})
    qa=ROOT/'final-qa';qa.mkdir(exist_ok=True)
    frames=[0,48,96,144,192,240,264,312,408,480,576,648,708,804,936,1008,1056,1079]
    expr='+'.join('eq(n\\,%d)'%n for n in frames)
    subprocess.run([FF,'-y','-v','error','-i',str(VIDEO),'-vf','select='+expr,'-fps_mode','vfr',str(qa/'frame-%02d.png')],check=True)
    files=sorted(qa.glob('frame-*.png'));assert len(files)==len(frames)
    font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',17)
    sheet=Image.new('RGB',(1920,6*386),'#111a22');d=ImageDraw.Draw(sheet)
    for i,(f,n) in enumerate(zip(files,frames)):
        im=Image.open(f);assert im.size==(1280,720)
        x=(i%3)*640;y=(i//3)*386
        sheet.paste(im.resize((640,360)),(x,y+26));d.text((x+12,y+4),f'V3 | {n/24:.2f}s',font=font,fill='white')
    sheet.save(qa/'contact.jpg',quality=95)
    # Compare actual front/back renders with prior delivered frames, not names.
    diff=[]
    for n,idx in [(0,0),(96,2)]:
        b=run(FF,'-v','error','-i',str(OLD/'canon5d-45s-chat.mp4'),'-vf',f'select=eq(n\\,{n})','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-')
        oldim=np.frombuffer(b,dtype=np.uint8).reshape(720,1280,3)
        newim=np.array(Image.open(files[idx]).convert('RGB'))
        mae=float(np.abs(oldim[150:620,200:1100].astype(float)-newim[150:620,200:1100]).mean())
        assert mae>3,(n,mae)
        diff.append({'frame':n,'model_region_mean_absolute_difference':mae})
    result={'file':str(VIDEO),'sha256':sha(VIDEO),'bytes':VIDEO.stat().st_size,'strict_decode':True,'duration':45,'resolution':[1280,720],'frames':1080,'fps':24,'approved_text_and_slots_unchanged':True,'light_and_tag_timeline_unchanged':True,'voice':new['voice_id'],'audio_source_sha256':sha(ROOT/'audio/narration_45s_48k_pcm.wav'),'audio_correlation':corr,'per_segment_audio':segment_corr,'audio_peak_dbfs':float(20*np.log10(peak)),'old_artifacts_unchanged':True,'new_visuals_differ':diff,'sampled_frames':frames,'contact_sheet':str(qa/'contact.jpg'),'visual_review':'pending','remote_delivery':'pending'}
    (ROOT/'final-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
