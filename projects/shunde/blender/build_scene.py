"""Build an editable Blender scene from the verified current Three.js export.
Run: Blender --background --factory-startup --disable-autoexec --python build_scene.py
No geometry is remodelled or decimated; material/light upgrades are explicit.
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from verify_scene import axis, geometry_signature

META = json.loads((ROOT / 'source/scene-transfer.json').read_text())
ASSETS = json.loads((ROOT / 'assets/materials.json').read_text())
OUTPUT = ROOT / 'output'
OUTPUT.mkdir(exist_ok=True)


def image_node(mat, filename, label, noncolor=False):
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.name = node.label = label
    node.image = bpy.data.images.load(str(ROOT / 'assets' / filename), check_existing=True)
    if noncolor:
        node.image.colorspace_settings.name = 'Non-Color'
    return node


def set_input(shader, name, value):
    shader.inputs[name].default_value = value


def base_shader(mat):
    mat.use_nodes = True
    return next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def upgrade(mat_name, asset_key, world_scale: float = 1.0, color_mix: float = 1.0, tint=None, roughness=.65, normal_strength=.22):
    """Retain original authored tile grid where color_mix<1; scanned surface microdetail otherwise."""
    mat = bpy.data.materials[mat_name]
    material = ASSETS[asset_key]
    mat['cc0_assets'] = material['asset_id']
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = base_shader(mat)
    uv = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeVectorMath')
    mapping.operation = 'SCALE'
    mapping.inputs[3].default_value = world_scale
    links.new(uv.outputs['UV'], mapping.inputs[0])
    tex = image_node(mat, material['color'], 'CC0 scanned albedo')
    links.new(mapping.outputs[0], tex.inputs['Vector'])
    color = tex.outputs['Color']
    if tint:
        multiply = nodes.new('ShaderNodeMixRGB')
        multiply.blend_type = 'MULTIPLY'
        multiply.inputs[0].default_value = 1
        multiply.inputs[2].default_value = (*tint, 1)
        links.new(color, multiply.inputs[1])
        color = multiply.outputs[0]
    if color_mix < 1 and bsdf.inputs['Base Color'].is_linked:
        original = bsdf.inputs['Base Color'].links[0].from_socket
        mix = nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = color_mix
        links.new(original, mix.inputs[1])
        links.new(color, mix.inputs[2])
        color = mix.outputs[0]
    links.new(color, bsdf.inputs['Base Color'])
    rough = image_node(mat, material['roughness'], 'CC0 measured roughness', True)
    links.new(mapping.outputs[0], rough.inputs['Vector'])
    ramp = nodes.new('ShaderNodeMapRange')
    ramp.inputs['To Min'].default_value = max(.05, roughness-.15)
    ramp.inputs['To Max'].default_value = min(1, roughness+.15)
    links.new(rough.outputs['Color'], ramp.inputs['Value'])
    links.new(ramp.outputs[0], bsdf.inputs['Roughness'])
    if color_mix >= 1:
        normal = image_node(mat, material['normal'], 'CC0 OpenGL normal', True)
        links.new(mapping.outputs[0], normal.inputs['Vector'])
        normalmap = nodes.new('ShaderNodeNormalMap')
        normalmap.inputs['Strength'].default_value = normal_strength
        links.new(normal.outputs['Color'], normalmap.inputs['Color'])
        links.new(normalmap.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        # Preserve actual 105 mm orthogonal tile joints, layer only restrained rough micro-bump.
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .12
        bump.inputs['Distance'].default_value = .0012
        if bsdf.inputs['Normal'].is_linked:
            links.new(bsdf.inputs['Normal'].links[0].from_socket, bump.inputs['Normal'])
        links.new(rough.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    set_input(bsdf, 'Metallic', 0)
    mat.diffuse_color = (.48, .46, .43, 1)
    return mat


def make_camera(name, pose):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.data.collections['CAMERAS'].objects.link(obj)
    obj.rotation_mode = 'QUATERNION'
    data.sensor_fit = 'VERTICAL'
    data.sensor_height = 24
    data.clip_start = .15
    data.clip_end = 500
    pose_camera(obj, pose)
    if pose.get('orthoWidth'):
        data.type = 'ORTHO'
        # Blender's vertical sensor-fit interprets ortho_scale as image height.
        data.ortho_scale = pose['orthoWidth'] * pose['size'][1] / pose['size'][0]
    return obj


def pose_camera(camera, pose):
    camera.location = axis(pose['position'])
    camera.rotation_quaternion = (axis(pose['target'])-camera.location).to_track_quat('-Z', 'Y')
    camera.data.lens = 24/(2*math.tan(math.radians(pose.get('fov', 44))/2))


def add_sun(name, position, target, energy, color, angle):
    data = bpy.data.lights.new(name, 'SUN')
    data.energy = energy
    data.color = color
    data.angle = math.radians(angle)
    obj = bpy.data.objects.new(name, data)
    bpy.data.collections['LIGHTING'].objects.link(obj)
    obj.location = axis(position)
    obj.rotation_euler = (axis(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()
    return obj


def restore_instance_colors():
    """Blender's glTF importer drops custom _COLOR_0 on EXT_mesh_gpu_instancing."""
    import struct
    import numpy as np
    baseline = {}
    for filename in ['shunde-campus.glb', 'reflection-grove.glb']:
        raw = (ROOT / 'source' / filename).read_bytes()
        length = struct.unpack_from('<I', raw, 12)[0]
        gltf = json.loads(raw[20:20+length])
        binary = memoryview(raw)[28+length:]
        def accessor(index):
            a = gltf['accessors'][index]
            view = gltf['bufferViews'][a['bufferView']]
            dtype = {5126:'<f4', 5121:'u1', 5123:'<u2'}[a['componentType']]
            width = {'VEC3':3, 'VEC4':4}[a['type']]
            dt = np.dtype(dtype)
            result = np.ndarray((a['count'], width), dtype=dt, buffer=binary,
                offset=view.get('byteOffset',0)+a.get('byteOffset',0),
                strides=(view.get('byteStride', width*dt.itemsize), dt.itemsize)).astype(float)
            if a.get('normalized') and a['componentType'] != 5126:
                result /= np.iinfo(dt).max
            return result
        for node in gltf['nodes']:
            attrs = node.get('extensions', {}).get('EXT_mesh_gpu_instancing', {}).get('attributes', {})
            if '_COLOR_0' not in attrs:
                continue
            parent = bpy.data.objects[node['name']]
            positions, colors = accessor(attrs['TRANSLATION']), accessor(attrs['_COLOR_0'])
            key = lambda p: tuple(round(float(c), 4) for c in p)
            children = {key(o.location):o for o in parent.children}
            assert len(children) == len(positions), 'Ambiguous glTF instance translation'
            for position, color in zip(positions, colors):
                obj = children[key(axis(position))]
                rgba = tuple(color[:3])+(float(color[3]) if len(color)>3 else 1.0,)
                obj.color = rgba
                baseline[obj.name] = list(rgba)
            material = parent.children[0].active_material
            nodes, links = material.node_tree.nodes, material.node_tree.links
            p = base_shader(material)
            factor = tuple(p.inputs['Base Color'].default_value)
            info = nodes.new('ShaderNodeObjectInfo')
            multiply = nodes.new('ShaderNodeMixRGB')
            multiply.blend_type = 'MULTIPLY'
            multiply.inputs[0].default_value = 1
            multiply.inputs[2].default_value = factor
            links.new(info.outputs['Color'], multiply.inputs[1])
            links.new(multiply.outputs[0], p.inputs['Base Color'])
    (ROOT / 'source/instance-colors.json').write_text(json.dumps(baseline))
    print('Restored exact per-instance colours:', len(baseline))


