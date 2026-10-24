from PIL import Image,ImageDraw
from pathlib import Path
import random, math
PROJECT=Path(__file__).resolve().parents[1]
ROOT=PROJECT/'web/assets'
random.seed(51)
W,H=640,360
pals={
 'refugio':dict(wall='#131d43',panel='#212c5d',floor='#202248',edge='#2a568e',glow='#62e9fa',light='#86a9ff',floor2='#242f59',sky='#101436'),
 'jardim':dict(wall='#132e3b',panel='#194959',floor='#153b47',edge='#2b827c',glow='#68ffd2',light='#a1fff2',floor2='#1d5150',sky='#102946'),
 'floresta':dict(wall='#1f1e42',panel='#36305d',floor='#252449',edge='#9464b5',glow='#ec8fff',light='#a7aaff',floor2='#32355c',sky='#17173f')}
def polygon(d,points,fill,outline=None,width=1):d.polygon(points,fill=fill);outline and d.line(points+[points[0]],fill=outline,width=width)
def bg(wid):
 c=pals[wid];im=Image.new('RGB',(W,H),c['wall']);d=ImageDraw.Draw(im)
 # Pixelled wall bands and symmetric architectural frame
 for x in range(0,W,48):
  d.rectangle((x,0,x+1,218),fill=c['panel']);d.line((x+5,12,x+39,12),fill=c['edge'],width=1)
 for y in range(0,216,35):d.line((0,y,W,y),fill=c['panel'],width=3)
 # column silhouettes
 for x in [15,595]:
  d.rectangle((x,8,x+28,228),fill=c['panel']);d.rectangle((x+3,12,x+25,222),outline=c['edge'],width=2)
  for y in range(27,215,20):d.rectangle((x+12,y,x+16,y+3),fill=c['glow'])
 # wall geometric tracery
 for x,y in [(75,40),(120,100),(525,58),(554,162),(69,175)]:
  d.line((x,y,x+12,y,x+12,y+15,x+26,y+15),fill=c['edge'],width=2)
  d.rectangle((x+24,y+13,x+28,y+17),fill=c['glow'])
 # floor
 d.polygon([(0,225),(W,225),(W,H),(0,H)],fill=c['floor'])
 for y in [236,267,308,356]:d.line((0,y,W,y),fill=c['edge'],width=2)
 for x in range(-80,800,80):d.line((x,225,x-75,360),fill=c['floor2'],width=2)
 d.rectangle((0,223,W,229),fill=c['edge'])
 for x in range(30,W,63):
  d.rectangle((x,246+(x%13),x+4,248+(x%13)),fill=c['light'])
  d.rectangle((x+15,329,x+19,331),fill=c['edge'])
 # window frame interior drawn separately with CSS; leave blank wall behind window
 # accents by world
 if wid=='jardim':
  for x in [85,150,500,554]:
   d.line((x,221,x+3,191),fill='#1eaf90',width=3)
   for dy in [0,15]:d.ellipse((x-12,193+dy,x-3,199+dy),fill='#26aa79')
 elif wid=='floresta':
  for x in [91,124,508,559]:
   for y in [36,68,95]:d.rectangle((x,y,x+6,y+9),fill='#544078');d.rectangle((x+1,y+2,x+5,y+5),fill='#d977f5')
 # scene labels small pixel sign (no text baked)
 d.rounded_rectangle((75,72,178,155),radius=9,fill=c['panel'],outline=c['edge'],width=3)
 d.rounded_rectangle((457,70,561,153),radius=9,fill=c['panel'],outline=c['edge'],width=3)
 d.rectangle((76,207,561,210),fill=c['glow'])
 # integrated world window frame border (CSS view sits inside aperture)
 d.ellipse((224,9,418,211),fill=c['panel'],outline=c['glow'],width=5)
 d.ellipse((233,19,409,199),fill=c['sky'],outline=c['edge'],width=2)
 # aperture from whole background: make transparent inside window, retain frame
 rgba=im.convert('RGBA');p=rgba.load()
 cx,cy,rx,ry=321,109,85,87
 for y in range(21,199):
  for x in range(235,407):
   if ((x-cx)/rx)**2+((y-cy)/ry)**2<1:p[x,y]=(0,0,0,0)
 # frame boundary plus four brackets
 d=ImageDraw.Draw(rgba)
 d.ellipse((230,16,412,204),outline=c['glow'],width=4)
 for x,y in [(318,6),(318,207),(223,106),(417,106)]:
  d.polygon([(x,y-5),(x+5,y),(x,y+5),(x-5,y)],fill=c['glow'])
 out=ROOT/'worlds'/f'{wid}-base.png';rgba.resize((1280,720),Image.Resampling.NEAREST).save(out)
 # sky/view separate independent image, crop to aperture, supports substitution
 sky=Image.new('RGBA',(400,400),c['sky']);s=ImageDraw.Draw(sky)
 for i in range(60):
  sx=random.randrange(0,399);sy=random.randrange(0,300);r=1 if i%5 else 2
  s.rectangle((sx,sy,sx+r,sy+r),fill= c['glow'] if i%3==0 else c['light'])
 if wid=='refugio':
  for i in range(11):
   sx=i*40-6;h=random.randrange(60,175)
   s.rectangle((sx,400-h,sx+29,400),fill='#3657ac')
   for yy in range(400-h+13,390,17):
    s.rectangle((sx+7,yy,sx+10,yy+5),fill='#92eaff')
 elif wid=='jardim':
  s.rectangle((0,270,399,399),fill='#15556a')
  for i in range(15):
   sx=i*28+6;h=random.randint(33,110)
   s.rectangle((sx,300-h,sx+5,370),fill='#155f67');s.ellipse((sx-20,260-h,sx+28,308-h),fill='#24a893')
 elif wid=='floresta':
  s.ellipse((255,40,310,95),fill='#f0d3f7')
  for i in range(17):
   sx=i*25;h=random.randint(40,110)
   s.polygon([(sx-13,350),(sx+16,350),(sx,260-h)],fill='#2b4178')
 sky.resize((400,400),Image.Resampling.NEAREST).save(ROOT/'worlds'/f'{wid}-view.png')
 # world cover
 cover=Image.new('RGBA',(480,300),(0,0,0,0));base=Image.open(out).resize((480,270),Image.Resampling.NEAREST);cover.paste(base,(0,15),base);cover.save(ROOT/'worlds'/f'{wid}-preview.png')
