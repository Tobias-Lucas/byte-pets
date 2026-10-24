import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {buildBridgeRound,publicBridgeRound,validateBridgeRound,traceBridgeRound} from './bridges.mjs';
import {dailyStatus} from './limits.mjs';
import {db,all,get,run,transaction,now} from './db.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>JSON.parse(readFileSync(path.join(root,'content',file),'utf8'));
export const WORLD=read('worlds.json');export const ITEMS=read('items.json');export const SLOTS=read('worlds_slots.json');export const SKILLS=read('skills.json');
export const WORLD_MAP=Object.fromEntries(WORLD.map(x=>[x.id,x]));
export const ITEM_MAP=Object.fromEntries(ITEMS.map(x=>[x.id,x]));
export function err(message,status=400){let e=new Error(message);e.status=status;throw e}
export function assert(condition,message,status=400){if(!condition)err(message,status)}
export function petState(accountId){tick(accountId);return get('SELECT * FROM pets WHERE account_id=?',accountId)}
const clamp=n=>Math.max(0,Math.min(100,n));
export function tick(accountId){
 const pet=get('SELECT * FROM pets WHERE account_id=?',accountId);if(!pet)return;
 // Institutional pets are fixed visual guides, not Tamagotchi-style player pets.
 if(get("SELECT 1 FROM school_members WHERE account_id=? AND role IN ('manager','teacher') LIMIT 1",accountId))return;
 const t=now(),elapsed=Math.max(0,t-pet.last_tick),hrs=Math.min(elapsed/3600,12);
 if(elapsed<2)return;
 const hunger=clamp(pet.hunger-Math.min(12,hrs*1.3));
 const hygiene=clamp(pet.hygiene-Math.min(12,hrs*.95));
 const energy=pet.sleeping?clamp(pet.energy+Math.min(100,elapsed/8)):clamp(pet.energy-Math.min(9,hrs*.75));
 const sleeping=pet.sleeping&&energy<100?1:0;
 const happiness=clamp(pet.happiness-Math.min(10,hrs*.8));
 let health=pet.health;
 if(hunger<18||hygiene<15)health=clamp(health-Math.min(4,hrs*.45));
 const heal=Math.min(pet.heal_reserve,elapsed/12);health=clamp(health+heal);
 const poop=pet.poop_at&&t>=pet.poop_at?1:pet.poop;
 run('UPDATE pets SET hunger=?,hygiene=?,energy=?,happiness=?,health=?,heal_reserve=?,poop=?,sleeping=?,last_tick=? WHERE account_id=?',hunger,hygiene,energy,happiness,health,Math.max(0,pet.heal_reserve-heal),poop,sleeping,t,accountId);
}
export function badge(accountId,badgeId,label,issuer='BytePets'){
 const changed=run('INSERT OR IGNORE INTO badges(account_id,badge_id,label,issuer,awarded_at) VALUES(?,?,?,?,?)',accountId,badgeId,label,issuer,now()).changes;
 return Boolean(changed);
}
export function reward(accountId,reason,xp,coins,key=randomUUID()){
 assert(xp>=0&&xp<=200&&coins>=0&&coins<=300,'Recompensa inválida');
 const changed=run('INSERT OR IGNORE INTO rewards(id,account_id,reason,xp,coins,created_at) VALUES(?,?,?,?,?,?)',key,accountId,reason,xp,coins,now()).changes;
 if(changed)run('UPDATE pets SET xp=xp+?,level=1+CAST((xp+?)/100 AS INTEGER),coins=coins+? WHERE account_id=?',xp,xp,coins,accountId);
 return Boolean(changed);
}
export function grantWorlds(accountId){
 const pet=get('SELECT * FROM pets WHERE account_id=?',accountId);if(!pet)return;
 const b=new Set(all('SELECT badge_id FROM badges WHERE account_id=?',accountId).map(x=>x.badge_id));
 for(const w of WORLD){if(pet.level>=w.minLevel&&(!w.requiresBadge||b.has(w.requiresBadge)))run('INSERT OR IGNORE INTO owned_worlds(account_id,world_id) VALUES(?,?)',accountId,w.id)}
}
export function me(accountId){
 tick(accountId);grantWorlds(accountId);
 const account=get('SELECT id,username,role,allow_visits FROM accounts WHERE id=?',accountId);
 const pet=get('SELECT * FROM pets WHERE account_id=?',accountId);
 if(!account||!pet)err('Conta não encontrada',404);
 const inventory=all('SELECT item_id,world_id,quantity FROM inventory WHERE account_id=? AND quantity>0',accountId);
 const equipment=all('SELECT world_id,slot,item_id FROM world_equipment WHERE account_id=?',accountId);
 const unlocked=all('SELECT world_id FROM owned_worlds WHERE account_id=?',accountId).map(x=>x.world_id);
 const badges=all('SELECT badge_id,label,issuer,awarded_at FROM badges WHERE account_id=? ORDER BY awarded_at DESC',accountId);
 const schools=all(`SELECT s.id,s.name,m.role FROM schools s JOIN school_members m ON m.school_id=s.id WHERE m.account_id=?`,accountId);
 const classes=all(`SELECT c.id,c.name,c.school_id FROM classes c JOIN class_members m ON m.class_id=c.id WHERE m.account_id=?`,accountId);
 return {account,pet,inventory,equipment,unlocked,badges,schools,classes,gameDaily:dailyStatus(accountId),cosmetics:{skins:[{id:'normal',title:'Original',unlocked:true},{id:'crystal',title:'Cristal',unlocked:pet.level>=3&&badges.some(b=>b.badge_id==='padroes')},{id:'forest',title:'Floresta',unlocked:pet.level>=6&&badges.some(b=>b.badge_id==='caminhos')}]}};
}
export function adopt(id,name){const nameTrim=String(name||'Byte').trim().slice(0,20);assert(nameTrim.length>=2,'Escolha um nome com pelo menos 2 caracteres');const t=now();transaction(()=>{
 run('INSERT INTO pets(account_id,name,last_tick) VALUES(?,?,?)',id,nameTrim,t);
 run('INSERT INTO owned_worlds(account_id,world_id) VALUES(?,?)',id,'refugio');
 run('INSERT INTO inventory(account_id,item_id,world_id,quantity) VALUES(?,?,?,?)',id,'apple','',2);
 run('INSERT INTO inventory(account_id,item_id,world_id,quantity) VALUES(?,?,?,?)',id,'cookie','',1);
});return me(id)}
export function care(id,action,itemId){return transaction(()=>{
 tick(id);const p=get('SELECT * FROM pets WHERE account_id=?',id),t=now();let anim='happy';
 if(p.sleeping&&!['wake','sleep'].includes(action))err('Seu BytePet esta dormindo. Acorde-o antes de cuidar dele.');
 switch(action){
 case 'feed':{
  const item=ITEM_MAP[itemId];assert(item&&item.kind==='food','Selecione uma comida');const inv=get('SELECT quantity FROM inventory WHERE account_id=? AND item_id=? AND world_id=?',id,itemId,'');assert(inv&&inv.quantity>0,'Comida indisponível');
  run('UPDATE inventory SET quantity=quantity-1 WHERE account_id=? AND item_id=? AND world_id=?',id,itemId,'');
  run('UPDATE pets SET hunger=?,happiness=?,heal_reserve=MIN(60,heal_reserve+?),poop_at=?,last_tick=? WHERE account_id=?',clamp(p.hunger+item.satiety),clamp(p.happiness+6),item.heal,t+20,t,id);
  anim='eat';break;}
 case 'clean':run('UPDATE pets SET hygiene=?,happiness=?,poop=?,poop_at=CASE WHEN poop=1 THEN 0 ELSE poop_at END WHERE account_id=?',clamp(p.hygiene+31),clamp(p.happiness+5),0,id);break;
 case 'collect':assert(p.poop===1,'Sem sujeira para recolher');run('UPDATE pets SET poop=0,poop_at=0,hygiene=?,happiness=? WHERE account_id=?',clamp(p.hygiene+12),clamp(p.happiness+4),id);break;
 case 'sleep':{if(p.energy>=100)err('A energia ja esta completa.');run('UPDATE pets SET sleeping=1,last_tick=? WHERE account_id=?',t,id);anim='sleep';break;}
 case 'wake':run('UPDATE pets SET sleeping=0,last_tick=? WHERE account_id=?',t,id);anim='idle';break;
 case 'play':run('UPDATE pets SET energy=?,happiness=?,hunger=? WHERE account_id=?',clamp(p.energy-8),clamp(p.happiness+18),clamp(p.hunger-4),id);break;
 default:err('Ação inválida')}
 if(action==='clean'||action==='collect'){
  if(t-p.care_reward_at>50){run('UPDATE pets SET care_reward_at=? WHERE account_id=?',t,id);reward(id,'care:'+action,3,1)}
 }
 return {state:me(id),anim};
})}
export function buy(id,itemId,worldId){const item=ITEM_MAP[itemId];assert(item,'Item inexistente');if(item.kind==='decor'){assert(item.worldId===worldId,'O item pertence a outro mundo');const unlocked=get('SELECT 1 AS ok FROM owned_worlds WHERE account_id=? AND world_id=?',id,worldId);assert(unlocked,'Mundo bloqueado')}else{worldId=''}
 return transaction(()=>{const pet=get('SELECT coins FROM pets WHERE account_id=?',id);assert(pet.coins>=item.price,'PixelCoins insuficientes');run('UPDATE pets SET coins=coins-? WHERE account_id=?',item.price,id);
 run('INSERT INTO inventory(account_id,item_id,world_id,quantity) VALUES(?,?,?,1) ON CONFLICT(account_id,item_id,world_id) DO UPDATE SET quantity=quantity+1',id,itemId,worldId);
 run('INSERT INTO rewards(id,account_id,reason,xp,coins,created_at) VALUES(?,?,?,?,?,?)',randomUUID(),id,'purchase:'+itemId,0,-item.price,now());return me(id)});}
