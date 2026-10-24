import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {all,get,run,transaction,now} from './db.mjs';
import {assert,adopt,me,schoolRole} from './core.mjs';
const sha=(v)=>createHash('sha256').update(v).digest('hex');
export const usernameOk=(s)=>/^[a-z0-9_]{3,20}$/.test(s);
export const passwordOk=(s)=>typeof s==='string'&&s.length>=8&&s.length<=128;
export const usernameOf=(s)=>String(s||'').trim().toLowerCase();
export function setupState(){
 const v=get("SELECT value FROM app_settings WHERE key='mode'")?.value;
 if(v)return {configured:true,mode:v};
 // Do not expose an unauthenticated bootstrap endpoint on a legacy database.
 if(get('SELECT COUNT(*) AS n FROM accounts').n>0){
  run("INSERT OR IGNORE INTO app_settings(key,value) VALUES('mode','normal')");
  return {configured:true,mode:'normal',legacy:true};
 }
 return {configured:false,mode:null};
}
export function setupNormal(){return transaction(()=>{
 assert(!setupState().configured,'O BytePets ja foi configurado',409);
 run("INSERT INTO app_settings(key,value) VALUES('mode','normal')");return {mode:'normal'};
});}
const schoolCode=()=>randomBytes(5).toString('hex').toUpperCase();
export function setupSchool(username,passwordHash,schoolName,petName){
 const clean=String(schoolName||'').trim();assert(clean.length>=3&&clean.length<=90,'Informe o nome da instituicao');
 assert(usernameOk(username),'Usuario administrador invalido');
 const result=transaction(()=>{
  assert(!setupState().configured,'O BytePets ja foi configurado',409);
  const accountId=randomUUID(),schoolId=randomUUID(),code=schoolCode();
  run('INSERT INTO accounts(id,username,password_hash,role,created_at) VALUES(?,?,?,?,?)',accountId,username,passwordHash,'adult',now());
  run('INSERT INTO schools(id,name,created_by,created_at,code) VALUES(?,?,?,?,?)',schoolId,clean,accountId,now(),code);
  run('INSERT INTO school_members(school_id,account_id,role) VALUES(?,?,?)',schoolId,accountId,'manager');
  run("INSERT INTO app_settings(key,value) VALUES('mode','school')");
  return {accountId,schoolId,code};
 });
 adopt(result.accountId,'Orion');return result;
}
export function addRosterStudent(actor,schoolId,{enrollment,studentName,classId}){
 schoolRole(actor,schoolId,['manager']);
 const en=String(enrollment||'').trim(),name=String(studentName||'').trim();
 assert(/^\d{4,20}$/.test(en),'Matricula deve conter entre 4 e 20 digitos');
 assert(name.length>=3&&name.length<=120,'Nome do aluno invalido');
 assert(get('SELECT id FROM classes WHERE id=? AND school_id=?',classId,schoolId),'Turma invalida');
 const token=randomBytes(9).toString('base64url');
 const id=randomUUID();
 run('INSERT INTO school_roster(id,school_id,enrollment,student_name,class_id,activation_hash,created_at) VALUES(?,?,?,?,?,?,?)',id,schoolId,en,name,classId,sha(token),now());
 return {id,enrollment:en,studentName:name,classId,activationCode:token,studentCode:token};
}
export function lookupStudentCode(studentCode){
 const code=String(studentCode||'').trim();assert(code.length>=10&&code.length<=80,'Digite o codigo individual da escola');
 const row=get(`SELECT r.id,r.student_name,c.name AS class_name,s.name AS school_name
 FROM school_roster r JOIN classes c ON c.id=r.class_id JOIN schools s ON s.id=r.school_id
 WHERE r.activation_hash=? AND r.active=1 AND r.account_id IS NULL`,sha(code));
 assert(row,'Codigo invalido, expirado ou ja utilizado',403);
 return {schoolName:row.school_name,className:row.class_name,studentName:row.student_name};
}
export function reissueStudentCode(actor,schoolId,rosterId){
 schoolRole(actor,schoolId,['manager']);
 const row=get('SELECT id,account_id FROM school_roster WHERE id=? AND school_id=? AND active=1',rosterId,schoolId);
 assert(row,'Matricula nao encontrada',404);assert(!row.account_id,'Esta matricula ja possui conta',409);
 const code=randomBytes(12).toString('base64url');run('UPDATE school_roster SET activation_hash=? WHERE id=?',sha(code),row.id);
 return {studentCode:code,activationCode:code};
}
export function registerEnrolledStudent(b,ph){
 const username=usernameOf(b.username),password=b.password;
 assert(usernameOk(username),'Usuario invalido');assert(passwordOk(password),'Senha: minimo de 8 caracteres');
 assert(String(b.petName||'').trim().length>=2,'Escolha o nome do mascote');
 const schoolCode=String(b.schoolCode||'').trim().toUpperCase(),enrollment=String(b.enrollment||'').trim();
 const activation=String(b.studentCode||b.activationCode||'').trim();
 assert(activation.length>=8,'Informe o codigo individual do aluno');
 // Backwards-compatible registration for previously distributed three-part legacy credentials.
 const school=b.studentCode?null:get('SELECT id FROM schools WHERE code=?',schoolCode);
 if(!b.studentCode)assert(school,'Instituicao nao encontrada',404);
 const student=transaction(()=>{
  const roster=b.studentCode?
   get('SELECT * FROM school_roster WHERE activation_hash=?',sha(activation)):
   get('SELECT * FROM school_roster WHERE school_id=? AND enrollment=?',school.id,enrollment);
  assert(roster&&roster.active,'Matricula nao autorizada',403);
  assert(!roster.account_id,'Esta matricula ja possui uma conta',409);
  assert(roster.activation_hash===sha(activation),'Codigo de ativacao invalido',403);
  assert(!get('SELECT id FROM accounts WHERE username=?',username),'Nome de usuario ja usado',409);
  const id=randomUUID();
  run('INSERT INTO accounts(id,username,password_hash,role,created_at) VALUES(?,?,?,?,?)',id,username,ph,'student',now());
  run('UPDATE school_roster SET account_id=?,activation_hash=? WHERE id=? AND account_id IS NULL',id,sha('used:'+id),roster.id);
  run('INSERT INTO class_members(class_id,account_id) VALUES(?,?)',roster.class_id,id);
  run("INSERT INTO school_members(school_id,account_id,role) VALUES(?,?,'student')",roster.school_id,id);
  return {accountId:id,studentName:roster.student_name};
 });
 adopt(student.accountId,b.petName);
 return student;
}
export function createTeacherInvite(actor,schoolId){
 schoolRole(actor,schoolId,['manager']);const token=randomBytes(30).toString('base64url');
 run('INSERT INTO teacher_invites(id,school_id,token_hash,expires_at,created_by,created_at) VALUES(?,?,?,?,?,?)',randomUUID(),schoolId,sha(token),now()+7*86400,actor,now());
 return {token,expiresInDays:7,path:'/?teacherInvite='+encodeURIComponent(token)};
}
export function teacherInviteInfo(token){
 const invite=get('SELECT i.school_id,i.expires_at,i.used_at,s.name AS school_name FROM teacher_invites i JOIN schools s ON s.id=i.school_id WHERE i.token_hash=?',sha(String(token||'')));
 assert(invite&&!invite.used_at&&invite.expires_at>now(),'Convite expirado ou utilizado',404);
 return {schoolName:invite.school_name};
}
export function requestTeacher(b,ph){
 const username=usernameOf(b.username),token=String(b.inviteToken||'');
 assert(usernameOk(username),'Usuario invalido');assert(passwordOk(b.password),'Senha invalida');
 const created=transaction(()=>{
  const invite=get('SELECT * FROM teacher_invites WHERE token_hash=?',sha(token));
  assert(invite&&!invite.used_at&&invite.expires_at>now(),'Convite expirado ou utilizado',403);
  assert(!get('SELECT id FROM accounts WHERE username=?',username),'Usuario ja existe',409);
  const id=randomUUID();
  run('INSERT INTO accounts(id,username,password_hash,role,created_at) VALUES(?,?,?,?,?)',id,username,ph,'adult',now());
  run('INSERT INTO teacher_requests(id,school_id,account_id,status,created_at) VALUES(?,?,?,?,?)',randomUUID(),invite.school_id,id,'pending',now());
  run('UPDATE teacher_invites SET used_at=? WHERE id=?',now(),invite.id);
  return {accountId:id,schoolId:invite.school_id};
 });
 adopt(created.accountId,'Luna');return created;
}
export function approvalState(accountId){return get(`SELECT r.status,s.name AS school_name FROM teacher_requests r JOIN schools s ON s.id=r.school_id WHERE r.account_id=?`,accountId)||null;}
export function approveTeacher(actor,schoolId,requestId,approved){
 schoolRole(actor,schoolId,['manager']);return transaction(()=>{
  const req=get('SELECT * FROM teacher_requests WHERE id=? AND school_id=? AND status=?',requestId,schoolId,'pending');
  assert(req,'Solicitacao nao encontrada',404);
  run('UPDATE teacher_requests SET status=?,resolved_at=? WHERE id=?',approved?'approved':'rejected',now(),requestId);
  if(approved)run("INSERT INTO school_members(school_id,account_id,role) VALUES(?,?,'teacher')",schoolId,req.account_id);
  return {approved};
 });
}
export function teacherAssignClass(actor,schoolId,accountId,classId){
 schoolRole(actor,schoolId,['manager']);
 assert(get("SELECT 1 FROM school_members WHERE school_id=? AND account_id=? AND role='teacher'",schoolId,accountId),'Professor nao aprovado',403);
 assert(get('SELECT 1 FROM classes WHERE id=? AND school_id=?',classId,schoolId),'Turma invalida',404);
 run('INSERT OR IGNORE INTO teacher_classes(school_id,account_id,class_id) VALUES(?,?,?)',schoolId,accountId,classId);
 return {ok:true};
}
export function teacherPermittedClasses(accountId,schoolId){
 const role=schoolRole(accountId,schoolId);
 return role==='manager'?all('SELECT * FROM classes WHERE school_id=? ORDER BY name',schoolId):
  all('SELECT c.* FROM classes c JOIN teacher_classes tc ON tc.class_id=c.id WHERE tc.account_id=? AND c.school_id=? ORDER BY c.name',accountId,schoolId);
}
export function schoolRosterSummary(actor,schoolId){
 const role=schoolRole(actor,schoolId);const ownClasses=teacherPermittedClasses(actor,schoolId).map(c=>c.id);
 const roster=all('SELECT sr.id,sr.enrollment,sr.student_name,sr.class_id,sr.account_id,c.name AS class_name FROM school_roster sr JOIN classes c ON c.id=sr.class_id WHERE sr.school_id=? ORDER BY sr.student_name',schoolId)
  .filter(r=>role==='manager'||ownClasses.includes(r.class_id));
 const requests=role==='manager'?all("SELECT tr.id,a.username,tr.created_at FROM teacher_requests tr JOIN accounts a ON a.id=tr.account_id WHERE tr.school_id=? AND tr.status='pending'",schoolId):[];
 const teachers=all("SELECT a.id,a.username FROM school_members m JOIN accounts a ON a.id=m.account_id WHERE m.school_id=? AND m.role='teacher'",schoolId);
 const assignments=all('SELECT account_id,class_id FROM teacher_classes WHERE school_id=?',schoolId);
 return {roster,requests,teachers,assignments,classes:teacherPermittedClasses(actor,schoolId)};
}
export function schoolDailyCap(accountId){
 const caps=all("SELECT s.daily_game_limit AS cap FROM school_members m JOIN schools s ON s.id=m.school_id WHERE m.account_id=? AND m.role='student'",accountId).map(r=>r.cap);
 return caps.length?Math.min(...caps):5;
}
export function setDailyCap(actor,schoolId,limit){
 schoolRole(actor,schoolId,['manager']);assert(Number.isInteger(limit)&&limit>=1&&limit<=10,'Limite entre 1 e 10');
 run('UPDATE schools SET daily_game_limit=? WHERE id=?',limit,schoolId);return {limit};
}
