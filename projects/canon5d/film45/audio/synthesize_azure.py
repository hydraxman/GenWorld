#!/usr/bin/env python3
"""Real Azure Speech batch synthesis + sample-accurate 45s PCM assembly.
Requires az login, ffmpeg, ffprobe. Secrets stay in memory. Resume-safe cache
is bound to SSML and returned WAV hashes. No voice cloning or other provider.
Run: python3 synthesize_azure.py && python3 verify_audio.py
"""
import array
import hashlib
import json
import math
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent
SUBSCRIPTION = '76060559-0971-451d-a3cf-47d04c87e309'
RESOURCE = 'FilmmakerBsp'
REGION = 'eastus'
VOICE = 'zh-CN-YunxiNeural'
RATE = '+8%'
FORMAT = 'riff-48khz-16bit-mono-pcm'
BASE = f'https://{REGION}.tts.speech.microsoft.com/cognitiveservices'
SEGMENTS = [
    (0,8,'以佳能单反为例，先转一圈，看清镜头、机身和背面的操控区。'),
    (8,12,'拆开外壳，跟着光线看内部。'),
    (12,16,'镜片组折射光线，让它汇聚。'),
    (16,19,'光圈调节开口，控制进光量。'),
    (19,23,'取景时，主反光镜把光线向上反射。'),
    (23,25.5,'光线在对焦屏上形成像。'),
    (25.5,28.5,'五棱镜改变光路，校正像的方向。'),
    (28.5,31,'最后，通过目镜进入眼睛。'),
    (31,36,'拍照时，反光镜抬起，快门打开，光线才直达传感器。'),
    (36,42,'镜头把景物成像在传感器上。感光像素把光转换成电信号。'),
    (42,45,'图像处理器再把信号处理成照片。'),
]
# Only used when the measured +8% rendition cannot fit at <=1.25 atempo.
SHORT = {
    1:'先绕佳能单反一圈，看镜头、机身和背面操控区。',
    2:'拆开外壳，跟着光线看内部。',
    3:'镜片组折射光线，使其汇聚。',
    4:'光圈控制开口和进光量。',
    5:'取景时，主反光镜向上反射光线。',
    6:'对焦屏上形成像。',
    7:'五棱镜改变光路，校正像向。',
    8:'光经目镜进入眼睛。',
    9:'拍照时，反光镜抬起，快门打开，光直达传感器。',
    10:'镜头在传感器上成像，感光像素把光转成电信号。',
    11:'图像处理器把信号变成照片。',
}

def save_json(path, data):
    tmp = path.with_suffix(path.suffix+'.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    tmp.replace(path)

def az_json(*args):
    p = subprocess.run(['az', *args, '--output','json','--only-show-errors'],capture_output=True,text=True,timeout=90)
    if p.returncode:
        raise RuntimeError('Azure CLI failed; authenticate or check access (credential output suppressed)')
    return json.loads(p.stdout)

def duration(path):
    p = subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(path)],text=True)
    return float(p.strip())

def pcm(path):
    with wave.open(str(path),'rb') as w:
        assert (w.getnchannels(),w.getsampwidth(),w.getframerate()) == (1,2,48000)
        values = array.array('h', w.readframes(w.getnframes()))
    if sys.byteorder != 'little':
        values.byteswap()
    return values

def write_pcm(path, values):
    out = array.array('h', values)
    if sys.byteorder != 'little':
        out.byteswap()
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes(out.tobytes())

