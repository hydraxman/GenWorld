import bpy,json
from pathlib import Path
s=bpy.data.scenes['Canon5D_45s_Film'];bpy.context.window.scene=s;s.render.resolution_percentage=100;s.eevee.taa_render_samples=48
for frame in [805,937,1057]:
    s.frame_set(frame);s.render.filepath=str(Path(__file__).resolve().parent/'previews/full_')+str(frame)+'.png';bpy.ops.render.render(write_still=True)
print(json.dumps({'rendered':[805,937,1057],'engine':s.render.engine,'samples':s.eevee.taa_render_samples}))
