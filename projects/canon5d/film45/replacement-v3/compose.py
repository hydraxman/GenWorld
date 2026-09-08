from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,time,subprocess,sys,hashlib,math,io
ROOT=Path(__file__).resolve().parent
W,H,FPS,N=1280,720,24,1080
FONT='/System/Library/Fonts/STHeiti Medium.ttc'
TIMELINE=json.loads((ROOT/'timeline.json').read_text())
AUDIO=json.loads((ROOT/'audio/narration_segments.json').read_text())
assert len(TIMELINE)==N and len(AUDIO['segments'])==11
FONTS={size:ImageFont.truetype(FONT,size) for size in [13,14,15,16,18,24,27,30]}
PHASES=list(dict.fromkeys(x['phase'] for x in TIMELINE))
STARTS={p:min(x['t'] for x in TIMELINE if x['phase']==p) for p in PHASES}
ENDS={p:max(x['t'] for x in TIMELINE if x['phase']==p)+1/FPS for p in PHASES}
def wrap(text,font,maxwidth):
    lines=[];line=''
    for ch in text:
        if font.getlength(line+ch)>maxwidth and line:lines.append(line);line=ch
        else:line+=ch
    if line:lines.append(line)
    return lines

def annotate(base,number):
    image=base.convert('RGBA').resize((W,H),Image.Resampling.LANCZOS)
    layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer);meta=TIMELINE[number-1];t=meta['t'];p=meta['phase'];i=PHASES.index(p)
    # Quiet fixed header and progressively filled timeline.
    d.rounded_rectangle((24,20,585,92),radius=12,fill=(9,17,24,210))
    d.text((41,29),'单反相机：从光线到照片',font=FONTS[30],fill='#EDF4F8')
    d.text((42,67),f'{i+1:02d}  {p}',font=FONTS[16],fill='#B2C7D5')
    d.rounded_rectangle((1080,25,1255,56),radius=9,fill=(9,17,24,210));d.text((1096,32),'教学结构示意',font=FONTS[15],fill='#B8C6CF')
    color=(105,209,255) if 12<=t<31 else ((116,238,163) if t>=42 else (250,192,102))
    if 12<=t<31:mode='取景光路：镜片 → 光圈 → 反光镜 → 对焦屏 → 五棱镜 → 目镜'
    elif 31<=t<36:mode='曝光光路：先抬起反光镜，再打开快门'
    elif 36<=t<42:mode='成像：光线汇聚到传感器；光能转换为电信号'
    elif t>=42:mode='电信号 → 图像处理器 → 照片'
    else:mode='Canon EOS 5D Mark IV 外观参考 · 内部布局简化示意'
    d.text((42,105),mode,font=FONTS[15],fill=(*color,255))
    if meta['tag'] and meta['anchor']:
        x,y=meta['anchor'][0]*W/1920,meta['anchor'][1]*H/1080
        age=t-STARTS[p];remain=ENDS[p]-t;alpha=min(1,age/.22,remain/.18);alpha=max(0,alpha)
        width,height=300,86
        bx=x-width-125 if p=='反光镜 + 快门' else x+135
        bx=max(30,min(W-width-30,bx));by=max(137,min(500,y-150+10*(1-alpha)))
        # Leader endpoints are actual projected 3D component centers.
        edge=(bx+width if bx<x else bx,by+height*.58)
        d.line([(x,y),(edge[0]-10 if bx>x else edge[0]+10,edge[1]),edge],fill=(*color,int(210*alpha)),width=2)
        d.ellipse((x-5,y-5,x+5,y+5),fill=(*color,int(255*alpha)))
        d.rounded_rectangle((bx,by,bx+width,by+height),radius=12,fill=(10,21,30,int(230*alpha)),outline=(*color,int(235*alpha)),width=2)
        d.text((bx+16,by+11),meta['tag'],font=FONTS[24],fill=(242,248,251,int(255*alpha)))
        detail=wrap(meta['detail'],FONTS[15],width-32)
        for j,line in enumerate(detail[:2]):d.text((bx+16,by+48+j*19),line,font=FONTS[15],fill=(178,205,220,int(255*alpha)))
    seg=next(x for x in AUDIO['segments'] if x['slot_start']<=t<x['slot_end'])
    # Captions remain through the natural sentence-end pause.
    lines=wrap(seg['text'],FONTS[27],1130);th=len(lines)*36;tw=max(FONTS[27].getlength(x) for x in lines)
    left=(W-tw)/2-24;top=H-44-th
    d.rounded_rectangle((left,top-10,W-left,top+th+9),radius=12,fill=(5,12,19,224))
    for j,line in enumerate(lines):d.text(((W-FONTS[27].getlength(line))/2,top+j*36),line,font=FONTS[27],fill='#F0F4F6')
    d.line((30,705,W-30,705),fill=(108,123,132,150),width=3);d.line((30,705,30+(W-60)*(number/N),705),fill=(*color,255),width=3)
    return Image.alpha_composite(image,layer).convert('RGB')

