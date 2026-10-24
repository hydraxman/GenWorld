"""Create full-frame photo/model comparison sheets without cropping."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--font', type=Path, required=True, help='Path to a Chinese-capable TTF/OTF/TTC font')
p.add_argument('--reference', type=Path, required=True)
p.add_argument('--candidate', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
p.add_argument('--right-label', default='当前三维模型 · 比例校准')
p.add_argument('--left-label', default='用户新照片 · 裁切正面')
a = p.parse_args()
font = ImageFont.truetype(str(a.font), 28)
small = ImageFont.truetype(str(a.font), 22)
sheet = Image.new('RGB', (1920, 738), '#f1f1ec')
draw = ImageDraw.Draw(sheet)
labels = [a.left_label, a.right_label]
for i, path in enumerate([a.reference, a.candidate]):
    with Image.open(path) as source:
        image = source.convert('RGB')
        image.thumbnail((960, 640), Image.Resampling.LANCZOS)
        sheet.paste(image, (i * 960 + (960 - image.width) // 2, 58 + (640 - image.height) // 2))
    draw.text((i * 960 + 24, 12), labels[i], fill='#263832', font=font)
draw.line([(960, 0), (960, 738)], fill='#ffffff', width=3)
draw.text((24, 705), '保留完整画幅；模型尺寸、隐藏立面与内部构造为推测，非测绘成果。', fill='#485950', font=small)
a.output.parent.mkdir(parents=True, exist_ok=True)
sheet.save(a.output, quality=95)
print(a.output)
