import bpy, math, json
from mathutils import Vector
from pathlib import Path
ROOT=str(Path(__file__).resolve().parent)
FPS=24; N=1080; W=1920; H=1080
source=bpy.data.scenes['Canon5D_Educational_Cutaway'];bpy.context.window.scene=source
assert 'Canon5D_45s_Film' not in bpy.data.scenes
bpy.ops.scene.new(type='FULL_COPY');s=bpy.context.scene;s.name='Canon5D_45s_Film'
def original_name(o):
    a,sep,b=o.name.rpartition('.')
    return a if sep and len(b)==3 and b.isdigit() else o.name
objects={original_name(o):o for o in s.objects};base=list(s.objects)
def snapshot():return {o.name:{'loc':o.location.copy(),'rot':o.rotation_euler.copy(),'scale':o.scale.copy(),'hide':o.hide_render} for o in base}
s.frame_set(1);closed=snapshot();s.frame_set(90);opened=snapshot()
for o in base:o.animation_data_clear()
s.animation_data_clear();s.frame_start=1;s.frame_end=N;s.render.fps=FPS
# Independent materials: leave the already-delivered still-image project untouched.
matmap={}
for o in base:
    if o.type in ['MESH','CURVE','FONT']:
        for slot in o.material_slots:
            m=slot.material
            if not m:continue
            if m.name not in matmap:matmap[m.name]=m.copy()
            slot.material=matmap[m.name]
def material(name,color,metal=0,rough=.4,emit=0):
    m=bpy.data.materials.new('FILM_'+name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;m.diffuse_color=(*color,1)
    if emit:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
    return m
for old,m in matmap.items():
    p=m.node_tree.nodes.get('Principled BSDF')
    if not p:continue
    if 'Black magnesium' in old:p.inputs['Metallic'].default_value=0;p.inputs['Base Color'].default_value=(.012,.013,.014,1);p.inputs['Roughness'].default_value=.44
    if 'Black textured rubber' in old:p.inputs['Metallic'].default_value=0;p.inputs['Base Color'].default_value=(.008,.009,.009,1);p.inputs['Roughness'].default_value=.67
    if 'Coated optical glass' in old or 'Pentaprism optical glass' in old:
        p.inputs['Base Color'].default_value=(.96,.98,.99,1);p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.035;p.inputs['Transmission Weight'].default_value=.72
        p.inputs['Thin Film Thickness'].default_value=120;p.inputs['Thin Film IOR'].default_value=1.38
    if 'Green FR4' in old:p.inputs['Base Color'].default_value=(.009,.075,.03,1);p.inputs['Metallic'].default_value=0
    if 'Studio slate' in old:p.inputs['Base Color'].default_value=(.016,.022,.03,1);p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.65
# Animate the existing assembled -> exploded endpoint poses.
for o in base:
    a=closed[o.name];b=opened[o.name]
    for frame,pose in [(1,a),(8*FPS+1,a),(12*FPS+1,b)]:
        o.location=pose['loc'];o.rotation_euler=pose['rot'];o.scale=pose['scale'];o.keyframe_insert(data_path='location',frame=frame);o.keyframe_insert(data_path='rotation_euler',frame=frame);o.keyframe_insert(data_path='scale',frame=frame)
    o.hide_render=a['hide'];o.hide_viewport=a['hide'];o.keyframe_insert(data_path='hide_render',frame=1);o.keyframe_insert(data_path='hide_viewport',frame=1)
    if b['hide']!=a['hide']:
        if b['hide']:
            o.location=b['loc']+Vector((4.0,-1.8,.6));o.scale=b['scale']*.1;o.keyframe_insert(data_path='location',frame=12*FPS);o.keyframe_insert(data_path='scale',frame=12*FPS)
        o.hide_render=b['hide'];o.hide_viewport=b['hide'];o.keyframe_insert(data_path='hide_render',frame=12*FPS+1);o.keyframe_insert(data_path='hide_viewport',frame=12*FPS+1)
# Replace the static teaching ray with staged path segments.
oldray=objects['CC_Viewing light ray'];oldray.animation_data_clear();oldray.hide_render=True;oldray.hide_viewport=True
film=bpy.data.collections.new('FILM_Labels_Light_and_Controls');s.collection.children.link(film)
def finish(o,name,m):
    o.name='FILM_'+name
    for c in list(o.users_collection):c.objects.unlink(o)
    film.objects.link(o)
    if m:o.data.materials.append(m)
    return o
black=material('Button plastic',(.009,.01,.012),0,.5)
ink=material('White silk print',(.72,.73,.70),0,.5)
gold=material('Active component outline',(1,.56,.12),0,.3,2.5)
cyan=material('Viewing light',(.07,.68,1),0,.28,3)
amber=material('Exposure light',(1,.43,.045),0,.28,3)
signal=material('Electrical signal',(.2,1,.50),0,.3,2)
def cube(name,loc,size,m):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,name,m);b=o.modifiers.new('Edge radius','BEVEL');b.width=.022;b.segments=3;return o

