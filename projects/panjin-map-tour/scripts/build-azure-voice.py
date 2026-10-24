#!/usr/bin/env python3
from __future__ import annotations
import hashlib, html, json, math, os, re, subprocess, time, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
VOICE='zh-CN-XiaoxiaoNeural'; STYLE='friendly'; STYLE_DEGREE='1.06'; RATE='+2%'; PITCH='+0%'; FPS=24
WORK=ROOT/'audio-work'; RAW=WORK/'raw'; WAV=WORK/'wav'; SSML=WORK/'ssml'; PUBLIC=ROOT/'public'/'audio'
for p in [RAW,WAV,SSML,PUBLIC]:p.mkdir(parents=True,exist_ok=True)

def load_env():
    values=dict(os.environ)
    candidates=[]
    if os.environ.get('AZURE_SPEECH_ENV_FILE'):
        candidates.append(Path(os.environ['AZURE_SPEECH_ENV_FILE']).expanduser())
    candidates.append(ROOT/'.env')
    for env_file in candidates:
        if not env_file.is_file():continue
        for line in env_file.read_text().splitlines():
            line=line.strip()
            if not line or line.startswith('#') or '=' not in line:continue
            k,v=line.split('=',1);values.setdefault(k.strip(),v.strip().strip('"').strip("'"))
    missing=[k for k in ('AZURE_SPEECH_KEY','AZURE_SPEECH_REGION') if not values.get(k)]
    if missing:
        raise SystemExit('Missing Azure configuration: '+', '.join(missing)+'. Set environment variables or AZURE_SPEECH_ENV_FILE.')
    return values

def run(args,capture=False):
    r=subprocess.run(args,check=True,capture_output=capture,text=capture)
    return r.stdout.strip() if capture else ''

def duration(path):
    return float(run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(path)],True))

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()

def ssml_for(text):
    escaped=html.escape(text).replace('。','。<break time="260ms"/>').replace('；','；<break time="180ms"/>')
    return ('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            'xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">'
            f'<voice name="{VOICE}"><mstts:express-as style="{STYLE}" styledegree="{STYLE_DEGREE}">'
            f'<prosody rate="{RATE}" pitch="{PITCH}">{escaped}</prosody>'
            '</mstts:express-as></voice></speak>')

def synth(endpoint,key,ssml,out):
    req=urllib.request.Request(endpoint,data=ssml.encode(),method='POST',headers={
        'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml',
        'X-Microsoft-OutputFormat':'audio-48khz-192kbitrate-mono-mp3','User-Agent':'HermesPanjinTourV3'})
    last=None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req,timeout=90) as r:payload=r.read()
            if len(payload)<2000:raise RuntimeError('Azure returned an implausibly small audio payload')
            out.write_bytes(payload);return
        except Exception as e:
            last=e
            if attempt==2:raise
            time.sleep(2**attempt)
    raise RuntimeError(last)

def silence(path,seconds):
    run(['ffmpeg','-y','-v','error','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',f'{seconds:.6f}','-c:a','pcm_s16le',str(path)])

cfg=load_env();key=cfg['AZURE_SPEECH_KEY'];region=cfg['AZURE_SPEECH_REGION'].lower()
if not re.fullmatch(r'[a-z0-9]{2,32}',region):
    raise SystemExit('Invalid AZURE_SPEECH_REGION: expected a canonical Azure region slug')
voices_url=f'https://{region}.tts.speech.microsoft.com/cognitiveservices/voices/list'
with urllib.request.urlopen(urllib.request.Request(voices_url,headers={'Ocp-Apim-Subscription-Key':key}),timeout=60) as r:catalog=json.load(r)
voice=next(v for v in catalog if v.get('ShortName')==VOICE)
if voice.get('Gender')!='Female' or STYLE not in (voice.get('StyleList') or []):raise SystemExit('Required female voice/style is not available in live Azure catalog')
source=json.loads((ROOT/'data'/'narration.json').read_text())
records=[]
for i,seg in enumerate(source):
    ssml=ssml_for(seg['text']);ssml_path=SSML/f'{i:02d}-{seg["id"]}.ssml';ssml_path.write_text(ssml)
    mp3=RAW/f'{i:02d}-{seg["id"]}.mp3';synth(f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1',key,ssml,mp3)
    wav=WAV/f'{i:02d}-{seg["id"]}.wav';run(['ffmpeg','-y','-v','error','-i',str(mp3),'-ar','48000','-ac','2','-c:a','pcm_s16le',str(wav)])
    d=duration(wav)
    if not 2.0<d<30.0:raise SystemExit(f'Implausible stem duration {seg["id"]}: {d}')
    records.append({**seg,'raw_audio':str(mp3.relative_to(ROOT)),'wav':str(wav.relative_to(ROOT)),'ssml':str(ssml_path.relative_to(ROOT)),'duration_s':d,'sha256':sha(mp3)})

lead=0.8;final_hold=2.2;gap_default=1.0;special_gaps={'stop-6':1.8,'stop-8':1.4}
parts=[];lead_path=WAV/'silence-lead.wav';silence(lead_path,lead);parts.append(lead_path)
current=lead;schedule=[]
for i,r in enumerate(records):
    start=current;speech_end=start+r['duration_s'];gap=final_hold if i==len(records)-1 else special_gaps.get(r['id'],gap_default)
    end=speech_end+gap
    schedule.append({**r,'start_s':round(start,6),'speech_end_s':round(speech_end,6),'end_s':round(end,6),'gap_after_s':gap})
    parts.append(ROOT/r['wav'])
    gap_path=WAV/f'silence-after-{i:02d}.wav';silence(gap_path,gap);parts.append(gap_path)
    current=end

total=math.ceil(current*FPS)/FPS
extra=total-current
if extra>1e-6:
    extra_path=WAV/'silence-frame-align.wav';silence(extra_path,extra);parts.append(extra_path)
concat=WORK/'concat.txt';concat.write_text(''.join(f"file '{p.as_posix()}'\n" for p in parts))
joined=WORK/'joined.wav';run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(concat),'-c','copy',str(joined)])
normalized=WORK/'normalized.wav';run(['ffmpeg','-y','-v','error','-i',str(joined),'-af','loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000','-ar','48000','-ac','2','-c:a','pcm_s16le',str(normalized)])
master=PUBLIC/'narration-v3.wav';run(['ffmpeg','-y','-v','error','-i',str(normalized),'-af',f'apad,atrim=duration={total:.6f}','-t',f'{total:.6f}','-ar','48000','-ac','2','-c:a','pcm_s16le',str(master)])
meta={'provider':'Azure Speech','region':region,'voice':VOICE,'gender':voice.get('Gender'),'style':STYLE,'style_degree':float(STYLE_DEGREE),'rate':RATE,'pitch':PITCH,'sample_rate_hz':48000,'channels':2,'duration_s':duration(master),'timeline_duration_s':total,'segments':schedule,'master':str(master.relative_to(ROOT)),'master_sha256':sha(master),'live_style_list':voice.get('StyleList')}
(ROOT/'data'/'narration-schedule.json').write_text(json.dumps({'total_duration_s':total,'lead_s':lead,'segments':schedule},ensure_ascii=False,indent=2)+'\n')
(ROOT/'audio_meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'provider':meta['provider'],'voice':VOICE,'style':STYLE,'segments':len(schedule),'duration_s':meta['duration_s'],'master_sha256':meta['master_sha256']},ensure_ascii=False))
