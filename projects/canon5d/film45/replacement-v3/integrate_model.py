import bpy,bmesh,math,json
from mathutils import Vector,Matrix
from pathlib import Path
ROOT=str(Path(__file__).resolve().parent)
if 'Canon5D_Replacement_V3' not in bpy.data.scenes:
    bpy.context.window.scene=bpy.data.scenes['Canon5D_45s_Film'];bpy.ops.scene.new(type='FULL_COPY');bpy.context.scene.name='Canon5D_Replacement_V3'
s=bpy.data.scenes['Canon5D_Replacement_V3'];bpy.context.window.scene=s;s.frame_set(1)
assert not any(o.name.startswith('V3_Asset_') for o in s.objects)
old=list(s.objects)
def base(n):
    a,sep,b=n.rpartition('.')
    return a if sep and len(b)==3 and b.isdigit() else n
# Preserve teaching content, replace old exterior geometry and back controls.
removed=[]
for o in old:
    n=base(o.name)
    outer=any(c.name.startswith('CC_01_Outer_Shell') for c in o.users_collection)
    lensold=any(n.startswith('CC_'+p) for p in ['Far barrel','Removable barrel','Focus ring rib','Red L-series','Front lens rim'])
    controls=n.startswith('FILM_') and not any(n.startswith('FILM_'+p) for p in ['MainCamera','Progressive','Viewing ray','Exposure','Image forming','Object arrow','Inverted image','Electrical signal','Highlight','Shutter frame'])
    if outer or lensold or controls:
        o.animation_data_clear();o.hide_render=True;o.hide_viewport=True;removed.append(o.name)
    elif (n.startswith('CC_') or n.startswith('FILM_Shutter frame')) and o.type not in {'CAMERA','LIGHT'} and not any(c.name.startswith('CC_07_Stage') for c in o.users_collection) and not n.startswith('CC_Viewing light'):
        # New exterior fully owns the assembled shot. Old internals emerge on opening.
        initial=o.hide_render
        for f,value in [(1,True),(193,True),(202,initial)]:
            o.hide_render=value;o.keyframe_insert(data_path='hide_render',frame=f)
            o.hide_viewport=value;o.keyframe_insert(data_path='hide_viewport',frame=f)
source=ROOT+'/assets/canon_eos5d_mark_iv.glb'
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=source)
imported=[o for o in bpy.data.objects if o not in before]
asset=bpy.data.collections.new('V3_HighDetail_Canon_Exterior');s.collection.children.link(asset)
for o in imported:asset.objects.link(o)
bpy.context.view_layer.update()
mesh_objects=[o for o in imported if o.type=='MESH'];transforms={o:o.matrix_world.copy() for o in mesh_objects}
body=next(o for o in mesh_objects if base(o.name)=='Body')
bodypoints=[body.matrix_world@Vector(v) for v in body.bound_box]
unit=.18585346639156342/(max(p.x for p in bodypoints)-min(p.x for p in bodypoints))
# Level the model's slight barrel tilt, then register its mount to teaching coordinates.
R=Matrix.Rotation(-.033,4,'X');pivot=R@Vector((.0008,.0483,.0584));target=Vector((0,-1.24,2.65))
matmap={}
for o in mesh_objects:
    name=base(o.name);o['source_object']=name
    M=transforms[o];o.parent=None;o.matrix_world=Matrix.Identity(4)
    o.data=o.data.copy();o.data.transform(M)
    for v in o.data.vertices:
        p=(R@(v.co*unit)-pivot)*36
        if name.startswith(('Lens','Ring','Circle')):p.y*=.78
        v.co=p+target
    for slot in o.material_slots:
        m=slot.material
        if not m:continue
        if m.name not in matmap:
            cp=m.copy();cp.name='V3_'+m.name;matmap[m.name]=cp
        slot.material=matmap[m.name]
    o.name='V3_Asset_'+name;o.animation_data_clear();o.hide_render=False;o.hide_viewport=False
for o in imported:
    if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
