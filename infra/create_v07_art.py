from PIL import Image,ImageDraw,ImageEnhance
from pathlib import Path
import colorsys
p=Path(__file__).resolve().parent.parent/'web/assets'
target=p/'games'/'tiles';target.mkdir(parents=True,exist_ok=True)
SZ=80
brown=(159,89,48,255);light=(231,161,89,255);edge=(73,45,54,255);accent=(255,213,127,255)

def draw_bridge(kind):
    im=Image.new('RGBA',(SZ,SZ)); d=ImageDraw.Draw(im)
    # Tiles are intentionally composed on a coarse 4-pixel grid.
    if kind=='straight':
        d.rectangle((20,0,60,79),fill=edge)
        d.rectangle((24,0,56,79),fill=brown)
        for y in range(2,78,12):
            d.rectangle((24,y,56,y+7),fill=light); d.line((25,y+7,55,y+7),fill=(95,51,47,255),width=2)
            d.rectangle((27,y+2,30,y+4),fill=accent); d.rectangle((51,y+2,54,y+4),fill=accent)
        d.line((20,0,20,79),fill=(92,55,57,255),width=4);d.line((60,0,60,79),fill=(92,55,57,255),width=4)
    else:
        # Upper exit joins right exit, L elbow oriented North/East (matches bridge engine rot=0).
        d.rectangle((20,0,60,60),fill=edge)
        d.rectangle((22,22,79,60),fill=edge)
        d.rectangle((24,0,56,55),fill=brown)
        d.rectangle((24,24,79,56),fill=brown)
        for y in range(0,33,11):
            d.rectangle((25,y+2,55,y+8),fill=light); d.line((26,y+8,55,y+8),fill=edge,width=2)
        for x in range(25,78,11):
            d.rectangle((x+2,26,x+8,54),fill=light);d.line((x+8,26,x+8,54),fill=edge,width=2)
        d.rectangle((22,22,36,36),fill=(190,115,61,255))
        d.rectangle((26,26,32,32),fill=accent)
        # outside edge, no protrusions beyond adjoining tile bounds
        d.line((20,0,20,60),fill=edge,width=4)
        d.line((20,60,79,60),fill=edge,width=4)
    return im.resize((160,160),Image.Resampling.NEAREST)
for name in ['straight','corner']:
    draw_bridge(name).save(target/f'bridge-{name}.png')
# Whole-sprite pixel recolor for consistent skins across idle/sleep/visit states.
pet=p/'pets';base_names=['idle','sleep','happy','dirty','weak','eat','blink','celebrate'];
for theme,shift,saturate in [('crystal',.10,1.05),('forest',.42,1.12)]:
    out=pet/'skins'/theme;out.mkdir(parents=True,exist_ok=True)
    for anim in base_names:
        base=Image.open(pet/f'{anim}.png').convert('RGBA')
        px=base.load()
        for y in range(base.height):
            for x in range(base.width):
                r,g,b,a=px[x,y]
                if a==0:continue
                h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
                # Keep eyes and white highlights readable; recolor medium-saturated areas.
                if s>.15 and v>.20:
                    h=(h+shift)%1;s=min(1,s*saturate)
                    nr,ng,nb=colorsys.hsv_to_rgb(h,s,v)
                    px[x,y]=(int(nr*255),int(ng*255),int(nb*255),a)
        base.save(out/f'{anim}.png')
print('Bridge tile and pet skin assets created')
