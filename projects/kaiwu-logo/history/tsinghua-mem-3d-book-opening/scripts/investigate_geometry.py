from pathlib import Path
import json
import shapely
from shapely.geometry import Polygon,Point,MultiPolygon
from shapely.ops import unary_union,nearest_points
from shapely import make_valid,get_coordinates
P=Path(__file__).resolve().parent.parent
raw=json.loads((P/'inputs/source-polygons.json').read_text());sem=json.loads((P/'inputs/semantic-geometry.json').read_text())
a=unary_union([make_valid(Polygon(s['outer'],s['holes'])) for s in raw['shapes']]);b=unary_union([Polygon(s['outer'],s['holes']) for group in sem.values() for s in group])
print('Area',a.area,b.area,'sym difference',a.symmetric_difference(b).area,'hausdorff',a.hausdorff_distance(b))
records=[]
for name,src,target in [('source-to-partition',a,b),('partition-to-source',b,a)]:
 coords=get_coordinates(src);ds=shapely.distance(shapely.points(coords),target.boundary);i=ds.argmax();p=Point(coords[i]);q=nearest_points(p,target.boundary)[1];records.append({'direction':name,'maxBoundaryDistance':float(ds[i]),'at':list(coords[i]),'nearestBoundary':list(q.coords)[0],'distanceToFilledSolid':float(p.distance(target))});print(records[-1])
for tol in [1e-12,1e-10,1e-8,1e-6]:
 ag=shapely.set_precision(a,tol);bg=shapely.set_precision(b,tol);print(tol,ag.hausdorff_distance(bg),ag.symmetric_difference(bg).area)
(P/'qa/hausdorff-investigation.json').write_text(json.dumps({'rawHausdorff':a.hausdorff_distance(b),'rawSymmetricDifferenceArea':a.symmetric_difference(b).area,'extremeBoundaryPoints':records},indent=2))
