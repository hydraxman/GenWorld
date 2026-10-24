import bpy
from pathlib import Path
root=Path(__file__).resolve().parent
# Data-only interchange strips .blend code/handlers before GUI import.
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/canon_eos5d_mark_iv_original.blend'),use_scripts=False)
for o in bpy.context.scene.objects:o.select_set(o.type in {'MESH','EMPTY'})
bpy.ops.export_scene.gltf(filepath=str(root/'assets/canon_eos5d_mark_iv.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
print('EXPORTED_DATA_ONLY_GLB')
