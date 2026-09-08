import bpy,math,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
s=bpy.data.scenes['Canon5D_Replacement_V3'];bpy.context.window.scene=s
assert (s.render.resolution_x,s.render.resolution_y,s.render.fps,s.frame_end)==(1280,720,24,1080)
def obj(prefix):return next(o for o in s.objects if o.name==prefix or o.name.startswith(prefix+'.'))
angles=[]
for f in range(1,194):
    s.frame_set(f);p=s.camera.location;angles.append(math.atan2(p.y+.65,p.x))
turn=sum((b-a+math.pi)%(2*math.pi)-math.pi for a,b in zip(angles,angles[1:]));assert abs(turn-2*math.pi)<1e-4
s.frame_set(1)
new=[o for o in s.objects if o.name.startswith('V3_Asset_') and o.type=='MESH']
assert len(new)>=74 and sum(len(o.data.polygons) for o in new)>70000
p=[o.matrix_world@Vector(c) for o in new if not o.hide_render for c in o.bound_box]
lo=Vector([min(v[k] for v in p) for k in range(3)]);hi=Vector([max(v[k] for v in p) for k in range(3)])
assert 5<(hi-lo).x<9 and 5<(hi-lo).z<8 and 5<(hi-lo).y<9,(list(lo),list(hi))
assert all(o.hide_render for o in s.objects if any(c.name.startswith('CC_01_Outer_Shell') for c in o.users_collection))
assert all(not o.hide_render for o in new if not o.name.endswith('__discard'))
mirror=obj('CC_Main reflex mirror');s.frame_set(745);down=mirror.rotation_euler.x;s.frame_set(781);up=mirror.rotation_euler.x
assert abs(down+math.pi/4)<.01 and abs(up+math.pi/2)<.01
ray=obj('FILM_Exposure chief ray');violations=[]
for f in range(1,1081):
    s.frame_set(f)
    if not ray.hide_render and ray.data.bevel_factor_end*10.11-6.1>=2.5:
        for i in range(6):
            blade=obj('CC_Focal plane shutter blade '+str(i));z=blade.location.z
            if z-blade.dimensions.z/2<=2.65<=z+blade.dimensions.z/2:violations.append(f)
assert not violations
s.frame_set(289)
assert all(o.hide_render for o in new if any(x in o.name for x in ['__front','__lensnear','__lensglass']))
assert bpy.data.objects['V3_Part_rear'].location.y>6
assert all(len(o.animation_data.drivers)==0 for o in s.objects if o.animation_data)
# Verify camera/optical animation equivalence at every frame to the prior film.
a=bpy.data.scenes['Canon5D_45s_Film']
prefixes=['FILM_MainCamera','FILM_Progressive viewing path','FILM_Viewing ray head','FILM_Exposure chief ray','FILM_Electrical signal','CC_Main reflex mirror','CC_36x24 full frame CMOS','CC_DIGIC 6+ package']
pairs=[(next(o for o in a.objects if o.name==pre or o.name.startswith(pre+'.')),obj(pre)) for pre in prefixes]
for f in range(1,1081):
    bpy.context.window.scene=a;a.frame_set(f);bpy.context.view_layer.update()
    original=[(x.location.copy(),x.scale.copy(),x.rotation_euler.copy(),x.data.bevel_factor_end if x.type=='CURVE' else None) for x,y in pairs]
    bpy.context.window.scene=s;s.frame_set(f);bpy.context.view_layer.update()
    for (x,y),(loc,scale,rotation,bevel) in zip(pairs,original):
        assert (loc-y.location).length<1e-5 and (scale-y.scale).length<1e-5, (f,x.name,y.name,list(loc),list(y.location))
        assert max(abs(i-j) for i,j in zip(rotation,y.rotation_euler))<1e-5
        if bevel is not None:assert abs(bevel-y.data.bevel_factor_end)<1e-5
result={'passed':True,'scene':s.name,'asset':s['replacement_asset'],'new_meshes':len(new),'new_polygons':sum(len(o.data.polygons) for o in new),'assembly_bbox':[list(lo),list(hi)],'old_outer_shell_hidden':True,'full_orbit_degrees':math.degrees(turn),'original_camera_and_optics_animation_preserved_all_frames':True,'ray_through_closed_shutter_frames':violations,'no_drivers':True}
(root/'blend-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))
