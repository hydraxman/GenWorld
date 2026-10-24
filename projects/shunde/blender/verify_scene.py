"""Run using Blender --background <blend> --python verify_scene.py.
Checks the actual saved scene, source geometry, camera projection and animation.
"""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parent

def axis(p):
    return Vector((p[0], -p[2], p[1]))

def geometry_signature(objects):
    """Mesh datablocks and object multiplicities; detects dropped glTF instances."""
    meshes = {}
    for obj in objects:
        if obj.type != 'MESH':
            continue
        mesh = obj.data
        if mesh.name not in meshes:
            import array
            vertices = array.array('f', [0.0]) * (len(mesh.vertices) * 3)
            mesh.vertices.foreach_get('co', vertices)
            meshes[mesh.name] = {'vertices': len(mesh.vertices), 'polygons': len(mesh.polygons),
                                  'sha256': hashlib.sha256(vertices.tobytes()).hexdigest(), 'users': 0}
        meshes[mesh.name]['users'] += 1
    return meshes

def verify():
    manifest = json.loads((ROOT / 'source/scene-transfer.json').read_text())
    scene = bpy.context.scene
    assert scene.name == 'Shunde_Blender_PBR', 'Missing migrated scene'
    collection = bpy.data.collections['SOURCE_GEOMETRY']
    expected = json.loads((ROOT / 'source/geometry-baseline.json').read_text())
    assert geometry_signature(collection.all_objects) == expected, 'Source mesh or instance loss'
    pine_children = bpy.data.objects['Instanced curved pine needle fascicles'].children
    assert len(pine_children) == manifest['stats']['leafInstances']
    assert len({tuple(round(c, 5) for c in obj.color) for obj in pine_children}) > 100, 'glTF instance colours lost'
    color_baseline = json.loads((ROOT / 'source/instance-colors.json').read_text())
    for name, expected_color in color_baseline.items():
        assert max(abs(a-b) for a,b in zip(bpy.data.objects[name].color, expected_color)) < 1e-6
    tiers = [bpy.data.objects[name] for name in manifest['tiers']]
    camera = bpy.data.objects['Camera_Original_46s']
    assert scene.render.fps == manifest['fps']
    assert (scene.frame_start, scene.frame_end) == (1, 1380)
    errors = []
    # Every authored frame, not only key shot poses.
    for sample in manifest['samples']:
        scene.frame_set(sample['frame'])
        assert (camera.location-axis(sample['position'])).length < 2e-5
        direction = camera.rotation_quaternion @ Vector((0, 0, -1))
        expected_direction = (axis(sample['target'])-camera.location).normalized()
        assert (direction-expected_direction).length < 2e-5
        assert abs(camera.data.angle_y-math.radians(sample['fov'])) < 2e-6
        for obj, y in zip(tiers, sample['tierY']):
            assert abs(obj.location.z-y) < 2e-5, obj.name
    for label, spec in manifest['captures'].items():
        cam = bpy.data.objects['Camera_'+label]
        assert (cam.location-axis(spec['position'])).length < 2e-5
    missing = [img.name for img in bpy.data.images if img.source == 'FILE' and not img.packed_file and img.size[0] > 0]
    assert not missing, ('Unpacked image dependencies', missing)
    assert scene.render.engine == 'CYCLES'
    pbr = [m for m in bpy.data.materials if m.get('cc0_assets')]
    assert len(pbr) >= 4, 'CC0 textures not assigned to actual materials'
    assert scene.world.get('hdri_license') == 'CC0'
    glass = bpy.data.materials['Unified sky-reflecting architectural glass']
    principled = next(n for n in glass.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    assert principled.inputs['Transmission Weight'].default_value > .7
    assert principled.inputs['Metallic'].default_value == 0
    scene.frame_set(1)
    building = bpy.data.objects['Shunde V3 architecture — confirmed rear, estimated dimensions']
    corners = [obj.matrix_world @ Vector(c) for obj in building.children_recursive if obj.type == 'MESH' for c in obj.bound_box]
    low = [min(p[i] for p in corners) for i in range(3)]
    high = [max(p[i] for p in corners) for i in range(3)]
    source_bounds = manifest['stats']['buildingBounds']
    lo, hi = source_bounds['min'], source_bounds['max']
    expected_low, expected_high = [lo[0], -hi[2], lo[1]], [hi[0], -lo[2], hi[1]]
    assert max(abs(a-b) for a,b in zip(low+high, expected_low+expected_high)) < 1e-4, 'Building world bounds differ from Three.js'
    report = {'pass': True, 'building_bounds_match': True, 'instance_colors_checked': len(color_baseline), 'camera_samples_checked': len(manifest['samples']),
              'tiers_checked': len(tiers), 'source_mesh_datablocks': len(expected),
              'source_mesh_objects': sum(v['users'] for v in expected.values()),
              'source_glb_sha256': manifest['glbSha256'], 'packed_images': sum(bool(i.packed_file) for i in bpy.data.images),
              'cc0_materials': [m.name for m in pbr], 'engine': scene.render.engine,
              'scene': scene.name, 'dimensions_status': 'photo/sketch estimates, not surveyed',
              'animation': '46 seconds at 30fps; every sampled source camera and tier pose verified'}
    (ROOT / 'qa').mkdir(exist_ok=True)
    (ROOT / 'qa/scene-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print('VERIFIED', json.dumps(report, ensure_ascii=False))

if __name__ == '__main__':
    verify()
