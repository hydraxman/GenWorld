from pathlib import Path
import sys
from PIL import Image, ImageDraw

output = Path(__file__).resolve().parent.parent / "output"
study = "--study" in sys.argv
book = "--book" in sys.argv
glyphs = "--glyphs" in sys.argv
rows = [["%02d-%.2f.png" % (i, t) for t in (.6, 1.6, 3, 4.6)] for i in range(1, 6)] if study else [
    ["study-2026-4s-%.2f.png" % t for t in (2.31, 2.52, 2.73)],
    ["study-2026-4s-%.2f.png" % t for t in (2.94, 3.08, 3.4)],
] if glyphs else [
    ["study-2026-4s-%.2f.png" % t for t in (1.4, 1.47, 1.54)],
    ["study-2026-4s-%.2f.png" % t for t in (1.58, 1.7, 1.83)],
] if book else [
    ["study-2026-4s-%.2f.png" % t for t in (0, .4, .8)],
    ["study-2026-4s-%.2f.png" % t for t in (1.2, 1.6, 2.1)],
    ["study-2026-4s-%.2f.png" % t for t in (2.6, 3.2, 119 / 30)],
]
width, height, label = 480, 270, 27
sheet = Image.new("RGB", (width * len(rows[0]), (height + label) * len(rows)), "#eaf0f6")
draw = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    for c, file in enumerate(row):
        image = Image.open(output / file).convert("RGB").resize((width, height), Image.Resampling.LANCZOS)
        x, y = c * width, r * (height + label)
        sheet.paste(image, (x, y + label))
        draw.text((x + 10, y + 6), file.removesuffix(".png"), fill="#213148")
sheet.save(output / ("existing-effects.jpg" if study else "glyph-contact.jpg" if glyphs else
                     "book-contact.jpg" if book else "sample-contact.jpg"), quality=94)
