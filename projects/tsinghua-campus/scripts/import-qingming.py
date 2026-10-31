"""Extract one authored willow and its leaf texture; keep the full asset pack local."""
import base64
import hashlib
import io
import json
from pathlib import Path
import struct
import subprocess
import sys
from PIL import Image

root = Path(__file__).resolve().parents[1]
checkout = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "output" / "qingming-source"
asset = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "output" / "Qingming_Auto_Details.glb"
revision = "81f5c0a6e78e67388cc8a978064b88c53621949e"
actual_revision = subprocess.check_output(["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True).strip()
if actual_revision != revision:
    raise ValueError("Qingming checkout is not the reviewed revision")
copied = [
    ("LICENSE", "LICENSE.txt", "7311daf4a78b01fa5366cfe1eee5fe3226ff64b375c406ef677b6ce6e96059c0"),
    ("src/micro.js", "micro.js", "75512118cd2385c2f8d8c317d21e261ad0be02e26598df40062698517036fb76"),
]
originals = {}
for source, target, sha256 in copied:
    content = subprocess.check_output(["git", "-C", str(checkout), "show", f"{revision}:{source}"])
    if hashlib.sha256(content).hexdigest() != sha256:
        raise ValueError(f"Qingming source has changed: {source}")
    originals[target] = content
raw = asset.read_bytes()
expected = "6b8a9facc67f73e2fbbe372c549202b07da13733ec7e1751c6e67a3c135afd2f"
if hashlib.sha256(raw).hexdigest() != expected:
    raise ValueError("Qingming model asset does not match the reviewed catalog")
length = struct.unpack_from("<I", raw, 12)[0]
gltf = json.loads(raw[20:20 + length])
binary = raw[28 + length:]
destination = root / "src" / "vendor" / "qingming"
destination.mkdir(parents=True, exist_ok=True)

def accessor(index):
    a = gltf["accessors"][index]
    view = gltf["bufferViews"][a["bufferView"]]
    size = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
    width = {5121: 1, 5123: 2, 5125: 4, 5126: 4}[a["componentType"]] * size
    start = view.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = view.get("byteStride", width)
    packed = b"".join(binary[start + i * stride:start + i * stride + width] for i in range(a["count"]))
    return {"itemSize": size, "componentType": a["componentType"], "normalized": a.get("normalized", False),
            "data": base64.b64encode(packed).decode()}

parts = []
names = [f"Willow / {name}.002" for name in ["bark", "leaf_dark", "leaf_light", "leaf_mid"]]
for name in names:
    node = next(n for n in gltf["nodes"] if n.get("extras", {}).get("sourceMesh") == name and n["extras"]["level"] == 1)
    primitive = gltf["meshes"][node["mesh"]]["primitives"][0]
    parts.append({"name": name, "leaf": node["extras"]["leafCard"], "index": accessor(primitive["indices"]),
                  "attributes": {key: accessor(value) for key, value in primitive["attributes"].items()}})
image = gltf["bufferViews"][gltf["images"][0]["bufferView"]]
png = binary[image["byteOffset"]:image["byteOffset"] + image["byteLength"]]
rgba = Image.open(io.BytesIO(png)).convert("RGBA")
result = {"source": "https://github.com/mike007jd/qingming", "revision": revision,
          "sourceAssetSha256": expected, "parts": parts,
          "texture": {"width": rgba.width, "height": rgba.height, "rgba": base64.b64encode(rgba.tobytes()).decode()}}
(destination / "willow.json").write_text(json.dumps(result, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
for target, content in originals.items():
    (destination / target).write_bytes(content)
print(f"Extracted {len(parts)} original willow mesh parts and {rgba.width}x{rgba.height} leaf texture")
