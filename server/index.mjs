import http from 'node:http';
import {createReadStream,existsSync,mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
import {extname,resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isPathInside} from './path-security.mjs';
import {db,get,all,run,transaction,now,databaseEngine,ping} from './db.mjs';
import {WORLD,ITEMS,SLOTS,SKILLS,assert,err,adopt,me,care,buy,equip,travel,startGame,finishGame,visitor,schoolRole,isClassmate,friendshipState} from './core.mjs';
import {seedModules,createSchool,createClass,joinClass,createModule,createQuestion,publishModule,modulesVisible,questionsFor,submitAnswer,schoolSummary,schoolReport} from './school.mjs';
import {startModuleRun,latestModuleRun,moduleRunView,answerModuleRun} from './module-runs.mjs';
import {setupState,setupNormal,setupSchool,addRosterStudent,registerEnrolledStudent,createTeacherInvite,teacherInviteInfo,requestTeacher,approvalState,approveTeacher,teacherAssignClass,schoolRosterSummary,setDailyCap,usernameOk,passwordOk,usernameOf,lookupStudentCode,reissueStudentCode} from './onboarding.mjs';
import {institutionalRole,assertStudentPlayer,targetScope,mentorView,enterVisit,leaveVisit,visitHeartbeat,currentVisitors,sendMentorMessage,studentMessages,markMessageRead} from './mentors.mjs';
seedModules();
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..'),web=join(root,'web'),mediaDir=join(resolve(process.env.DATA_DIR||join(root,'data')),'media');mkdirSync(mediaDir,{recursive:true});
const PORT=Number(process.env.PORT||4173),secure=process.env.COOKIE_SECURE==='true';
const PYTHON_BIN=process.env.PYTHON_BIN||'python3';
const MIME={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.jpg':'image/jpeg','.jpeg':'image/jpeg','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8'};
const hash=(text)=>createHash('sha256').update(text).digest('hex');
const pwHash=(password)=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex')};
const pwCheck=(password,stored)=>{const [salt,encoded]=stored.split(':');if(!salt||!encoded||encoded.length!==128)return false;return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(encoded,'hex'))};
function session(res,id){const token=randomBytes(32).toString('base64url');run('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)',hash(token),id,now()+86400*7);
 res.setHeader('Set-Cookie',`bp_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure?'; Secure':''}`);return id}
function user(req){const cookie=req.headers.cookie||'',token=cookie.match(/(?:^|; )bp_session=([^;]+)/)?.[1];if(!token)err('Entre para continuar',401);const record=get('SELECT account_id FROM sessions WHERE token_hash=? AND expires_at>?',hash(token),now());if(!record)err('Sessão expirada',401);return record.account_id;}
function output(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));}
async function json(req){let body='';for await(const chunk of req){body+=chunk;if(body.length>3_500_000)err('Requisição muito grande',413)}
 if(!body)return {};try{return JSON.parse(body)}catch{err('JSON inválido')}}
