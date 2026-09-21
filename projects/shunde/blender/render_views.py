"""Render real Cycles views without overwriting the saved production scene.
Blender -b output/Shunde_Blender_PBR.blend --python render_views.py -- --draft front entrance
Use --final for 1920px views; no flags renders draft previews.
"""
import bpy
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
final = '--final' in args
names = [a for a in args if not a.startswith('--')] or ['front', 'entrance', 'rear', 'top', 'exploded']
meta = json.loads((ROOT / 'source/scene-transfer.json').read_text())
scene = bpy.context.scene
folder = ROOT / ('output/renders' if final else 'qa/draft')
folder.mkdir(parents=True, exist_ok=True)
scene.cycles.samples = 128 if final else 24
scene.cycles.adaptive_threshold = .018 if final else .08
scene.cycles.use_denoising = True
results = []
for name in names:
    start = time.monotonic()
    if name == 'exploded':
        scene.frame_set(1201)
        scene.camera = bpy.data.objects['Camera_Original_46s']
        width, height = 1920, 1080
    else:
        scene.frame_set(1)
        scene.camera = bpy.data.objects['Camera_'+name]
        width, height = meta['captures'][name]['size']
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100 if final else 50
    scene.render.filepath = str(folder / (name+'.png'))
    bpy.ops.render.render(write_still=True)
    result = {'view': name, 'path': str(folder/(name+'.png')), 'seconds': time.monotonic()-start,
              'width': width if final else width//2, 'height': height if final else height//2,
              'samples': scene.cycles.samples, 'engine': scene.render.engine, 'device': scene.cycles.device}
    results.append(result)
    (folder / 'render-report.json').write_text(json.dumps(results, indent=2))
    print('RENDER_RESULT', json.dumps(result), flush=True)
