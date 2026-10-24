from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage as ndi
import json,hashlib
p=Path(__file__).parent/'assets/leaves'
a=np.array(Image.open(p/'BaseColor.png').convert('RGB')).astype(float)
m=(a[:,:,1]>a[:,:,0]*1.01)&(a[:,:,1]>a[:,:,2]*1.055)&(a[:,:,1]>25)
m=ndi.binary_closing(m,iterations=2);labels,n=ndi.label(m);sizes=np.bincount(labels.ravel());sizes[0]=0;m=labels==sizes.argmax();m=ndi.binary_fill_holes(m)
# Retain the photographed blade; stem is constructed separately in the geometry.
m[945:]=False
rgba=Image.open(p/'BaseColor.png').convert('RGBA');rgba.putalpha(Image.fromarray((m*255).astype('uint8')));rgba.save(p/'maple-color.png')
# Build a real outline mesh from the silhouette, not a rectangular alpha card.
s=np.array(Image.fromarray((m*255).astype('uint8')).resize((256,256),Image.Resampling.NEAREST))>0
labels,n=ndi.label(s);sizes=np.bincount(labels.ravel());sizes[0]=0;s=ndi.binary_fill_holes(labels==sizes.argmax())
edges={}
def edge(a,b):edges.setdefault(a,[]).append(b)
for y,x in zip(*np.where(s)):
 if y==0 or not s[y-1,x]:edge((x,y),(x+1,y))
 if x==255 or not s[y,x+1]:edge((x+1,y),(x+1,y+1))
 if y==255 or not s[y+1,x]:edge((x+1,y+1),(x,y+1))
 if x==0 or not s[y,x-1]:edge((x,y+1),(x,y))
loops=[]
while edges:
 start=next(iter(edges));pts=[start];at=start
 for _ in range(10000):
  nxt=edges[at].pop()
  if not edges[at]:del edges[at]
  if nxt==start:break
  pts.append(nxt);at=nxt
 loops.append(pts)
pts=max(loops,key=len)
def rdp(points,eps):
 a,b=np.array(points[0]),np.array(points[-1]);v=b-a;l=np.linalg.norm(v)
 dist=[abs(np.cross(v,np.array(q)-a))/l if l else np.linalg.norm(np.array(q)-a) for q in points]
 i=int(np.argmax(dist))
 if dist[i]<=eps:return [points[0],points[-1]]
 return rdp(points[:i+1],eps)[:-1]+rdp(points[i:],eps)
mid=len(pts)//2;simple=rdp(pts[:mid+1],2.5)[:-1]+rdp(pts[mid:]+[pts[0]],2.5)[:-1]
outline=[[round(x/256,6),round(1-y/256,6)] for x,y in simple]
(p/'outline.json').write_text(json.dumps(outline))
source={'name':'Maple Leaf 01','author':'Dorian Zgraggen / cgbookcase','license':'CC0','page':'https://www.cgbookcase.com/textures/maple-leaf-01','license_evidence':'meta name=tex1:license content=cc0 in qa/sources/maple.html','maps':{k:{'url':f'https://cgbookcase.b-cdn.net/textures/thumbnails/MapleLeaf01_1K/MapleLeaf01_1K_{k}.png','sha256':hashlib.sha256((p/(k+'.png')).read_bytes()).hexdigest()} for k in ['BaseColor','Normal','Roughness']},'changes':'Derived opacity/silhouette from photographed green blade; curved outline geometry; DirectX normal Y inversion at runtime. Original 1K maps retained. Full 2K ZIP endpoint returned HTTP403; using accessible official 1K maps.'}
(p/'SOURCE.json').write_text(json.dumps(source,ensure_ascii=False,indent=2))
print({'outline_vertices':len(outline),'opaque_ratio':float(m.mean())})
preview=Image.new('RGB',rgba.size,'#ddd9d0');preview.paste(rgba,mask=rgba.getchannel('A'));preview.resize((768,768)).save(Path(__file__).parent/'qa/leaf-source-preview.jpg')
