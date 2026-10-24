from pathlib import Path
import numpy as np
from PIL import Image
P=Path(__file__).resolve().parent.parent
N=1100
y,x=np.mgrid[0:N,0:N].astype(float);x=x/N;y=y/N
for k in range(4):
 rng=np.random.default_rng(62023+k)
 def noise():
  a=np.zeros((N,N))
  for n,w in [(4,.30),(8,.26),(16,.20),(32,.12),(64,.07),(128,.035),(256,.015)]:
   im=Image.fromarray(np.uint8(rng.random((n,n))*255)).resize((N,N),Image.Resampling.BICUBIC)
   a+=np.asarray(im)/255*w
  return a
 a=noise();b=noise();c=noise()
 band=np.exp(-((y-(.95-x*.8+(.08*np.sin(x*9))))/.27)**2)
 if k==1: band=np.exp(-((np.sqrt((x-.25)**2+(y-.45)**2)-.48)/.21)**2)
 if k==2: band=np.exp(-((y-(x*.6+.04))/.29)**2)
 if k==3: band=np.exp(-((y-(.75-x*.25))/.4)**2)
 cloud=np.clip((a-.27)*2.3,0,1)*(.25+.95*band)
 dust=np.clip((b-.43)*3,0,.8)
 cloud=cloud*(1-.65*dust)
 detail=np.clip((c-.35)*3,0,1)*cloud
 colors=[([15,23,56],[79,60,122],[45,63,104]),([13,25,57],[39,66,104],[70,44,98]),([18,26,57],[69,55,121],[33,83,108]),([12,31,58],[38,63,103],[58,45,104])]
 base,col,accent=map(np.array,colors[k]); rgb=base+cloud[...,None]*col+detail[...,None]*accent
 # Fine field of unresolved stars adds real astronomical texture.
 rr=rng.random((N,N)); speck=(rr>.997)*(rng.random((N,N))*36+9)
 rgb+=speck[...,None]
 Image.fromarray(np.uint8(np.clip(rgb,0,255))).save(P/f'assets/nebula-{k}.jpg',quality=94)
print('Four deterministic textured nebula plates generated')
