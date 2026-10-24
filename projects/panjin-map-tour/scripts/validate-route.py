#!/usr/bin/env python3
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
it=json.loads((ROOT/'data/itinerary.json').read_text())
geo=json.loads((ROOT/'data/route.geojson').read_text())
line=next(f['geometry']['coordinates'] for f in geo['features'] if f['geometry']['type']=='LineString')
errors=[]
if len(it['stops'])!=10:errors.append('stop_count')
if len({s['name'] for s in it['stops']})!=10:errors.append('duplicate_stop')
for word in ['红海滩','辽河碑林','黑风关','田庄台','博物馆']:
    if not any(word in s['name'] for s in it['stops']):errors.append('missing_'+word)
if max(s['snap_distance_m'] for s in it['stops'])>300:errors.append('snap_distance')
if len(line)<600:errors.append('route_geometry_too_short')
if not (140000<=it['total_distance_m']<=155000):errors.append('distance_out_of_expected_range')
if not all(121.7<=s['coordinates'][0]<=122.3 and 40.65<=s['coordinates'][1]<=41.3 for s in it['stops']):errors.append('coordinate_outside_panjin_extent')
def point_segment_m(p,a,b):
    lat=math.radians((p[1]+a[1]+b[1])/3);sx=111320*math.cos(lat);sy=111320
    vx=(b[0]-a[0])*sx;vy=(b[1]-a[1])*sy;wx=(p[0]-a[0])*sx;wy=(p[1]-a[1])*sy
    vv=vx*vx+vy*vy;q=max(0,min(1,(wx*vx+wy*vy)/vv)) if vv else 0
    return math.hypot(wx-q*vx,wy-q*vy)
anchor_route_m=[min(point_segment_m(s['coordinates'],a,b) for a,b in zip(line,line[1:])) for s in it['stops']]
if max(anchor_route_m)>2:errors.append('marker_anchor_not_on_route')
if any(s.get('anchor_kind')!='OSRM road access point; marker and route share this coordinate' for s in it['stops']):errors.append('anchor_contract_missing')
result={'stops':len(it['stops']),'days':it['days'],'distance_km':round(it['total_distance_m']/1000,1),'drive_minutes':it['estimated_drive_minutes'],'route_points':len(line),'max_poi_to_road_anchor_m':max(s['snap_distance_m'] for s in it['stops']),'marker_to_route_m':[round(x,3) for x in anchor_route_m],'max_marker_to_route_m':round(max(anchor_route_m),3),'required_names':{w:any(w in s['name'] for s in it['stops']) for w in ['红海滩','辽河碑林','黑风关','田庄台','博物馆']},'errors':errors,'pass':not errors}
(ROOT/'qa').mkdir(exist_ok=True)
(ROOT/'qa/route-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
raise SystemExit(0 if not errors else 1)
