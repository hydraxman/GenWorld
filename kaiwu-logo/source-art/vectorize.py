from pathlib import Path
from PIL import Image
import subprocess,xml.etree.ElementTree as ET,json,hashlib
r=Path(__file__).parent
src=Path('/Users/bryannathan/.hermes/cache/images/img_2ad84937e1ad.jpg')
im=Image.open(src).convert('RGB');w,h=im.size
color=(111,51,123);v=[255-c for c in color];den=sum(x*x for x in v)
# Project antialiased/JPEG pixels onto the source purple-to-white axis.
mask=Image.new('1',(w,h),1)
mask.putdata([0 if sum((255-c)*d for c,d in zip(p,v))/den>=.5 else 1 for p in im.getdata()])
mask.save(r/'purple-mask.pbm')
subprocess.run(['potrace',str(r/'purple-mask.pbm'),'--svg','--group','--turdsize','0','--alphamax','0.6','--opttolerance','0.08','--unit','100','--color','#6f337b','--output',str(r/'traced.svg')],check=True)
ns='http://www.w3.org/2000/svg';ET.register_namespace('',ns)
tree=ET.parse(r/'traced.svg');svg=tree.getroot();svg.set('width',str(w));svg.set('height',str(h));svg.set('viewBox',f'0 0 {w} {h}');svg.set('role','img')
for node in list(svg):
 if node.tag.endswith('metadata'):svg.remove(node)
title=ET.Element('{'+ns+'}title');title.text='清华大学MEM工程管理导引课程 · 2023';svg.insert(0,title)
desc=ET.Element('{'+ns+'}desc');desc.text='Source-faithful purple vector paths. All white regions, including lettering and circuit lines, are transparent negative space. No raster image, background rectangle, or font dependency.';svg.insert(1,desc)
file=r/'Tsinghua-MEM-2023-Transparent.svg';tree.write(file,encoding='utf-8',xml_declaration=True)
assert not list(svg.iter('{'+ns+'}image')) and not list(svg.iter('{'+ns+'}rect')) and not list(svg.iter('{'+ns+'}text'))
q={'file':str(file),'source':str(src),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'dimensions':[w,h],'path_count':len(list(svg.iter('{'+ns+'}path'))),'raster_embeds':0,'font_dependencies':0,'background':'transparent','white_regions':'transparent path holes','color':'#6f337b','accepted':False}
(r/'verification.json').write_text(json.dumps(q,indent=2));print(json.dumps(q))
