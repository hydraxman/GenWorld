"""Fresh Azure HD Flash narration; no video creation or external delivery."""
import sys,importlib.util,json,hashlib,subprocess,urllib.request,wave,math,time
from pathlib import Path
from datetime import datetime,timezone
from xml.sax.saxutils import escape
import numpy as np
ROOT=Path(__file__).resolve().parent
FILM=ROOT.parent.parent
spec=importlib.util.spec_from_file_location('old',FILM/'xiaoxiao2/synthesize_azure.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
source=FILM/'audio/narration_segments.json';src=json.loads(source.read_text())
assert len(src['segments'])==11
for name in ('raw','fitted','audit'): (ROOT/name).mkdir(exist_ok=True)
h.save(ROOT/'source_narration_segments.json',src)
resource=h.az_json('cognitiveservices','account','show','--resource-group','TTS','--name',h.RESOURCE,'--subscription',h.SUBSCRIPTION)
assert resource['location']==h.REGION and resource['kind']=='SpeechServices'
key=h.az_json('cognitiveservices','account','keys','list','--resource-group','TTS','--name',h.RESOURCE,'--subscription',h.SUBSCRIPTION)['key1']
def request(path,payload=None):
    req=urllib.request.Request(h.BASE+path,data=payload,headers={'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':h.FORMAT,'User-Agent':'Canon5D-ReplacementV3-VoiceAudit'})
    with urllib.request.urlopen(req,timeout=120) as r:return r.read(),r.status
body,status=request('/voices/list');voice=next(v for v in json.loads(body) if v.get('ShortName')==h.VOICE)
assert voice['Gender']=='Female' and voice['Locale']=='zh-CN'
h.save(ROOT/'voice_availability.json',{'checked_utc':datetime.now(timezone.utc).isoformat(),'http_status':status,'endpoint':h.BASE+'/voices/list','resource':h.RESOURCE,'region':h.REGION,'voice':voice})
manifest={'provider':'Azure Speech','voice_id':h.VOICE,'voice_gender_catalogue':'Female','generation':'fresh HTTPS requests; no cache or fallback','provider_rate':'default minimal SSML','sample_rate_hz':48000,'channels':1,'target_duration_seconds':45.,'source_manifest_sha256':h.sha(source),'segments':[],'complete':False}
x=np.zeros(2160000,dtype=np.int16)
for s in src['segments']:
    stem=f'{s["id"]:02d}';raw=ROOT/'raw'/f'{stem}.wav';meta=raw.with_suffix('.json')
    ssml=f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="{h.VOICE}">{escape(s["text"])}</voice></speak>'
    assert not raw.exists(),'Do not overwrite paid audio'
    body,status=request('/v1',ssml.encode());raw.write_bytes(body);raw.with_suffix('.ssml').write_text(ssml)
    data=h.pcm(raw);dur=len(data)/48000
    h.save(meta,{'voice_id':h.VOICE,'provider':'Azure Speech','http_status':status,'text':s['text'],'output_format':h.FORMAT,'wav_sha256':h.sha(raw),'request_sha256':hashlib.sha256((ssml+h.FORMAT+h.BASE).encode()).hexdigest(),'duration_seconds':dur,'generated_utc':datetime.now(timezone.utc).isoformat()})
    start,end=s['slot_start'],s['slot_end'];target=end-start-.12;tempo=max(1.,dur/target);fit=ROOT/'fitted'/f'{stem}.wav'
    for attempt in range(4):
        assert tempo<=1.45,'Tempo cap exceeded; do not truncate'
        subprocess.run(['ffmpeg','-y','-v','error','-xerror','-i',str(raw),'-af',f'atempo={tempo:.12f}','-ar','48000','-ac','1','-c:a','pcm_s16le',str(fit)],check=True)
        data=h.pcm(fit)
        if len(data)/48000<=end-start-.10:break
        tempo*=len(data)/48000/target
    assert len(data)/48000<=end-start-.10
    offset=round(start*48000);x[offset:offset+len(data)]=data
    row={k:s[k] for k in ('id','slot_start','slot_end','text')};row.update(voice_id=h.VOICE,raw_wav=str(raw),raw_sha256=h.sha(raw),fitted_wav=str(fit),fitted_sha256=h.sha(fit),raw_duration_seconds=dur,atempo=tempo,audio_start=start,audio_end=start+len(data)/48000,fitted_duration_seconds=len(data)/48000,tail_silence_seconds=end-start-len(data)/48000,text_shortened=False)
    manifest['segments'].append(row);h.save(ROOT/'narration_segments.json',manifest)
    print(json.dumps({'segment':s['id'],'http':status,'raw_seconds':dur,'atempo':tempo}),flush=True)
gain=min(1.,32768*10**(-2/20)/np.max(np.abs(x.astype(float))));x=np.rint(x.astype(float)*gain).astype(np.int16)
final=ROOT/'narration_45s_48k_pcm.wav';h.write_pcm(final,x)
subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(final),'-f','null','-'],check=True)
manifest.update(master_gain_db=20*math.log10(gain),final_wav=str(final),final_sha256=h.sha(final),complete=True)
h.save(ROOT/'narration_segments.json',manifest)
print(json.dumps({'ready':str(final),'sha256':h.sha(final),'samples':len(x),'max_atempo':max(s['atempo'] for s in manifest['segments'])}),flush=True)
