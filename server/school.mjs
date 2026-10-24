import {randomUUID,randomBytes} from 'node:crypto';
import {teacherPermittedClasses} from './onboarding.mjs';
import {all,get,run,transaction,now} from './db.mjs';
import {assert,err,schoolRole,reward,badge,me} from './core.mjs';
const types=['single','multiple','boolean','short','matching','ordering'];
export function seedModules(){
 const ids=['public-logic','public-biology'];
 const modules=[['public-logic','Mente Lógica','Raciocínio','Missões de padrões, escolhas e planejamento.'],['public-biology','Biologia da Floresta','Biologia','Vida, natureza e ecossistemas.']];
 for(const [id,title,subject,description] of modules)run('INSERT OR IGNORE INTO modules(id,school_id,title,subject,description,published,created_by,created_at) VALUES(?,NULL,?,?,?,1,?,?)',id,title,subject,description,'system',now());
 const questions=[
 ['L1','public-logic','single','Que número completa: 2, 4, 6, 8, ...?',['9','10','11'],'10','Some sempre 2.'],
 ['L2','public-logic','boolean','Uma sequência de passos pode formar um algoritmo.',['Verdadeiro','Falso'],true,'Um algoritmo é uma sequência de instruções.'],
 ['L3','public-logic','multiple','Quais números são pares?',['2','3','4','5'],['2','4'],'Pares são divisíveis por 2.'],
 ['L4','public-logic','ordering','Coloque as ações em ordem.',['Pensar','Executar','Conferir'],['Pensar','Executar','Conferir'],'Planeje, execute e revise.'],
 ['L5','public-logic','matching','Relacione cada símbolo a sua forma.',{left:[{id:'a',label:'▲'},{id:'b',label:'●'}],right:[{id:'tri',label:'Triângulo'},{id:'cir',label:'Círculo'}]},{a:'tri',b:'cir'},'Combine a forma correspondente.'],
 ['L6','public-logic','short','Quantos lados tem um quadrado?',[],['4','quatro'],'O quadrado tem quatro lados.'],
 ['B1','public-biology','single','Qual parte da planta absorve água do solo?',['Raiz','Flor','Fruto'],'Raiz','As raízes absorvem água e nutrientes.'],
 ['B2','public-biology','boolean','As plantas precisam de luz para fazer fotossíntese.',['Verdadeiro','Falso'],true,'A luz é importante para a fotossíntese.'],
 ['B3','public-biology','multiple','Quais destes são seres vivos?',['Árvore','Pedra','Borboleta','Mesa'],['Árvore','Borboleta'],'Animais e plantas são seres vivos.']
 ];
 for(const [id,moduleId,type,prompt,options,answer,explanation] of questions)run('INSERT OR IGNORE INTO questions(id,module_id,type,prompt,options_json,answer_json,explanation,score,created_at) VALUES(?,?,?,?,?,?,?,?,?)',id,moduleId,type,prompt,JSON.stringify(options),JSON.stringify(answer),explanation,10,now());
}
export function createSchool(ownerId,name){assert(String(name||'').trim().length>=3&&String(name).length<=90,'Nome da escola inválido');return transaction(()=>{const id=randomUUID();const code=randomBytes(5).toString('hex').toUpperCase();run('INSERT INTO schools(id,name,created_by,created_at,code) VALUES(?,?,?,?,?)',id,name.trim(),ownerId,now(),code);run('INSERT INTO school_members(school_id,account_id,role) VALUES(?,?,?)',id,ownerId,'manager');return {id,name,code:get('SELECT code FROM schools WHERE id=?',id)?.code}})}
export function addTeacher(actor,schoolId,username){schoolRole(actor,schoolId,['manager']);const account=get('SELECT id FROM accounts WHERE username=?',String(username||'').trim().toLowerCase());assert(account,'O professor precisa criar uma conta primeiro');assert(get('SELECT role FROM accounts WHERE id=?',account.id)?.role==='adult','O professor deve possuir conta adulta');run(`INSERT INTO school_members(school_id,account_id,role) VALUES(?,?,?) ON CONFLICT(school_id,account_id) DO UPDATE SET role='teacher'`,schoolId,account.id,'teacher');return {username,status:'professor cadastrado'};}
export function createClass(actor,schoolId,name){schoolRole(actor,schoolId,['manager']);assert(String(name||'').trim().length>=2,'Informe o nome da turma');const code=randomUUID().slice(0,8).toUpperCase(),id=randomUUID();run('INSERT INTO classes(id,school_id,name,join_code) VALUES(?,?,?,?)',id,schoolId,name.trim(),code);return {id,schoolId,name,joinCode:code};}
export function joinClass(actor,code){const c=get('SELECT * FROM classes WHERE join_code=?',String(code||'').trim().toUpperCase());assert(c,'Código de turma inválido');return transaction(()=>{
 run('INSERT OR IGNORE INTO class_members(class_id,account_id) VALUES(?,?)',c.id,actor);run(`INSERT OR IGNORE INTO school_members(school_id,account_id,role) VALUES(?,?,'student')`,c.school_id,actor);return {classId:c.id,schoolId:c.school_id,name:c.name};})}
