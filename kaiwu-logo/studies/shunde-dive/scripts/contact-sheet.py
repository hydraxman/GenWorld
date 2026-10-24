from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageChops

output = Path(__file__).resolve().parents[1] / "output" / "v3-source-proof"
comparisons = []
for t in ["0.00", "0.60"]:
    a = Image.open(output / f"dive-{t}.png").convert("RGB")
    b = Image.open(output / f"sky-reference-{t}.png").convert("RGB")
    delta = ImageChops.difference(a, b)
    maximum = max(hi for lo, hi in delta.getextrema())
    changed = sum(pixel != (0, 0, 0) for pixel in delta.getdata())
    comparisons.append({"time": t, "maximumChannelDifference": maximum, "changedPixels": changed})
    assert maximum <= 1 and changed < 2500, comparisons[-1]

times = ["0.60", "1.35", "1.70", "2.10", "2.50", "2.90", "3.40", "4.00"]
sheet = Image.new("RGB", (1280, 4 * 390), "#eef1f0")
draw = ImageDraw.Draw(sheet)
for i, time in enumerate(times):
    x, y = (i % 2) * 640, (i // 2) * 390
    image = Image.open(output / f"dive-{time}.png").convert("RGB")
    image.thumbnail((640, 360), Image.Resampling.LANCZOS)
    sheet.paste(image, (x, y))
    draw.text((x + 14, y + 367), f"{time}s  |  Shunde + campus / actual GPU frame", fill="#263c42")
sheet.save(output / "contact-sheet.jpg", quality=92)
(output / "opening-comparison.json").write_text(json.dumps(comparisons, indent=2), encoding="utf-8")
print(json.dumps(comparisons))
print(output / "contact-sheet.jpg")
