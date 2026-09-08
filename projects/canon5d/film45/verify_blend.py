import bpy,math,json
from mathutils import Vector
s=bpy.data.scenes['Canon5D_45s_Film'];bpy.context.window.scene=s
assert (s.render.resolution_x,s.render.resolution_y,s.render.fps,s.frame_end)==(1280,720,24,1080)
def obj(prefix):return next(o for o in s.objects if o.name==prefix or o.name.startswith(prefix+'.'))
# Orbit is a full revolution, not a half turn disguised by a cut.
angles=[]
for f in range(1,194):
    s.frame_set(f);p=s.camera.location;angles.append(math.atan2(p.y+.65,p.x))
turn=0
for a,b in zip(angles,angles[1:]):turn+=(b-a+math.pi)%(2*math.pi)-math.pi
assert abs(turn-2*math.pi)<1e-4,turn
s.frame_set(1);closed_y=obj('CC_Main PCB').location.y;s.frame_set(289);open_y=obj('CC_Main PCB').location.y;assert open_y-closed_y>4
mirror=obj('CC_Main reflex mirror');s.frame_set(745);down=mirror.rotation_euler.x;s.frame_set(781);up=mirror.rotation_euler.x;assert abs(down+math.pi/4)<.01 and abs(up+math.pi/2)<.01
ray=bpy.data.objects['FILM_Exposure chief ray'];violations=[]
for f in range(1,1081):
    s.frame_set(f)
    if not ray.hide_render and ray.data.bevel_factor_end*10.11-6.1>=2.5:
        for i in range(6):
            blade=obj('CC_Focal plane shutter blade '+str(i));z=blade.location.z
            if z-blade.dimensions.z/2<=2.65<=z+blade.dimensions.z/2:violations.append(f)
assert not violations,violations
assert all(len(o.animation_data.drivers)==0 for o in s.objects if o.animation_data)
assert all(not getattr(sc,'blendermcp_auto_start_server',False) for sc in bpy.data.scenes)
print(json.dumps({'passed':True,'scene':s.name,'objects':len(s.objects),'full_orbit_degrees':math.degrees(turn),'pcb_closed_y':closed_y,'pcb_open_y':open_y,'mirror_angles_degrees':[math.degrees(down),math.degrees(up)],'ray_through_closed_shutter_frames':violations,'resolution':[1280,720],'frames':1080,'fps':24}))
