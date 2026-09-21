"""Read back delivered GLB bytes, embedded assets and geometry contract."""
import hashlib, io, json, struct, os, sys
from pathlib import Path
from PIL import Image
root=Path(os.environ.get('SHUNDE_OUTPUT',str(Path.home()/'.hermes/outputs/shunde-courtyard-rebuild/delivery')))
p=Path(sys.argv[1]) if len(sys.argv)>1 else root/'Shunde-courtyard-context.glb'
data=p.read_bytes()
magic,version,total=struct.unpack_from('<III',data)
assert (magic,version,total)==(0x46546c67,2,len(data))
json_size,json_tag=struct.unpack_from('<II',data,12)
assert json_tag==0x4e4f534a
manifest=json.loads(data[20:20+json_size])
offset=20+json_size
binary_size,binary_tag=struct.unpack_from('<II',data,offset)
assert binary_tag==0x004e4942
blob=data[offset+8:offset+8+binary_size]
images=[]
for im in manifest['images']:
 assert 'uri' not in im, 'GLB must contain local embedded textures, not external imagery'
 v=manifest['bufferViews'][im['bufferView']]
 image=Image.open(io.BytesIO(blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]))
 image.load();images.append({'name':im.get('name'),'size':image.size,'mode':image.mode})
normal_primitives=0
for mesh in manifest['meshes']:
 for prim in mesh['primitives']:
  mat=manifest['materials'][prim['material']]
  if 'normalTexture' in mat:
   assert 'TANGENT' in prim['attributes'];normal_primitives+=1
   assert mat['normalTexture'].get('scale',1)>0
instances=0
for node in manifest['nodes']:
 ext=node.get('extensions',{}).get('EXT_mesh_gpu_instancing')
 if ext:instances+=manifest['accessors'][ext['attributes']['TRANSLATION']]['count']
qa=json.loads((root/'glb-verification.json').read_text())
assert instances==qa['glb']['instances']
# GLTFLoader creates an object per node primitive; a resource can be reused by
# multiple nodes (e.g. the same shrub mesh). Do not compare resource count to it.
mesh_objects=sum(len(manifest['meshes'][node['mesh']]['primitives'])
                 for node in manifest['nodes'] if 'mesh' in node)
assert mesh_objects==qa['glb']['meshes']
assert len(data)==qa['glb']['bytes']
report={'pass':True,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'version':version,'meshes':mesh_objects,'meshResources':len(manifest['meshes']),'materials':len(manifest['materials']),'embeddedImages':len(images),'normalMappedPrimitivesWithExplicitTangents':normal_primitives,'instances':instances,'images':images,'browserReadbackMatchesDisk':True}
(root/'glb-disk-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='images'},ensure_ascii=False,indent=2))
