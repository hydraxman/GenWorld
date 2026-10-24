"""Freeze nearby OSM geometry in the same ENU frame as the existing Shunde model."""
import argparse
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("--source-url", required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[4]
reference = json.loads((root / "projects/shunde/docs/courtyard/source-footprint.json").read_text("utf-8"))
origin = reference["coordinate_system"]["origin_lon_lat_height"]


def ecef(lon, lat):
    lam, phi = math.radians(lon), math.radians(lat)
    e2 = 1 - (1 - 1 / 298.257223563) ** 2
    n = 6378137 / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    return (n * math.cos(phi) * math.cos(lam), n * math.cos(phi) * math.sin(lam),
            n * (1 - e2) * math.sin(phi))


base = ecef(*origin[:2])
lam, phi = map(math.radians, origin[:2])


def project(lon, lat):
    x, y, z = [a - b for a, b in zip(ecef(lon, lat), base)]
    east = -math.sin(lam) * x + math.cos(lam) * y
    north = -math.sin(phi) * math.cos(lam) * x - math.sin(phi) * math.sin(lam) * y + math.cos(phi) * z
    return [round(east, 4), round(-north, 4)]


raw = args.source.read_bytes()
if raw.lstrip().startswith(b"{"):
    elements = json.loads(raw)["elements"]
else:
    document = ET.fromstring(raw)
    elements = []
    for element in document:
        if element.tag not in ("node", "way"):
            continue
        record = {"type": element.tag, "id": int(element.attrib["id"]),
                  "tags": {t.attrib["k"]: t.attrib["v"] for t in element.findall("tag")}}
        if element.tag == "node":
            record.update(lat=float(element.attrib["lat"]), lon=float(element.attrib["lon"]))
        else:
            record["nodes"] = [int(n.attrib["ref"]) for n in element.findall("nd")]
        elements.append(record)
nodes = {e["id"]: e for e in elements if e["type"] == "node"}


def clip_segment(a, b, bound=420):
    lo, hi = 0., 1.
    dx, dz = b[0] - a[0], b[1] - a[1]
    for p, q in [(-dx, a[0] + bound), (dx, bound - a[0]),
                 (-dz, a[1] + bound), (dz, bound - a[1])]:
        if p == 0:
            if q < 0:
                return None
        elif p < 0:
            lo = max(lo, q / p)
        else:
            hi = min(hi, q / p)
        if lo > hi:
            return None
    return [[round(a[0] + u * dx, 4), round(a[1] + u * dz, 4)] for u in (lo, hi)]


buildings, roads, trees = [], [], []
for element in sorted(elements, key=lambda e: (e["type"], e["id"])):
    tags = element.get("tags", {})
    if element["type"] == "node" and tags.get("natural") == "tree":
        trees.append(project(element["lon"], element["lat"]))
    if element["type"] != "way":
        continue
    if "geometry" in element:
        points = [project(p["lon"], p["lat"]) for p in element["geometry"]]
    else:
        refs = element["nodes"]
        if any(n not in nodes for n in refs):
            raise ValueError(f"OSM way {element['id']} has missing nodes; obtain a complete map extract")
        points = [project(nodes[n]["lon"], nodes[n]["lat"]) for n in refs]
    if not points:
        continue
    if (tags.get("building") not in (None, "no") and element["id"] != 84653293
            and min(math.hypot(*p) for p in points) <= 390):
        if points[0] != points[-1]:
            raise ValueError(f"Building way {element['id']} is not a closed footprint")
        if len(points) < 4:
            raise ValueError(f"Building way {element['id']} has too few points")
        height = tags.get("height", "")
        levels = tags.get("building:levels", "")
        if re.fullmatch(r"\d+(?:\.\d+)?(?:\s*m)?", height):
            estimate, status = float(height.rstrip("m ")), "OSM height tag, not independently surveyed"
        elif re.fullmatch(r"\d+(?:\.\d+)?", levels):
            estimate, status = float(levels) * 3.4 + 1, "estimated from OSM levels at 3.4m per level"
        else:
            estimate, status = 15, "illustrative 15m height; source has no usable height"
        buildings.append({"id": element["id"], "name": tags.get("name", ""), "points": points[:-1],
                          "height": estimate, "heightStatus": status, "tags": tags})
    if "highway" in tags and tags["highway"] not in ("steps", "proposed", "construction"):
        if tags.get("area") == "yes":
            if all(max(map(abs, p)) <= 420 for p in points):
                roads.append({"id": element["id"], "kind": tags["highway"], "area": True,
                              "name": tags.get("name", ""), "points": points})
        else:
            for a, b in zip(points, points[1:]):
                segment = clip_segment(a, b)
                if segment:
                    roads.append({"id": element["id"], "kind": tags["highway"], "area": False,
                                  "name": tags.get("name", ""), "points": segment})
result = {
    "sourceUrl": args.source_url,
    "sourceSha256": hashlib.sha256(raw).hexdigest(),
    "license": "ODbL 1.0; © OpenStreetMap contributors",
    "copyrightUrl": "https://www.openstreetmap.org/copyright",
    "origin": origin, "coordinates": "x=East, z=-North; same ECEF-to-ENU as source model",
    "limitations": "Context massing only. Multipolygon building relations omitted, not filled across holes; facades, roof treatments, road widths and tree shapes are illustrative. Centerlines clipped to +/-420m; incomplete pedestrian areas omitted. No invented campus landmarks.",
    "buildings": buildings, "roads": roads, "trees": trees,
}
destination = root / "projects/shunde/docs/campus-context.json"
destination.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(json.dumps({"buildings": len(buildings), "roads": len(roads), "trees": len(trees),
                  "output": str(destination)}, ensure_ascii=False))
