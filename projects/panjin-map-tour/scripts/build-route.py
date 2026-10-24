#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STOPS = [
    {"id": 1, "name": "盘锦站", "short": "盘锦站", "day": 1, "coordinates": [122.0568121, 41.1957096], "note": "抵达盘锦，开启湿地与人文之旅", "source": "OSM way 280842106"},
    {"id": 2, "name": "盘锦辽河碑林景区", "short": "辽河碑林", "day": 1, "coordinates": [122.0166052, 41.1863096], "note": "中国唯一不断代碑林，纵览书法文脉", "source": "OSM way 279938664"},
    {"id": 3, "name": "辽河湿地公园", "short": "湿地公园", "day": 1, "coordinates": [122.0524644, 41.1794330], "note": "沿辽河城市湿地慢行观景", "source": "OSM way 279990953"},
    {"id": 4, "name": "盘锦市博物馆", "short": "市博物馆", "day": 1, "coordinates": [122.0584942, 41.1298025], "note": "在明代兴隆台烽火台旧址读懂盘锦历史", "source": "OSM way 466912108; Panjin Government"},
    {"id": 5, "name": "盘锦广厦艺术街", "short": "广厦艺术街", "day": 1, "coordinates": [122.0975938, 41.1311983], "note": "书画、非遗与夜间城市生活", "source": "Amap GCJ-02 listing converted to WGS84; Liaoning Government"},
    {"id": 6, "name": "北旅田园·黑风关古镇", "short": "黑风关古镇", "day": 1, "coordinates": [122.1835022, 41.1112840], "note": "唐风古街与沉浸式夜游", "source": "OSM way 1468434669"},
    {"id": 7, "name": "田庄台镇", "short": "田庄台镇", "day": 2, "coordinates": [122.1316053, 40.8315494], "note": "镇区、小吃与甲午末战历史", "source": "OSM node 4616138133"},
    {"id": 8, "name": "盘锦江南风情园景区", "short": "江南风情园", "day": 2, "coordinates": [122.1585303, 40.7325603], "note": "辽东湾沿线的园林休闲空间", "source": "OSM way 466331066"},
    {"id": 9, "name": "红海滩国家风景廊道游客中心", "short": "红海滩游客中心", "day": 2, "coordinates": [121.8405810, 40.9006564], "note": "换乘景区交通，进入滨海湿地", "source": "OSM way 1111729147"},
    {"id": 10, "name": "红海滩国家风景廊道·踏霞漫步", "short": "踏霞漫步", "day": 2, "coordinates": [121.8446284, 40.8560035], "note": "在红滩、绿苇与稻田间收束旅程", "source": "OSM node 10171004880"},
]

coords = ";".join(f"{s['coordinates'][0]},{s['coordinates'][1]}" for s in STOPS)
url = f"https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson&steps=false&annotations=false"
response = subprocess.run(
    ["curl", "-fsSL", "--retry", "3", "--max-time", "120", "-A", "HermesAgent-PanjinRoute/1.0", url],
    check=True, capture_output=True, text=True,
)
payload = json.loads(response.stdout)
if payload.get("code") != "Ok" or not payload.get("routes"):
    raise SystemExit(f"OSRM failed: {payload.get('code')}")
route = payload["routes"][0]
snaps = [round(w["distance"], 1) for w in payload["waypoints"]]
route_anchors = [w["location"] for w in payload["waypoints"]]
if max(snaps) > 300:
    raise SystemExit(f"Waypoint snap too large: {max(snaps)}m")
legs = []
for i, leg in enumerate(route["legs"]):
    legs.append({
        "from": STOPS[i]["id"], "to": STOPS[i + 1]["id"],
        "distance_m": round(leg["distance"]),
        "drive_minutes": round(leg["duration"] / 60),
    })
itinerary = {
    "title": "盘锦湿地与人文经典自驾路线",
    "mode": "自驾/包车；红海滩景区内以现场交通规定为准",
    "days": 2,
    "total_distance_m": round(route["distance"]),
    "estimated_drive_minutes": round(route["duration"] / 60),
    "stops": [{
        **{k: v for k, v in s.items() if k != "coordinates"},
        "poi_coordinates": s["coordinates"],
        "coordinates": route_anchors[i],
        "anchor_kind": "OSRM road access point; marker and route share this coordinate",
        "snap_distance_m": snaps[i],
    } for i, s in enumerate(STOPS)],
    "legs": legs,
}
feature_collection = {
    "type": "FeatureCollection",
    "features": [
        {"type": "Feature", "properties": {"name": itinerary["title"], "mode": itinerary["mode"]}, "geometry": route["geometry"]},
        *[{"type": "Feature", "properties": {k: v for k, v in s.items() if k not in {"coordinates", "poi_coordinates"}}, "geometry": {"type": "Point", "coordinates": s["coordinates"]}} for s in itinerary["stops"]],
    ],
}
(ROOT / "data" / "route.geojson").write_text(json.dumps(feature_collection, ensure_ascii=False, indent=2) + "\n")
(ROOT / "data" / "itinerary.json").write_text(json.dumps(itinerary, ensure_ascii=False, indent=2) + "\n")
(ROOT / "qa").mkdir(exist_ok=True)
(ROOT / "qa" / "osrm-response-summary.json").write_text(json.dumps({
    "url": url,
    "code": payload["code"],
    "distance_m": route["distance"],
    "duration_s": route["duration"],
    "geometry_points": len(route["geometry"]["coordinates"]),
    "waypoint_snap_m": snaps,
    "route_anchors": route_anchors,
}, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"stops": len(STOPS), "distance_km": round(route["distance"] / 1000, 1), "drive_minutes": round(route["duration"] / 60), "geometry_points": len(route["geometry"]["coordinates"]), "max_snap_m": max(snaps)}, ensure_ascii=False))
