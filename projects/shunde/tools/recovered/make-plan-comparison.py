"""Compare full-frame plan captures; rotate the old view to match front-down orientation."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--font', type=Path, required=True, help='Path to a Chinese-capable TTF/OTF/TTC font')
p.add_argument('--before', type=Path, required=True)
p.add_argument('--after', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
font_path = str(a.font)
title = ImageFont.truetype(font_path, 34)
body = ImageFont.truetype(font_path, 26)
sheet = Image.new('RGB', (1920, 930), '#f1f1ec')
draw = ImageDraw.Draw(sheet)
labels = ['修改前：扁平轮廓、圆柱偏中间', '修改后：直角三角形主体、局部圆柱转接']
for i, path in enumerate([a.before, a.after]):
    with Image.open(path) as source:
        image = source.convert('RGB')
        if i == 0:
            image = image.transpose(Image.Transpose.ROTATE_180)
        image.thumbnail((936, 720), Image.Resampling.LANCZOS)
        sheet.paste(image, (i * 960 + (960 - image.width) // 2, 70 + (720 - image.height) // 2))
    draw.text((i * 960 + 20, 20), labels[i], fill='#263832', font=title)
draw.line([(960, 0), (960, 790)], fill='white', width=3)
draw.text((25, 810), '方向统一：正门在下方；右侧向后延伸；右下角为正面与右侧的 90° 转角。', font=body, fill='#263832')
draw.text((25, 855), '右图为真实模型正交俯视。整体形态按用户澄清；具体长度、圆柱半径仍为照片估计。', font=body, fill='#485950')
a.output.parent.mkdir(parents=True, exist_ok=True)
sheet.save(a.output, quality=95)
print(a.output)
