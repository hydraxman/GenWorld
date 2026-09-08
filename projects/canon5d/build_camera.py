"""Original procedural educational DSLR, inspired by Canon EOS 5D Mark IV.
Run this source through Blender MCP. No external assets, drivers or handlers.
Frame 1 = exterior; frame 90 = cutaway / exploded; no metrology claim.
"""
import bpy, math, random, json
from mathutils import Vector

PREFIX = 'CC_'
from pathlib import Path
OUT = str(Path(__file__).resolve().parent)

def mat(name, color, metallic=0.0, roughness=0.4, transmission=0.0, emission=0.0, textured=False):
    m=bpy.data.materials.new(PREFIX+name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metallic;p.inputs['Roughness'].default_value=roughness
    p.inputs['Transmission Weight'].default_value=transmission;p.inputs['IOR'].default_value=1.48
    p.inputs['Coat Weight'].default_value=0.15
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    if textured:
        noise=m.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=160;noise.inputs['Detail'].default_value=2
        bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=0.30;bump.inputs['Distance'].default_value=0.035
        m.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
    return m

def finish(o,name,m,collection,bevel=0):
    o.name=PREFIX+name
    for c in list(o.users_collection):c.objects.unlink(o)
    collection.objects.link(o)
    if m:o.data.materials.append(m)
    if bevel:
        mod=o.modifiers.new('Manufactured edge radius','BEVEL');mod.width=bevel;mod.segments=3
    return o

def cube(name,loc,size,m,c,bevel=0.06):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,m,c,bevel)

