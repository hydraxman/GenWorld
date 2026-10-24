from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json
ROOT=Path(__file__).resolve().parent
font='/System/Library/Fonts/STHeiti Medium.ttc'
def f(n):return ImageFont.truetype(font,n)
canvas=Image.new('RGB',(2100,1770),'#10191f');canvas.paste(Image.open(ROOT/'canon5d-cutaway.png').convert('RGB'),(0,150))
d=ImageDraw.Draw(canvas);white='#e6eff3';muted='#a4b4be';accent='#f2cb8c'
d.text((80,35),'Canon EOS 5D Mark IV',font=f(62),fill=white)
d.text((82,111),'单反相机｜剖视与分层结构示意',font=f(29),fill=accent)
anchors=[('镜片与光圈',(644,893),(400,880)),('主反光镜',(904,833),(850,1090)),('五棱镜 / 取景器',(922,642),(645,590)),('焦平面快门',(1112,768),(1060,1050)),('全画幅 CMOS',(1219,738),(1190,565)),('主电路板',(1362,688),(1510,535)),('锂电池',(1239,1011),(1490,1150))]
for i,(label,a,b) in enumerate(anchors,1):
    a=(a[0],a[1]+150);b=(b[0],b[1]+150)
    d.line([a,b],fill=accent,width=3);d.ellipse((a[0]-5,a[1]-5,a[0]+5,a[1]+5),fill=accent)
    r=27;d.ellipse((b[0]-r,b[1]-r,b[0]+r,b[1]+r),fill='#162129',outline=accent,width=3)
    d.text(b,str(i),font=f(30),fill=accent,anchor='mm')
    row=(i-1)//4;col=(i-1)%4;d.text((82+col*502,1575+row*47),f'{i:02}  {label}',font=f(28),fill=white)
d.text((82,1682),'蓝线为取景光路；拍摄时反光镜抬起，快门开启后光线到达传感器。',font=f(24),fill=muted)
d.text((82,1721),'外观参考佳能官方照片，内部参考拆机资料；镜片组、走线及部件尺寸为教学示意，并非精密复刻。',font=f(23),fill=muted)
canvas.save(ROOT/'canon5d-cutaway-labelled.jpg',quality=95,subsampling=0)
print(json.dumps({'file':str(ROOT/'canon5d-cutaway-labelled.jpg'),'size':canvas.size,'labels':len(anchors)},ensure_ascii=False))
