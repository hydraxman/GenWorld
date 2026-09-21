# Losslessly repack embedded PNGs; preserve all mesh/instance buffers and pixels.
import io,json,struct,hashlib
from pathlib import Path
from PIL import Image
p=Path('output/Courtyard3D.glb');b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);binary=b[28+n:];views=g['bufferViews'];images={im['bufferView'] for im in g['images']}
leaf_normal_views={g['images'][g['textures'][m['normalTexture']['index']]['source']]['bufferView'] for m in g['materials'] if m.get('name','').startswith('CC0') and 'normalTexture' in m}
out=bytearray();savings=0
for i,v in enumerate(views):
 raw=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
 if i in images:
  im=Image.open(io.BytesIO(raw))
  # glTF exposes one normal scale, unlike Three.js Vector2. Bake DX -> GL Y conversion.
  if i in leaf_normal_views:
   channels=list(im.split());channels[1]=channels[1].point(lambda x:255-x);im=Image.merge(im.mode,channels)
  buf=io.BytesIO();im.save(buf,format='PNG',optimize=True,compress_level=9);small=buf.getvalue()
  assert Image.open(io.BytesIO(small)).tobytes()==im.tobytes()
  if len(small)<len(raw) or i in leaf_normal_views:savings+=len(raw)-len(small);raw=small
 while len(out)%4:out.append(0)
 v['byteOffset']=len(out);v['byteLength']=len(raw);out.extend(raw)
while len(out)%4:out.append(0)
g['buffers'][0]['byteLength']=len(out);j=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode()
while len(j)%4:j+=b' '
data=struct.pack('<III',0x46546c67,2,28+len(j)+len(out))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(out),0x004e4942)+out
assert len(data)==struct.unpack_from('<I',data,8)[0]
p.with_name('Courtyard3D-v4.glb').write_bytes(data)
Path('qa/glb-repack.json').write_text(json.dumps({'original_bytes':len(b),'repacked_bytes':len(data),'image_bytes_saved':savings,'lossless_pixel_checks':len(images),'sha256':hashlib.sha256(data).hexdigest()},indent=2));print(Path('qa/glb-repack.json').read_text())
