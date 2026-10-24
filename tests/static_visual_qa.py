from playwright.sync_api import sync_playwright
from pathlib import Path
import json,base64,copy,os
root=Path(__file__).resolve().parents[1];web=root/'web'
art=Path(os.environ.get('QA_OUT_DIR',str(root/'qa')));art.mkdir(parents=True,exist_ok=True)
worlds=json.loads((root/'content/worlds.json').read_text());items=json.loads((root/'content/items.json').read_text());slots=json.loads((root/'content/worlds_slots.json').read_text())['commonSlots'];skills=json.loads((root/'content/skills.json').read_text())
def uri(p):
 fp=web/p.lstrip('/');mime='image/png';return 'data:'+mime+';base64,'+base64.b64encode(fp.read_bytes()).decode()
for w in worlds:
 for key in ['image','window','preview']:w[key]=uri(w[key]);
for item in items:item['image']=uri(item['image'])
petImgs={x.stem:uri('/assets/pets/'+x.name) for x in (web/'assets/pets').glob('*.png')}
me={'account':{'id':'visual','username':'explorador','role':'adult','allow_visits':False},'pet':{'account_id':'visual','name':'Lumi','level':4,'xp':340,'coins':420,'world_id':'refugio','skin':'normal','hunger':78,'energy':89,'hygiene':90,'happiness':97,'health':92,'poop':0},'inventory':[{'item_id':'refugio_bed_1','world_id':'refugio','quantity':1},{'item_id':'refugio_lamp_1','world_id':'refugio','quantity':1},{'item_id':'refugio_companion_1','world_id':'refugio','quantity':1},{'item_id':'refugio_rug_1','world_id':'refugio','quantity':1},{'item_id':'refugio_wall_decor_1','world_id':'refugio','quantity':1},{'item_id':'apple','world_id':'','quantity':2}],
'equipment':[{'world_id':'refugio','slot':slot,'item_id':f'refugio_{slot}_1'} for slot in ['bed','lamp','companion','rug','wall_decor']],
'unlocked':['refugio','jardim'],'badges':[{'badge_id':'padroes','label':'Aprendiz dos Padrões','issuer':'BytePets','awarded_at':1792700000}],
'schools':[],'classes':[],'cosmetics':{'skins':[{'id':'normal','title':'Original','unlocked':True},{'id':'crystal','title':'Cristal','unlocked':True},{'id':'forest','title':'Floresta','unlocked':False}]}}
content={'worlds':worlds,'items':items,'slots':slots,'skills':skills}
js=(web/'src/app.js').read_text()
js=js.replace("const petImg=(anim)=>'/assets/pets/'+(anim||'idle')+'.png';","const petImg=(anim)=>window.__petImgs[anim||'idle'] || window.__petImgs.idle;")
js=js.split('boot();\n')[0]
css=(web/'styles.css').read_text().replace("@import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');",'')
html='<html><head><meta charset="utf-8"><style>'+css+'</style></head><body><div id="app"></div></body></html>'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1460,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 payload='window.__petImgs='+json.dumps(petImgs)+';'+js+';APP.content='+json.dumps(content,ensure_ascii=False)+';APP.me='+json.dumps(me,ensure_ascii=False)+';APP.page="home";render();window.__qa={switchView:(view)=>{APP.page=view;render()},onboarding:()=>{APP.me=null;render()},school:()=>{APP.me.schools=[{id:"s1",name:"Escola das Descobertas",role:"manager"}];APP.schoolId="s1";APP.schoolData={school:{id:"s1",name:"Escola das Descobertas"},classes:[{id:"c1",name:"5º ano A",join_code:"BYTEX777"}],teachers:[{username:"prof_demo"}],modules:[{id:"m1",title:"Biologia da Floresta",subject:"Biologia",published:1}]};APP.page="school";render()},challenges:()=>{APP.moduleId=null;APP.modules=[{id:"logic",title:"Mente Lógica",subject:"Raciocínio",description:"Missões de padrões, escolhas e planejamento.",total:6,passed:2,complete:false},{id:"bio",title:"Biologia da Floresta",subject:"Biologia",description:"Vida, natureza e ecossistemas.",total:3,passed:1,complete:false}];APP.page="challenges";render()}};'
 page.evaluate(payload)
 for view in ['home','worlds','games','shop','badges']:
  page.evaluate('(view)=>window.__qa.switchView(view)',view)
  page.screenshot(path=str(art/(view+'.png')),full_page=True)
 
 page.evaluate('window.__qa.school()'); page.screenshot(path=str(art/'school.png'),full_page=True)
 page.evaluate('window.__qa.challenges()'); page.screenshot(path=str(art/'challenges.png'),full_page=True)

 # Verify actual client-side navigation and three responsive widths.
 page.evaluate('window.__qa.switchView("home")')
 for tab,expect in [('worlds','Explorar mundos'),('games','Sala de jogos'),('shop','Loja Pixel'),('badges','Diário de medalhas')]:
  page.locator('[data-page="'+tab+'"]').click()
  assert expect.lower() in page.locator('main').inner_text().lower(),(tab,'navigation not rendered')
 for width in [390,768,1460]:
  page.set_viewport_size({'width':width,'height':844})
  page.evaluate('window.__qa.switchView("home")')
  assert not page.evaluate('document.documentElement.scrollWidth > window.innerWidth'),('horizontal overflow',width)
 page.set_viewport_size({'width':390,'height':844})
 page.evaluate('window.__qa.switchView("home")')
 page.screenshot(path=str(art/'home-mobile.png'),full_page=True)
 overflow=page.evaluate('document.documentElement.scrollWidth>window.innerWidth')
 print('mobile measures',page.evaluate("Object.fromEntries(['body','#app','.app','.topbar','main','.big-stage'].map(s=>{let e=document.querySelector(s);return [s,e?{width:e.getBoundingClientRect().width,left:e.getBoundingClientRect().left,scrollWidth:e.scrollWidth}:null]}))"))
 # Authentication screenshot
 page.set_viewport_size({'width':1460,'height':950});page.evaluate('window.__qa.onboarding()');page.screenshot(path=str(art/'onboarding.png'),full_page=True)
 print('Rendered:',list(x.name for x in art.glob('*.png')),'JS_ERRORS',errors,'mobile_horizontal_overflow',overflow)
 browser.close()