for k in pals:bg(k)
# Generic pixel art sprite factory
def sprite(name,w,h,drawfn):
 im=Image.new('RGBA',(w,h),(0,0,0,0));d=ImageDraw.Draw(im);drawfn(d,w,h);im.resize((w*3,h*3),Image.Resampling.NEAREST).save(ROOT/'decor'/(name+'.png'))
def bed(d,w,h,theme):
 a={'refugio':('#3375c7','#6ff1ee'),'jardim':('#238968','#94f8cc'),'floresta':('#8c69cf','#e6a0ff')}[theme]
 d.rounded_rectangle((5,23,w-4,h-6),radius=12,fill=a[0],outline='#0b1131',width=3)
 d.rounded_rectangle((13,16,w-15,h-18),radius=8,fill='#dceaff',outline='#7897c9',width=2)
 d.rounded_rectangle((20,17,w//2,h-25),radius=6,fill='#f8faff')
 d.polygon([(w//2,27),(w-19,27),(w-12,h-21),(w//2,h-19)],fill=a[1])
 d.rectangle((13,h-8,w-17,h-4),fill='#18214f')
def lamp(d,w,h,theme):
 c={'refugio':'#70e8fa','jardim':'#85ffd0','floresta':'#e5a2ff'}[theme]
 d.polygon([(w//2,0),(w//2+15,18),(w//2+9,44),(w//2-8,44),(w//2-14,18)],fill=c,outline='#26305e')
 d.line((w//2,45,w//2,75),fill='#668cc1',width=4);d.ellipse((w//2-15,70,w//2+15,81),fill='#304c88',outline=c,width=2)
def companion(d,w,h,kind):
 c={'robot':'#a9e6fb','slime':'#81f9b7','sprite':'#efabff'}[kind]
 d.ellipse((10,18,w-10,h-8),fill=c,outline='#16305a',width=3)
 if kind=='robot':d.rectangle((16,12,w-15,h-14),fill=c,outline='#16305a',width=3);d.line((w//2,3,w//2,13),fill=c,width=3)
 for x in [w//2-10,w//2+8]:d.ellipse((x,36,x+5,41),fill='#132341')
 d.arc((w//2-7,39,w//2+12,54),0,180,fill='#132341',width=2)
def rug(d,w,h,theme):
 c={'refugio':'#5278e9','jardim':'#2e9f8b','floresta':'#a66ee4'}[theme]
 d.ellipse((4,6,w-5,h-6),fill=c,outline='#101b4c',width=3)
 d.ellipse((15,12,w-16,h-12),outline='#b6fff9',width=3)
 for x in [w//2-12,w//2+12]:d.rectangle((x,h//2-3,x+4,h//2+3),fill='#f2dcff')
def wall(d,w,h,kind):
 c={'refugio':'#76eafb','jardim':'#8affd2','floresta':'#ffb5fa'}[kind]
 d.rounded_rectangle((7,5,w-8,h-6),radius=5,fill='#192a50',outline=c,width=3)
 d.polygon([(w//2,15),(w//2+23,h//2),(w//2,h-17),(w//2-23,h//2)],fill=c,outline='#486c9a')
for world in pals:
 for i in range(1,3):
  suffix=f'{world}_{i}'
  sprite(f'bed_{suffix}',118,67,lambda d,w,h,world=world:bed(d,w,h,world))
  sprite(f'lamp_{suffix}',60,88,lambda d,w,h,world=world:lamp(d,w,h,world))
  sprite(f'rug_{suffix}',138,46,lambda d,w,h,world=world:rug(d,w,h,world))
  sprite(f'wall_{suffix}',76,65,lambda d,w,h,world=world:wall(d,w,h,world))
  sprite(f'companion_{suffix}',64,65,lambda d,w,h,kind=('robot' if i==1 else 'slime'):companion(d,w,h,kind))
# Pet: source sheet with crop and alpha around cells, normalized canvas
pet_sheet=Image.open(PROJECT/'assets_source/pet_sprite_reference.png')
frames={
 'idle':(19,2,267,212),
 'blink':(701,6,952,214),
 'happy':(952,6,1250,213),
 'eat':(8,613,243,781),
 'sleep':(22,415,312,608),
 'weak':(985,1096,1245,1240),
 'dirty':(764,1035,962,1238),
 'celebrate':(286,1020,504,1235)
}
from scipy.ndimage import label
import numpy as np
for k,box in frames.items():
 im=pet_sheet.crop(box)
 alpha=np.array(im.getchannel('A'))
 labeled,n=label(alpha>8,structure=np.ones((3,3),dtype=np.uint8))
 if n:
  counts=np.bincount(labeled.flatten());counts[0]=0
  main=int(np.argmax(counts))
  mask=(labeled==main).astype(np.uint8)*255
  a=np.where(mask>0,alpha,0).astype(np.uint8)
  im.putalpha(Image.fromarray(a,'L'))
 bbox=im.getbbox()
 if bbox:im=im.crop(bbox)
 im.thumbnail((252,252),Image.Resampling.NEAREST)
 cv=Image.new('RGBA',(280,280),(0,0,0,0))
 cv.alpha_composite(im,((280-im.width)//2,280-im.height-14))
 cv.save(ROOT/'pets'/f'{k}.png')
# Normalize two secondary poses without bleeding from adjacent sheet cells.
base=Image.open(ROOT/'pets'/'idle.png').convert('RGBA')
muddy=base.copy();md=ImageDraw.Draw(muddy)
for x,y,r in [(178,204,8),(194,216,5),(121,236,6),(93,117,5)]:
 md.ellipse((x-r,y-r,x+r,y+r),fill='#9a6548',outline='#563c4b',width=2)
muddy.save(ROOT/'pets'/'dirty.png')
celebrate=Image.open(ROOT/'pets'/'happy.png').convert('RGBA');cd=ImageDraw.Draw(celebrate)
for x,y,r,c in [(31,110,10,'#69f4ef'),(249,100,12,'#ffb5f3'),(230,44,7,'#ffe59d'),(43,212,8,'#d29bff')]:
 cd.polygon([(x,y-r),(x+3,y-3),(x+r,y),(x+3,y+3),(x,y+r),(x-3,y+3),(x-r,y),(x-3,y-3)],fill=c)
celebrate.save(ROOT/'pets'/'celebrate.png')
# pet alt tinted skin is unlocked by badge/level but uses CSS filter, not duplicate sheet
print('Assets ready:',len(list(ROOT.rglob('*.png'))))
