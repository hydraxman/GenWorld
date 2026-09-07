from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
source=Image.open(root/'assets/reference-v2-front.jpg').convert('RGB')
# Only the three gold glyph silhouettes; discard the photographed stone/background.
# No facade, tree, glazing, or architectural photo plane enters the model.
im=source.crop((958,800,984,848))
out=Image.new('RGBA',im.size,(0,0,0,0))
for y in range(im.height):
 for x in range(im.width):
  r,g,b=im.getpixel((x,y));alpha=max(0,min(255,int(min((min(r,g)-120)*3,(min(r,g)-b-38)*5))))
  out.putpixel((x,y),(214,186,95,alpha))
out=out.resize((208,384),Image.Resampling.LANCZOS)
out.save(root/'assets/name-glyphs.png')
(root/'assets/name-glyphs-source.json').write_text(json.dumps({'source':'reference-v2-front.jpg','nativeCrop':[958,800,984,848],'usage':'gold inscription glyph alpha only; authored flat backing; not a facade photo plane','text':'舜德楼'},ensure_ascii=False,indent=2))
print('Authored glyph-only texture:',out.size)
