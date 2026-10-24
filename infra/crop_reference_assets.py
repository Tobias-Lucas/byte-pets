from PIL import Image,ImageEnhance,ImageOps
from pathlib import Path
project=Path(__file__).resolve().parents[1];root=project/'web/assets';src=project/'assets_source'
views={'refugio':('refugio_concept.png',(565,0,1205,680)),'jardim':('jardim_concept.png',(540,10,1150,660)),'floresta':('floresta_concept.png',(590,25,1240,700))}
for wid,(file,area) in views.items():
 im=Image.open(src/file).convert('RGB');v=im.crop(area);v=ImageOps.fit(v,(400,400));v.save(root/'worlds'/f'{wid}-view.png')
 v2=ImageEnhance.Color(v).enhance(.7);v2=ImageEnhance.Brightness(v2).enhance(.75);v2.save(root/'worlds'/f'{wid}-view-alt.png')
# Each extraction is a separate transparent sprite; original concept sheets are not used at run time.
sheets={
'refugio':('refugio_decor_sheet.png',{
'bed_1':(2,3,468,280),'bed_2':(463,4,952,285),'lamp_1':(8,280,329,577),'lamp_2':(320,272,622,580),'companion_1':(868,275,1140,575),'companion_2':(592,280,868,575),'wall_decor_1':(0,579,310,885),'wall_decor_2':(306,581,629,888)
}),
'jardim':('jardim_decor_sheet.png',{
'bed_1':(8,12,382,318),'bed_2':(374,12,766,317),'lamp_1':(2,304,360,623),'lamp_2':(358,300,711,628),'companion_1':(1031,315,1425,621),'companion_2':(724,306,1128,620),'wall_decor_1':(4,625,356,946),'wall_decor_2':(355,627,703,951)
}),
'floresta':('floresta_decor_sheet.png',{
'bed_1':(7,4,390,310),'bed_2':(380,2,767,312),'lamp_1':(1,316,369,619),'lamp_2':(362,310,707,624),'companion_1':(1088,9,1424,312),'companion_2':(1058,319,1428,614),'wall_decor_1':(2,622,374,905),'wall_decor_2':(361,619,703,905)
})}
for wid,(file,crops) in sheets.items():
 im=Image.open(src/file).convert('RGBA')
 for short,area in crops.items():
  patch=im.crop(area)
  bbox=patch.getchannel('A').getbbox()
  if bbox:patch=patch.crop(bbox)
  # normalize transparent space to stable dimensions with an anchor centered
  if short.startswith('bed'):sz=(500,330)
  elif short.startswith('lamp'):sz=(290,320)
  elif short.startswith('wall'):sz=(335,335)
  else:sz=(310,310)
  patch.thumbnail((sz[0]-15,sz[1]-10),Image.Resampling.LANCZOS)
  canv=Image.new('RGBA',sz,(0,0,0,0));canv.alpha_composite(patch,((sz[0]-patch.width)//2,sz[1]-patch.height))
  category,variant=short.rsplit('_',1)
  canv.save(root/'decor'/f'{category}_{wid}_{variant}.png')
  # use the second generated item in the sheet as variant where available
  # high-quality second slots are independent assets, not recolors.
  if short.endswith('_2'):
   target=f'{short[:-1]}2_{wid}_2.png'
print('Cropped reference assets into individual transparent sprites.')
