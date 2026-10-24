from pathlib import Path
import json,math
from shapely.geometry import Polygon,Point,box
from shapely.ops import unary_union
from shapely import make_valid
P=Path(__file__).resolve().parent.parent
raw=json.loads((P/'inputs/source-polygons.json').read_text())
polys=[make_valid(Polygon(s['outer'],s['holes'])) for s in raw['shapes']]
source=unary_union(polys)
def cubic(a,b,c,d,n=90):
 return [((1-t)**3*a[0]+3*(1-t)**2*t*b[0]+3*(1-t)*t*t*c[0]+t**3*d[0],(1-t)**3*a[1]+3*(1-t)**2*t*b[1]+3*(1-t)*t*t*c[1]+t**3*d[1]) for t in [i/n for i in range(n+1)]]
# Cutting boundary follows the outside book; all white apertures remain source holes.
book=Polygon(cubic((145,180),(207,127),(264,126),(319,157))+cubic((319,157),(374,128),(433,130),(491,178))+[(491,447)]+cubic((491,447),(426,423),(374,435),(319,461))+cubic((319,461),(262,437),(203,433),(145,458)))
inner=Point(319.5,319.5).buffer(220.6,quad_segs=320)
rope=Point(319.5,319.5).buffer(282.2,quad_segs=360)
book=book.intersection(inner)
regions={'leftPage':book.intersection(box(-10,-10,319.3,650)), 'rightPage':book.intersection(box(319.3,-10,650,650)), 'circuits':inner.difference(book), 'letterBand':rope.difference(inner), 'braidedRim':box(-10,-10,650,650).difference(rope)}
parts={k:make_valid(source.intersection(r)) for k,r in regions.items()}
def polygons(g):
 if g.geom_type=='Polygon':return [g]
 return [p for c in getattr(g,'geoms',[]) for p in polygons(c)]
def encode(g,region):
 result=[]
 for p in polygons(g):
  if p.area<1e-8:continue
  outer=list(p.exterior.coords);holes=[list(h.coords) for h in p.interiors]
  # Artificial cutting edges remain straight, unbeveled mating surfaces.
  noBevel=[list(x) for ring in [outer]+holes for x in ring if Point(x).distance(region.boundary)<1e-6]
  result.append({'outer':outer,'holes':holes,'noBevel':noBevel})
 return result
data={k:encode(g,regions[k]) for k,g in parts.items()}
(P/'inputs/semantic-geometry.json').write_text(json.dumps(data,separators=(',',':')))
merged=unary_union(list(parts.values()))
report={'sourcePaths':raw['paths'],'sourceShapes':len(raw['shapes']),'sourceHoles':sum(len(s['holes']) for s in raw['shapes']),'sourceArea':source.area,'symmetricDifferenceArea':source.symmetric_difference(merged).area,'hausdorffErrorSourcePixels':source.hausdorff_distance(merged),'components':{k:{'polygons':len(data[k]),'area':v.area} for k,v in parts.items()},'hingeXSourcePixels':319.3,'sampling':'SVGLoader getPoints(16); all source transforms already applied','maskNote':'Semantic cut only; exact partition of sampled original solid, not a redraw'}
assert report['symmetricDifferenceArea']<1e-6
(P/'qa/geometry-partition.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
