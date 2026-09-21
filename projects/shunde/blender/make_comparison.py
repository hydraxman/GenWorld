"""Compare actual Three.js and Cycles renders without cropping either image."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
font_path = '/System/Library/Fonts/STHeiti Medium.ttc'
title = ImageFont.truetype(font_path, 42)
label = ImageFont.truetype(font_path, 29)
small = ImageFont.truetype(font_path, 22)
rows = [('主立面 · 同机位', '0s.jpg', 'front.png'), ('入口材质 · 同机位', '27s.jpg', 'entrance.png')]
canvas = Image.new('RGB', (2400, 1630), '#f0f1ed')
draw = ImageDraw.Draw(canvas)
draw.text((36, 22), '舜德楼  |  Three.js → Blender / Cycles', font=title, fill='#17242b')
draw.text((36, 82), '原建筑、镜头与布局保留；扫描PBR材质、光线追踪玻璃与照明升级', font=small, fill='#44545c')
y = 130
for description, before, after in rows:
    draw.text((25, y), f'Three.js 原场景  ·  {description}', font=label, fill='#46515a')
    draw.text((1225, y), f'Blender / Cycles  ·  {description}', font=label, fill='#154b53')
    y += 48
    for x, path in [(0, ROOT.parent/'qa/frames'/before), (1200, ROOT/'output/renders'/after)]:
        image = Image.open(path).convert('RGB')
        image.thumbnail((1180, 664), Image.Resampling.LANCZOS)
        canvas.paste(image, (x+10+(1180-image.width)//2, y+(664-image.height)//2))
    y += 700
canvas.save(ROOT/'output/ThreeJS-vs-Blender.jpg', quality=94, subsampling=0)
print(ROOT/'output/ThreeJS-vs-Blender.jpg')