def cylinder(name,loc,radius,depth,m):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,location=loc,rotation=(math.pi/2,0,0));o=finish(bpy.context.object,name,m);b=o.modifiers.new('Button edge','BEVEL');b.width=.025;b.segments=3;return o

def txt(name,body,loc,size,m):
    cu=bpy.data.curves.new('FILM_'+name,'FONT');cu.body=body;cu.size=size;cu.align_x='CENTER';cu.extrude=.001;o=bpy.data.objects.new('FILM_'+name,cu);film.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,math.pi);o.data.materials.append(m);return o
# Back controls for the full orbit, coherently attached to the moving back shell.
s.frame_set(1);rear=objects['CC_Rear shell'];inv=rear.matrix_world.inverted()
def rear_parent(o):o.parent=rear;o.matrix_parent_inverse=inv
for i,word in enumerate(['RATE','ZOOM','PLAY','DEL','Q']):
    z=3.65-i*.49;o=cylinder('Back left '+word,(-2.98,1.80,z),.13,.10,black);rear_parent(o);t=txt('Back print '+word,word,(-3.29,1.90,z-.035),.074,ink);rear_parent(t)
for x,label in [(-2.65,'MENU'),(-1.80,'INFO')]:
    o=cylinder('Top back '+label,(x,1.80,4.11),.16,.10,black);rear_parent(o);rear_parent(txt('Print '+label,label,(x,1.90,4.075),.068,ink))
dial=cylinder('Rear quick control dial',(2.15,1.86,2.18),.56,.18,black);rear_parent(dial)
for i in range(36):
    a=2*math.pi*i/36;o=cube('Rear dial knurl '+str(i),(2.15+.53*math.cos(a),1.99,2.18+.53*math.sin(a)),(.038,.045,.080),black);o.rotation_euler.y=-a;rear_parent(o)
rear_parent(cylinder('SET key',(2.15,1.99,2.18),.25,.09,black));rear_parent(txt('SET marking','SET',(2.15,2.05,2.12),.115,ink))
rear_parent(cube('Thumb joystick',(1.88,1.84,3.49),(.29,.18,.29),black));rear_parent(cube('LOCK switch',(2.1,1.82,1.10),(.59,.12,.20),black));rear_parent(txt('LOCK marking','LOCK',(2.1,1.93,.93),.10,ink))
for x,z,label in [(2.05,4.1,'AF-ON'),(2.70,4.0,'*')]:rear_parent(cylinder('Rear upper '+label,(x,1.82,z),.16,.1,black));rear_parent(txt('Print upper '+label,label,(x,1.93,z-.035),.070,ink))
# Native keyed rays and moving light markers, no drivers or handlers.
def curve(name,points,m,r=.022):
    cu=bpy.data.curves.new('FILM_'+name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=2;cu.resolution_u=2
    sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points):p.co=(*co,1)
    o=bpy.data.objects.new('FILM_'+name,cu);film.objects.link(o);o.data.materials.append(m);return o

