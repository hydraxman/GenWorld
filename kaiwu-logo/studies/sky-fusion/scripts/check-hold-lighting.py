"""Measure actual, mirrored page surfaces, excluding letters, bevels and sky."""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

project = Path(__file__).resolve().parent.parent
output = project / "output"
source = json.loads((project.parent.parent / "latest" /
                     "tsinghua-mem-five-effects-cloud/inputs/semantic-geometry.json").read_text(encoding="utf-8"))
scale = 1080 / (2 * 12.2 * math.tan(math.radians(35.14 / 2)))
mask = Image.new("L", (1920, 1080))
draw = ImageDraw.Draw(mask)
for name in ["leftPage", "rightPage"]:
    for polygon in source[name]:
        for contour, value in [(polygon["outer"], 255), *[(hole, 0) for hole in polygon["holes"]]]:
            draw.polygon([(960 + (x - 319.3) * .01 * scale,
                           540 + (y - 319.5) * .01 * scale) for x, y in contour], fill=value)
mask = mask.filter(ImageFilter.MinFilter(9))
points = [(x, y) for y in range(340, 655) for x in range(775, 930)
          if mask.getpixel((x, y)) == 255 and mask.getpixel((1919 - x, y)) == 255]
assert len(points) > 10000, f"Too few matched page samples: {len(points)}"


def measure(path):
    image = Image.open(path).convert("RGB")
    def luminance(rgb):
        c = [v / 255 / 12.92 if v / 255 <= .04045 else ((v / 255 + .055) / 1.055) ** 2.4 for v in rgb]
        return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
    left = sum(luminance(image.getpixel((x, y))) for x, y in points) / len(points)
    right = sum(luminance(image.getpixel((1919 - x, y))) for x, y in points) / len(points)
    return {"left": left, "right": right, "relative_difference": abs(left - right) / max(left, right)}


report = {"matched_pixels_per_leaf": len(points), "frames": {}}
for file in ["study-2026-4s-3.75.png", "study-2026-4s-3.97.png", "study-2026-4s-4.00.png"]:
    report["frames"][file] = measure(output / file)
before = output / "lighting-before.png"
if before.exists():
    report["before"] = measure(before)
    a = Image.open(before).convert("RGB").resize((960, 540))
    b = Image.open(output / "study-2026-4s-3.97.png").convert("RGB").resize((960, 540))
    comparison = Image.new("RGB", (1920, 574), "#eaf0f6")
    comparison.paste(a, (0, 34))
    comparison.paste(b, (960, 34))
    label = ImageDraw.Draw(comparison)
    label.text((20, 10), "BEFORE", fill="#213148")
    label.text((980, 10), "BALANCED HOLD", fill="#213148")
    comparison.save(output / "lighting-comparison.jpg", quality=94)
(output / "hold-lighting.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
assert all(frame["relative_difference"] < .12 for frame in report["frames"].values()), "Final pages remain unevenly lit"
assert all(frame["left"] > .02 and frame["right"] > .02 for frame in report["frames"].values()), "Balancing must not crush the metal to black"
