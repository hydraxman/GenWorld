"""15-second native Cycles orbit; preserves the original 46s scene file.
Prepare: Blender -b output/Shunde_Blender_PBR.blend --python orbit15.py -- --prepare
Preview: Blender -b output/Shunde_Orbit_15s.blend --python orbit15.py -- --preview
Render: Blender -b output/Shunde_Orbit_15s.blend --python orbit15.py -- --render
"""
import bpy
import hashlib
import json
import math
import sys
import time
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'output/orbit15'
FPS, FRAMES = 24, 360
WIDTH, HEIGHT = 1280, 720
SAMPLES = 48
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
scene = bpy.context.scene
OUT.mkdir(parents=True, exist_ok=True)


def pose(frame, radius=96.0):
    theta = math.radians(-22)+(frame-1)/FRAMES*math.tau
    target = Vector((0, 20, 8.0))
    location = Vector((target.x+radius*math.sin(theta), target.y-radius*math.cos(theta), 39.0))
    return location, (target-location).to_track_quat('-Z','Y')


def prepare():
    assert scene.name == 'Shunde_Blender_PBR'
    source = ROOT / 'output/Shunde_Blender_PBR.blend'
    source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
    scene.frame_set(1)
    for name in json.loads((ROOT/'source/scene-transfer.json').read_text())['tiers']:
        obj = bpy.data.objects[name]
        obj.animation_data_clear()
        obj.location.z = 0
    scene.name = 'Shunde_Orbit_15s'
    scene.frame_start, scene.frame_end = 1, FRAMES
    scene.render.fps = FPS
    scene.render.resolution_x, scene.render.resolution_y = WIDTH, HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.use_persistent_data = True
    scene.cycles.samples = SAMPLES
    scene.cycles.adaptive_threshold = .04
    scene.cycles.use_denoising = True
    scene.cycles.seed = 17
    scene.cycles.use_animated_seed = False
    scene.cycles.device = 'GPU'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for device in prefs.devices:
        device.use = device.type == 'METAL'
    data = bpy.data.cameras.new('Camera_Orbit_15s')
    camera = bpy.data.objects.new(data.name, data)
    bpy.data.collections['CAMERAS'].objects.link(camera)
    camera.rotation_mode = 'QUATERNION'
    data.sensor_fit = 'VERTICAL'
    data.sensor_height = 24
    data.lens = 24/(2*math.tan(math.radians(38)/2))
    data.clip_start, data.clip_end = .15, 500
    scene.camera = camera
    scene.timeline_markers.clear()
    for f, name in [(1,'Front-left'),(91,'Right side'),(181,'Rear'),(271,'Left side')]:
        scene.timeline_markers.new(name, frame=f)
    points = np.array([tuple(o.matrix_world @ Vector(c)) for o in bpy.data.objects['Shunde V3 architecture — confirmed rear, estimated dimensions'].children_recursive if o.type=='MESH' for c in o.bound_box])
    homogeneous = np.column_stack((points, np.ones(len(points))))
    depsgraph=bpy.context.evaluated_depsgraph_get()
    # Fit the entire orbit, not just four cardinal screenshots.
    for radius in range(96, 161, 4):
        audit=[]
        for frame in range(1,FRAMES+2):
            camera.location, camera.rotation_quaternion = pose(frame, radius)
            bpy.context.view_layer.update()
            projection = camera.calc_matrix_camera(depsgraph, x=WIDTH, y=HEIGHT)
            clip = homogeneous @ np.array(projection @ camera.matrix_world.inverted()).T
            ndc = clip[:,:2]/clip[:,3:4]
            low, high=(ndc.min(axis=0)+1)/2,(ndc.max(axis=0)+1)/2
            assert np.isfinite(ndc).all() and (clip[:,3]>0).all()
            audit.append({'frame':frame,'position':list(camera.location),'bounds01':[low.tolist(),high.tolist()]})
        if all(min(row['bounds01'][0])>.05 and max(row['bounds01'][1])<.95 for row in audit):
            break
    else:
        raise AssertionError('Unable to frame building through full orbit')
    for frame in range(1,FRAMES+2):
        camera.location, camera.rotation_quaternion = pose(frame, radius)
        camera.keyframe_insert('location',frame=frame)
        camera.keyframe_insert('rotation_quaternion',frame=frame)
    assert (pose(1,radius)[0]-pose(FRAMES+1,radius)[0]).length<1e-5
    scene.frame_set(1)
    scene['source_pbr_sha256']=source_sha
    scene['orbit_description']='Full 360-degree constant-speed orbit in 15 seconds; original building and materials unchanged.'
    manifest={'duration':15,'fps':FPS,'frames':FRAMES,'size':[WIDTH,HEIGHT],'samples':SAMPLES,'engine':'CYCLES','source_blend_sha256':source_sha,'orbit_radius':radius,'camera_height':39,'target':[0,20,8.0],'vertical_fov':38,'bounds_checks':audit,'audio':'none','overlays':'none'}
    (OUT/'orbit-manifest.json').write_text(json.dumps(manifest,indent=2))
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'output/Shunde_Orbit_15s.blend'),compress=True)
    assert hashlib.sha256(source.read_bytes()).hexdigest()==source_sha
    print('PREPARED',json.dumps({k:v for k,v in manifest.items() if k!='bounds_checks'}),flush=True)