def show_between(o,start,end):
    o.hide_render=True;o.hide_viewport=True;o.keyframe_insert(data_path='hide_render',frame=1);o.keyframe_insert(data_path='hide_viewport',frame=1)
    o.hide_render=False;o.hide_viewport=False;o.keyframe_insert(data_path='hide_render',frame=round(start*FPS)+1);o.keyframe_insert(data_path='hide_viewport',frame=round(start*FPS)+1)
    o.hide_render=True;o.hide_viewport=True;o.keyframe_insert(data_path='hide_render',frame=round(end*FPS)+1);o.keyframe_insert(data_path='hide_viewport',frame=round(end*FPS)+1)
viewpoints=[(0,-6.1,2.65),(0,-3.36,2.65),(0,-2.70,2.65),(0,-.03,2.65),(0,-.03,3.63),(0,-.03,4.25),(0,.45,4.98),(0,.9,4.71),(0,2.15,4.71)]
ray=curve('Progressive viewing path',viewpoints,cyan);show_between(ray,12,31.3)
cumulative=[0]
for a,b in zip(viewpoints,viewpoints[1:]):cumulative.append(cumulative[-1]+(Vector(b)-Vector(a)).length)
ray.data.bevel_factor_mapping_end='SPLINE'
keys=[(12,0),(13.1,1),(15.9,1),(17.0,2),(18.9,2),(20.15,3),(22.9,3),(23.8,4),(25.4,4),(26.1,5),(26.9,6),(28.4,7),(29.6,8),(31.25,8)]
for t,i in keys:ray.data.bevel_factor_end=cumulative[i]/cumulative[-1];ray.data.keyframe_insert(data_path='bevel_factor_end',frame=round(t*FPS)+1)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.067);tip=finish(bpy.context.object,'Viewing ray head',cyan);show_between(tip,12,31.3)
for t,i in keys:tip.location=viewpoints[i];tip.keyframe_insert(data_path='location',frame=round(t*FPS)+1)
# Exposure follows mirror-up and shutter-open, never through a closed shutter.
for name in ['CC_Main reflex mirror','CC_Mirror rear backing','CC_Secondary AF mirror']:
    o=objects[name];s.frame_set(round(31.1*FPS)+1);o.keyframe_insert(data_path='location',frame=round(31.1*FPS)+1);o.keyframe_insert(data_path='rotation_euler',frame=round(31.1*FPS)+1)
    o.rotation_euler.x=-math.pi/2;o.location.z=3.20 if 'Secondary' not in name else 2.99;o.location.y=-.12 if 'Secondary' not in name else .35
    o.keyframe_insert(data_path='location',frame=round(32.2*FPS)+1);o.keyframe_insert(data_path='rotation_euler',frame=round(32.2*FPS)+1)
# Make the shutter frame a real aperture; the original solid backing must not block light.
sh=objects['CC_Shutter frame'];s.frame_set(289);shlocal=sh.location.copy();sh.hide_render=True;sh.hide_viewport=True;sh.animation_data_clear()
shparts=[]
for name,delta,size in [('top',(0,0,.79),(2.22,.13,.12)),('bottom',(0,0,-.79),(2.22,.13,.12)),('left',(-1.055,0,0),(.11,.13,1.56)),('right',(1.055,0,0),(.11,.13,1.56))]:
    o=cube('Shutter frame '+name,shlocal+Vector(delta),size,black);shparts.append(o)
    o.location.y-=1.7;o.keyframe_insert(data_path='location',frame=1);o.keyframe_insert(data_path='location',frame=193);o.location.y+=1.7;o.keyframe_insert(data_path='location',frame=289)
for i in range(6):
    o=objects['CC_Focal plane shutter blade '+str(i)];s.frame_set(round(32.1*FPS)+1);o.keyframe_insert(data_path='location',frame=round(32.1*FPS)+1)
    o.location.z=3.37+i*.045;o.keyframe_insert(data_path='location',frame=round(33.3*FPS)+1)