def main():
    if '--preview' in sys.argv:
        files={97:'frame_97.png',313:'frame_313.png',481:'frame_481.png',649:'glass-fix.png',805:'full_805.png',937:'full_937.png',1057:'full_1057.png'}
        for n,name in files.items():annotate(Image.open(ROOT/'previews'/name),n).save(ROOT/'previews'/f'labelled_{n}.jpg',quality=95)
        print('Annotated seven actual rendered QA frames',flush=True);return
    output=ROOT/'Canon5D-NewModel-Xiaoxiao2-V3.mp4';log=ROOT/'encode.log'
    cmd=['/opt/homebrew/bin/ffmpeg','-y','-hide_banner','-loglevel','warning','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','pipe:0','-i',str(ROOT/'audio/narration_45s_48k_pcm.wav'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','medium','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-t','45','-movflags','+faststart',str(output)]
    started=time.monotonic();last_report=-1
    with log.open('w') as fh:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=fh,stderr=subprocess.STDOUT)
        try:
            for n in range(1,N+1):
                path=ROOT/'frames'/f'frame_{n:04d}.png';wait_start=time.monotonic()
                while True:
                    if path.exists():
                        try:
                            data=path.read_bytes()
                            if data.endswith(b'\x00\x00\x00\x00IEND\xaeB\x60\x82'):
                                im=Image.open(io.BytesIO(data));im.load();break
                        except (OSError,ValueError,SyntaxError,EOFError):pass
                    if proc.poll() is not None:raise RuntimeError('ffmpeg exited; inspect encode.log')
                    if time.monotonic()-wait_start>900:raise TimeoutError(f'No complete frame {n} for 15 minutes')
                    time.sleep(.5)
                assert im.size==(W,H),(n,im.size)
                proc.stdin.write(annotate(im,n).tobytes())
                if n==1 or n%48==0 or n==N:
                    elapsed=time.monotonic()-started;data={'encoded':n,'total':N,'elapsed_s':round(elapsed,1),'eta_s':round(elapsed/n*(N-n),1)};(ROOT/'progress.json').write_text(json.dumps(data));print(json.dumps(data),flush=True)
            proc.stdin.close();rc=proc.wait(timeout=240);assert rc==0,rc
        except BaseException:
            proc.kill();proc.wait();raise
    probe=json.loads(subprocess.check_output(['/opt/homebrew/bin/ffprobe','-v','error','-show_streams','-show_format','-of','json',str(output)]))
    video=next(x for x in probe['streams'] if x['codec_type']=='video');audio=next(x for x in probe['streams'] if x['codec_type']=='audio')
    assert (video['width'],video['height'],int(video['nb_frames']))==(W,H,N);assert abs(float(probe['format']['duration'])-45)<.05
    subprocess.run(['/opt/homebrew/bin/ffmpeg','-v','error','-xerror','-i',str(output),'-f','null','-'],check=True,timeout=180)
    verification={'path':str(output),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size,'duration':probe['format']['duration'],'video':{'codec':video['codec_name'],'width':W,'height':H,'fps':video['r_frame_rate'],'frames':int(video['nb_frames'])},'audio':{'codec':audio['codec_name'],'sample_rate':audio['sample_rate'],'provider':'Azure Speech','voice':AUDIO['voice_id']},'strict_decode':'passed','visual_review':'pending'}
    (ROOT/'video-verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2));print(json.dumps(verification,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