def build():
    # This script is intended for a separate factory-startup process, never the user's GUI scene.
    assert not bpy.data.filepath, 'Use a fresh --factory-startup process, not an existing .blend'
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    scene = bpy.context.scene
    scene.name = 'Shunde_Blender_PBR'
    scene['source_commit'] = META['sourceCommit']
    scene['source_glb_sha256'] = META['glbSha256']
    scene['dimensions_status'] = 'Photographic/sketch working scale, not surveyed CAD'
    for name in ['SOURCE_GEOMETRY', 'CAMERAS', 'LIGHTING']:
        scene.collection.children.link(bpy.data.collections.new(name))
    for filename in ['shunde-campus.glb', 'reflection-grove.glb']:
        bpy.ops.import_scene.gltf(filepath=str(ROOT / 'source' / filename))
    imported = list(scene.objects)
    for obj in imported:
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        bpy.data.collections['SOURCE_GEOMETRY'].objects.link(obj)
    (ROOT / 'source/geometry-baseline.json').write_text(json.dumps(geometry_signature(imported), indent=2))
    # Imported vertex coordinates already use Blender Z-up; preserve every position and hierarchy.
    upgrade('Pale warm-gray square ceramic grid', 'concrete', .84, .10, roughness=.60)
    upgrade('Muted mauve-gray square-grid spandrels', 'concrete', .84, .10, roughness=.66)
    upgrade('Gray fine-grained round column stone', 'concrete', .7, .15, roughness=.38)
    stone = upgrade('Dark brown mottled entrance stone', 'stone', 3, 1, roughness=.32, normal_strength=.16)
    shader = base_shader(stone)
    set_input(shader, 'Coat Weight', .12)
    set_input(shader, 'Coat Roughness', .17)
    upgrade('Gray forecourt paving', 'paving', 2, 1, roughness=.80, normal_strength=.40)
    upgrade('Inferred thin concrete slabs', 'concrete', 1, 1, roughness=.78)
    if 'grass' in ASSETS:
        upgrade('Muted campus lawn', 'grass', 1.5, 1, tint=(.40,.66,.38), roughness=.95, normal_strength=.40)
    glass = bpy.data.materials['Unified sky-reflecting architectural glass']
    p = base_shader(glass)
    for socket in ['Base Color', 'Metallic', 'Roughness', 'Normal']:
        for link in list(p.inputs[socket].links):
            glass.node_tree.links.remove(link)
    set_input(p, 'Base Color', (.76, .86, .91, 1))
    set_input(p, 'Metallic', 0)
    set_input(p, 'Roughness', .075)
    set_input(p, 'IOR', 1.52)
    set_input(p, 'Transmission Weight', .88)
    set_input(p, 'Coat Weight', .25)
    set_input(p, 'Coat Roughness', .055)
    glass['method'] = 'Cycles ray-traced glazing: actual environment and geometry, not cube-map metal'
    frame = base_shader(bpy.data.materials['Warm silver anodized aluminium'])
    set_input(frame, 'Metallic', .72)
    set_input(frame, 'Roughness', .26)
    # Thin pine needles stay instanced; small subsurface helps back-lit branches without changing geometry.
    pine = base_shader(bpy.data.materials['Pine needle surfaces — dark olive green'])
    set_input(pine, 'Roughness', .72)
    set_input(pine, 'Subsurface Weight', .06)
    restore_instance_colors()
    world = bpy.data.worlds.new('CC0 exterior daylight')
    scene.world = world
    world.use_nodes = True
    world['hdri_license'] = 'CC0'
    world['hdri_asset'] = ASSETS['hdri']['asset_id']
    nodes, links = world.node_tree.nodes, world.node_tree.links
    env = nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(str(ROOT / 'assets' / ASSETS['hdri']['file']))
    texcoord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Rotation'].default_value[2] = math.radians(70)
    links.new(texcoord.outputs['Generated'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], env.inputs['Vector'])
    background = nodes.get('Background')
    background.inputs['Strength'].default_value = .85
    links.new(env.outputs['Color'], background.inputs['Color'])
    # Original procedural sky for camera rays; CC0 HDRI for illumination/reflections only.
    original_sky = nodes.new('ShaderNodeTexEnvironment')
    original_sky.image = bpy.data.images.load(str(ROOT / 'source/original-sky.png'))
    sky_background = nodes.new('ShaderNodeBackground')
    sky_background.inputs['Strength'].default_value = .65
    # Keep the original sky as an editable reference; use a clean atmospheric sky for the beauty view.
    original_sky.label = 'Original Three.js sky — optional reference'
    atmosphere = nodes.new('ShaderNodeTexSky')
    atmosphere.sky_type = 'HOSEK_WILKIE'
    atmosphere.sun_direction = axis([-24,42,23]).normalized()
    atmosphere.turbidity = 2.2
    atmosphere.ground_albedo = .22
    links.new(atmosphere.outputs['Color'], sky_background.inputs['Color'])
    lightpath = nodes.new('ShaderNodeLightPath')
    sky_mix = nodes.new('ShaderNodeMixShader')
    links.new(lightpath.outputs['Is Camera Ray'], sky_mix.inputs[0])
    links.new(background.outputs[0], sky_mix.inputs[1])
    links.new(sky_background.outputs[0], sky_mix.inputs[2])
    links.new(sky_mix.outputs[0], nodes.get('World Output').inputs['Surface'])
    add_sun('Sun_original_direction', [-24,43,32], [0,1,9], 2.8, (1,.91,.79), 2)
    add_sun('Soft_cool_fill', [25,16,-12], [0,5,0], .18, (.78,.86,1), 20)
    fill_data = bpy.data.lights.new('Large soft facade bounce', 'AREA')
    fill_data.energy = 5000
    fill_data.specular_factor = 0
    fill_data.transmission_factor = 0
    fill_data.shape = 'DISK'
    fill_data.size = 28
    fill_data.color = (.88,.94,1)
    fill = bpy.data.objects.new(fill_data.name, fill_data)
    fill.visible_glossy = False
    fill.visible_transmission = False
    bpy.data.collections['LIGHTING'].objects.link(fill)
    fill.location = axis([0,20,40])
    fill.rotation_euler = (axis([0,7,4])-fill.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.cycles.adaptive_threshold = .015
    scene.cycles.max_bounces = 8
    scene.cycles.transmission_bounces = 8
    scene.cycles.transparent_max_bounces = 8
    scene.cycles.seed = 17
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for device in prefs.devices:
            device.use = device.type == 'METAL'
        scene.cycles.device = 'GPU'
    except Exception as exc:
        print('Metal unavailable; use Cycles CPU:', exc)
        scene.cycles.device = 'CPU'
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.fps = 30
    scene.frame_start, scene.frame_end = 1, 1380
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = .4
    scene.render.film_transparent = False
    tiers = [bpy.data.objects[name] for name in META['tiers']]
    film = make_camera('Camera_Original_46s', META['samples'][0])
    for sample in META['samples']:
        f = sample['frame']
        pose_camera(film, sample)
        film.keyframe_insert('location', frame=f)
        film.keyframe_insert('rotation_quaternion', frame=f)
        film.data.keyframe_insert('lens', frame=f)
        # Imported glTF parent identity; Y-up displacement is Blender Z-up.
        for obj, y in zip(tiers, sample['tierY']):
            obj.location.z = y
            obj.keyframe_insert('location', frame=f)
    for name, spec in META['captures'].items():
        make_camera('Camera_'+name, spec)
    for frame_number, title in [(1,'01 | Main facade'),(241,'02 | Entrance'),(481,'03 | Side'),(721,'04 | Stone detail'),(931,'05 | Rear wedge'),(1081,'06 | Exploded assembly'),(1366,'Closed')]:
        scene.timeline_markers.new(title, frame=frame_number)
    scene.camera = film
    scene.frame_set(1)
    bpy.ops.file.pack_all()
    # Opening the packed file does not require Python auto-execution or an MCP service.
    if hasattr(scene, 'blendermcp_auto_start_server'):
        scene.blendermcp_auto_start_server = False
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.shading.type = 'MATERIAL'
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / 'Shunde_Blender_PBR.blend'), compress=True)
    print('SAVED', OUTPUT / 'Shunde_Blender_PBR.blend')

if __name__ == '__main__':
    build()