exposure=curve('Exposure chief ray',[(0,-6.1,2.65),(0,4.01,2.65)],amber);show_between(exposure,32.3,36.2)
for t,val in [(32.3,0),(33.4,.73),(35.0,1),(36.1,1)]:exposure.data.bevel_factor_end=val;exposure.data.keyframe_insert(data_path='bevel_factor_end',frame=round(t*FPS)+1)
# Thin-lens ray diagram: rays from one object point converge to one image point.
image_z=2.65-.30*(7.38/5.65)
for i,z in enumerate([2.08,2.65,3.20]):
    q=curve('Image forming ray '+str(i),[(0,-9,2.95),(0,-3.35,z),(0,4.00,image_z)],amber,.014);show_between(q,36,42)
    for t,val in [(36,0),(36.8,.47),(38.0,1),(41.9,1)]:q.data.bevel_factor_end=val;q.data.keyframe_insert(data_path='bevel_factor_end',frame=round(t*FPS)+1)
objarrow=curve('Object arrow',[(0,-9,2.35),(0,-9,2.95),(-.11,-9,2.82),(0,-9,2.95),(.11,-9,2.82)],signal,.032);show_between(objarrow,36,39)
imarrow=curve('Inverted image arrow',[(0,3.99,3.04),(0,3.99,image_z),(-.13,3.99,image_z+.16),(0,3.99,image_z),(.13,3.99,image_z+.16)],signal,.025);show_between(imarrow,38,42)
elec=curve('Electrical signal',[(0,4.00,2.65),(-1.1,4.3,2.65),(-1.1,5.70,3.06),(-.72,5.77,3.06)],signal,.023);show_between(elec,42,45)
for t,val in [(42,0),(43.3,1),(45,1)]:elec.data.bevel_factor_end=val;elec.data.keyframe_insert(data_path='bevel_factor_end',frame=round(t*FPS)+1)
# Component-specific selection outlines follow the actual geometry.
phases=[(0,8,'360° 外观','',None),(8,12,'拆开机身','',None),(12,16,'镜片组','折射并汇聚光线','CC_Lens optical group 3'),(16,19,'光圈','调节开口 · 控制进光量','CC_Aperture assembly'),(19,23,'主反光镜','取景时向上反射光线','CC_Main reflex mirror'),(23,25.5,'对焦屏','形成供取景观察的像','CC_Focusing screen'),(25.5,28.5,'五棱镜','折转光路 · 校正像的方向','CC_Pentaprism'),(28.5,31,'目镜','把取景画面送入眼睛','CC_Eyepiece glass'),(31,36,'反光镜 + 快门','先抬镜，再打开快门','CC_Focal plane shutter blade 3'),(36,42,'CMOS 图像传感器','形成像 · 把光转换成电信号','CC_36x24 full frame CMOS'),(42,45,'图像处理器','处理电信号，输出照片','CC_DIGIC 6+ package')]
for start,end,label,sub,name in phases:
    if not name:continue
    o=objects[name];corners=[Vector(v) for v in o.bound_box];center=sum(corners,Vector())/8;corners=[center+(v-center)*1.12 for v in corners]
    edges=[(0,1),(1,2),(2,3),(3,0),(4,5),(5,6),(6,7),(7,4),(0,4),(1,5),(2,6),(3,7)]
    cu=bpy.data.curves.new('FILM_Highlight '+label,'CURVE');cu.dimensions='3D';cu.bevel_depth=.018;cu.bevel_resolution=2
    for a,b in edges:
        sp=cu.splines.new('POLY');sp.points.add(1);sp.points[0].co=(*corners[a],1);sp.points[1].co=(*corners[b],1)
    outline=bpy.data.objects.new('FILM_Highlight '+label,cu);film.objects.link(outline);cu.materials.append(gold);outline.parent=o
    show_between(outline,start,end)
