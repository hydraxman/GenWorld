#!/usr/bin/env python3
"""Azure Xiaoxiao2 real synthesis, exact source text and original time slots.
Run --probe first; then no arguments to synthesize, fit and mux all 11.
Requires authenticated az CLI, numpy, ffmpeg and ffprobe. Keys stay in memory.
No substitutions, text shortening, prosody, pitch changes or video rendering.
"""
import argparse
import hashlib
import json
import math
import shutil
import subprocess
import time
import urllib.error
import urllib.request
import wave
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape
import numpy as np

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent/'audio/narration_segments.json'
OLD_VIDEO=ROOT.parent/'canon5d-45s-chat.mp4'
VOICE='zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural'
SUBSCRIPTION='76060559-0971-451d-a3cf-47d04c87e309'
RESOURCE='FilmmakerBsp'
REGION='eastus'
FORMAT='riff-48khz-16bit-mono-pcm'
BASE=f'https://{REGION}.tts.speech.microsoft.com/cognitiveservices'

def save(p,d):
    tmp=p.with_suffix(p.suffix+'.tmp')
    tmp.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
    tmp.replace(p)

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def az_json(*args):
    p=subprocess.run(['az',*args,'--output','json','--only-show-errors'],capture_output=True,text=True,timeout=90)
    if p.returncode:
        raise RuntimeError('Azure CLI failed; credential output suppressed')
    return json.loads(p.stdout)

def pcm(p):
    with wave.open(str(p),'rb') as w:
        assert (w.getnchannels(),w.getsampwidth(),w.getframerate())==(1,2,48000)
        return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').copy()

