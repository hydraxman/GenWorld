#!/usr/bin/env python3
"""Read-only acceptance checks for the real Azure narration artifacts."""
import array
import json
import math
import subprocess
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def inspect(path):
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))
    stream = probe['streams'][0]
    assert stream['codec_name'] == 'pcm_s16le'
    assert stream['sample_rate'] == '48000' and stream['channels'] == 1
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(path), '-f', 'null', '-'], check=True, capture_output=True)
    with wave.open(str(path), 'rb') as w:
        assert (w.getframerate(), w.getsampwidth(), w.getnchannels()) == (48000, 2, 1)
        frames = w.getnframes()
        samples = array.array('h', w.readframes(frames))
    peak = max(abs(v) for v in samples)
    rms = math.sqrt(sum(v*v for v in samples)/len(samples))
    assert peak > 0
    return {'path': str(path), 'frames': frames, 'duration_seconds': frames/48000, 'sample_peak_dbfs': 20*math.log10(peak/32768), 'rms_dbfs': 20*math.log10(rms/32768), 'clipped_samples': sum(abs(v)>=32767 for v in samples), 'decode_ok': True}

def main():
    data = json.loads((ROOT/'narration_segments.json').read_text())
    assert data['voice_id'] == 'zh-CN-YunxiNeural'
    assert len(data['segments']) == 11
    expected = [(0,8),(8,12),(12,16),(16,19),(19,23),(23,25.5),(25.5,28.5),(28.5,31),(31,36),(36,42),(42,45)]
    reports = []
    for s, (start,end) in zip(data['segments'], expected):
        assert (s['slot_start'],s['slot_end']) == (start,end)
        assert 1 <= s['atempo'] <= 1.25
        raw = inspect(Path(s['raw_wav']))
        fitted = inspect(Path(s['fitted_wav']))
        assert fitted['duration_seconds'] <= end-start-0.10 + 1/48000
        assert raw['clipped_samples'] == fitted['clipped_samples'] == 0
        reports.append({'id': s['id'], 'raw': raw, 'fitted': fitted, 'tail_silence_seconds': end-start-fitted['duration_seconds']})
    final = inspect(ROOT/'narration_45s_48k_pcm.wav')
    assert final['frames'] == 2160000
    assert final['sample_peak_dbfs'] <= -1.0 and final['clipped_samples'] == 0
    def samples_from(path):
        with wave.open(str(path), 'rb') as w:
            return array.array('h', w.readframes(w.getnframes()))
    expected_pcm = array.array('h', [0])*2160000
    gain = 10**(data['master_gain_db']/20)
    for s in data['segments']:
        values = array.array('h', (round(v*gain) for v in samples_from(s['fitted_wav'])))
        offset = round(s['slot_start']*48000)
        expected_pcm[offset:offset+len(values)] = values
    assert expected_pcm == samples_from(data['final_wav'])
    loudness = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', data['final_wav'], '-af', 'ebur128=peak=true:framelog=verbose', '-f', 'null', '-'],capture_output=True,text=True,check=True)
    (ROOT/'loudness_ebur128.txt').write_text(loudness.stderr)
    report = {'verified': True, 'voice_id': data['voice_id'], 'segment_count':len(reports), 'sample_exact_slot_placement':True, 'final':final, 'segments':reports}
    (ROOT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'verified':True,'voice_id':data['voice_id'],'segments':len(reports),'final':final},ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
