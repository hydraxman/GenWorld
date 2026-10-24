"""Offline validation of downloaded originals and Blender mapping."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / 'manifest.json').read_text())
mapping = json.loads((ROOT / 'materials.json').read_text())
files = manifest['files']
assert len(files) == 13 and len(manifest['assets']) == 5
assert len({x['local_relative_path'] for x in files}) == 13
for item in files:
    path = ROOT / item['local_relative_path']
    data = path.read_bytes()
    assert len(data) == item['bytes'] == item['expected_bytes']
    assert hashlib.sha256(data).hexdigest() == item['sha256']
    assert hashlib.md5(data).hexdigest() == item['expected_md5']
    if item['kind'] != 'hdri':
        with Image.open(path) as img:
            img.load()
            assert img.size == (2048, 2048)
for item in manifest['derivatives']:
    path = ROOT / item['local_relative_path']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']
    assert hashlib.sha256((ROOT / item['source_relative_path']).read_bytes()).hexdigest() == item['source_sha256']
    with Image.open(path) as img:
        img.load()
        assert img.size == (2048, 2048)
known = {item['local_relative_path']: item for item in files + manifest['derivatives']}
for name, entry in mapping.items():
    for key in ('color', 'roughness', 'normal', 'file'):
        if key in entry:
            assert entry[key] in known, entry[key]
            assert (ROOT / entry[key]).is_file()
    if name != 'hdri':
        assert known[entry['normal']]['kind'] == 'normal_opengl'

# Decode standard Radiance per-scanline RLE without optional image plugins.
data = (ROOT / mapping['hdri']['file']).read_bytes()
header = re.search(rb'-Y\s+(\d+)\s+\+X\s+(\d+)\n', data)
assert header
h, w = map(int, header.groups())
assert (w, h) == (2048, 1024)
pos = header.end()
rgbe = np.zeros((h, w, 4), dtype=np.uint8)
for y in range(h):
    assert data[pos:pos + 4] == bytes([2, 2, w >> 8, w & 255]), (y, pos)
    pos += 4
    for channel in range(4):
        x = 0
        while x < w:
            count = data[pos]
            pos += 1
            assert count > 0
            if count > 128:
                n = count - 128
                assert x + n <= w
                rgbe[y, x:x+n, channel] = data[pos]
                pos += 1
            else:
                n = count
                assert x + n <= w
                rgbe[y, x:x+n, channel] = np.frombuffer(data[pos:pos+n], dtype=np.uint8)
                pos += n
            x += n
assert pos == len(data), (pos, len(data))
scale = np.exp2(rgbe[:, :, 3].astype(np.float32) - 136)
scale[rgbe[:, :, 3] == 0] = 0
rgb = rgbe[:, :, :3].astype(np.float32) * scale[:, :, None]
assert np.isfinite(rgb).all() and rgb.max() > 1.0

# Local inspection derived from the actual CC0 map downloads, not website renders.
canvas = Image.new('RGB', (1600, 650), '#20242a')
draw = ImageDraw.Draw(canvas)
for index, name in enumerate(('concrete', 'stone', 'paving', 'grass')):
    with Image.open(ROOT / mapping[name]['color']) as image:
        image = image.convert('RGB').resize((390, 390))
        canvas.paste(image, (index * 400 + 5, 30))
    draw.text((index * 400 + 8, 8), mapping[name]['asset_id'], fill='white')
tonemap = np.power(rgb / (1.0 + rgb), 1.0 / 2.2)
preview = Image.fromarray(np.uint8(np.clip(tonemap, 0, 1) * 255)).resize((420, 210))
canvas.paste(preview, (5, 435))
draw.text((440, 450), 'noon_grass: actual HDR decoded + tone mapped', fill='white')
draw.text((440, 480), 'Stone shown is separate dark-brown derivative; original maps are untouched.', fill='white')
draw.text((440, 510), 'Keep facade square-grid joints and muted mauve spandrels.', fill='white')
canvas.save(ROOT / 'evidence' / 'downloaded-map-contact-sheet.jpg', quality=90)
report = {'verified_at_utc': datetime.now(timezone.utc).isoformat(), 'asset_count': 5,
          'material_sets': 4, 'texture_maps': 12, 'hdri_count': 1, 'download_count': len(files),
          'derivative_count': len(manifest['derivatives']), 'derivatives_verified': True,
          'original_download_bytes': sum(item['bytes'] for item in files),
          'sha256_readback_all_match': True, 'provider_md5_and_size_all_match': True,
          'pillow_texture_decode': True, 'all_texture_dimensions_px': [2048, 2048],
          'hdri_full_rle_decode': True, 'hdri_all_bytes_consumed': True,
          'hdri_dimensions_px': [w, h], 'hdri_linear_rgb_max': float(rgb.max()),
          'hdri_finite_pixels': True, 'materials_mapping_all_paths_verified': True,
          'normal_convention': 'OpenGL',
          'not_completed': ['未接线、渲染或验证Blender模型，此为主线程范围'],
          'caveats': ['入口石深棕配色为明确标记的派生贴图；不是原生深棕石扫描', '原石材板缝仍在，需由主线程控制UV，不改变门框构图']}
(ROOT / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
