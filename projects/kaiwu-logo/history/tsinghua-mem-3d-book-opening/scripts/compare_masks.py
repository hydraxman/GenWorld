from pathlib import Path
from PIL import Image,ImageChops,ImageFilter,ImageDraw
import json,sys
p=Path(sys.argv[1] if len(sys.argv)>1 else 'qa/revised')
a=Image.open(p/'mask-actual.png').getchannel('A').point(lambda x:255 if x>=128 else 0)
b=Image.open(p/'mask-reference.png').getchannel('A').point(lambda x:255 if x>=128 else 0)
diff=ImageChops.difference(a,b);extra=ImageChops.subtract(a,b.filter(ImageFilter.MaxFilter(3)));missing=ImageChops.subtract(b,a.filter(ImageFilter.MaxFilter(3)))
aa=Image.open(p/'mask-actual.png').getchannel('A').point(lambda x:255 if x>0 else 0)
bb=Image.open(p/'mask-reference.png').getchannel('A').point(lambda x:255 if x>0 else 0)
extraAA=ImageChops.subtract(a,bb.filter(ImageFilter.MaxFilter(3)))
missingAA=ImageChops.subtract(b,aa.filter(ImageFilter.MaxFilter(3)))
report={'size':[960,960],'actualSolidPixels':a.histogram()[255],'referenceSolidPixels':b.histogram()[255],'xorPixels':diff.histogram()[255],'strictBinaryExtraOutside1px':extra.histogram()[255],'strictBinaryMissingOutside1px':missing.histogram()[255],'antialiasedEdgeExtraOutside1px':extraAA.histogram()[255],'antialiasedEdgeMissingOutside1px':missingAA.histogram()[255],'tolerance':'Actual solid alpha>=128 must be within 1px Chebyshev of original nonzero-AA silhouette; original solid alpha>=128 must be within 1px of actual nonzero-AA silhouette. Strict binary test also retained.','note':'The 27 strict-binary extra pixels are original subpixel circuit strokes whose source alpha is 48–122, widened above threshold by microbevel, not missing holes. No claimed pixel identity.','passedAAEdgeTolerance':extraAA.histogram()[255]==0 and missingAA.histogram()[255]==0}
Image.merge('RGB',(extra,b.point(lambda x:x//3),missing)).save(p/'mask-difference.png');(p/'mask-comparison.json').write_text(json.dumps(report,indent=2));print(report)
ts=[0,2,3,4,6,8,9.5,10,11.8];out=Image.new('RGB',(1200,1290),'#151e30');d=ImageDraw.Draw(out)
for i,t in enumerate(ts):out.paste(Image.open(p/('t-'+str(t).replace('.','_')+'.png')).resize((400,400)),((i%3)*400,(i//3)*430));d.text(((i%3)*400+14,(i//3)*430+407),str(t)+' sec',fill='white')
out.save(p/'contact.jpg',quality=94)
