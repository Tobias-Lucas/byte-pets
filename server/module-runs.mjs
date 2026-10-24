// BytePets 0.7 - isolated, auditable, full-module test attempts.
import {randomUUID, randomInt} from 'node:crypto';
import {all,get,run,transaction,now} from './db.mjs';
import {assert,err,reward,me} from './core.mjs';
import {moduleAccess,evaluate} from './school.mjs';

export const TIER_ORDER={bronze:1,prata:2,ouro:3};
export function medalFor(correct,total){
 const pct=total>0?100*correct/total:0;
 return pct>=100?'ouro':pct>=70?'prata':'bronze';
}
export function shuffle(values){const arr=[...values];for(let i=arr.length-1;i>0;i--){const j=randomInt(i+1);[arr[i],arr[j]]=[arr[j],arr[i]];}if(arr.length>1&&arr.every((v,i)=>v===values[i]))[arr[0],arr[1]]=[arr[1],arr[0]];return arr;}
function displayOptionsFor(q){
 const options=JSON.parse(q.options_json);
 if(['single','multiple','boolean'].includes(q.type)&&Array.isArray(options))return shuffle(options);
 if(q.type==='ordering'&&Array.isArray(options)){
  const randomized=shuffle(options);
  if(randomized.length>1&&randomized.every((value,i)=>value===options[i]))[randomized[0],randomized[1]]=[randomized[1],randomized[0]];
  return randomized;
 }
 if(q.type==='matching'&&options&&Array.isArray(options.right))return {...options,right:shuffle(options.right)};
 return options;
}
function access(accountId,moduleId){
 const membership=moduleAccess(accountId,moduleId);
 assert(get("SELECT role FROM accounts WHERE id=?",accountId)?.role==='student','Somente estudantes realizam testes',403);
 return membership;
}
export function startModuleRun(accountId,moduleId){
 access(accountId,moduleId);
 return transaction(()=>{
  const pending=get("SELECT id FROM module_runs WHERE account_id=? AND module_id=? AND status='active' ORDER BY rowid DESC LIMIT 1",accountId,moduleId);
  if(pending)return {runId:pending.id,resumed:true};
  // A perfect score is terminal: the student can review, not farm new attempts.
  const priorGold=get("SELECT 1 AS ok FROM module_medals WHERE account_id=? AND module_id=? AND tier='ouro'",accountId,moduleId);
  assert(!priorGold,'Você já conquistou ouro neste módulo! Revise suas respostas e explicações.',409);
  const qs=all('SELECT id,type,options_json,score FROM questions WHERE module_id=? ORDER BY created_at,id',moduleId);
  assert(qs.length>0,'Este teste ainda não possui questões.',409);
  const ordered=shuffle(qs);
  const visual={};for(const q of ordered)visual[q.id]=displayOptionsFor(q);
  const id=randomUUID();
  run(`INSERT INTO module_runs(id,account_id,module_id,order_json,display_json,status,total,max_score,created_at)
    VALUES(?,?,?,?,?,'active',?,?,?)`,id,accountId,moduleId,JSON.stringify(ordered.map(q=>q.id)),JSON.stringify(visual),qs.length,qs.reduce((s,q)=>s+q.score,0),now());
  return {runId:id,resumed:false};
 });
}
function readRun(accountId,runId){
 const record=get('SELECT * FROM module_runs WHERE id=? AND account_id=?',runId,accountId);
 assert(record,'Tentativa não encontrada',404);
 access(accountId,record.module_id);
 return record;
}
export function latestModuleRun(accountId,moduleId){
 access(accountId,moduleId);
 const latest=get(`SELECT id FROM module_runs WHERE account_id=? AND module_id=? ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, rowid DESC LIMIT 1`,accountId,moduleId);
 return latest?moduleRunView(accountId,latest.id):null;
}
function getMedal(accountId,moduleId){return get('SELECT tier,best_percent,awarded_at FROM module_medals WHERE account_id=? AND module_id=?',accountId,moduleId)||null;}
export function moduleRunView(accountId,runId){
 const r=readRun(accountId,runId);const module=get('SELECT id,title,subject,description,school_id FROM modules WHERE id=?',r.module_id);
 const answers=all('SELECT * FROM module_run_answers WHERE run_id=?',runId);
 const byId=new Map(answers.map(x=>[x.question_id,x]));const visual=JSON.parse(r.display_json);
 const questions=JSON.parse(r.order_json).map(id=>{
  const q=get('SELECT * FROM questions WHERE id=? AND module_id=?',id,r.module_id);
  assert(q,'O teste foi alterado indevidamente',409);
  const record=byId.get(id),review=r.status==='completed';
  return {id:q.id,type:q.type,prompt:q.prompt,options:visual[id],score:q.score,mediaPath:q.media_path,
   answered:Boolean(record),chosen:record?JSON.parse(record.answer_json):null,
   ...(record||review?{correct:record?Boolean(record.correct):false,explanation:q.explanation,correctAnswer:JSON.parse(q.answer_json)}:{})};
 });
 return {id:r.id,module,status:r.status,total:r.total,answered:answers.length,correctCount:r.correct_count,score:r.score,maxScore:r.max_score,
  percent:r.status==='completed'?Math.round(r.correct_count/r.total*100):null,medalTier:r.medal_tier,medal:getMedal(accountId,r.module_id),
  questions,createdAt:r.created_at,completedAt:r.completed_at||null};
}
export function answerModuleRun(accountId,runId,questionId,answer,requestId){
 assert(typeof requestId==='string'&&requestId.length>=8&&requestId.length<=110,'ID da resposta inválido');
 const result=transaction(()=>{
  const r=readRun(accountId,runId);
  const previous=get('SELECT * FROM module_run_answers WHERE run_id=? AND question_id=?',runId,questionId);
  if(previous){
   assert(previous.request_id===requestId,'A questão já foi respondida. Continue o teste.',409);
   return {duplicate:true,correct:!!previous.correct,explanation:get('SELECT explanation FROM questions WHERE id=?',questionId)?.explanation||'',
    correctAnswer:JSON.parse(get('SELECT answer_json FROM questions WHERE id=?',questionId).answer_json),complete:r.status==='completed',medalTier:r.medal_tier};
  }
  assert(r.status==='active','Tentativa finalizada. Para melhorar a nota, refaça todo o teste.',409);
  const order=JSON.parse(r.order_json);
  const answered=get('SELECT COUNT(*) AS n FROM module_run_answers WHERE run_id=?',runId).n;
  assert(order[answered]===questionId,'Responda as questões na ordem da tentativa.',409);
  const q=get('SELECT * FROM questions WHERE id=? AND module_id=?',questionId,r.module_id);
  assert(q,'Questão não encontrada',404);
  const ansJson=JSON.stringify(answer);
  assert(ansJson&&ansJson.length<16000,'Resposta inválida');
  const correct=evaluate(q.type,JSON.parse(q.answer_json),answer);
  run('INSERT INTO module_run_answers(run_id,question_id,request_id,answer_json,correct,points,answered_at) VALUES(?,?,?,?,?,?,?)',runId,questionId,requestId,ansJson,correct?1:0,correct?q.score:0,now());
  run('UPDATE module_runs SET correct_count=correct_count+?,score=score+? WHERE id=?',correct?1:0,correct?q.score:0,runId);
  // Award the student's *first* correct response to a given question only once,
  // even across subsequent full-module attempts. Keeps PixelCoins non-farmable.
  if(correct){
   const prior=get('SELECT 1 AS ok FROM attempts WHERE account_id=? AND question_id=? AND correct=1 LIMIT 1',accountId,questionId);
   if(!prior)reward(accountId,'challenge:'+questionId,Math.min(12,q.score),8,'challenge:'+questionId);
  }
  run('INSERT INTO attempts(id,account_id,question_id,answer,correct,score,created_at) VALUES(?,?,?,?,?,?,?)',requestId,accountId,questionId,ansJson,correct?1:0,correct?q.score:0,now());
  const complete=answered+1===order.length;
  let tier=null,newMedal=false,upgraded=false;
  if(complete){
   const count=r.correct_count+(correct?1:0);tier=medalFor(count,r.total);
   run(`UPDATE module_runs SET status='completed',medal_tier=?,completed_at=? WHERE id=?`,tier,now(),runId);
   const prior=getMedal(accountId,r.module_id);
   const best=Math.max(prior?.best_percent||0,Math.round(100*count/r.total));
   if(!prior||TIER_ORDER[tier]>TIER_ORDER[prior.tier]){
    const issuer=get('SELECT name FROM schools WHERE id=(SELECT school_id FROM modules WHERE id=?)',r.module_id)?.name||'BytePets';
    run('INSERT INTO module_medals(account_id,module_id,tier,best_percent,awarded_at) VALUES(?,?,?,?,?) ON CONFLICT(account_id,module_id) DO UPDATE SET tier=excluded.tier,best_percent=excluded.best_percent,awarded_at=excluded.awarded_at',accountId,r.module_id,tier,best,now());
    run('INSERT INTO badges(account_id,badge_id,label,issuer,awarded_at) VALUES(?,?,?,?,?) ON CONFLICT(account_id,badge_id) DO UPDATE SET label=excluded.label,issuer=excluded.issuer,awarded_at=excluded.awarded_at',accountId,'mod:'+r.module_id,'Medalha '+tier.toUpperCase()+': '+get('SELECT title FROM modules WHERE id=?',r.module_id).title,issuer,now());
    newMedal=!prior;upgraded=!!prior;
   }else if(best>(prior?.best_percent||0))run('UPDATE module_medals SET best_percent=? WHERE account_id=? AND module_id=?',best,accountId,r.module_id);
  }
  return {correct,correctAnswer:JSON.parse(q.answer_json),explanation:q.explanation,complete,medalTier:tier,newMedal,upgraded};
 });
 return {...result,run:moduleRunView(accountId,runId),state:me(accountId)};
}
