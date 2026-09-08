import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parent
s=bpy.data.scenes['Canon5D_Replacement_V3'];bpy.context.window.scene=s
for m in bpy.data.materials:
    if not m.name.startswith('V3_'):continue
    if 'Multicoated glass' in m.name:
        nt=m.node_tree;nt.nodes.clear();out=nt.nodes.new('ShaderNodeOutputMaterial');p=nt.nodes.new('ShaderNodeBsdfPrincipled');clear=nt.nodes.new('ShaderNodeBsdfTransparent');mix=nt.nodes.new('ShaderNodeMixShader')
        p.inputs['Base Color'].default_value=(.008,.025,.016,1);p.inputs['Metallic'].default_value=.38;p.inputs['Roughness'].default_value=.09;p.inputs['Coat Weight'].default_value=.4
        mix.inputs[0].default_value=.58;nt.links.new(clear.outputs[0],mix.inputs[1]);nt.links.new(p.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],out.inputs['Surface'])
    if 'PlasticMaterial' in m.name:
        for p in m.node_tree.nodes:
            if p.type=='BSDF_PRINCIPLED':
                p.inputs['Roughness'].default_value=.48;p.inputs['Specular IOR Level'].default_value=.28;p.inputs['Coat Weight'].default_value=.03
# Restore top display mapping from the packed source image using explicit local UVs.
m=bpy.data.materials.new('V3_TopLCD_Restored');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.34
tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(root/'assets/textures/2_Image_2_002.png'),check_existing=True);tex.image.pack();m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
for o in s.objects:
    if o.name.startswith('V3_Asset_LCD__'):
        o.data.materials.clear();o.data.materials.append(m)
        uv=o.data.uv_layers.active or o.data.uv_layers.new(name='DisplayUV')
        xs=[v.co.x for v in o.data.vertices];ys=[v.co.y for v in o.data.vertices];xmin,xmax=min(xs),max(xs);ymin,ymax=min(ys),max(ys)
        for poly in o.data.polygons:
            for idx in poly.loop_indices:
                v=o.data.vertices[o.data.loops[idx].vertex_index].co
                uv.data[idx].uv=((v.x-xmin)/(xmax-xmin),(v.y-ymin)/(ymax-ymin))
s.frame_set(1);s.render.filepath=str(root/'frames/frame_');s.eevee.taa_render_samples=24;s.blendermcp_auto_start_server=False
for sc in bpy.data.scenes:sc.blendermcp_auto_start_server=False
bpy.ops.wm.save_as_mainfile(filepath=str(root/'canon5d-v3-production.blend'))
for f in [1,97]:
    s.frame_set(f);s.render.filepath=str(root/'previews'/f'polished_{f}.png');bpy.ops.render.render(write_still=True)
print('POLISH_COMPLETE')
