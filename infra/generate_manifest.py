from PIL import Image
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1]
base=root/'web/assets'
items=[]
for path in sorted(base.rglob('*.png')):
 im=Image.open(path)
 items.append({'id':str(path.relative_to(base)).replace('\\','/'),'path':'/assets/'+str(path.relative_to(base)).replace('\\','/'),'width':im.width,'height':im.height,'format':im.format,'transparent':im.mode in ('RGBA','LA') and im.getchannel('A').getextrema()[0]<255,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(root/'content/assets_manifest.json').write_text(json.dumps({'version':1,'assets':items},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(items)} assets in manifest')
