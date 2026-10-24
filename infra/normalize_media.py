import sys
from PIL import Image,ImageOps,ImageFile
Image.MAX_IMAGE_PIXELS=20_000_000
ImageFile.LOAD_TRUNCATED_IMAGES=False
try:
 im=Image.open(sys.argv[1]);im.verify()
 im=Image.open(sys.argv[1]);im=ImageOps.exif_transpose(im)
 if im.width*im.height>20_000_000:raise ValueError('Oversized image')
 im=im.convert('RGBA')
 pad=Image.new('RGBA',(384,384),(18,25,54,255))
 contained=ImageOps.contain(im,(344,344),method=Image.Resampling.LANCZOS)
 pad.alpha_composite(contained,((384-contained.width)//2,(384-contained.height)//2))
 pad.convert('RGB').save(sys.argv[2],'WEBP',quality=88,method=5)
except Exception as e:
 sys.stderr.write(str(e));sys.exit(2)