def render():
    assert scene.name=='Shunde_Orbit_15s'
    # Device selection is process-local; GPU in the saved scene is insufficient.
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='METAL'
    prefs.get_devices()
    for device in prefs.devices:
        device.use=device.type=='METAL'
    assert any(d.use and d.type=='METAL' for d in prefs.devices), 'Metal GPU is not enabled'
    scene.cycles.device='GPU'
    print('RENDER_DEVICES',[(d.name,d.type,d.use) for d in prefs.devices],flush=True)
    preview='--preview' in args
    folder=OUT/('preview' if preview else 'frames')
    folder.mkdir(exist_ok=True)
    start_frame=int(args[args.index('--start')+1]) if '--start' in args else 1
    end_frame=int(args[args.index('--end')+1]) if '--end' in args else FRAMES
    assert 1<=start_frame<=end_frame<=FRAMES
    frames=[1,91,181,271] if preview else range(start_frame,end_frame+1)
    scene.render.resolution_percentage=50 if preview else 100
    scene.cycles.samples=24 if preview else SAMPLES
    scene.cycles.adaptive_threshold=.06 if preview else .04
    scene.render.use_persistent_data=True
    source_blend=ROOT/'output/Shunde_Orbit_15s.blend'
    fingerprint=hashlib.sha256(source_blend.read_bytes()+Path(__file__).read_bytes()+str(preview).encode()).hexdigest()
    config_path=folder/'render-config.json'
    if config_path.exists():
        assert json.loads(config_path.read_text())['fingerprint']==fingerprint,'Render configuration changed; preserve frames and use a new output folder'
    config_path.write_text(json.dumps({'fingerprint':fingerprint,'preview':preview,'samples':scene.cycles.samples}))
    started=time.monotonic()
    times=[]
    for frame in frames:
        path=folder/f'frame_{frame:04d}.png'
        if not preview and path.exists():
            with path.open('rb') as f:
                f.seek(-12,2)
                assert f.read()==b'\x00\x00\x00\x00IEND\xaeB`\x82', f'Truncated frame: {path}'
            continue
        t=time.monotonic()
        scene.frame_set(frame)
        scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        elapsed=time.monotonic()-t
        times.append(elapsed)
        report={'last_frame':frame,'total_frames':len(frames) if preview else FRAMES,'batch_frames':len(frames),'elapsed_seconds':time.monotonic()-started,'mean_frame_seconds':sum(times)/len(times),'preview':preview,'fingerprint':fingerprint}
        (OUT/('preview-progress.json' if preview else 'progress.json')).write_text(json.dumps(report,indent=2))
        print('ORBIT_PROGRESS',json.dumps(report),flush=True)

if '--prepare' in args:
    prepare()
if '--preview' in args or '--render' in args:
    render()