export function equip(id,itemId,worldId){const item=ITEM_MAP[itemId];assert(item&&item.kind==='decor'&&item.worldId===worldId,'Decoração inválida');return transaction(()=>{
 assert(get('SELECT 1 AS ok FROM owned_worlds WHERE account_id=? AND world_id=?',id,worldId),'Mundo bloqueado');
 assert(get('SELECT quantity FROM inventory WHERE account_id=? AND item_id=? AND world_id=? AND quantity>0',id,itemId,worldId),'Você não possui este item');
 run('INSERT INTO world_equipment(account_id,world_id,slot,item_id) VALUES(?,?,?,?) ON CONFLICT(account_id,world_id,slot) DO UPDATE SET item_id=excluded.item_id',id,worldId,item.slot,itemId);
 return me(id)});}
export function travel(id,worldId){assert(WORLD_MAP[worldId],'Mundo inexistente');return transaction(()=>{grantWorlds(id);assert(get('SELECT 1 AS ok FROM owned_worlds WHERE account_id=? AND world_id=?',id,worldId),'Desbloqueie este mundo primeiro');run('UPDATE pets SET world_id=? WHERE account_id=?',worldId,id);return me(id)})}
const rounds={
 pattern:[
  {title:'Luzes alternadas',hint:'Observe a repetição das formas.',sequence:['◆','●','◆','●','?'],options:['◆','●','▲'],answer:'◆'},
  {title:'Códigos do robô',hint:'A sequência repete dois, dois, um.',sequence:['▲','▲','●','▲','▲','?'],options:['●','▲','◆'],answer:'●'},
  {title:'Circuito crescente',hint:'O número de sinais aumenta de dois em dois.',sequence:['2','4','6','8','?'],options:['9','10','12'],answer:'10'},
  {title:'Padrão de três',hint:'Observe os três primeiros símbolos.',sequence:['◆','▲','●','◆','▲','?'],options:['◆','●','▲'],answer:'●'}
 ],
 maze:[
  {title:'Rota do Explorador',hint:'Organize os movimentos para chegar à estrela.',grid:5,start:[0,0],goal:[4,3],walls:[[1,1],[2,1],[3,1],[3,3]],maxSteps:12},
  {title:'Caminho Secreto',hint:'Nem todo caminho mais curto está livre.',grid:5,start:[0,4],goal:[4,0],walls:[[1,3],[2,3],[2,2],[3,1]],maxSteps:14},
  {title:'Portal Azul',hint:'Contorne as pedras antes de chegar.',grid:5,start:[0,0],goal:[4,4],walls:[[1,0],[1,1],[3,2],[3,3]],maxSteps:14},
 ],
 snake:[{title:'ByteSnake dos Pares',hint:'Pegue o numero indicado. Cuidado com os numeros impares.',goal:3,targets:[2,4,6],correct:[2,4,6,8],wrong:[1,3,5,7,9],limit:50}]
};
export function startGame(id,type){assert(rounds[type]||type==='bridges','Jogo inexistente');return transaction(()=>{
 const daily=dailyStatus(id);assert(daily.remaining>0,`Limite diario de ${daily.limit} jogos atingido. Volte amanha!`,429);
 const count=get('SELECT COUNT(*) AS c FROM issued_games WHERE account_id=? AND type=?',id,type)?.c||0;
 const pack=type==='bridges'?buildBridgeRound(count):rounds[type][count%rounds[type].length];
 const issue=randomUUID();const payload=type==='bridges'?publicBridgeRound(pack):{...pack};
 delete payload.answer;delete payload.correct;delete payload.wrong;
 run('INSERT INTO issued_games(id,account_id,type,payload,answer,created_at) VALUES(?,?,?,?,?,?)',issue,id,type,JSON.stringify(payload),JSON.stringify(pack),now());
 return {sessionId:issue,type,round:payload,daily:dailyStatus(id)};
 });}