export function createModule(actor,schoolId,body){schoolRole(actor,schoolId);const {title,subject,description=''}=body;assert(String(title||'').trim().length>=3&&String(subject||'').trim().length>=2,'Informe título e área');const id=randomUUID();run('INSERT INTO modules(id,school_id,title,subject,description,created_by,created_at) VALUES(?,?,?,?,?,?,?)',id,schoolId,title.trim(),subject.trim(),String(description).slice(0,600),actor,now());return {id,title,subject,schoolId};}
export function moduleAccess(accountId,moduleId,write=false){const m=get('SELECT * FROM modules WHERE id=?',moduleId);assert(m,'Módulo inexistente',404);if(m.school_id){
 if(write){const role=schoolRole(accountId,m.school_id);if(role==='teacher')assert(m.created_by===accountId,'Edite somente seus modulos',403);}else{
 const r=get('SELECT role FROM school_members WHERE school_id=? AND account_id=?',m.school_id,accountId);
 assert(r,'Sem permissão',403);
 if(r.role==='teacher'&&m.created_by!==accountId){const assigned=get('SELECT 1 FROM module_classes mc JOIN teacher_classes tc ON tc.class_id=mc.class_id WHERE mc.module_id=? AND tc.account_id=?',m.id,accountId);assert(assigned,'Modulo de outra turma',403)}
 if(r.role==='student'){
  assert(m.published&&get(`SELECT 1 AS ok FROM module_classes mc JOIN class_members cm ON cm.class_id=mc.class_id WHERE mc.module_id=? AND cm.account_id=?`,m.id,accountId),'Módulo não atribuído à sua turma',403);
 }
 }
 }else assert(!write,'Módulo global é somente leitura',403);
 return m;
}
export function createQuestion(actor,moduleId,body){const m=moduleAccess(actor,moduleId,true);assert(!m.published,'Módulo publicado não pode receber novas questões. Crie um novo módulo para preservar avaliações.',409);const {type,prompt,options=[],answer,explanation='',score=10,mediaPath=''}=body;
 assert(types.includes(type),'Tipo de questão inválido');assert(typeof prompt==='string'&&prompt.trim().length>=5&&prompt.length<=800,'Enunciado inválido');assert(Number.isInteger(score)&&score>=1&&score<=50,'Pontuação fora do limite');
 assert(answer!==undefined&&answer!==null,'Informe o gabarito');
 if(['multiple','ordering'].includes(type))assert(Array.isArray(answer),'Gabarito deve ser uma lista');
 if(type==='matching')assert(typeof answer==='object'&&!Array.isArray(answer),'Gabarito deve ser um mapa');
 if(type==='boolean')assert(typeof answer==='boolean','Informe verdadeiro/falso');
 if(['single','multiple','ordering'].includes(type))assert(Array.isArray(options)&&options.length>=2&&options.length<=12&&options.every(v=>typeof v==='string'&&v.trim().length>0),'Informe 2 a 12 opções válidas');
 if(type==='single')assert(typeof answer==='string'&&options.includes(answer),'Escolha um gabarito existente nas opções');
 if(type==='multiple')assert(answer.length>0&&answer.length<=options.length&&answer.every(v=>options.includes(v)),'Respostas corretas devem estar nas opções');
 if(type==='ordering')assert(answer.length===options.length&&[...answer].sort().every((v,i)=>v===[...options].sort()[i]),'Ordem correta deve conter todas as opções');
 if(type==='short')assert((typeof answer==='string'&&answer.trim().length>0)||(Array.isArray(answer)&&answer.length>0&&answer.every(v=>typeof v==='string'&&v.trim())),'Informe respostas curtas válidas');
 if(type==='matching'){
  assert(Array.isArray(options?.left)&&Array.isArray(options?.right)&&options.left.length>0&&options.right.length>0,'Associação requer left/right');
  const left=options.left.map(v=>v.id),right=new Set(options.right.map(v=>v.id));
  assert(Object.keys(answer).length===left.length&&left.every(v=>right.has(answer[v])),'Associação e gabarito são incompatíveis');
 }
 const optionsStr=JSON.stringify(options),answerStr=JSON.stringify(answer);
 assert(optionsStr.length<16000&&answerStr.length<6000,'Conteúdo muito grande');
 function checkSchoolImage(value){
  assert(typeof value==='string'&&/^\/media\/[0-9a-f-]+\.webp$/.test(value),'Imagem não reconhecida');
  const filename=value.split('/').pop();
  assert(get('SELECT id FROM media_assets WHERE filename=? AND school_id=?',filename,m.school_id),'A imagem não pertence a esta escola',403);
 }
 if(mediaPath)checkSchoolImage(mediaPath);
 function checkImages(input,depth=0){assert(depth<=8,'Estrutura de opções muito profunda');if(!input||typeof input!=='object')return;for(const [key,value] of Object.entries(input)){if(key==='image'&&value)checkSchoolImage(value);else if(value&&typeof value==='object')checkImages(value,depth+1)}}
 checkImages(options);
 const qid=randomUUID();run('INSERT INTO questions(id,module_id,type,prompt,options_json,answer_json,explanation,media_path,score,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',qid,moduleId,type,prompt.trim(),optionsStr,answerStr,String(explanation).slice(0,600),mediaPath,score,now());return {id:qid,moduleId};}