def write_pcm(p,x):
    with wave.open(str(p),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes(x.astype('<i2').tobytes())

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--probe',action='store_true')
    args=parser.parse_args()
    for cmd in ('az','ffmpeg','ffprobe'): assert shutil.which(cmd),cmd
    for name in ('raw','fitted'): (ROOT/name).mkdir(exist_ok=True)
    source=json.loads(SOURCE.read_text())
    assert len(source['segments'])==11
    snapshot={'manifest_path':str(SOURCE),'manifest_sha256':sha(SOURCE),'video_path':str(OLD_VIDEO),'video_sha256':sha(OLD_VIDEO)}
    snapshot_path=ROOT/'source_snapshot.json'
    if snapshot_path.exists(): assert json.loads(snapshot_path.read_text())==snapshot,'Source changed'
    else: save(snapshot_path,snapshot)
    frozen_path=ROOT/'source_narration_segments.json'
    if not frozen_path.exists(): shutil.copyfile(SOURCE,frozen_path)
    assert sha(frozen_path)==sha(SOURCE)
    resource=az_json('cognitiveservices','account','show','--resource-group','TTS','--name',RESOURCE,'--subscription',SUBSCRIPTION)
    assert resource['location']==REGION and resource['kind']=='SpeechServices'
    key=az_json('cognitiveservices','account','keys','list','--resource-group','TTS','--name',RESOURCE,'--subscription',SUBSCRIPTION)['key1']
    def request(path,payload=None):
        for attempt in range(4):
            req=urllib.request.Request(BASE+path,data=payload,headers={'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':FORMAT,'User-Agent':'Canon5D-Xiaoxiao2/1.0'})
            try:
                with urllib.request.urlopen(req,timeout=120) as r: return r.read(),r.status
            except urllib.error.HTTPError as e:
                if e.code not in (408,429,500,502,503,504) or attempt==3:
                    raise RuntimeError(f'Azure Speech HTTP {e.code}; response suppressed') from None
            except (urllib.error.URLError,TimeoutError):
                if attempt==3: raise RuntimeError('Azure Speech network failure; details suppressed') from None
            time.sleep(4*2**attempt)
    body,status=request('/voices/list')
    candidates=[v for v in json.loads(body) if 'xiaoxiao2' in v.get('ShortName','').lower()]
    voice=next((v for v in candidates if v['ShortName']==VOICE),None)
    assert voice and voice['Gender']=='Female' and voice['Locale']=='zh-CN',f'Required Xiaoxiao2 voice absent; candidates: {[v["ShortName"] for v in candidates]}'
    save(ROOT/'voice_availability.json',{'checked_utc':datetime.now(timezone.utc).isoformat(),'http_status':status,'endpoint':BASE+'/voices/list','resource':RESOURCE,'region':REGION,'voice':voice,'xiaoxiao2_candidates':candidates})
    print('Live catalogue confirmed: '+voice['ShortName']+' / '+voice['Gender'],flush=True)
    def synth(s):
        stem=f'{s["id"]:02d}'; wav=ROOT/'raw'/f'{stem}.wav'; meta=wav.with_suffix('.json')
        text=s['text']
        ssml=f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="{VOICE}">{escape(text)}</voice></speak>'
        fingerprint=hashlib.sha256((ssml+FORMAT+BASE).encode()).hexdigest()
        if wav.exists() and meta.exists():
            m=json.loads(meta.read_text())
            if m['request_sha256']==fingerprint and m['wav_sha256']==sha(wav): return wav
        body,status=request('/v1',ssml.encode())
        assert body[:4]==b'RIFF' and body[8:12]==b'WAVE'
        wav.write_bytes(body)  # Preserve paid audio before validation.
        wav.with_suffix('.ssml').write_text(ssml)
        samples=pcm(wav); duration=len(samples)/48000
        assert duration>0 and np.max(np.abs(samples.astype(float)))>0
        save(meta,{'provider':'Azure Speech','http_status':status,'voice_id':VOICE,'ssml_rate':None,'text':text,'output_format':FORMAT,'base_endpoint':BASE,'endpoint':BASE+'/v1','request_sha256':fingerprint,'wav_sha256':sha(wav),'duration_seconds':duration,'generated_utc':datetime.now(timezone.utc).isoformat()})
        print(json.dumps({'synthesized_segment':s['id'],'duration_seconds':duration,'http_status':status}),flush=True)
        return wav
    if args.probe:
        wav=synth(source['segments'][0]); x=pcm(wav)
        r=subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(wav),'-f','null','-'],capture_output=True,text=True)
        assert r.returncode==0 and not r.stderr.strip()
        report={'verified':True,'voice_id':VOICE,'http_status':200,'path':str(wav),'text':source['segments'][0]['text'],'duration_seconds':len(x)/48000,'sample_rate_hz':48000,'channels':1,'strict_decode':True,'peak_dbfs':float(20*np.log10(np.max(np.abs(x.astype(float)))/32768))}
        save(ROOT/'probe_verification.json',report); print(json.dumps(report,ensure_ascii=False,indent=2)); return
    assert json.loads((ROOT/'probe_verification.json').read_text())['verified'],'Run --probe first'
    raws=[synth(s) for s in source['segments']]
    measured=[{'id':s['id'],'raw_duration_seconds':len(pcm(raw))/48000,'slot_seconds':s['slot_end']-s['slot_start'],'required_atempo':max(1.,len(pcm(raw))/48000/(s['slot_end']-s['slot_start']-0.12))} for s,raw in zip(source['segments'],raws)]
    save(ROOT/'duration_measurements.json',measured)
    excessive=[x for x in measured if x['required_atempo']>1.45]
    if excessive:
        save(ROOT/'timing_blocker.json',{'status':'blocked','reason':'Original text cannot fit at <=1.45 atempo','segments':excessive})
        raise RuntimeError('Timing needs >1.45 atempo; see timing_blocker.json; no text changed')
    manifest={'provider':'Azure Speech','resource':RESOURCE,'region':REGION,'voice_id':VOICE,'ssml_rate':None,'provider_rate':'default; minimal SSML','output_format':'pcm_s16le','sample_rate_hz':48000,'channels':1,'target_duration_seconds':45.,'minimum_tail_silence_seconds':0.10,'source_manifest_sha256':sha(SOURCE),'source_video_sha256':sha(OLD_VIDEO),'segments':[],'complete':False}
    timeline=np.zeros(2160000,dtype=np.int16)
    for s,raw,meas in zip(source['segments'],raws,measured):
        start,end=s['slot_start'],s['slot_end']; target=end-start-0.12; tempo=meas['required_atempo']
        fit=ROOT/'fitted'/f'{s["id"]:02d}.wav'
        for attempt in range(4):
            assert tempo<=1.45,'Tempo cap exceeded; never truncate'
            if tempo==1: shutil.copyfile(raw,fit)
            else: subprocess.run(['ffmpeg','-y','-v','error','-i',str(raw),'-af',f'atempo={tempo:.12f}','-ar','48000','-ac','1','-c:a','pcm_s16le',str(fit)],check=True)
            x=pcm(fit)
            if len(x)/48000<=end-start-0.10: break
            tempo*=len(x)/48000/target
        assert len(x)/48000<=end-start-0.10
        offset=round(start*48000); assert not np.any(timeline[offset:offset+len(x)])
        timeline[offset:offset+len(x)]=x
        entry={'id':s['id'],'slot_start':start,'slot_end':end,'text':s['text'],'original_text':s['text'],'text_shortened':False,'voice_id':VOICE,'raw_wav':str(raw),'fitted_wav':str(fit),'raw_duration_seconds':meas['raw_duration_seconds'],'atempo':tempo,'audio_start':start,'audio_end':start+len(x)/48000,'fitted_duration_seconds':len(x)/48000,'tail_silence_seconds':end-start-len(x)/48000}
        manifest['segments'].append(entry); save(ROOT/'narration_segments.json',manifest)
        print(json.dumps({'fitted_segment':s['id'],'atempo':tempo,'seconds':len(x)/48000,'tail':entry['tail_silence_seconds']}),flush=True)
    peak=np.max(np.abs(timeline.astype(float))); gain=min(1.,32768*10**(-2/20)/peak)
    timeline=np.rint(timeline.astype(float)*gain).astype(np.int16)
    final=ROOT/'narration_45s_48k_pcm.wav'; write_pcm(final,timeline)
    manifest.update(master_gain_db=20*math.log10(gain),final_wav=str(final),final_sha256=sha(final),complete=True)
    save(ROOT/'narration_segments.json',manifest)
    output=ROOT/'canon5d-45s-xiaoxiao2.mp4'
    cmd=['ffmpeg','-y','-v','error','-i',str(OLD_VIDEO),'-i',str(final),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','1','-t','45','-map_metadata','0','-movflags','+faststart',str(output)]
    save(ROOT/'mux_command.json',cmd); subprocess.run(cmd,check=True)
    print('Created: '+str(output),flush=True)

if __name__=='__main__': main()
