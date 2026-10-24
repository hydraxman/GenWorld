#!/usr/bin/env python3
import html,json,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'data/narration.json').read_text());schedule=json.loads((ROOT/'data/narration-schedule.json').read_text());meta=json.loads((ROOT/'audio_meta.json').read_text());page=(ROOT/'public/index.html').read_text();errors=[]
source_only='--source-only' in sys.argv
segs=schedule['segments'];total=schedule['total_duration_s']
if len(source)!=len(segs):errors.append('segment_count')
if abs(segs[0]['start_s']-schedule['lead_s'])>1e-6:errors.append('lead')
for i,(a,b) in enumerate(zip(source,segs)):
    if a['id']!=b['id'] or a['text']!=b['text'] or a['stop_id']!=b['stop_id']:errors.append(f'source_schedule_{i}')
    if not (b['start_s']<b['speech_end_s']<b['end_s']):errors.append(f'window_{i}')
    if i and abs(segs[i-1]['end_s']-b['start_s'])>1e-6:errors.append(f'continuity_{i}')
    ssml=(ROOT/b['ssml']).read_text()
    if 'voice name="zh-CN-XiaoxiaoNeural"' not in ssml or 'style="friendly"' not in ssml or 'styledegree="1.06"' not in ssml:errors.append(f'ssml_voice_{i}')
    spoken=html.unescape(re.sub(r'<[^>]+>','',re.sub(r'<break[^>]*/>','',ssml)))
    if a['text'] not in spoken:errors.append(f'ssml_text_{i}')
if total-segs[-1]['end_s']<0 or total-segs[-1]['end_s']>1/24+.001:errors.append('frame_alignment_tail')
if "document.getElementById('activeCaption').textContent=(t>=seg.start_s&&t<=seg.speech_end_s)?seg.text:''" not in page:errors.append('caption_not_verbatim_from_schedule')
if meta.get('provider')!='Azure Speech' or meta.get('voice')!='zh-CN-XiaoxiaoNeural' or meta.get('style')!='friendly' or meta.get('gender')!='Female':errors.append('audio_lineage')
duration=None
if not source_only:
    audio=ROOT/meta['master']
    if not audio.is_file():errors.append('audio_master_missing')
    else:
        duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(audio)],text=True))
        if abs(duration-total)>1/48000+.001:errors.append('audio_timeline_duration')
result={'mode':'source-only' if source_only else 'full','segments':len(segs),'timeline_duration_s':total,'audio_duration_s':duration,'voice':meta.get('voice'),'gender':meta.get('gender'),'style':meta.get('style'),'style_degree':meta.get('style_degree'),'rate':meta.get('rate'),'pitch':meta.get('pitch'),'caption_source':'schedule segment text verbatim','errors':errors,'pass':not errors}
(ROOT/'qa').mkdir(exist_ok=True);(ROOT/'qa/narration-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False));raise SystemExit(0 if not errors else 1)