def main():
    for command in ['az','ffmpeg','ffprobe']:
        assert shutil.which(command), f'Missing {command}'
    rawdir = ROOT/'raw'; fitdir=ROOT/'fitted'
    rawdir.mkdir(exist_ok=True); fitdir.mkdir(exist_ok=True)
    resource = az_json('cognitiveservices','account','show','--resource-group','TTS','--name',RESOURCE,'--subscription',SUBSCRIPTION)
    assert resource['location'] == REGION and resource['kind'] == 'SpeechServices'
    key = az_json('cognitiveservices','account','keys','list','--resource-group','TTS','--name',RESOURCE,'--subscription',SUBSCRIPTION)['key1']
    def request(path, payload=None):
        for attempt in range(4):
            req = urllib.request.Request(BASE+path,data=payload,headers={
                'Ocp-Apim-Subscription-Key':key,
                'Content-Type':'application/ssml+xml',
                'X-Microsoft-OutputFormat':FORMAT,
                'User-Agent':'Canon5D-Narration/1.0',
            })
            try:
                with urllib.request.urlopen(req,timeout=90) as response:
                    return response.read(), response.status
            except urllib.error.HTTPError as e:
                if e.code not in (408,429,500,502,503,504) or attempt==3:
                    raise RuntimeError(f'Azure Speech HTTP {e.code}; response body suppressed') from None
                delay = min(30, max(4*2**attempt, int(e.headers.get('Retry-After','0')) if e.headers.get('Retry-After','0').isdigit() else 0))
            except (urllib.error.URLError, TimeoutError):
                if attempt==3:
                    raise RuntimeError('Azure Speech network failure after 4 attempts') from None
                delay = 4*2**attempt
            print(f'Network retry {attempt+1}/3 in {delay}s',flush=True)
            time.sleep(delay)
    voices_body, voices_status = request('/voices/list')
    voices = json.loads(voices_body)
    voice = next((v for v in voices if v.get('ShortName')==VOICE), None)
    assert voice and voice['Locale']=='zh-CN', 'Required Azure voice is not available'
    save_json(ROOT/'voice_availability.json', {'checked_utc':datetime.now(timezone.utc).isoformat(),'http_status':voices_status,'endpoint':BASE+'/voices/list','resource':RESOURCE,'region':REGION,'voice':voice})
    print(f'Azure voice confirmed: {VOICE}',flush=True)
    def synthesize(index,text,variant):
        stem=f'{index:02d}_{variant}'
        wav = rawdir/(stem+'.wav'); meta = rawdir/(stem+'.json')
        ssml=f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="{VOICE}"><prosody rate="{RATE}">{escape(text)}</prosody></voice></speak>'
        fingerprint=hashlib.sha256((ssml+FORMAT+BASE).encode()).hexdigest()
        if wav.exists() and meta.exists():
            m=json.loads(meta.read_text())
            if m.get('request_sha256')==fingerprint and m.get('wav_sha256')==hashlib.sha256(wav.read_bytes()).hexdigest():
                duration(wav)
                return wav
        body,status=request('/v1',ssml.encode('utf-8'))
        assert body[:4]==b'RIFF' and body[8:12]==b'WAVE', 'Azure did not return WAV'
        tmp=wav.with_suffix('.wav.tmp'); tmp.write_bytes(body); tmp.replace(wav)
        measured=duration(wav); assert measured>0; pcm(wav)
        (rawdir/(stem+'.ssml')).write_text(ssml,encoding='utf-8')
        save_json(meta, {'provider':'Azure Speech','endpoint':BASE+'/v1','http_status':status,'voice_id':VOICE,'rate':RATE,'text':text,'output_format':FORMAT,'request_sha256':fingerprint,'wav_sha256':hashlib.sha256(body).hexdigest(),'duration_seconds':measured,'generated_utc':datetime.now(timezone.utc).isoformat()})
        return wav
    manifest={'provider':'Azure Speech','resource':RESOURCE,'region':REGION,'voice_id':VOICE,'ssml_rate':RATE,'output_format':'pcm_s16le','sample_rate_hz':48000,'channels':1,'target_duration_seconds':45.0,'minimum_tail_silence_seconds':0.10,'segments':[]}
    manifest_path=ROOT/'narration_segments.json'
    timeline=array.array('h',[0])*2160000
    for i,(start,end,original) in enumerate(SEGMENTS,1):
        text=original; raw=synthesize(i,text,'original'); d=duration(raw)
        target=end-start-0.12
        if d/target>1.25:
            text=SHORT[i]
            raw=synthesize(i,text,'short'); d=duration(raw)
        tempo=max(1.0,d/target)
        assert tempo<=1.25, f'Segment {i} still too long; shorten text, never truncate'
        fitted=fitdir/f'{i:02d}.wav'
        if tempo==1:
            shutil.copyfile(raw,fitted)
        else:
            subprocess.run(['ffmpeg','-y','-v','error','-i',str(raw),'-af',f'atempo={tempo:.9f}','-ar','48000','-ac','1','-c:a','pcm_s16le',str(fitted)],check=True)
        samples=pcm(fitted)
        # atempo has small block-length rounding differences: retry with a
        # slightly higher factor, rather than clipping the end of a sentence.
        for _ in range(3):
            if len(samples)/48000<=end-start-0.10:
                break
            tempo*= (len(samples)/48000)/target
            assert tempo<=1.25, f'Segment {i} cannot fit safely'
            subprocess.run(['ffmpeg','-y','-v','error','-i',str(raw),'-af',f'atempo={tempo:.9f}','-ar','48000','-ac','1','-c:a','pcm_s16le',str(fitted)],check=True)
            samples=pcm(fitted)
        assert len(samples)/48000<=end-start-0.10
        offset=round(start*48000)
        assert all(v==0 for v in timeline[offset:offset+len(samples)])
        timeline[offset:offset+len(samples)]=samples
        entry={'id':i,'slot_start':start,'slot_end':end,'text':text,'original_text':original,'text_shortened':text!=original,'voice_id':VOICE,'raw_wav':str(raw),'fitted_wav':str(fitted),'raw_duration_seconds':d,'atempo':tempo,'audio_start':start,'audio_end':start+len(samples)/48000,'fitted_duration_seconds':len(samples)/48000,'tail_silence_seconds':end-start-len(samples)/48000}
        manifest['segments'].append(entry); save_json(manifest_path,manifest)
        print(json.dumps({'segment':i,'raw_seconds':d,'atempo':round(tempo,5),'fitted_seconds':len(samples)/48000,'tail_seconds':entry['tail_silence_seconds'],'shortened':entry['text_shortened']},ensure_ascii=False),flush=True)
    assert len(manifest['segments'])==11 and len(timeline)==2160000
    peak=max(abs(x) for x in timeline); assert peak>0
    # Global attenuation only: preserve relative Azure segment loudness.
    gain=min(1.0,(32768*10**(-1.1/20))/peak)
    timeline=array.array('h',(round(v*gain) for v in timeline))
    final=ROOT/'narration_45s_48k_pcm.wav'; write_pcm(final,timeline)
    manifest['master_gain_db']=20*math.log10(gain)
    manifest['final_wav']=str(final)
    manifest['final_sha256']=hashlib.sha256(final.read_bytes()).hexdigest()
    manifest['complete']=True
    save_json(manifest_path,manifest)
    print(f'Complete: {final}',flush=True)

if __name__=='__main__':
    main()
