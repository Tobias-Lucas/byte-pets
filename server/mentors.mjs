import {randomUUID} from 'node:crypto';
import {all,get,run,transaction,now} from './db.mjs';
import {assert,friendshipState,isClassmate,tick} from './core.mjs';

export const MENTOR_TEXT={
 congratulations:'Parabens pelo seu esforco! Continue explorando.',
 activity:'Tem uma atividade nova esperando por voce.',
 encouragement:'Cada tentativa e uma chance de aprender. Continue!',
 help:'Se precisar de ajuda, converse com seu professor na escola.'
};
export function institutionalRole(accountId){
 const record=get("SELECT role FROM school_members WHERE account_id=? AND role IN ('manager','teacher') ORDER BY CASE role WHEN 'manager' THEN 0 ELSE 1 END LIMIT 1",accountId);
 return record?.role||null;
}
export function assertStudentPlayer(accountId){assert(!institutionalRole(accountId),'Perfil institucional: acesse somente o painel de gestao',403);}
export function targetScope(visitorId,ownerId){
 const owner=get('SELECT id,username,allow_visits FROM accounts WHERE id=?',ownerId);assert(owner,'Conta nao encontrada',404);
 const staff=institutionalRole(visitorId);
 if(staff){
  const permitted=staff==='manager'?
   get(`SELECT 1 AS yes FROM school_members m JOIN school_members target ON target.school_id=m.school_id
   WHERE m.account_id=? AND m.role='manager' AND target.account_id=? AND target.role='student' LIMIT 1`,visitorId,ownerId):
   get(`SELECT 1 AS yes FROM teacher_classes tc JOIN class_members cm ON cm.class_id=tc.class_id
   JOIN school_members sm ON sm.account_id=cm.account_id AND sm.school_id=tc.school_id AND sm.role='student'
   WHERE tc.account_id=? AND cm.account_id=? LIMIT 1`,visitorId,ownerId);
  assert(permitted,'Aluno nao pertence a uma turma sob sua responsabilidade',403);
 } else {
  assert(visitorId===ownerId||friendshipState(visitorId,ownerId)||isClassmate(visitorId,ownerId),'Somente amigos e colegas podem visitar',403);
 }
 if(visitorId!==ownerId)assert(owner.allow_visits===1,'O proprietario nao autorizou visitas',403);
 return {owner,staff};
}
export function mentorView(accountId){
 const role=institutionalRole(accountId);const acc=get('SELECT username FROM accounts WHERE id=?',accountId);
 if(role)return {id:accountId,name:role==='manager'?'Orion, o Sabio':'Luna, a Guia',username:acc.username,role,sprite:'/assets/pets/'+(role==='manager'?'mentor_admin':'mentor_teacher')+'.png',institutional:true};
 const pet=get('SELECT name,level,skin FROM pets WHERE account_id=?',accountId);
 return {id:accountId,name:pet?.name||acc.username,username:acc.username,role:'student',level:pet?.level||1,sprite:'/assets/pets/'+(['crystal','forest'].includes(pet?.skin)?'skins/'+pet.skin+'/':'')+'idle.png',skin:pet?.skin||'normal',institutional:false};
}
export function enterVisit(visitorId,ownerId){
 targetScope(visitorId,ownerId);assert(visitorId!==ownerId,'Voce ja esta na propria casa');
 return transaction(()=>{
  run('DELETE FROM active_visits WHERE expires_at<?',now());
  const active=get('SELECT COUNT(*) AS total FROM active_visits WHERE owner_id=? AND expires_at>? AND visitor_id!=?',ownerId,now(),visitorId)?.total||0;
  assert(active<4,'Esta casa esta com o limite de visitantes',429);
  run('INSERT INTO active_visits(visitor_id,owner_id,entered_at,expires_at) VALUES(?,?,?,?) ON CONFLICT(visitor_id) DO UPDATE SET owner_id=excluded.owner_id,entered_at=excluded.entered_at,expires_at=excluded.expires_at',visitorId,ownerId,now(),now()+100);
  return {visitor:mentorView(visitorId),ownerId};
 });
}
export function leaveVisit(visitorId){run('DELETE FROM active_visits WHERE visitor_id=?',visitorId);return {ok:true};}
export function visitHeartbeat(visitorId,ownerId){targetScope(visitorId,ownerId);const changed=run('UPDATE active_visits SET expires_at=? WHERE visitor_id=? AND owner_id=? AND expires_at>?',now()+100,visitorId,ownerId,now()).changes;assert(changed===1,'Visita expirou, entre novamente',409);return {ok:true};}
export function currentVisitors(ownerId){
 const a=all('SELECT visitor_id FROM active_visits WHERE owner_id=? AND expires_at>? ORDER BY entered_at LIMIT 4',ownerId,now());
 return {visitors:a.map(x=>mentorView(x.visitor_id))};
}
export function sendMentorMessage(senderId,recipientId,key){
 const staff=institutionalRole(senderId);assert(staff,'Somente administracao e professores podem enviar recados pedagogicos',403);
 // Academic preset messages are permitted in authorized classes even when house visits are disabled.
 const inSchool=get(`SELECT 1 AS ok FROM school_members sm JOIN school_members target ON target.school_id=sm.school_id WHERE sm.account_id=? AND sm.role='manager' AND target.account_id=? AND target.role='student' LIMIT 1`,senderId,recipientId);
 const teaching=get(`SELECT 1 AS ok FROM teacher_classes tc JOIN class_members cm ON cm.class_id=tc.class_id WHERE tc.account_id=? AND cm.account_id=? LIMIT 1`,senderId,recipientId);
 assert(inSchool||teaching,'Aluno fora das turmas autorizadas',403);
 assert(Object.hasOwn(MENTOR_TEXT,key),'Recado indisponivel');
 const rate=get('SELECT COUNT(*) AS total FROM mentor_messages WHERE sender_id=? AND recipient_id=? AND created_at>?',senderId,recipientId,now()-86400)?.total||0;
 assert(rate<5,'Limite de cinco recados por aluno por dia',429);
 const id=randomUUID();run('INSERT INTO mentor_messages(id,sender_id,recipient_id,message_key,created_at) VALUES(?,?,?,?,?)',id,senderId,recipientId,key,now());
 return {id,message:MENTOR_TEXT[key]};
}
export function studentMessages(accountId){
 return {messages:all(`SELECT mm.id,mm.message_key,mm.created_at,mm.read_at,a.username AS sender_username
 FROM mentor_messages mm JOIN accounts a ON a.id=mm.sender_id
 WHERE mm.recipient_id=? ORDER BY mm.created_at DESC LIMIT 10`,accountId).map(x=>({...x,message:MENTOR_TEXT[x.message_key]}))};
}
export function markMessageRead(accountId,messageId){const changed=run('UPDATE mentor_messages SET read_at=COALESCE(read_at,?) WHERE id=? AND recipient_id=?',now(),messageId,accountId).changes;assert(changed===1,'Recado nao encontrado',404);return {ok:true};}
