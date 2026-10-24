"""Independent check of the right angle in actual exported roof vertices, not model metadata."""
import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--glb', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
data = a.glb.read_bytes()
assert struct.unpack_from('<III', data) == (0x46546C67, 2, len(data))
length, tag = struct.unpack_from('<II', data, 12)
assert tag == 0x4E4F534A
manifest = json.loads(data[20:20+length])
blen, btag = struct.unpack_from('<II', data, 20+length)
assert btag == 0x004E4942
blob = data[28+length:28+length+blen]
nodes = manifest['nodes']
parents = {c: i for i, node in enumerate(nodes) for c in node.get('children', [])}
roots = [i for i, node in enumerate(nodes) if node.get('name') == 'Nonrectangular roof cap']
assert len(roots) == 1, 'one current main roof cap required'
points = []
def inspect(i):
    node = nodes[i]
    k = i
    while True:
        assert not any(key in nodes[k] for key in ['matrix', 'translation', 'rotation', 'scale']), 'unexpected cap transform: inspect world coordinates explicitly'
        if k not in parents:
            break
        k = parents[k]
    if 'mesh' in node:
        for prim in manifest['meshes'][node['mesh']]['primitives']:
            accessor = manifest['accessors'][prim['attributes']['POSITION']]
            assert accessor['componentType'] == 5126 and accessor['type'] == 'VEC3'
            view = manifest['bufferViews'][accessor['bufferView']]
            start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
            stride = view.get('byteStride', 12)
            points.extend(struct.unpack_from('<fff', blob, start + j*stride) for j in range(accessor['count']))
    for c in node.get('children', []):
        inspect(c)
inspect(roots[0])
xmax = max(p[0] for p in points)
zmin, zmax = min(p[2] for p in points), max(p[2] for p in points)
eps = 1e-4
# A local cylindrical bulge may protrude left of the straight front edge.
xmin = min(p[0] for p in points if abs(p[2]-zmax) < eps)
def has(x, z):
    return any(abs(p[0]-x) < eps and abs(p[2]-z) < eps for p in points)
assert has(xmax,zmax), 'front-right corner missing'
assert has(xmin,zmax), 'straight front edge missing'
assert has(xmax,zmin), 'right side does not extend perpendicular to the rear tip'
u = (xmin-xmax, 0)
v = (0, zmin-zmax)
dot = sum(x*y for x,y in zip(u,v))
angle = math.degrees(math.acos(dot/(math.hypot(*u)*math.hypot(*v))))
assert abs(angle-90) < 1e-8
report = {'pass': True, 'evidence': 'actual embedded GLB roof POSITION accessors', 'sha256': hashlib.sha256(data).hexdigest(), 'roofVertices': len(points), 'frontRightXZ': [xmax,zmax], 'frontLeftXZ': [xmin,zmax], 'rearRightXZ': [xmax,zmin], 'rightAngleDegrees': angle, 'frontSpan': xmax-xmin, 'rightSideDepth': zmax-zmin, 'depthToFrontRatio': (zmax-zmin)/(xmax-xmin), 'dimensionsStatus': 'estimated working units, not survey measurements'}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