# Real coating: not chrome. Keep decal images, LCD contents and leather bump.
for oldname,m in matmap.items():
    for p in m.node_tree.nodes:
        if p.type!='BSDF_PRINCIPLED':continue
        if any(t in oldname for t in ['Plastic','guma','Rubber','LEATHER','GapsColor','Metal Black']):
            for link in list(p.inputs['Base Color'].links):m.node_tree.links.remove(link)
            p.inputs['Base Color'].default_value=(.009,.010,.012,1)
            p.inputs['Metallic'].default_value=.0
            p.inputs['Roughness'].default_value=.57 if any(t in oldname for t in ['LEATHER','guma','Rubber']) else .36
            p.inputs['Coat Weight'].default_value=.09
        if oldname=='Multicoated glass':
            p.inputs['Roughness'].default_value=.085
    for node in m.node_tree.nodes:
        if node.type=='BUMP':node.inputs['Strength'].default_value=min(node.inputs['Strength'].default_value,.22)
roots={}
deltas={'rear':(0,6.4,.1),'top':(0,.3,2.8),'grip':(-2.7,.1,.05),'front':(4.8,-.3,.7),'far':(-.25,0,0),'lensfar':(0,0,0),'lensnear':(4.9,-.2,1.1),'lensglass':(0,-.6,0),'discard':(0,0,0)}
for key,delta in deltas.items():
    r=bpy.data.objects.new('V3_Part_'+key,None);asset.objects.link(r);roots[key]=r
    for f,loc in [(1,(0,0,0)),(193,(0,0,0)),(289,delta)]:r.location=loc;r.keyframe_insert(data_path='location',frame=f)
    r.location=(0,0,0)
def zone(p,name):
    if name in ['Sensor','Camera Internal']:return 'discard'
    if name.startswith(('Lens Glass','Lens Gless','Lens Internal')):return 'lensglass'
    if name.startswith(('Lens','Ring','Circle')):return 'lensfar' if p.x<0 else 'lensnear'
    if name.startswith('Visor'):return 'top'
    if p.z>4.28:return 'top'
    if p.y>1.05:return 'rear'
    if p.x<-2.0:return 'grip'
    return 'far' if p.x<-.85 else 'front'
parts=[]
for o in mesh_objects:
    name=o['source_object']
    bm=bmesh.new();bm.from_mesh(o.data)
    if name in ['Body','Body Center','Labels','Lens Body']:
        planes=[((0,0,4.28),(0,0,1)),((0,1.05,0),(0,1,0)),((-2,0,0),(1,0,0)),((-.85,0,0),(1,0,0))] if not name.startswith('Lens') else [((0,0,0),(1,0,0))]
        for co,no in planes:bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=co,plane_no=no,clear_inner=False,clear_outer=False)
        bm.to_mesh(o.data)
    bm.free();o.data.update()
    groups={zone(p.center,name) for p in o.data.polygons}
    for key in sorted(groups):
        data=o.data.copy();new=o.copy();new.data=data;new.name='V3_Asset_'+name+'__'+key;asset.objects.link(new)
        bm=bmesh.new();bm.from_mesh(data)
        delete=[f for f in bm.faces if zone(f.calc_center_median(),name)!=key]
        bmesh.ops.delete(bm,geom=delete,context='FACES');bm.to_mesh(data);bm.free();data.update()
        new.parent=roots[key];new.matrix_parent_inverse=Matrix.Identity(4)
        if key=='discard':new.hide_render=True;new.hide_viewport=True
        if key in ['lensnear','lensglass','front']:
            # Removed foreground shells leave an unobstructed educational section.
            for f,val in [(1,False),(276,False),(289,True)]:
                new.hide_render=val;new.hide_viewport=val;new.keyframe_insert(data_path='hide_render',frame=f);new.keyframe_insert(data_path='hide_viewport',frame=f)
        parts.append({'name':new.name,'source':name,'group':key,'polygons':len(data.polygons)})
    bpy.data.objects.remove(o,do_unlink=True)
s['replacement_asset']='BlenderKit c71ed1a5-0c66-41af-9894-a5fd3ffdeb01 | sotilrac Asmat | Royalty Free'
s['replacement_notes']='New detailed exterior; educational optics and light/tag/camera timing retained; shell segmented for demonstration, not manufacturer teardown.'
s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=100;s.eevee.taa_render_samples=24
s.render.filepath=ROOT+'/frames/frame_';s.frame_set(1);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/canon5d-v3-integrated.blend')
print(json.dumps({'scene':s.name,'removed_old_exterior_count':len(removed),'new_mesh_count':len(parts),'new_polygons':sum(x['polygons'] for x in parts),'parts':parts,'saved':bpy.data.filepath}))
