import bpy,json,pathlib,sys
from mathutils import Vector
root=pathlib.Path(__file__).parent
bpy.ops.wm.open_mainfile(filepath=str(root/'canon_eos5d_mark_iv_original.blend'), use_scripts=False)
report={'blender':bpy.app.version_string,'scene_objects':len(bpy.context.scene.objects),'objects':[],'images':[],'materials':[]}
for o in bpy.data.objects:
 d={'name':o.name,'type':o.type,'location':list(o.location),'rotation':list(o.rotation_euler),'scale':list(o.scale),'parent':o.parent.name if o.parent else None,'dimensions':list(o.dimensions),'hide_render':o.hide_render,'collections':[c.name for c in o.users_collection]}
 if o.type=='MESH':
  d.update(vertices=len(o.data.vertices),polygons=len(o.data.polygons),materials=[m.name if m else None for m in o.data.materials],bbox_world=[list(o.matrix_world@Vector(c)) for c in o.bound_box],modifiers=[{'name':m.name,'type':m.type} for m in o.modifiers])
 report['objects'].append(d)
tex=root/'textures';tex.mkdir(exist_ok=True)
for i,img in enumerate(bpy.data.images):
 d={'name':img.name,'size':list(img.size),'source':img.source,'filepath':img.filepath,'packed':bool(img.packed_file)}
 if img.packed_file:
  raw=img.packed_file.data
  ext='.jpg' if raw.startswith(b'\xff\xd8\xff') else '.png' if raw.startswith(b'\x89PNG') else (pathlib.Path(img.filepath).suffix or '.bin'); dest=tex/(str(i)+'_'+bpy.path.clean_name(img.name)+ext)
  dest.write_bytes(raw);d['extracted_path']=str(dest)
 report['images'].append(d)
for mat in bpy.data.materials: report['materials'].append({'name':mat.name,'nodes':len(mat.node_tree.nodes) if mat.node_tree else 0})
report['mesh_count']=sum(o['type']=='MESH' for o in report['objects'])
report['polygons_total']=sum(o.get('polygons',0) for o in report['objects'])
(root/'inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('ASSET_REPORT',json.dumps({k:v for k,v in report.items() if k not in ['objects','materials']},ensure_ascii=False))
print('OBJECTS',[(o['name'],o.get('polygons'),o['dimensions']) for o in report['objects']])
# Separate review scene, never modify the GUI project or overwrite source.
scene=bpy.context.scene
for o in list(scene.objects):
 if o.type in {'CAMERA','LIGHT'}: bpy.data.objects.remove(o,do_unlink=True)
meshes=[o for o in scene.objects if o.type=='MESH' and not o.hide_render]
points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
lo=Vector([min(p[k] for p in points) for k in range(3)]);hi=Vector([max(p[k] for p in points) for k in range(3)])
center=(lo+hi)/2;dim=max(hi-lo)
scene.world=bpy.data.worlds.new('AssetReviewWorld');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.25,0.25,0.25,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
for idx,off in enumerate([(1,-1,2),(-1,-.4,1),(.2,1.4,1.4)]):
 bpy.ops.object.light_add(type='AREA',location=center+Vector(off)*dim)
 light=bpy.context.object;light.name='ReviewArea'+str(idx);light.data.energy=5;light.data.shape='DISK';light.data.size=dim*1.5;light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='ReviewCamera';scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=dim*1.6
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for label,off in [('front',(1,-1.8,1)),('rear',(-1,1.8,.8))]:
 cam.location=center+Vector(off)*dim*2;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(root/('validation_'+label+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'canon_eos5d_mark_iv_review.blend'))