# Camera stages and every-frame bake provide deterministic motion.
camdata=bpy.data.cameras.new('FILM_MainCamera');cam=bpy.data.objects.new('FILM_MainCamera',camdata);film.objects.link(cam);camdata.type='ORTHO';s.camera=cam
stages=[(8,(11,-17.65,10),(0,-.65,2.55),15.8),(12,(17,-12,10),(0,1.8,3.4),25),(13.2,(10,-11,7.4),(0,-2.2,2.6),12),(18.8,(10,-9,7.4),(0,-1.8,2.65),11),(20,(10,-7,7.5),(0,.25,3.0),9.6),(23.9,(9,-5,7.0),(0,.5,3.85),8.6),(26.4,(8,-4,6.7),(0,.3,4.6),8.5),(29.4,(8,6.5,7),(0,1.55,4.6),8.0),(32.3,(16,-7,8),(0,.2,3),18),(36,(18,-2,10),(0,-2,2.7),22),(38.7,(18,-2,10),(0,-2,2.7),22),(40,(10,-3,7),(0,4.1,2.7),9.3),(42,(10,-3,7),(0,4.1,2.7),9.3),(43,(8,-1,6.5),(-.72,5.85,3.06),8.5),(45,(8,-1,6.5),(-.72,5.85,3.06),8.5)]
def camera_pose(t):
    if t<=8:
        r=math.sqrt(11**2+17**2);a=math.atan2(-17,11)+2*math.pi*t/8
        return Vector((r*math.cos(a),-.65+r*math.sin(a),10)),Vector((0,-.65,2.55)),15.8
    for a,b in zip(stages,stages[1:]):
        if a[0]<=t<=b[0]:
            u=(t-a[0])/(b[0]-a[0]);u=u*u*(3-2*u)
            return Vector(a[1]).lerp(Vector(b[1]),u),Vector(a[2]).lerp(Vector(b[2]),u),a[3]+(b[3]-a[3])*u
    b=stages[-1];return Vector(b[1]),Vector(b[2]),b[3]
s.render.resolution_x=W;s.render.resolution_y=H;s.render.resolution_percentage=100
metadata=[]
for frame in range(1,N+1):
    t=(frame-1)/FPS;s.frame_set(frame);pos,target,scale=camera_pose(t);cam.location=pos;cam.rotation_euler=(target-pos).to_track_quat('-Z','Y').to_euler();camdata.ortho_scale=scale
    cam.keyframe_insert(data_path='location',frame=frame);cam.keyframe_insert(data_path='rotation_euler',frame=frame);camdata.keyframe_insert(data_path='ortho_scale',frame=frame)
    phase=next(p for p in phases if p[0]<=t<p[1]);anchor=None
    if phase[4]:
        o=objects[phase[4]];center=sum((Vector(v) for v in o.bound_box),Vector())/8
        bpy.context.view_layer.update();matrix=cam.calc_matrix_camera(bpy.context.evaluated_depsgraph_get(),x=W,y=H) @ cam.matrix_world.inverted();v=matrix @ (o.matrix_world @ center).to_4d();anchor=[round((v.x/v.w+1)*W/2,2),round((1-v.y/v.w)*H/2,2)]
    metadata.append({'frame':frame,'t':round(t,6),'phase':phase[2],'tag':phase[2] if phase[4] else None,'detail':phase[3],'anchor':anchor})
# Clear studio lighting and sensible real-time renderer settings.
for o in s.objects:
    if o.type=='LIGHT':o.data.color=(1,.965,.92) if 'Warm rim' in o.name else (.94,.97,1)
s.render.engine='BLENDER_EEVEE';s.eevee.taa_render_samples=32;s.eevee.use_raytracing=True
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.render.image_settings.compression=15;s.render.film_transparent=False;s.render.filepath=ROOT+'/frames/frame_'
s.view_settings.view_transform='AgX';s['film_notes']='45s teaching animation, simplified internal structure; viewing and exposure paths kept distinct; no handlers/drivers';s['film_fps']=24;s['film_frames']=1080;s.blendermcp_auto_start_server=False
s.frame_set(1)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.overlay.show_overlays=False;area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/canon5d-film45.blend')
print(json.dumps({'scene':s.name,'objects':len(s.objects),'frames':N,'timeline':metadata,'saved':bpy.data.filepath},ensure_ascii=False))