export function publishModule(actor,moduleId,classIds){const m=moduleAccess(actor,moduleId,true);assert(all('SELECT id FROM questions WHERE module_id=?',moduleId).length>0,'Cadastre pelo menos uma questão');assert(Array.isArray(classIds)&&classIds.length>0,'Escolha uma turma');return transaction(()=>{
 for(const cid of classIds){const c=get('SELECT id FROM classes WHERE id=? AND school_id=?',cid,m.school_id);assert(c,'Turma fora da escola');const role=schoolRole(actor,m.school_id);if(role==='teacher')assert(get('SELECT 1 FROM teacher_classes WHERE account_id=? AND class_id=?',actor,cid),'Turma nao atribuida ao professor',403);run('INSERT OR IGNORE INTO module_classes(module_id,class_id) VALUES(?,?)',moduleId,cid)}
 run('UPDATE modules SET published=1 WHERE id=?',moduleId);return {published:true}})}
export function modulesVisible(accountId){const q=all(`SELECT DISTINCT m.id,m.school_id,m.title,m.subject,m.description,m.published,s.name AS school_name FROM modules m LEFT JOIN schools s ON s.id=m.school_id LEFT JOIN module_classes mc ON mc.module_id=m.id LEFT JOIN class_members cm ON cm.class_id=mc.class_id AND cm.account_id=? LEFT JOIN school_members sm ON sm.school_id=m.school_id AND sm.account_id=? WHERE m.school_id IS NULL OR sm.role='manager' OR (sm.role='teacher' AND (m.created_by=? OR EXISTS(SELECT 1 FROM teacher_classes tc JOIN module_classes linked ON linked.class_id=tc.class_id WHERE linked.module_id=m.id AND tc.account_id=?))) OR (m.published=1 AND cm.account_id IS NOT NULL) ORDER BY m.school_id,m.subject,m.title`,accountId,accountId,accountId,accountId);
 return q.map(m=>{
  const total=get('SELECT COUNT(*) AS n FROM questions WHERE module_id=?',m.id).n;
  const best=get("SELECT id,correct_count,score,medal_tier FROM module_runs WHERE account_id=? AND module_id=? AND status='completed' ORDER BY correct_count DESC,score DESC,completed_at DESC LIMIT 1",accountId,m.id);
  const medal=get('SELECT tier,best_percent FROM module_medals WHERE account_id=? AND module_id=?',accountId,m.id);
  return {...m,total,passed:best?.correct_count||0,complete:!!best&&best.correct_count===total,completed:!!best,medalTier:medal?.tier||null,bestPercent:medal?.best_percent??null};
 });
}
export function questionsFor(accountId,moduleId){const m=moduleAccess(accountId,moduleId);const teacher=Boolean(m.school_id&&get(`SELECT role FROM school_members WHERE school_id=? AND account_id=? AND role IN ('teacher','manager')`,m.school_id,accountId));
 const qs=all('SELECT * FROM questions WHERE module_id=? ORDER BY created_at,id',moduleId);return {module:m,questions:qs.map(q=>({id:q.id,type:q.type,prompt:q.prompt,options:JSON.parse(q.options_json),score:q.score,mediaPath:q.media_path,answered:!!get('SELECT 1 AS ok FROM attempts WHERE account_id=? AND question_id=? AND correct=1',accountId,q.id),...(teacher?{answer:JSON.parse(q.answer_json),explanation:q.explanation}:{})}))};}
