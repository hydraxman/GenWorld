import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parent
s=bpy.data.scenes['Canon5D_Replacement_V3'];bpy.context.window.scene=s
s.render.resolution_percentage=100;s.eevee.taa_render_samples=32
# Restore grain lost by data-only interchange; preserve packed decal images.
for m in bpy.data.materials:
    if m.name.startswith('V3_') and any(x in m.name for x in ['LEATHER','Rubber','guma']):
        p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if p and not p.inputs['Normal'].is_linked:
            tex=m.node_tree.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=170;tex.inputs['Detail'].default_value=2
            bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.008
            m.node_tree.links.new(tex.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
s.frame_set(1);s.render.filepath=str(root/'frames/frame_')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'canon5d-v3-production.blend'))
q=root/'previews';q.mkdir(exist_ok=True)
for f in [1,97,241,265,313,649,805,937,1057]:
    s.frame_set(f);s.render.filepath=str(q/f'frame_{f}.png');bpy.ops.render.render(write_still=True)
print('PREVIEW_COMPLETE')