const ids=(p)=>p.split('/').filter(Boolean);
let lastAuth=new Map();function authThrottle(req){const ip=req.socket.remoteAddress||'localhost',t=now(),prev=lastAuth.get(ip)||[];const recent=prev.filter(x=>t-x<120);assert(recent.length<25,'Muitas tentativas. Tente mais tarde.',429);recent.push(t);lastAuth.set(ip,recent);}
function staticFile(req,res,pathname){
 if(pathname.startsWith('/media/')){
  const id=pathname.slice('/media/'.length).replace(/\.webp$/,'');
  const asset=get('SELECT school_id FROM media_assets WHERE id=?',id);assert(asset&&pathname.endsWith('.webp'),'Imagem não encontrada',404);
  const uid=user(req);const membership=get('SELECT role FROM school_members WHERE school_id=? AND account_id=?',asset.school_id,uid);
  assert(membership,'Arquivo de outra escola',403);
  if(membership.role==='student'){
   const available=get(`SELECT 1 AS ok FROM questions q JOIN modules m ON m.id=q.module_id JOIN module_classes mc ON mc.module_id=m.id JOIN class_members cm ON cm.class_id=mc.class_id WHERE m.school_id=? AND m.published=1 AND cm.account_id=? AND (q.media_path=? OR q.options_json LIKE ?) LIMIT 1`,asset.school_id,uid,pathname,'%'+id+'%');
   assert(available,'Imagem não publicada para sua turma',403);
  }
 }
 let rel;try{rel=decodeURIComponent(pathname)}catch{err('Caminho inválido',400)}
 const dir=rel.startsWith('/media/')?mediaDir:web;
 rel=rel.startsWith('/media/')?rel.slice('/media/'.length):rel.replace(/^\//,'');const full=resolve(dir,rel||'index.html');
 if(!isPathInside(dir,full))err('Acesso negado',403);
 if(!existsSync(full)||!['.png','.webp','.svg','.js','.css','.html','.json','.webmanifest','.ico','.jpg','.jpeg'].includes(extname(full))){res.writeHead(404);res.end('Não encontrado');return;}
 res.writeHead(200,{'Content-Type':MIME[extname(full)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=1800','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});createReadStream(full).pipe(res);
}
function validateConfirmedPassword(body){
 // Older API clients may omit passwordConfirm; modern registration screens
 // always send it. Never accept inconsistent values when supplied.
 if(Object.hasOwn(body,'passwordConfirm'))assert(body.password===body.passwordConfirm,'As senhas não coincidem. Confira e tente novamente.',422);
}
function readPublicAccount(id){return get('SELECT username,role,allow_visits FROM accounts WHERE id=?',id)}
function visitorViewFor(visitorId,ownerId){
 const owner=get('SELECT id,username FROM accounts WHERE id=?',ownerId);
 const p=get('SELECT name,level,world_id,health,skin,sleeping,hygiene,poop FROM pets WHERE account_id=?',ownerId);
 assert(p,'O aluno nao possui mascote',404);
 return {account:owner,pet:p,equipment:all('SELECT world_id,slot,item_id FROM world_equipment WHERE account_id=?',ownerId),visitor:mentorView(visitorId),badges:all('SELECT badge_id,label FROM badges WHERE account_id=?',ownerId)};
}
async function route(req,res){
 let url=new URL(req.url,'http://localhost'),path=url.pathname,parts=ids(path),method=req.method;
 if(!path.startsWith('/api/'))return staticFile(req,res,path);
 if(method==='GET'&&path==='/api/health'){ping();return output(res,200,{status:'ok',database:databaseEngine,version:'1.1.0'});}
 if(method==='GET'&&path==='/api/client-config')return output(res,200,{app:'BytePets',version:'1.1.0',apiBaseUrl:process.env.PUBLIC_BASE_URL||null,database:databaseEngine});
 if(method==='GET'&&path==='/api/content')return output(res,200,{worlds:WORLD,items:ITEMS,slots:SLOTS.commonSlots,skills:SKILLS,engine:'BytePets v0.8.0'});
 if(method==='GET'&&path==='/api/setup')return output(res,200,setupState());
 if(method==='POST'&&path==='/api/setup'){
  authThrottle(req);const b=await json(req);
  if(b.mode==='normal')return output(res,201,setupNormal());
  if(b.mode==='school'){
   validateConfirmedPassword(b);const username=usernameOf(b.username),password=String(b.password||'');
   assert(usernameOk(username)&&passwordOk(password),'Usuario ou senha do administrador invalidos');
   const school=setupSchool(username,pwHash(password),b.schoolName,b.petName);
   session(res,school.accountId);return output(res,201,{mode:'school',schoolCode:school.code,state:{...me(school.accountId),approval:null}});
  }
  err('Escolha uso normal ou estudantil');
 }
 if(method==='GET'&&path==='/api/teacher-invite')return output(res,200,teacherInviteInfo(url.searchParams.get('token')));
 if(method==='POST'&&path==='/api/teacher/register'){
  authThrottle(req);const b=await json(req);
  assert(setupState().mode==='school','Sistema nao configurado como escola',403);
  validateConfirmedPassword(b);assert(passwordOk(String(b.password||'')),'Senha: minimo de 8 caracteres');
  const request=requestTeacher(b,pwHash(String(b.password||'')));
  session(res,request.accountId);return output(res,201,{state:{...me(request.accountId),approval:approvalState(request.accountId)}});
 }
 if(method==='POST'&&path==='/api/student/verify-code'){
  authThrottle(req);assert(setupState().mode==='school','Cadastro escolar indisponivel',403);
  const data=await json(req);return output(res,200,lookupStudentCode(data.studentCode));
 }
 if(method==='POST'&&path==='/api/student/register'){
  authThrottle(req);const b=await json(req);
  assert(setupState().mode==='school','Cadastro escolar indisponivel',403);
  validateConfirmedPassword(b);assert(usernameOk(usernameOf(b.username))&&passwordOk(b.password),'Usuario ou senha invalidos');
  const result=registerEnrolledStudent(b,pwHash(b.password));
  session(res,result.accountId);return output(res,201,{state:{...me(result.accountId),approval:null}});
 }
 if(method==='POST'&&path==='/api/register'){
 authThrottle(req);assert(setupState().mode==='normal','Use o cadastro com matricula disponibilizado pela sua escola',403);
 const b=await json(req),username=usernameOf(b.username),password=String(b.password||''),role=(process.env.ALLOW_LEGACY_ADULT_REGISTRATION==='true'&&b.role==='adult')?'adult':'student';
 validateConfirmedPassword(b);assert(/^[a-z0-9_]{3,20}$/.test(username),'Usuário: 3 a 20 caracteres (letras, números e _).');assert(password.length>=8&&password.length<=128,'Senha: mínimo de 8 caracteres.');assert(!get('SELECT id FROM accounts WHERE username=?',username),'Este usuário já existe',409);
 const id=randomUUID(),ph=pwHash(password);run('INSERT INTO accounts(id,username,password_hash,role,created_at) VALUES(?,?,?,?,?)',id,username,ph,role,now());adopt(id,b.petName||'Byte');session(res,id);return output(res,201,{ok:true,state:{...me(id),approval:null}});
 }
 if(method==='POST'&&path==='/api/login'){
 authThrottle(req);const b=await json(req),u=String(b.username||'').toLowerCase().trim(),a=get('SELECT * FROM accounts WHERE username=?',u);
 if(!a||!pwCheck(String(b.password||''),a.password_hash))err('Usuário ou senha incorretos',401);
 session(res,a.id);return output(res,200,{state:{...me(a.id),approval:approvalState(a.id)}});
 }
 if(method==='POST'&&path==='/api/logout'){
 const token=(req.headers.cookie||'').match(/(?:^|; )bp_session=([^;]+)/)?.[1];if(token)run('DELETE FROM sessions WHERE token_hash=?',hash(token));res.setHeader('Set-Cookie','bp_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return output(res,200,{ok:true});
 }
 const id=user(req);const b=method==='POST'||method==='PATCH'?await json(req):{};
 if(method==='GET'&&path==='/api/me')return output(res,200,{...me(id),approval:approvalState(id)});
 const approval=approvalState(id);
 if(approval&&approval.status!=='approved')err('Cadastro de professor aguardando avaliacao da escola',403);
 const staff=institutionalRole(id);
 const studentOnly=path.startsWith('/api/pet/')||path.startsWith('/api/world/')||path.startsWith('/api/shop/')||path.startsWith('/api/games/')||path==='/api/classes/join'||path==='/api/social/friends/request'||path==='/api/social/visits'||path.startsWith('/api/social/friends/');
 if(staff&&studentOnly)err('Gestores e professores usam apenas ferramentas institucionais',403);
 // Live visit presence and teacher-to-student preset notices.
 if(method==='GET'&&path==='/api/visits/active')return output(res,200,currentVisitors(id));
 if(method==='POST'&&path==='/api/visits/leave')return output(res,200,leaveVisit(id));
 if(method==='POST'&&path==='/api/visits/heartbeat')return output(res,200,visitHeartbeat(id,b.ownerId));
 if(method==='POST'&&path==='/api/mentor/messages')return output(res,201,sendMentorMessage(id,b.studentId,b.key));
 if(method==='GET'&&path==='/api/mentor/messages'){assertStudentPlayer(id);return output(res,200,studentMessages(id));}
 if(method==='POST'&&parts[1]==='mentor'&&parts[2]==='messages'&&parts[3]&&parts[4]==='read')return output(res,200,markMessageRead(id,parts[3]));

 if(method==='POST'&&path==='/api/pet/name'){assert(String(b.name||'').trim().length>=2&&String(b.name).length<=20,'Nome inválido');run('UPDATE pets SET name=? WHERE account_id=?',String(b.name).trim(),id);return output(res,200,me(id));}
 if(method==='POST'&&path==='/api/pet/skin'){
 const state=me(id),skin=state.cosmetics.skins.find(x=>x.id===b.skin);assert(skin?.unlocked,'Skin ainda não desbloqueada');run('UPDATE pets SET skin=? WHERE account_id=?',b.skin,id);return output(res,200,me(id));}
 if(method==='POST'&&path==='/api/pet/care')return output(res,200,care(id,b.action,b.itemId));
 if(method==='POST'&&path==='/api/world/travel')return output(res,200,travel(id,b.worldId));
 if(method==='POST'&&path==='/api/shop/buy')return output(res,200,buy(id,b.itemId,b.worldId));
 if(method==='POST'&&path==='/api/world/equip')return output(res,200,equip(id,b.itemId,b.worldId));
 if(method==='POST'&&path==='/api/games/start')return output(res,200,startGame(id,b.type));
 if(method==='POST'&&path==='/api/games/finish')return output(res,200,finishGame(id,b.sessionId,b.answer));
 if(method==='GET'&&path==='/api/modules')return output(res,200,modulesVisible(id));
 if(method==='POST'&&parts[1]==='modules'&&parts[2]&&parts[3]==='runs'&&parts.length===4){const created=startModuleRun(id,parts[2]);return output(res,201,{...created,run:moduleRunView(id,created.runId)});}
 if(method==='GET'&&parts[1]==='modules'&&parts[2]&&parts[3]==='runs'&&parts[4]==='latest')return output(res,200,{run:latestModuleRun(id,parts[2])});
 if(method==='GET'&&parts[1]==='test-runs'&&parts[2]&&parts.length===3)return output(res,200,{run:moduleRunView(id,parts[2])});
 if(method==='POST'&&parts[1]==='test-runs'&&parts[2]&&parts[3]==='answers')return output(res,200,answerModuleRun(id,parts[2],b.questionId,b.answer,b.requestId));
 if(method==='GET'&&parts[1]==='modules'&&parts[2]&&parts[3]==='questions')return output(res,200,questionsFor(id,parts[2]));
 if(method==='POST'&&parts[1]==='questions'&&parts[2]&&parts[3]==='answer'){
  // Legacy compatibility only for accounts that have never started a complete test for this module.
  // Once in the new assessment flow, answers are irrevocable until a full-module retry.
  const q=get('SELECT module_id FROM questions WHERE id=?',parts[2]);
  if(q&&get('SELECT 1 AS ok FROM module_runs WHERE account_id=? AND module_id=?',id,q.module_id))err('Conclua o teste inteiro; respostas individuais não podem ser repetidas.',409);
  return output(res,200,submitAnswer(id,parts[2],b.attemptId,b.answer));
 }
 if(method==='POST'&&path==='/api/classes/join'){assert(setupState().mode!=='school','Utilize a matricula autorizada pela instituicao',403);return output(res,200,joinClass(id,b.code));}
 if(method==='POST'&&path==='/api/schools'){
 const a=readPublicAccount(id);assert(a.role==='adult'&&setupState().mode==='school'&&get("SELECT 1 FROM school_members WHERE account_id=? AND role='manager'",id),'Somente o administrador institucional pode criar escolas',403);return output(res,201,createSchool(id,b.name));}
 if(parts[1]==='schools'&&parts[2]){
 const schoolId=parts[2];
 if(method==='GET'&&parts[3]==='roster')return output(res,200,schoolRosterSummary(id,schoolId));
 if(method==='POST'&&parts[3]==='roster'&&parts[4]&&parts[5]==='reissue')return output(res,200,reissueStudentCode(id,schoolId,parts[4]));
 if(method==='POST'&&parts[3]==='roster'&&!parts[4])return output(res,201,addRosterStudent(id,schoolId,b));
 if(method==='POST'&&parts[3]==='teacher-invites')return output(res,201,createTeacherInvite(id,schoolId));
 if(method==='POST'&&parts[3]==='teacher-requests'&&parts[4])return output(res,200,approveTeacher(id,schoolId,parts[4],b.approve===true));
 if(method==='POST'&&parts[3]==='teacher-classes')return output(res,200,teacherAssignClass(id,schoolId,b.teacherId,b.classId));
 if(method==='POST'&&parts[3]==='game-limit')return output(res,200,setDailyCap(id,schoolId,b.limit));
 if(method==='GET'&&parts.length===3)return output(res,200,schoolSummary(id,schoolId));
 if(method==='GET'&&parts.length===4&&parts[3]==='reports')return output(res,200,schoolReport(id,schoolId));

 if(method==='POST'&&parts[3]==='classes')return output(res,201,createClass(id,schoolId,b.name));
 if(method==='POST'&&parts[3]==='modules')return output(res,201,createModule(id,schoolId,b));
 if(method==='POST'&&parts[3]==='media'){
  schoolRole(id,schoolId);
  assert(typeof b.data==='string'&&b.data.length<2_500_000,'Imagem inválida: limite 1,8 MB.');
  let match=b.data.match(/^data:image\/(png|jpeg|webp);base64,([\w+/=]+)$/);assert(match,'Envie PNG, JPEG ou WebP.');
  const raw=Buffer.from(match[2],'base64');assert(raw.length>12&&raw.length<=1_800_000,'Imagem muito grande');
  const assetId=randomUUID(),input=join(mediaDir,assetId+'.tmp'),out=join(mediaDir,assetId+'.webp');writeFileSync(input,raw);
  const proc=spawnSync(PYTHON_BIN,[join(root,'infra','normalize_media.py'),input,out],{timeout:10000,encoding:'utf8'});
  unlinkSync(input);if(proc.status!==0){if(existsSync(out))unlinkSync(out);err('Falha ao processar imagem. Confirme o formato.',422)}
  run('INSERT INTO media_assets(id,school_id,created_by,filename,mime,sha256,created_at) VALUES(?,?,?,?,?,?,?)',assetId,schoolId,id,assetId+'.webp','image/webp',hash(raw),now());return output(res,201,{path:'/media/'+assetId+'.webp',width:384,height:384});
 }
 }
 if(parts[1]==='modules'&&parts[2]&&method==='POST'){
  if(parts[3]==='questions')return output(res,201,createQuestion(id,parts[2],b));
  if(parts[3]==='publish')return output(res,200,publishModule(id,parts[2],b.classIds));
 }
 if(method==='GET'&&path==='/api/social'){
  let accepted=all(`SELECT a.id,a.username,p.level FROM friendships f JOIN accounts a ON a.id=CASE WHEN f.requester=? THEN f.recipient ELSE f.requester END JOIN pets p ON p.account_id=a.id WHERE (f.requester=? OR f.recipient=?) AND f.status='accepted'`,id,id,id);
  const incoming=all(`SELECT f.id,a.username FROM friendships f JOIN accounts a ON a.id=f.requester WHERE f.recipient=? AND f.status='pending'`,id);
  const classmates=all(`SELECT DISTINCT a.id,a.username,p.level FROM class_members me JOIN class_members they ON they.class_id=me.class_id JOIN accounts a ON a.id=they.account_id AND a.allow_visits=1 JOIN pets p ON p.account_id=a.id WHERE me.account_id=? AND a.id!=?`,id,id);
  return output(res,200,{friends:accepted,requests:incoming,classmates});
 }
 if(method==='POST'&&path==='/api/social/friends/request'){
  const target=get('SELECT id FROM accounts WHERE username=?',String(b.username||'').toLowerCase().trim());assert(target&&target.id!==id,'Usuário inválido');assert(!get('SELECT id FROM friendships WHERE (requester=? AND recipient=?) OR (requester=? AND recipient=?)',id,target.id,target.id,id),'Já existe uma solicitação');
  run('INSERT INTO friendships(id,requester,recipient,created_at) VALUES(?,?,?,?)',randomUUID(),id,target.id,now());return output(res,201,{ok:true});}
 if(method==='POST'&&parts[1]==='social'&&parts[2]==='friends'&&parts[3]&&parts[4]==='accept'){
  const result=run("UPDATE friendships SET status='accepted' WHERE id=? AND recipient=? AND status='pending'",parts[3],id);assert(result.changes===1,'Pedido não encontrado');return output(res,200,{ok:true});}
 if(method==='POST'&&path==='/api/social/visits'){
  assert(typeof b.allow==='boolean','Escolha uma opção');run('UPDATE accounts SET allow_visits=? WHERE id=?',b.allow?1:0,id);return output(res,200,me(id));}
 if(method==='GET'&&parts[1]==='visit'&&parts[2]){
  targetScope(id,parts[2]);
  const result=visitorViewFor(id,parts[2]);return output(res,200,result);
 }
 if(method==='POST'&&parts[1]==='visit'&&parts[2])return output(res,200,enterVisit(id,parts[2]));
 err('Endpoint não encontrado',404);
}
const server=http.createServer(async(req,res)=>{
 try{
  // Reject cross-origin state mutations. Browsers use same-origin cookies.
  if(['POST','PATCH','DELETE','PUT'].includes(req.method)&&req.headers.origin){const o=new URL(req.headers.origin);const host=req.headers.host;if(o.host!==host)err('Origem não permitida',403)}
  await route(req,res);
 }catch(e){console.error('[API]',e.status||500,e.message);if(!res.headersSent)output(res,e.status||500,{error:e.status?e.message:'Erro interno; consulte os logs'});else res.end()}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`BytePets Web/API v1.1: http://localhost:${PORT} / API and client`));