export const norm=v=>String(v).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ');
export function evaluate(type,expected,actual){
 switch(type){
 case 'single':return norm(actual)===norm(expected);
 case 'boolean':return actual===expected;
 case 'short':return (Array.isArray(expected)?expected:[expected]).some(e=>norm(e)===norm(actual));
 case 'multiple':return Array.isArray(actual)&&Array.isArray(expected)&&actual.length===expected.length&&[...actual].sort().every((v,i)=>v===[...expected].sort()[i]);
 case 'ordering':return Array.isArray(actual)&&Array.isArray(expected)&&actual.length===expected.length&&actual.every((v,i)=>v===expected[i]);
 case 'matching':return actual&&typeof actual==='object'&&!Array.isArray(actual)&&Object.keys(expected).length===Object.keys(actual).length&&Object.keys(expected).every(k=>actual[k]===expected[k]);
 default:return false;
 }
}
export function submitAnswer(id,questionId,attemptId,answer){assert(typeof attemptId==='string'&&attemptId.length>=8&&attemptId.length<=100,'Identificador de tentativa inválido');return transaction(()=>{
 const q=get('SELECT * FROM questions WHERE id=?',questionId);assert(q,'Questão inexistente',404);
 const m=moduleAccess(id,q.module_id);const existing=get('SELECT * FROM attempts WHERE id=?',attemptId);
 if(existing){assert(existing.account_id===id,'Tentativa inválida',403);return {duplicate:true,correct:!!existing.correct,score:existing.score,state:me(id)}}
 const answerString=JSON.stringify(answer);assert(answerString&&answerString.length<16000,'Resposta inválida');
 const correct=evaluate(q.type,JSON.parse(q.answer_json),answer);const firstCorrect=correct&&!get('SELECT 1 AS ok FROM attempts WHERE account_id=? AND question_id=? AND correct=1',id,questionId);
 const score=firstCorrect?q.score:0; // Replaying a solved question never increases its grade.
 run('INSERT INTO attempts(id,account_id,question_id,answer,correct,score,created_at) VALUES(?,?,?,?,?,?,?)',attemptId,id,questionId,answerString,Number(correct),score,now());
 if(firstCorrect)reward(id,'challenge:'+questionId,Math.min(12,q.score),8,'challenge:'+questionId);
 const total=get('SELECT COUNT(*) AS n FROM questions WHERE module_id=?',m.id).n;
 const passed=get(`SELECT COUNT(DISTINCT q.id) AS n FROM questions q JOIN attempts a ON a.question_id=q.id AND a.account_id=? AND a.correct=1 WHERE q.module_id=?`,id,m.id).n;
 let medal=false;if(total>0&&passed===total){const issuer=m.school_id?get('SELECT name FROM schools WHERE id=?',m.school_id)?.name||'Escola':'BytePets';medal=badge(id,'mod:'+m.id,'Medalha: '+m.title,issuer);}
 return {correct,score,explanation:q.explanation,complete:total>0&&passed===total,medal,state:me(id)};
})}
export function schoolSummary(accountId,schoolId){const role=schoolRole(accountId,schoolId);const classes=teacherPermittedClasses(accountId,schoolId);const modules=all('SELECT id,title,subject,published,created_by FROM modules WHERE school_id=? ORDER BY created_at DESC',schoolId).filter(m=>role==='manager'||m.created_by===accountId||Boolean(get('SELECT 1 FROM module_classes mc JOIN teacher_classes tc ON tc.class_id=mc.class_id WHERE mc.module_id=? AND tc.account_id=?',m.id,accountId)));return {role,school:get('SELECT * FROM schools WHERE id=?',schoolId),classes,modules,teachers:all(`SELECT a.username FROM school_members m JOIN accounts a ON a.id=m.account_id WHERE m.school_id=? AND m.role IN ('teacher','manager')`,schoolId)}}


/** Read-only gradebook, based on complete assessment sessions rather than individual
 * question attempts. A student may improve a result until obtaining gold, but each
 * student's summary uses only their BEST completed run of each assigned module.
 */
