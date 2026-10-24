import bpy, math, json
from mathutils import Vector
from pathlib import Path
s=bpy.data.scenes['Canon5D_Educational_Cutaway'];bpy.context.window.scene=s;s.frame_set(90)
assert s.get('material_revision') != 'photo-aligned-v2', 'Already applied: inspect instead of duplicating'
def reset(name,base,metal,rough):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True
    nt=m.node_tree;nt.nodes.clear();p=nt.nodes.new('ShaderNodeBsdfPrincipled');out=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(p.outputs['BSDF'],out.inputs['Surface'])
    p.inputs['Base Color'].default_value=(*base,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;m.diffuse_color=(*base,1)
    p.location=(350,50);out.location=(650,50)
    return m,p

def texture(m,scale,low,high,bump_distance,bump_strength,stretch=None):
    nt=m.node_tree;p=nt.nodes.get('Principled BSDF');tc=nt.nodes.new('ShaderNodeTexCoord');n=nt.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=scale;n.inputs['Detail'].default_value=2.0
    if stretch:
        v=nt.nodes.new('ShaderNodeVectorMath');v.operation='MULTIPLY';v.inputs[1].default_value=stretch;nt.links.new(tc.outputs['Object'],v.inputs[0]);nt.links.new(v.outputs['Vector'],n.inputs['Vector'])
    else:nt.links.new(tc.outputs['Object'],n.inputs['Vector'])
    ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(low,low,low,1);ramp.color_ramp.elements[1].color=(high,high,high,1);nt.links.new(n.outputs['Fac'],ramp.inputs['Fac']);nt.links.new(ramp.outputs['Color'],p.inputs['Roughness'])
    if bump_distance:
        b=nt.nodes.new('ShaderNodeBump');b.inputs['Distance'].default_value=bump_distance;b.inputs['Strength'].default_value=bump_strength;nt.links.new(n.outputs['Fac'],b.inputs['Height']);nt.links.new(b.outputs['Normal'],p.inputs['Normal'])
    tc.location=(-800,0);n.location=(-560,0);ramp.location=(-100,120)

m,p=reset('CC_Black magnesium body',(.010,.0105,.011),0,.46);texture(m,100,.39,.53,.004,.18)
m,p=reset('CC_Black textured rubber',(.007,.0075,.008),0,.68);texture(m,60,.61,.76,.009,.30)
# Fine irregular pebbles, not deep leather cracks or metallic rubber.
nt=m.node_tree;v=nt.nodes.new('ShaderNodeTexVoronoi');v.inputs['Scale'].default_value=52;v.feature='SMOOTH_F1';v.inputs['Smoothness'].default_value=.8
coord=next(n for n in nt.nodes if n.type=='TEX_COORD');nt.links.new(coord.outputs['Object'],v.inputs['Vector'])
b=nt.nodes.new('ShaderNodeBump');b.inputs['Distance'].default_value=.012;b.inputs['Strength'].default_value=.28;nt.links.new(v.outputs['Distance'],b.inputs['Height']);old=next(n for n in nt.nodes if n.type=='BUMP' and n!=b);nt.links.new(old.outputs['Normal'],b.inputs['Normal']);nt.links.new(b.outputs['Normal'],p.inputs['Normal'])
m,p=reset('CC_Machined silver',(.58,.59,.60),1,.22);p.inputs['Anisotropic'].default_value=.5;texture(m,50,.16,.29,.0007,.10,(1,130,1))
m,p=reset('CC_Gold contacts',(.82,.57,.19),1,.22);texture(m,85,.18,.28,.0004,.10)
m,p=reset('CC_Copper flex',(.36,.12,.012),.15,.32);p.inputs['Coat Weight'].default_value=.38;p.inputs['Coat Roughness'].default_value=.22;texture(m,100,.28,.36,.0004,.10)
m,p=reset('CC_Green FR4',(.009,.063,.027),0,.38);p.inputs['Coat Weight'].default_value=.28;p.inputs['Coat Roughness'].default_value=.24;texture(m,175,.32,.44,.0008,.18)
m,p=reset('CC_Silicon packages',(.007,.008,.008),0,.61);texture(m,160,.52,.69,.0013,.18)
m,p=reset('CC_Optical baffle',(.003,.003,.0035),0,.84);texture(m,120,.77,.9,.002,.20)
m,p=reset('CC_Canon red accent',(.42,.006,.01),0,.4);p.inputs['Coat Weight'].default_value=.12
m,p=reset('CC_White engraving',(.66,.66,.63),0,.5)
m,p=reset('CC_LCD off glass',(.002,.004,.006),0,.085);p.inputs['Coat Weight'].default_value=1;p.inputs['Coat Roughness'].default_value=.045
m,p=reset('CC_LCD grey',(.15,.19,.15),0,.24)
m,p=reset('CC_CMOS dichroic coating',(.025,.017,.06),.12,.065);p.inputs['Coat Weight'].default_value=1;p.inputs['Coat Roughness'].default_value=.04;p.inputs['Thin Film Thickness'].default_value=310;p.inputs['Thin Film IOR'].default_value=1.42
m,p=reset('CC_Coated optical glass',(.985,.99,.995),0,.012);p.inputs['Transmission Weight'].default_value=1;p.inputs['IOR'].default_value=1.52;p.inputs['Thin Film Thickness'].default_value=120;p.inputs['Thin Film IOR'].default_value=1.38
m,p=reset('CC_Pentaprism optical glass',(.98,.985,.99),0,.01);p.inputs['Transmission Weight'].default_value=1;p.inputs['IOR'].default_value=1.52
m,p=reset('CC_Studio slate',(.025,.027,.029),0,.68);texture(m,140,.63,.73,.001,.10)
mirror,p=reset('CC_V2 First surface optical mirror',(.90,.90,.90),1,.018)
shutter,p=reset('CC_V2 Shutter blade black finish',(.008,.009,.01),.36,.39);texture(shutter,90,.33,.45,.0005,.1,(1,1,100))
anodized,p=reset('CC_V2 Black anodized retaining rings',(.01,.011,.012),.55,.37);texture(anodized,160,.31,.42,.0006,.1)
solder,p=reset('CC_V2 Tin solder and leads',(.50,.51,.52),1,.29)
ceramic,p=reset('CC_V2 Ceramic capacitors',(.23,.13,.055),0,.42)
for name in ['CC_Main reflex mirror','CC_Secondary AF mirror']:
    o=bpy.data.objects[name];o.data.materials.clear();o.data.materials.append(mirror)
for o in s.objects:
    if o.name.startswith('CC_Focal plane shutter blade'):
        o.data.materials.clear();o.data.materials.append(shutter)
    if o.name.startswith('CC_Optical retaining ring'):
        o.data.materials.clear();o.data.materials.append(anodized)
# Small soldered leads and silkscreen identifiers; all parented to the moving PCB.
board=bpy.data.objects['CC_Main PCB'];collection=bpy.data.collections['CC_06_Electronics'];parent_inverse=board.matrix_world.inverted()
def detail_cube(name,loc,dim,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name='CC_V2 '+name;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for c in list(o.users_collection):c.objects.unlink(o)
    collection.objects.link(o);o.data.materials.append(mat);be=o.modifiers.new('Solder edge','BEVEL');be.width=.006;be.segments=2;o.parent=board;o.matrix_parent_inverse=parent_inverse
    return o
for i in range(45):
    o=bpy.data.objects['CC_PCB component '+str(i)];x,y,z=o.location;w=o.dimensions.x;h=o.dimensions.z
    if w>=.30:
        for side in [-1,1]:
            for j in range(4):detail_cube('IC lead '+str(i)+' '+str(side)+' '+str(j),(x+side*(w/2+.045),y-.009,z-h*.35+j*h*.23),(.08,.045,.029),solder)
    elif i%3==0:
        o.data.materials.clear();o.data.materials.append(ceramic)
        for side in [-1,1]:detail_cube('Capacitor end '+str(i)+' '+str(side),(x+side*(w/2-.024),y-.048,z),(.046,.018,h*.98),solder)
    if i%4==0:
        cu=bpy.data.curves.new('CC_V2 PCB print '+str(i),'FONT');cu.body=('U' if w>=.30 else 'C')+str(i+10);cu.size=.073;cu.extrude=0
        t=bpy.data.objects.new('CC_V2 PCB print '+str(i),cu);collection.objects.link(t);t.location=(x-w/2,board.location.y-.065,z+h/2+.04);t.rotation_euler=(math.pi/2,0,0);t.data.materials.append(bpy.data.materials['CC_White engraving']);t.parent=board;t.matrix_parent_inverse=parent_inverse
# Neutral photography lighting instead of the earlier blue/orange stylization.
for name,power,color in [('CC_Key softbox',2700,(1,.97,.94)),('CC_Warm rim',2300,(1,.95,.88)),('CC_Front fill',1800,(.93,.97,1)),('CC_Back board softbox',2300,(.97,.98,1))]:
    o=bpy.data.objects[name];o.data.energy=power;o.data.color=color
s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.24,.25,.27,1);s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.32
s.view_settings.exposure=0;s.cycles.samples=128;s.cycles.max_bounces=12;s.cycles.transmission_bounces=10
s['material_revision']='photo-aligned-v2';s['material_scope']='Neutral lighting; nonmetallic powdercoat/rubber; clear AR optical glass; brushed exposed metals; soldermask/chip resin/solder. Appearance approximation, not measured manufacturer PBR.'
s.camera=bpy.data.objects['CC_Cutaway'];s.render.resolution_percentage=50;s.render.filepath=str(Path(__file__).resolve().parent/'materials-v2-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).resolve().parent/'canon5d-materials-v2.blend'))
bpy.ops.render.render(write_still=True)
print(json.dumps({'material_revision':s['material_revision'],'objects':len(s.objects),'preview':s.render.filepath,'saved':bpy.data.filepath}))