def cyl(name,loc,radius,depth,m,c,axis='Y',vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=bpy.context.object
    if axis=='Y':o.rotation_euler.x=math.pi/2
    if axis=='X':o.rotation_euler.y=math.pi/2
    finish(o,name,m,c,0.025)
    for p in o.data.polygons:p.use_smooth=True
    return o

def ring(name,y,z,ro,ri,depth,m,c,a0=0,a1=2*math.pi):
    n=96;verts=[]
    for yy,rr in [(y-depth/2,ro),(y+depth/2,ro),(y-depth/2,ri),(y+depth/2,ri)]:
        verts += [(rr*math.cos(a0+(a1-a0)*i/n),yy,z+rr*math.sin(a0+(a1-a0)*i/n)) for i in range(n+1)]
    f=[];k=n+1
    for i in range(n):
        f.extend([(i,i+1,k+i+1,k+i),(2*k+i,3*k+i,3*k+i+1,2*k+i+1),(i,2*k+i,2*k+i+1,i+1),(k+i,k+i+1,3*k+i+1,3*k+i)])
    f += [(0,k,3*k,2*k),(n,2*k+n,3*k+n,k+n)]
    mesh=bpy.data.meshes.new(PREFIX+name);mesh.from_pydata(verts,[],f);mesh.update()
    o=bpy.data.objects.new(PREFIX+name,mesh);c.objects.link(o);o.data.materials.append(m)
    mod=o.modifiers.new('Edge micro bevel','BEVEL');mod.width=0.018;mod.segments=2
    for p in mesh.polygons:p.use_smooth=True
    return o

def poly_xz(name,points,y,depth,m,c):
    n=len(points);v=[(x,y+side*depth/2,z) for side in [-1,1] for x,z in points]
    f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(PREFIX+name);mesh.from_pydata(v,[],f);mesh.update();o=bpy.data.objects.new(PREFIX+name,mesh);c.objects.link(o);o.data.materials.append(m)
    b=o.modifiers.new('Shell edge softness','BEVEL');b.width=0.08;b.segments=3
    return o

def prism_yz(name,points,width,m,c):
    n=len(points);v=[(side*width/2,y,z) for side in [-1,1] for y,z in points]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(PREFIX+name);mesh.from_pydata(v,[],faces);mesh.update();o=bpy.data.objects.new(PREFIX+name,mesh);c.objects.link(o);o.data.materials.append(m)
    b=o.modifiers.new('Optical edge','BEVEL');b.width=.04;b.segments=2
    return o

def line(name,points,radius,m,c):
    cu=bpy.data.curves.new(PREFIX+name,'CURVE');cu.dimensions='3D';cu.resolution_u=16;cu.bevel_depth=radius;cu.bevel_resolution=3
    sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(PREFIX+name,cu);c.objects.link(o);o.data.materials.append(m);return o

def text_obj(name,body,loc,size,m,c,rotation=(math.pi/2,0,0),align='CENTER'):
    cu=bpy.data.curves.new(PREFIX+name,'FONT');cu.body=body;cu.size=size;cu.align_x=align;cu.extrude=.003
    o=bpy.data.objects.new(PREFIX+name,cu);c.objects.link(o);o.location=loc;o.rotation_euler=rotation;o.data.materials.append(m);return o

def move(o,delta):
    start=o.location.copy();o.keyframe_insert(data_path='location',frame=1);o.keyframe_insert(data_path='location',frame=25)
    o.location=start+Vector(delta);o.keyframe_insert(data_path='location',frame=90);o.location=start

def vanish(o):
    o.hide_render=False;o.keyframe_insert(data_path='hide_render',frame=1);o.keyframe_insert(data_path='hide_render',frame=35)
    o.hide_render=True;o.keyframe_insert(data_path='hide_render',frame=75);o.hide_render=False

def build():
    assert 'Canon5D_Educational_Cutaway' not in bpy.data.scenes,'Scene already exists; inspect instead of duplicating'
    s=bpy.data.scenes.new('Canon5D_Educational_Cutaway');bpy.context.window.scene=s
    groups={}
    for name in ['01_Outer_Shell','02_Lens_Optics','03_Mirror_Box','04_Viewfinder','05_Shutter_Sensor','06_Electronics','07_Stage','08_Optical_Path']:
        c=bpy.data.collections.new(PREFIX+name);s.collection.children.link(c);groups[name]=c
    shell=groups['01_Outer_Shell'];lens=groups['02_Lens_Optics'];mirrorc=groups['03_Mirror_Box'];view=groups['04_Viewfinder'];imaging=groups['05_Shutter_Sensor'];elec=groups['06_Electronics'];stage=groups['07_Stage'];paths=groups['08_Optical_Path']
    rubber=mat('Black textured rubber',(.018,.023,.029),.03,.56,textured=True)
    enamel=mat('Black magnesium body',(.026,.032,.04),.48,.3)
    chrome=mat('Machined silver',(.48,.53,.58),.92,.23)
    dark=mat('Optical baffle',(.006,.009,.013),.15,.48)
    copper=mat('Copper flex',(.72,.26,.045),.65,.25)
    red=mat('Canon red accent',(.72,.014,.024),.32,.25)
    white=mat('White engraving',(.85,.9,.94),.15,.28)
    green=mat('Green FR4',(.015,.16,.085),.15,.4)
    chip=mat('Silicon packages',(.013,.023,.028),.35,.3)
    gold=mat('Gold contacts',(.86,.53,.11),.8,.24)
    glass=mat('Coated optical glass',(.45,.79,.88),.0,.045,.88)
    prismglass=mat('Pentaprism optical glass',(.41,.76,.82),.05,.095,.72)
    sensor=mat('CMOS dichroic coating',(.12,.22,.44),.68,.13)
    raymat=mat('Viewfinder light path',(.1,.8,1),.15,.3,emission=2.2)
    ground=mat('Studio slate',(.023,.035,.05),.18,.4)
    # Body silhouette proportions follow the official 150.7 x 116.4 x 75.9 mm envelope.
    profile=[(-3.65,.35),(-3.7,3.6),(-3.32,4.35),(-1.55,4.5),(-1.05,5.45),(-.5,5.75),(.65,5.75),(1.35,4.5),(2.65,4.5),(3.45,4.02),(3.7,.45),(3.45,.2),(-3.25,.2)]
    back=poly_xz('Rear shell',profile,1.55,.2,enamel,shell);move(back,(0,3.1,.15))
    # Front shell is perforated; upper/right half is removed in cutaway.
    front=poly_xz('Front shell',profile,-1.10,.2,enamel,shell)
    cutter=cyl('Temporary mount opening',(0,-1.1,2.65),1.52,1.0,None,shell)
    bpy.context.view_layer.objects.active=front
    mod=front.modifiers.new('Lens mount aperture','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    vanish(front)
    leftwall=cube('Far side shell',(-3.45,.15,2.25),(.22,2.7,3.8),rubber,shell,.12)
    floor=cube('Metal chassis',(0,.15,.35),(6.65,2.8,.22),chrome,mirrorc,.09)
    grip=cube('Sculpted hand grip',(2.95,-.15,2.2),(1.55,3.4,4.0),rubber,shell,.48);move(grip,(2.4,.15,0))
    gripcap=cube('Grip shoulder',(2.8,-.55,4.05),(1.7,2.25,.8),enamel,shell,.35);move(gripcap,(2.4,.15,0))
    shutterbutton=cyl('Shutter release',(2.95,-1.0,4.5),.28,.10,chrome,shell,axis='Z');move(shutterbutton,(2.4,.15,0))
    dial=cyl('Mode dial',(-2.6,.15,4.52),.53,.22,dark,shell,axis='Z')
    for i in range(32):
        a=i*2*math.pi/32;cyl('Mode dial knurl '+str(i),(-2.6+.52*math.cos(a),.15+.52*math.sin(a),4.52),.037,.24,enamel,shell,axis='Z',vertices=8)
    for i,label in enumerate(['M','Av','Tv','P']):
        a=i*1.4;text_obj('Mode '+label,label,(-2.6+.32*math.cos(a),.15+.32*math.sin(a),4.66),.13,white,shell,rotation=(0,0,0))
    for i in range(4):cyl('Top control '+str(i),(1.7+i*.35,.78,4.38),.105,.12,dark,shell,axis='Z')
    topdisplay=cube('Top LCD',(2.05,.1,4.43),(1.15,.9,.035),mat('LCD grey',(.26,.34,.29),.25,.18),shell,.06)
    text_obj('LCD digits','125  F5.6',(2.05,.05,4.465),.16,dark,shell,rotation=(0,0,0))
    roof=prism_yz('Pentaprism cover',[(-1.05,4.35),(-.72,5.45),(.15,5.85),(1.0,5.38),(1.2,4.35)],2.9,enamel,shell);move(roof,(0,.2,2.5))
    logo=text_obj('Canon logotype','Canon',(0,-.88,5.1),.45,white,shell);move(logo,(0,.2,2.5))
    modeltext=text_obj('Camera model','EOS\n5D\nMark IV',(-2.15,-1.235,3.65),.20,white,shell);vanish(modeltext)
    hotshoe=cube('Hot shoe',(0,.38,5.84),(.94,.84,.09),chrome,shell,.02);move(hotshoe,(0,.2,2.5))
    for x in [-.52,.52]:
        rail=cube('Flash rail '+str(x),(x,.38,5.9),(.10,.94,.14),enamel,shell,.02);move(rail,(0,.2,2.5))
    # EF mount, positive-X barrel half removed to expose generic optical groups.
    ring('EF mount',-1.24,2.65,1.63,1.42,.15,chrome,lens)
    for i in range(8):
        a=i*math.pi/4;cyl('Mount screw '+str(i),(1.52*math.cos(a),-1.34,2.65+1.52*math.sin(a)),.048,.025,dark,lens,vertices=16)
    for i in range(8):
        a=-2.0+i*.14;cyl('EF contact '+str(i),(1.36*math.cos(a),-1.36,2.65+1.36*math.sin(a)),.055,.035,gold,lens,vertices=16)
    for seg,(y,ro,ri,depth) in enumerate([(-1.65,1.63,1.41,.65),(-2.4,1.7,1.44,.8),(-3.25,1.77,1.49,.75),(-4.07,1.8,1.49,.75),(-4.65,1.79,1.47,.35)]):
        ring('Far barrel '+str(seg),y,2.65,ro,ri,depth,rubber if seg in [1,3] else enamel,lens,math.pi/2,3*math.pi/2)
        near=ring('Removable barrel '+str(seg),y,2.65,ro,ri,depth,rubber if seg in [1,3] else enamel,lens,-math.pi/2,math.pi/2);vanish(near)
    for i in range(72):
        a=2*math.pi*i/72
        for y in [-2.4,-4.05]:
            rib=cube('Focus ring rib '+str(i)+' '+str(y),(1.74*math.cos(a),y,2.65+1.74*math.sin(a)),(.045,.57,.07),rubber,lens,.015);rib.rotation_euler.y=-a
            if math.cos(a)>0:vanish(rib)
    ring('Red L-series style trim',-4.54,2.65,1.812,1.75,.085,red,lens)
    ring('Front lens rim',-4.86,2.65,1.8,1.40,.13,enamel,lens)
    for i,(y,rr) in enumerate([(-4.76,1.39),(-4.05,1.30),(-3.36,1.15),(-2.95,.96),(-2.26,1.08),(-1.54,.99)]):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,location=(0,y,2.65));o=bpy.context.object;o.scale=(rr,.12,rr);finish(o,'Lens optical group '+str(i+1),glass,lens)
        for face in o.data.polygons:face.use_smooth=True
        if i<3:move(o,(0,-.20*(3-i),0))
        ring('Optical retaining ring '+str(i+1),y,2.65,rr+.07,rr,.08,chrome,lens,math.pi/2,3*math.pi/2)
    ring('Aperture assembly',-2.70,2.65,1.10,.48,.11,dark,lens)
    for i in range(8):
        a=i*math.pi/4;leaf=cube('Aperture blade '+str(i),(.53*math.cos(a),-2.77,2.65+.53*math.sin(a)),(.40,.035,.19),chrome,lens,.018);leaf.rotation_euler.y=-a+.32
    # Main reflex mirror redirects viewing light upward; submirror/AF is schematic.
    for x in [-1.18,1.18]:cube('Mirror box wall '+str(x),(x,-.04,2.55),(.12,1.95,1.95),enamel,mirrorc,.03)
    mainmirror=cube('Main reflex mirror',(0,-.13,2.55),(1.89,.06,1.5),chrome,mirrorc,.025);mainmirror.rotation_euler.x=-math.pi/4
    backing=cube('Mirror rear backing',(0,-.05,2.50),(2.0,.07,1.55),dark,mirrorc,.035);backing.rotation_euler.x=-math.pi/4
    cyl('Mirror hinge',(0,.49,3.1),.075,2.02,chrome,mirrorc,axis='X')
    sub=cube('Secondary AF mirror',(0,.48,2.18),(.72,.05,.59),chrome,mirrorc,.018);sub.rotation_euler.x=math.pi/4
    cube('Phase detection AF module',(0,.25,1.13),(1.16,.80,.32),green,mirrorc,.04)
    for x in [-.3,0,.3]:cube('AF receiver '+str(x),(x,-.02,1.32),(.18,.25,.04),sensor,mirrorc,.015)
    motor=cyl('Mirror drive motor',(-1.92,-.08,2.60),.32,.78,chrome,mirrorc,axis='Z')
    for j in range(3):cyl('Mirror gearbox '+str(j),(-1.72+j*.22,-.45,3.2),.19,.11,copper,mirrorc)
    # Horizontal focusing screen, pentaprism and rear eyepiece.
    cube('Focusing screen',(0,.0,3.63),(1.90,1.36,.055),glass,view,.02)
    ringview=prism_yz('Pentaprism',[(-.65,3.96),(-.85,4.65),(.0,5.30),(1.05,4.80),(1.05,3.96)],1.92,prismglass,view)
    eyecup=cube('Eyepiece surround',(0,1.65,4.69),(1.32,.4,.85),rubber,view,.20)
    cube('Eyepiece glass',(0,1.9,4.7),(.81,.07,.52),glass,view,.07)
    # Focal-plane shutter, sensor and support separated along the optical axis.
    shframe=cube('Shutter frame',(0,.92,2.65),(2.22,.13,1.68),chrome,imaging,.06);move(shframe,(0,1.7,0))
    for i in range(6):
        slat=cube('Focal plane shutter blade '+str(i),(0,.80,2.05+i*.23),(1.97,.045,.235),dark,imaging,.008);move(slat,(0,1.7,0))
    sf=cube('Sensor carrier',(0,1.1,2.65),(2.25,.18,1.65),chrome,imaging,.045);move(sf,(0,3.05,.02))
    chipface=cube('36x24 full frame CMOS',(0,.98,2.65),(1.8,.045,1.2),sensor,imaging,.008);move(chipface,(0,3.05,.02))
    for x in [-1.04,1.04]:
        for z in [1.97,3.34]:
            screw=cyl('Sensor alignment screw '+str(x)+str(z),(x,.94,z),.07,.05,gold,imaging,vertices=16);move(screw,(0,3.05,.02))
    # Main board is behind the sensor; illustrative chip placements, not a netlist.
    board=cube('Main PCB',(0,1.37,2.65),(5.68,.095,3.54),green,elec,.07);move(board,(0,4.55,.16))
    rng=random.Random(41)
    for i in range(45):
        x=rng.uniform(-2.6,2.6);z=rng.uniform(1.13,4.18);w=rng.choice([.14,.22,.34,.50]);h=rng.choice([.12,.25,.36])
        component=cube('PCB component '+str(i),(x,1.27,z),(w,.10,h),chip,elec,.017);move(component,(0,4.55,.16))
        trace=line('PCB trace '+str(i),[(x,1.305,z),(x+.1,1.305,z+.14),(x+.35,1.305,z+.14)],.010,gold,elec);move(trace,(0,4.55,.16))
    processor=cube('DIGIC 6+ package',(-.72,1.24,2.9),(.82,.15,.83),chip,elec,.02);move(processor,(0,4.55,.16))
    proc_label=text_obj('DIGIC label','DIGIC 6+',(-.72,1.15,2.88),.13,white,elec);move(proc_label,(0,4.55,.16))
    battery=cube('LP E6N battery',(2.45,.2,1.82),(1.18,1.5,2.75),dark,elec,.12);move(battery,(2.5,.3,.05))
    lab=text_obj('Battery marking','LP-E6N\nLi-ion',(2.45,-.57,2.0),.16,white,elec);move(lab,(2.5,.3,.05))
    card=cube('CF card cage',(2.07,1.23,3.28),(1.16,.36,1.74),chrome,elec,.045);move(card,(1.5,3.0,.15))
    for i in range(10):
        con=cube('CF contacts '+str(i),(1.6+i*.10,1.0,2.51),(.045,.12,.17),gold,elec,.005);move(con,(1.5,3.0,.15))
    lcd=cube('Rear LCD frame',(-.7,1.70,2.50),(3.9,.17,2.80),rubber,shell,.18);move(lcd,(0,6.0,.10))
    lcdglass=cube('Rear LCD panel',(-.7,1.81,2.50),(3.48,.025,2.33),mat('LCD off glass',(.015,.035,.050),.42,.13),shell,.045);move(lcdglass,(0,6.0,.10))
    # Schematic gold flex cables kept compact around sensor / electronics.
    for i in range(5):
        x=-1.3+i*.5;line('Flex cable '+str(i),[(x,.68,1.25),(x,.68,.7),(x+.2,1.25,.7)],.045,copper,elec)
    # Viewing-mode light path does not continue through the closed shutter to the CMOS.
    ray=line('Viewing light ray',[(0,-5.6,2.65),(0,-.03,2.65),(0,-.03,3.67),(0,-.03,4.25),(0,.45,4.98),(0,.90,4.71),(0,2.15,4.71)],.022,raymat,paths)
    ray.hide_render=True;ray.keyframe_insert(data_path='hide_render',frame=1);ray.hide_render=False;ray.keyframe_insert(data_path='hide_render',frame=75)
    # Stage and cameras.
    cube('Presentation plinth',(0,.4,-.09),(14.2,16.8,.35),ground,stage,.30)
    cube('Studio ground',(0,0,-.4),(200,200,.25),ground,stage,.03)
    world=bpy.data.worlds.new(PREFIX+'Studio world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.15,.20,.28,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35;s.world=world
    def light(name,loc,target,power,color,size):
        data=bpy.data.lights.new(PREFIX+name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
        o=bpy.data.objects.new(PREFIX+name,data);stage.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    light('Key softbox',(4,-7,13),(0,0,2),2100,(.82,.9,1),8)
    light('Warm rim',(-8,4,10),(0,1,3),2600,(1,.67,.4),7)
    light('Front fill',(-4,-9,5),(0,0,2.5),1500,(.5,.72,1),6)
    light('Back board softbox',(2,9,10),(0,4,2.8),2600,(.70,.9,1),6)
    for name,loc,target,scale in [('Exterior',(11,-17,10),(0,-.8,2.5),12.8),('Cutaway',(16,-17,13),(0,1.5,3.3),21.5),('Side',(18,-6,10),(0,1,3.2),19.0)]:
        data=bpy.data.cameras.new(PREFIX+name);cam=bpy.data.objects.new(PREFIX+name,data);stage.objects.link(cam);cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=scale;data.lens=55
    s.camera=bpy.data.objects[PREFIX+'Cutaway'];s.render.engine='CYCLES';s.cycles.device='GPU';s.cycles.samples=80;s.cycles.use_denoising=True;s.cycles.max_bounces=8;s.cycles.transmission_bounces=6
    s.render.resolution_x=1800;s.render.resolution_y=1350;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.film_transparent=False
    s.view_settings.view_transform='AgX';s.render.fps=30;s.frame_start=1;s.frame_end=90
    s.unit_settings.system='METRIC';s.unit_settings.scale_length=.02;s.unit_settings.length_unit='MILLIMETERS'
    s['design_reference']='Canon EOS 5D Mark IV; outside dimensions reference only; internals/optics schematic.'
    s['usage']='Frame 1 assembled; frame 90 cutaway. Collections separate shell, optics, mirror box, viewfinder, imaging and electronics.'
    s.blendermcp_auto_start_server=False
    s.frame_set(90)
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
    print(json.dumps({'scene':s.name,'objects':len(s.objects),'collections':list(groups),'frame':s.frame_current,'camera':s.camera.name}))

build()
