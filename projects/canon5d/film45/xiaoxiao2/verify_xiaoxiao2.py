#!/usr/bin/env python3
"""Acceptance checks: exact source text, timing, PCM and copied video."""
import hashlib
import json
import math
import subprocess
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent/'audio/narration_segments.json'
OLD_VIDEO = ROOT.parent/'canon5d-45s-chat.mp4'
VIDEO = ROOT/'canon5d-45s-xiaoxiao2.mp4'
VOICE = 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural'

def digest(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def run(*args):
    return subprocess.check_output(args, stderr=subprocess.PIPE)

def pcm(p):
    with wave.open(str(p), 'rb') as w:
        assert (w.getframerate(),w.getnchannels(),w.getsampwidth()) == (48000,1,2)
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').copy()

def levels(x, scale=32768):
    v=x.astype(np.float64)/scale
    return {'sample_count':len(v),'duration_seconds':len(v)/48000,
            'peak_dbfs':float(20*np.log10(np.max(np.abs(v)))),
            'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(v*v)))),
            'clipped_samples':int(np.sum(np.abs(v)>=1-1/32768))}

def strict(p):
    r=subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(p),'-f','null','-'],capture_output=True,text=True)
    assert r.returncode==0 and not r.stderr.strip(), (str(p),r.stderr)

def main():
    source=json.loads(SOURCE.read_text())
    m=json.loads((ROOT/'narration_segments.json').read_text())
    frozen=json.loads((ROOT/'source_snapshot.json').read_text())
    assert digest(SOURCE)==frozen['manifest_sha256']==m['source_manifest_sha256']
    assert digest(OLD_VIDEO)==frozen['video_sha256']
    assert m['complete'] and m['voice_id']==VOICE
    voice=json.loads((ROOT/'voice_availability.json').read_text())
    assert voice['http_status']==200 and voice['voice']['ShortName']==VOICE
    assert voice['voice']['Gender']=='Female'
    assert len(m['segments'])==len(source['segments'])==11
    master=pcm(m['final_wav']); assert len(master)==2160000
    assert digest(m['final_wav'])==m['final_sha256']
    expected=np.zeros(len(master),dtype=np.int16)
    gain=10**(m['master_gain_db']/20)
    reports=[]
    for s,old in zip(m['segments'],source['segments']):
        assert (s['id'],s['text'],s['slot_start'],s['slot_end'])==(old['id'],old['text'],old['slot_start'],old['slot_end'])
        assert s['text']==s['original_text'] and s['text_shortened'] is False
        assert 1<=s['atempo']<=1.45 and s['voice_id']==VOICE
        raw=pcm(s['raw_wav']); fit=pcm(s['fitted_wav'])
        meta=json.loads(Path(s['raw_wav']).with_suffix('.json').read_text())
        assert meta['text']==old['text'] and meta['voice_id']==VOICE and meta['http_status']==200
        assert meta['wav_sha256']==digest(s['raw_wav'])
        import xml.etree.ElementTree as ET
        ssml=Path(s['raw_wav']).with_suffix('.ssml').read_text()
        assert ''.join(ET.fromstring(ssml).itertext())==old['text']
        assert 'prosody' not in ssml
        assert hashlib.sha256((ssml+meta['output_format']+meta['base_endpoint']).encode()).hexdigest()==meta['request_sha256']
        assert len(fit)/48000<=s['slot_end']-s['slot_start']-0.10+1/48000
        assert abs(s['audio_end']-(s['slot_start']+len(fit)/48000))<1/48000
        a=round(s['slot_start']*48000); b=a+len(fit)
        assert np.all(expected[a:b]==0)
        expected[a:b]=np.rint(fit.astype(float)*gain).astype(np.int16)
        assert np.all(master[b:round(s['slot_end']*48000)]==0)
        rl,fl=levels(raw),levels(fit)
        assert rl['clipped_samples']==fl['clipped_samples']==0
        strict(s['raw_wav']); strict(s['fitted_wav'])
        reports.append({'id':s['id'],'text':s['text'],'text_exact':True,'slot_start':s['slot_start'],'slot_end':s['slot_end'],'raw':rl,'fitted':fl,'atempo':s['atempo'],'tail_silence_seconds':s['slot_end']-s['audio_end']})
    assert np.array_equal(expected,master)
    ml=levels(master); assert ml['clipped_samples']==0 and ml['peak_dbfs']<=-1
    strict(m['final_wav']); strict(VIDEO)
    probe=json.loads(run('ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(VIDEO)))
    v=next(s for s in probe['streams'] if s['codec_type']=='video')
    a=next(s for s in probe['streams'] if s['codec_type']=='audio')
    assert (v['width'],v['height'],v['r_frame_rate'],v['nb_read_frames'])==(1280,720,'24/1','1080')
    assert float(probe['format']['duration'])==float(v['duration'])==float(a['duration'])==45
    assert a['sample_rate']=='48000' and a['channels']==1
    def vh(p):
        return run('ffmpeg','-v','error','-i',str(p),'-map','0:v:0','-c:v','copy','-f','hash','-hash','sha256','-').decode().strip()
    old_hash,new_hash=vh(OLD_VIDEO),vh(VIDEO); assert old_hash==new_hash
    decoded=np.frombuffer(run('ffmpeg','-v','error','-xerror','-i',str(VIDEO),'-map','0:a:0','-f','f32le','-ar','48000','-ac','1','-'),dtype='<f4')
    assert len(decoded)>=len(master)
    decoded=decoded[:len(master)]
    corr=float(np.corrcoef(master,decoded)[0,1]); assert corr>0.99
    dl=levels(decoded,1); assert dl['clipped_samples']==0
    for r,s in zip(reports,m['segments']):
        start=round(s['slot_start']*48000); end=round(s['audio_end']*48000)
        r['mp4_to_wav_correlation']=float(np.corrcoef(master[start:end],decoded[start:end])[0,1])
        assert r['mp4_to_wav_correlation']>0.99
    loud=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(VIDEO),'-af','ebur128=peak=true:framelog=verbose','-f','null','-'],capture_output=True,text=True,check=True)
    (ROOT/'loudness_ebur128.txt').write_text(loud.stderr)
    report={'verified':True,'voice_id':VOICE,'gender':voice['voice']['Gender'],'live_voice_list_http_status':200,'segment_count':len(reports),'all_source_text_exact':True,'all_original_slots_exact':True,'sample_exact_pcm_assembly':True,'source_manifest_and_old_video_unchanged':True,'ssml_rate':'provider default; no prosody','maximum_atempo':max(s['atempo'] for s in m['segments']),'video':{'path':str(VIDEO),'duration_seconds':45,'width':1280,'height':720,'fps':24,'decoded_frames':1080,'strict_full_decode':True,'copied_video_stream_hash_equal':True,'source_video_stream_hash':old_hash,'new_video_stream_hash':new_hash,'sha256':digest(VIDEO)},'wav':{'path':m['final_wav'],'sha256':digest(m['final_wav']),'sample_rate_hz':48000,'codec':'pcm_s16le','channels':1,**ml},'mp4_audio':{'codec':a['codec_name'],'correlation_to_new_wav':corr,**dl},'segments':reports,'scope_note':'Text verified against source and actual submitted SSML; no ASR or human listening assessment claimed. Existing visual and subtitle frames are bitstream-identical.'}
    (ROOT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:val for k,val in report.items() if k!='segments'},ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
