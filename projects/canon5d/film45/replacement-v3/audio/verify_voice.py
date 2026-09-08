"""Independent PCM and SSML audit; never infer human gender from pitch."""
import json,hashlib,subprocess,wave,math,xml.etree.ElementTree as ET
from datetime import datetime,timezone
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent;FILM=ROOT.parent.parent
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def load(p):return json.loads(Path(p).read_text())
def save(p,d):Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def pcm(p):
    r=subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(p),'-map','0:a:0','-ac','1','-ar','48000','-f','s16le','-'],capture_output=True,check=True)
    assert not r.stderr
    return np.frombuffer(r.stdout,dtype='<i2').copy()
def corr(a,b):
    n=min(len(a),len(b));return float(np.corrcoef(a[:n],b[:n])[0,1])
def stats(x):
    a=x.astype(float);return {'sample_count':len(a),'duration_seconds':len(a)/48000,'peak_dbfs':float(20*np.log10(np.abs(a).max()/32768)),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(a*a))/32768)),'clipped_samples':int(np.sum(np.abs(a)>=32767))}
src=load(FILM/'audio/narration_segments.json');prev=load(FILM/'xiaoxiao2/narration_segments.json');new=load(ROOT/'narration_segments.json')
assert len(src['segments'])==len(prev['segments'])==len(new['segments'])==11
oldwav=pcm(src['final_wav']);prevwav=pcm(prev['final_wav']);newwav=pcm(new['final_wav'])
oldvid=pcm(FILM/'canon5d-45s-chat.mp4');prevvid=pcm(FILM/'xiaoxiao2/canon5d-45s-xiaoxiao2.mp4')
report={'checked_utc':datetime.now(timezone.utc).isoformat(),'status':'verified signal lineage; perceptual listening not performed','voice_id':new['voice_id'],'live_catalogue':load(ROOT/'voice_availability.json'),'source_manifest_sha256':sha(FILM/'audio/narration_segments.json'),'local_audio_comparison':{'old_video_to_yunxi_master':corr(oldvid,oldwav),'previous_xiaoxiao2_video_to_xiaoxiao2_master':corr(prevvid,prevwav),'previous_xiaoxiao2_video_to_yunxi_master':corr(prevvid,oldwav),'old_and_previous_video_pcm_identical':bool(np.array_equal(oldvid,prevvid)),'new_master_to_yunxi_master':corr(newwav,oldwav),'new_master_to_previous_xiaoxiao2_master':corr(newwav,prevwav)},'files':[], 'segments':[], 'acceptance_boundary':{'fresh_azure_requests':True,'provider_voice_catalogue_gender':'Female','actual_audio_not_reused_yunxi':True,'human_listening':False,'asr':False,'audio_understanding_model':False,'human_gender_inference':False,'f0_gender_inference':False,'subjective_female_sound_guarantee':False,'note':'Female is Azure synthetic voice catalogue metadata, not inference of a real person or proof of user-perceived timbre. Signal comparison verifies actual decoded track replacement, not perceptual gender.'}}
for p in [FILM/'canon5d-45s-chat.mp4',FILM/'xiaoxiao2/canon5d-45s-xiaoxiao2.mp4',Path(src['final_wav']),Path(prev['final_wav']),Path(new['final_wav'])]:report['files'].append({'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)})
assembly=np.zeros(2160000,dtype='<i2')
for a,b,c in zip(src['segments'],prev['segments'],new['segments']):
    for k in ('id','text','slot_start','slot_end'):assert a[k]==b[k]==c[k]
    ns='{http://www.w3.org/2001/10/synthesis}'
    for seg in (b,c):
        raw=Path(seg['raw_wav']);meta=load(raw.with_suffix('.json'));tree=ET.parse(raw.with_suffix('.ssml'));v=tree.getroot().find(ns+'voice')
        assert ''.join(v.itertext())==a['text'];assert v.attrib['name']==new['voice_id'];assert sha(raw)==meta['wav_sha256'];assert meta['http_status']==200
    fit=pcm(c['fitted_wav']);start=round(c['slot_start']*48000);end=round(c['slot_end']*48000)
    assembly[start:start+len(fit)]=fit
    assert len(fit)<=end-start-4800
    x,y,z=pcm(a['raw_wav']),pcm(b['raw_wav']),pcm(c['raw_wav'])
    assert not np.array_equal(x,y) and not np.array_equal(x,z)
    sa,sb=start,end
    report['segments'].append({'id':a['id'],'text':a['text'],'slot_start':a['slot_start'],'slot_end':a['slot_end'],'source_and_actual_ssml_exact':True,'raw_previous_equal_yunxi':bool(np.array_equal(x,y)),'raw_new_equal_yunxi':bool(np.array_equal(x,z)),'raw_new_equal_previous':bool(np.array_equal(y,z)),'previous_mp4_to_previous_master_correlation':corr(prevvid[sa:sb],prevwav[sa:sb]),'previous_mp4_to_yunxi_master_correlation':corr(prevvid[sa:sb],oldwav[sa:sb]),'new_atempo':c['atempo'],'new_tail_silence_seconds':c['tail_silence_seconds'],'new_tail_all_zero':bool(not np.any(newwav[start+len(fit):end]))})
assembly=np.rint(assembly.astype(float)*10**(new['master_gain_db']/20)).astype('<i2')
assert np.array_equal(assembly,newwav);assert len(newwav)==2160000;assert sha(new['final_wav'])==new['final_sha256'];assert all(x['new_tail_all_zero'] for x in report['segments'])
report['new_master']={'path':new['final_wav'],'sha256':new['final_sha256'],**stats(newwav),'strict_decode':True,'source_segment_count':11,'sample_exact_assembly':True,'maximum_atempo':max(c['atempo'] for c in new['segments'])}
assert report['new_master']['clipped_samples']==0
save(ROOT/'voice_audit.json',report)
for name,data in [('old-yunxi-first-slot',oldvid[:8*48000]),('previous-xiaoxiao2-first-slot',prevvid[:8*48000]),('new-xiaoxiao2-first-slot',newwav[:8*48000])]:
    with wave.open(str(ROOT/'audit'/f'{name}.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(48000);w.writeframes(data.tobytes())
print(json.dumps({'new_master':report['new_master'],'local_audio_comparison':report['local_audio_comparison'],'min_previous_mp4_slot_correlation':min(x['previous_mp4_to_previous_master_correlation'] for x in report['segments'])},ensure_ascii=False,indent=2))
