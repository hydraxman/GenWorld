import bpy,json
from pathlib import Path
s=bpy.data.scenes['Canon5D_45s_Film'];bpy.context.window.scene=s;s.frame_start=1;s.frame_end=24;s.render.resolution_percentage=100;s.eevee.taa_render_samples=24;s.eevee.use_raytracing=False;s.render.filepath=str(Path(__file__).resolve().parent/'perf/frame_');bpy.ops.render.render(animation=True)
print(json.dumps({'frames':24,'resolution':[s.render.resolution_x,s.render.resolution_y],'samples':s.eevee.taa_render_samples,'raytracing':s.eevee.use_raytracing}))