export function schoolReport(accountId,schoolId){
 const role=schoolRole(accountId,schoolId);
 const classes=teacherPermittedClasses(accountId,schoolId);
 return {schoolId,generatedAt:now(),role,classes:classes.map(c=>{
  const moduleRows=all(`SELECT m.id,m.title,m.subject,m.description,
   (SELECT COUNT(*) FROM questions q WHERE q.module_id=m.id) AS total,
   (SELECT COALESCE(SUM(q.score),0) FROM questions q WHERE q.module_id=m.id) AS max_score
   FROM modules m JOIN module_classes mc ON mc.module_id=m.id
   WHERE mc.class_id=? AND m.school_id=? AND m.published=1 ORDER BY m.subject,m.title`,c.id,schoolId);
  const students=all(`SELECT a.id,a.username,p.level,
   COALESCE(sr.student_name,a.username) AS student_name,sr.enrollment
   FROM class_members cm JOIN accounts a ON a.id=cm.account_id
   JOIN pets p ON p.account_id=a.id
   LEFT JOIN school_roster sr ON sr.class_id=cm.class_id AND sr.account_id=a.id
   WHERE cm.class_id=? AND a.role='student' ORDER BY student_name`,c.id).map(a=>{
    const grades=moduleRows.map(m=>{
      const best=get(`SELECT id,correct_count,total,score,max_score,medal_tier,completed_at
       FROM module_runs WHERE account_id=? AND module_id=? AND status='completed'
       ORDER BY CAST(correct_count AS REAL)/NULLIF(total,0) DESC,score DESC,rowid DESC LIMIT 1`,a.id,m.id);
      const last=get(`SELECT id,medal_tier,completed_at FROM module_runs
       WHERE account_id=? AND module_id=? AND status='completed' ORDER BY rowid DESC LIMIT 1`,a.id,m.id);
      const attempts=get(`SELECT COUNT(*) AS n FROM module_runs
       WHERE account_id=? AND module_id=? AND status='completed'`,a.id,m.id)?.n||0;
      const medal=get('SELECT tier,best_percent FROM module_medals WHERE account_id=? AND module_id=?',a.id,m.id);
      // Preserve fully answered pre-v0.7 quizzes without mixing partial legacy
      // answers into a modern, complete-test score. Mark these explicitly.
      let legacy=null;
      if(!best&&m.total>0){
       const attemptsBefore=all(`SELECT q.id,q.score AS possible,
        (SELECT COUNT(*) FROM attempts a WHERE a.account_id=? AND a.question_id=q.id) AS tries,
        (SELECT MAX(a.score) FROM attempts a WHERE a.account_id=? AND a.question_id=q.id) AS achieved
        FROM questions q WHERE q.module_id=?`,a.id,a.id,m.id);
       if(attemptsBefore.length===m.total&&attemptsBefore.every(q=>q.tries>0)){
        legacy={correct:attemptsBefore.filter(q=>Number(q.achieved)>0).length,
         score:attemptsBefore.reduce((n,q)=>n+(Number(q.achieved)||0),0)};
       }
      }
      const correct=best?.correct_count??legacy?.correct??0;
      const earned=best?.score??legacy?.score??0;
      return {moduleId:m.id,moduleTitle:m.title,subject:m.subject,
       status:best?'completed':legacy?'legacy':'pending',attempts,correct,total:m.total,
       score:earned,maxScore:m.max_score,
       percent:best||legacy?Math.round(100*correct/Math.max(1,m.total)):0,
       medalTier:medal?.tier||best?.medal_tier||null,
       lastMedalTier:last?.medal_tier||null,completedAt:last?.completed_at??null};
    });
    const passed=grades.reduce((t,g)=>t+g.correct,0),total=grades.reduce((t,g)=>t+g.total,0);
    const points=grades.reduce((t,g)=>t+g.score,0),maxPoints=grades.reduce((t,g)=>t+g.maxScore,0);
    return {id:a.id,username:a.username,studentName:a.student_name,enrollment:a.enrollment,
     level:a.level,passed,total,points,maxPoints,
     percent:total?Math.round(100*passed/total):0,
     completedModules:grades.filter(g=>['completed','legacy'].includes(g.status)).length,
     totalModules:moduleRows.length,grades};
  });
  return {id:c.id,name:c.name,
   modules:moduleRows.map(m=>({id:m.id,title:m.title,subject:m.subject,total:m.total,maxScore:m.max_score})),
   students,summary:{students:students.length,completedModules:students.reduce((n,s)=>n+s.completedModules,0),
    assignedModules:moduleRows.length,averagePercent:students.length?Math.round(students.reduce((n,s)=>n+s.percent,0)/students.length):0}};
 })};
}
