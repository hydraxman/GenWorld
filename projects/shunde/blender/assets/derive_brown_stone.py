"""Create separate dark-brown albedo; preserve downloaded originals."""
from pathlib import Path
import json
import hashlib
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
source = 'textures/granite_tile_03/granite_tile_03_diff_2k.jpg'
out = 'derived/granite_tile_03/granite_tile_03_dark_brown_diff_2k.png'
original = (ROOT / source).read_bytes()
source_sha = hashlib.sha256(original).hexdigest()
a = np.asarray(Image.open(ROOT / source).convert('RGB'), dtype=np.float64) / 255
linear = np.where(a <= .04045, a / 12.92, ((a + .055) / 1.055) ** 2.4)
target = np.array([63, 48, 40], dtype=np.float64) / 255
target_linear = np.where(target <= .04045, target / 12.92, ((target + .055) / 1.055) ** 2.4)
source_mean_linear = linear.mean(axis=(0, 1))
tint = target_linear / source_mean_linear
b = np.clip(linear * tint, 0, 1)
srgb = np.where(b <= .0031308, 12.92 * b, 1.055 * b ** (1/2.4) - .055)
result = np.uint8(np.clip(np.round(srgb * 255), 0, 255))
path = ROOT / out
path.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(result).save(path)
with Image.open(path) as check:
    check.load()
    assert check.size == (2048, 2048)
assert hashlib.sha256((ROOT / source).read_bytes()).hexdigest() == source_sha
record = {'asset_id': 'granite_tile_03', 'license': 'CC0-1.0', 'license_url': 'https://polyhaven.com/license',
          'url': 'https://polyhaven.com/a/granite_tile_03', 'kind': 'albedo', 'colorspace': 'sRGB',
          'original_download': False, 'local_relative_path': out, 'source_relative_path': source,
          'source_sha256': source_sha, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
          'bytes': path.stat().st_size, 'dimensions_px': [2048, 2048],
          'derivation': 'sRGB decode -> per-channel linear multiply -> sRGB encode; no spatial filtering; original grain retained',
          'target_mean_linear_from_srgb_bytes': [63, 48, 40], 'linear_rgb_tint': tint.tolist(),
          'actual_mean_srgb_bytes': result.mean(axis=(0, 1)).tolist(),
          'note_zh': '为复刻原场景深棕入口而调色，不代表真实楼宇石材扫描；保留源颗粒及原板缝，原始贴图不变'}
manifest = json.loads((ROOT / 'manifest.json').read_text())
manifest['derivatives'] = [record]
(ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
mapping = json.loads((ROOT / 'materials.json').read_text())
mapping['stone']['color'] = out
mapping['stone']['color_original'] = source
mapping['stone']['note'] = '已单独派生深棕配色匹配原场景RGB[63,48,40]；原始图片未改。roughness与OpenGL normal均为Poly Haven真实原图。源板缝仍在，须控制UV不改变门框构图。'
(ROOT / 'materials.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(record, ensure_ascii=False, indent=2))
