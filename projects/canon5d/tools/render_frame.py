"""Render a safe local QA frame from the final saved blend, without saving it.
Blender --background --factory-startup --disable-autoexec <production.blend>
  --python-exit-code 1 --python tools/render_frame.py -- 481
"""
import json
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'qa'
OUTPUT.mkdir(exist_ok=True)
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
frame = int(args[0]) if args else 481
assert 1 <= frame <= 1080
scene = bpy.data.scenes['Canon5D_Replacement_V3']
bpy.context.window.scene = scene
scene.frame_set(frame)
bpy.context.view_layer.update()
missing = [i.name for i in bpy.data.images if i.source == 'FILE' and not i.packed_file
           and not Path(bpy.path.abspath(i.filepath)).is_file()]
assert not missing, missing
report = {
    'blender': bpy.app.version_string,
    'scene': scene.name,
    'engine': scene.render.engine,
    'resolution': [scene.render.resolution_x, scene.render.resolution_y],
    'resolution_percentage': scene.render.resolution_percentage,
    'fps': scene.render.fps,
    'frame_range': [scene.frame_start, scene.frame_end],
    'samples': scene.eevee.taa_render_samples,
    'view_transform': scene.view_settings.view_transform,
    'camera': scene.camera.name,
    'camera_type': scene.camera.data.type,
    'camera_ortho_scale': scene.camera.data.ortho_scale,
    'camera_lens_mm': scene.camera.data.lens,
    'lens_note': 'Lens value is not used for ORTHO projection',
    'raytracing': scene.eevee.use_raytracing,
    'world_unit_system': scene.unit_settings.system,
    'world_unit_scale': scene.unit_settings.scale_length,
    'missing_external_images': missing,
    'frame': frame,
    'output': f'qa/render-{frame}.png',
    'source_blend_not_saved': True,
}
scene.render.filepath = str(OUTPUT / f'render-{frame}.png')
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
(OUTPUT / 'scene-runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False))
