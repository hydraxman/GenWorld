#!/usr/bin/env python3
import argparse,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--states');parser.add_argument('--out');args=parser.parse_args()
states_path=Path(args.states) if args.states else (ROOT/'qa/camera-states.json' if (ROOT/'qa/camera-states.json').is_file() else ROOT/'baselines/camera-states.json')
out_path=Path(args.out) if args.out else ROOT/'qa/motion-validation.json'
states=json.loads(states_path.read_text())

def hav(a,b):
    lat=math.radians((a[1]+b[1])/2)
    return math.hypot((b[0]-a[0])*111320*math.cos(lat),(b[1]-a[1])*111320)

def ad(a,b):return abs((b-a+180)%360-180)
centers=[s['camera']['center'] for s in states];bearings=[s['camera']['bearing'] for s in states];progress=[s['progress'] for s in states]
steps=[hav(a,b) for a,b in zip(centers,centers[1:])];acc=[abs(b-a) for a,b in zip(steps,steps[1:])]
# Hard cuts: a one-frame center jump over 500m or zoom/pitch jump over conservative thresholds.
zoom_delta=[abs(b['camera']['zoom']-a['camera']['zoom']) for a,b in zip(states,states[1:])]
pitch_delta=[abs(b['camera']['pitch']-a['camera']['pitch']) for a,b in zip(states,states[1:])]
metrics={
 'frames':len(states),
 'bearing_range_deg':round(max(bearings)-min(bearings),6),
 'bearing_frame_delta_max_deg':round(max(ad(a,b) for a,b in zip(bearings,bearings[1:])),6),
 'center_step_max_m':round(max(steps),3),
 'center_accel_max_m_per_frame2':round(max(acc),3),
 'zoom_frame_delta_max':round(max(zoom_delta),6),
 'pitch_frame_delta_max_deg':round(max(pitch_delta),6),
 'progress_monotonic':all(b+1e-12>=a for a,b in zip(progress,progress[1:])),
 'hard_center_jumps_gt_500m':sum(x>500 for x in steps),
 'bearing_jumps_gt_0_1deg':sum(ad(a,b)>.1 for a,b in zip(bearings,bearings[1:])),
}
metrics['pass']=metrics['bearing_jumps_gt_0_1deg']==0 and metrics['hard_center_jumps_gt_500m']==0 and metrics['progress_monotonic'] and metrics['zoom_frame_delta_max']<.03 and metrics['pitch_frame_delta_max_deg']<.25
out_path.parent.mkdir(parents=True,exist_ok=True);out_path.write_text(json.dumps(metrics,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(metrics,ensure_ascii=False))
raise SystemExit(0 if metrics['pass'] else 1)