function validateMaze(round,moves){assert(Array.isArray(moves)&&moves.length<=round.maxSteps,'Sequência inválida');let [x,y]=round.start;for(const cmd of moves){const delta={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]}[cmd];assert(delta,'Comando inválido');x+=delta[0];y+=delta[1];if(x<0||y<0||x>=round.grid||y>=round.grid||round.walls.some(w=>w[0]===x&&w[1]===y))return false;}return x===round.goal[0]&&y===round.goal[1];}
export function finishGame(id,sessionId,response){return transaction(()=>{
 const issued=get('SELECT * FROM issued_games WHERE id=? AND account_id=?',sessionId,id);assert(issued,'Sessão inexistente',404);if(issued.completed)return {duplicate:true,correct:!!issued.correct,state:me(id)};
 const round=JSON.parse(issued.answer);let correct=false;
 if(issued.type==='pattern')correct=String(response)===round.answer;
 if(issued.type==='maze')correct=validateMaze(round,response);
 if(issued.type==='bridges')correct=validateBridgeRound(round,response);
 if(issued.type==='snake')correct=Array.isArray(response)&&response.length===round.targets.length&&response.every((n,i)=>Number(n)===round.targets[i]);
 if(!correct)return {correct:false,retry:true,state:me(id),...(issued.type==='bridges'?traceBridgeRound(round,response):{})}; // Alpha: valida alvos, nao reproduz movimento do cliente
 run('UPDATE issued_games SET completed=1, correct=? WHERE id=?',Number(correct),sessionId);
 if(correct){reward(id,'game:'+issued.type,24,18,'game:'+sessionId);
 const c=get(`SELECT COUNT(*) AS c FROM issued_games WHERE account_id=? AND type=? AND completed=1 AND correct=1`,id,issued.type)?.c||0;
 if(issued.type==='pattern'&&c>=3)badge(id,'padroes','Aprendiz dos Padrões');
 if((issued.type==='maze'||issued.type==='bridges')&&c>=3)badge(id,'caminhos','Mestre dos Caminhos');}
 return {correct,state:me(id),...(correct&&issued.type==='bridges'?{walkPath:round.path}: {})};
})}
export function schoolRole(id,schoolId,roles=['manager','teacher']){const membership=get('SELECT role FROM school_members WHERE school_id=? AND account_id=?',schoolId,id);assert(membership&&roles.includes(membership.role),'Sem permissão nesta escola',403);return membership.role;}
export function isClassmate(a,b){return Boolean(get(`SELECT 1 AS ok FROM class_members a JOIN class_members b ON a.class_id=b.class_id WHERE a.account_id=? AND b.account_id=?`,a,b));}
export function friendshipState(a,b){return get(`SELECT * FROM friendships WHERE ((requester=? AND recipient=?) OR (requester=? AND recipient=?)) AND status='accepted'`,a,b,b,a)}
export function visitor(requester,target){const owner=get('SELECT id,username,allow_visits FROM accounts WHERE id=?',target);assert(owner,'Jogador inexistente',404);
 assert(requester===target||Boolean(friendshipState(requester,target))||Boolean(owner.allow_visits&&isClassmate(requester,target)),'Visita restrita a amigos ou colegas autorizados',403);
 grantWorlds(target);tick(target);const p=get('SELECT name,level,world_id,health,skin FROM pets WHERE account_id=?',target);
 return {account:{id:owner.id,username:owner.username},pet:p,unlocked:all('SELECT world_id FROM owned_worlds WHERE account_id=?',target).map(x=>x.world_id),equipment:all('SELECT world_id,slot,item_id FROM world_equipment WHERE account_id=?',target),badges:all('SELECT badge_id,label FROM badges WHERE account_id=?',target)};}
