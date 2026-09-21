"""Rebuild measured voice slots and word-anchored calligraphy timing."""
import argparse,json,math,wave
from pathlib import Path
from verify import asset_path
R=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio-dir',type=Path,default=R/'audio')
    parser.add_argument('--output',type=Path,default=R/'output/rebuilt-timing.json')
    args=parser.parse_args()
    route=json.loads((R/'route.json').read_text());audio=json.loads((args.audio_dir/'manifest.json').read_text());byname={a['name']:a for a in audio};segments=[];voices=[];cur=0;fps=24

    def sound(a,start):
     with wave.open(str(asset_path(R,a['file']))) as w:sec=w.getnframes()/w.getframerate();assert w.getframerate()==48000
     voices.append(dict(id=a['id'],name=a['name'],start_frame=start,duration_seconds=sec,file=a['file'],voice=a['voice'],style=a['style']));return math.ceil(sec*fps)
    intro=byname['开场'];length=sound(intro,12)+48;segments.append(dict(kind='intro',start_frame=0,end_frame=length,d0=0,d1=0,stop_index=0));cur=length
    for i,s in enumerate(route['stops']):
     if i:
      d0=route['stops'][i-1]['distance_m'];d1=s['distance_m'];travel=round((3+min(4,(d1-d0)/190))*fps);segments.append(dict(kind='move',start_frame=cur,end_frame=cur+travel,d0=d0,d1=d1,stop_index=i));cur+=travel
     a=byname[s['name']];n=sound(a,cur+12);length=n+36;segments.append(dict(kind='hold',start_frame=cur,end_frame=cur+length,d0=s['distance_m'],d1=s['distance_m'],stop_index=i,voice_id=a['id']));cur+=length
     if s['name']=='水木清华':
      n=sound(byname['水木清华对联'],cur+24);segments.append(dict(kind='poem',start_frame=cur,end_frame=cur+n+72,d0=s['distance_m'],d1=s['distance_m'],stop_index=i,voice_id='couplet'));cur+=n+72
    outro=byname['收尾'];n=sound(outro,cur+12);segments.append(dict(kind='outro',start_frame=cur,end_frame=cur+n+48,d0=route['total_m'],d1=route['total_m'],stop_index=11));cur+=n+48
    cp=json.loads((R/'research/couplet-and-history.json').read_text())['couplet'];canonical=cp['upper']+cp['lower'];record=byname['水木清华对联'];chars=[]
    # SDK textOffset can be -1 around sub aliases. Normalize only the observed
    # affected event texts, then require exact canonical text reconstruction.
    fix={'剑':'槛','\">槛外':'外','淡':'澹','寻':'洵','\">洵是':'是'}
    for b in record['boundaries']:
     if b['boundaryType']!='WordBoundary':continue
     text=fix.get(b['text'],b['text']);assert isinstance(text,str) and text;assert all('\u4e00'<=c<='\u9fff' for c in text),(b['text'],text)
     start=b['audioOffset']/1e7;duration=b['duration']/1e7
     for i,c in enumerate(text):chars.append(dict(char=c,audio_time=start+i*duration/len(text)))
    assert ''.join(c['char'] for c in chars)==canonical
    out=dict(fps=fps,total_frames=cur,duration_seconds=cur/fps,segments=segments,voices=voices,couplet=dict(upper=cp['upper'],lower=cp['lower'],characters=chars,method='Azure WordBoundary anchored; equal subdivision inside multi-character word events; sub aliases normalized and exact canonical text asserted'))
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps({'duration_seconds':cur/fps,'frames':cur,'stops':len(route['stops']),'voices':len(voices),'couplet_chars':len(chars)},ensure_ascii=False))

if __name__=='__main__':
    main()
