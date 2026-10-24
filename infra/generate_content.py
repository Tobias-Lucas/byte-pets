import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base='/assets/'
worlds=[]
for wid,name,level,badge in [('refugio','Refúgio Pixel',1,None),('jardim','Jardim Neon',3,'padroes'),('floresta','Floresta Mágica',6,'caminhos')]:
 worlds.append(dict(id=wid,name=name,minLevel=level,requiresBadge=badge,image=f'{base}worlds/{wid}-base.png',window=f'{base}worlds/{wid}-view.png',preview=f'{base}worlds/{wid}-preview.png',description={'refugio':'Seu lar entre circuitos e estrelas.','jardim':'Jardim de luz e descobertas.','floresta':'Mistérios e aventuras mágicas.'}[wid]))
items=[]
slot_names={'bed':['Cama Pixel','Cama Estelar'],'lamp':['Luminária Byte','Cristal Luminoso'],'companion':['Amigo Robô','Slime Luminoso'],'rug':['Tapete Grid','Tapete Constelação'],'wall_decor':['Quadro do Explorador','Painel de Cristais'],'window_view':['Vista Alternativa','Horizonte Especial']}
for world in worlds:
 w=world['id']
 for slot,names in slot_names.items():
  for i,name in enumerate(names,1):
   f=f'/{"assets"}/decor/{"wall" if slot=="wall_decor" else slot}_{w}_{i}.png' if slot!='window_view' else f'/assets/worlds/{w}-view-alt.png'
   items.append(dict(id=f'{w}_{slot}_{i}',name=name,kind='decor',worldId=w,slot=slot,image=f,price=65+25*i+(45 if slot=='companion' else 0),description=f'Decoração do mundo {world["name"]}.'))
foods=[('apple','Maçã Estelar',25,22),('cookie','Biscoito Lógico',35,28),('carrot','Cenoura Luminosa',30,25),('berry','Frutas da Floresta',45,38),('sandwich','Sanduíche Byte',70,50),('cake','Bolo Galáctico',100,70)]
for id,name,price,sat in foods:items.append(dict(id=id,name=name,kind='food',worldId=None,slot=None,image=f'/assets/food/{id}.png',price=price,satiety=sat,heal=round(sat*0.5),description='Recupera saciedade e inicia regeneração gradual.'))
(root/'content/worlds.json').write_text(json.dumps(worlds,ensure_ascii=False,indent=2))
(root/'content/items.json').write_text(json.dumps(items,ensure_ascii=False,indent=2))
(root/'content/skills.json').write_text(json.dumps([{'id':'padroes','title':'Padrões'},{'id':'caminhos','title':'Planejamento'},{'id':'matematica','title':'Matemática'},{'id':'biologia','title':'Biologia'}],ensure_ascii=False,indent=2))
print('content items',len(items))
