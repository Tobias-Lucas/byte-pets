import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import os from 'node:os';import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const dbDir=mkdtempSync(path.join(os.tmpdir(),'bytepets-v07-'));
const port=47000+Math.floor(Math.random()*1800);
const proc=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,DATA_DIR:dbDir,PORT:String(port)},stdio:'pipe'});
let stderr='';proc.stderr.on('data',d=>stderr+=d.toString());
after(()=>{proc.kill();rmSync(dbDir,{recursive:true,force:true})});
const base='http://127.0.0.1:'+port;
let cookie='';
async function req(url,method='GET',body){const response=await fetch(base+'/api'+url,{method,headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return {code:response.status,data:await response.json()}}
async function ready(){for(let i=0;i<50;i++){try{if((await fetch(base+'/api/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,50))}throw new Error(stderr)}
const answer={L1:'10',L2:true,L3:['2','4'],L4:['Pensar','Executar','Conferir'],L5:{a:'tri',b:'cir'},L6:'4'};
async function solve(run,goodCount){
 let response;
 for(let i=0;i<run.questions.length;i++){
  const q=run.questions[i],good=i<goodCount,value=good?answer[q.id]:q.type==='boolean'?false==='not':q.type==='multiple'?[]:q.type==='ordering'?[]:q.type==='matching'?{}:'resposta-inexistente';
  response=await req('/test-runs/'+run.id+'/answers','POST',{questionId:q.id,requestId:randomUUID(),answer:value});
  assert.equal(response.code,200,JSON.stringify(response.data));
  assert.equal(response.data.correct,good);
  assert.ok(typeof response.data.explanation==='string');
  assert.equal(response.data.run.answered,i+1);
 }
 assert.equal(response.data.complete,true);
 return response.data;
}
test('v0.7: complete runs, shuffled options, review, medals and full retake',async()=>{
 await ready();assert.equal((await req('/setup','POST',{mode:'normal'})).code,201);
 const registered=await req('/register','POST',{username:'explorador_07',password:'MinhaSenha123',petName:'Lumi'});assert.equal(registered.code,201);
 let created=await req('/modules/public-logic/runs','POST',{});assert.equal(created.code,201);
 let run=created.data.run;assert.equal(run.total,6);assert.equal(run.answered,0);assert.equal(new Set(run.questions.map(q=>q.id)).size,6);
 assert.ok(run.questions.every(q=>q.correctAnswer===undefined),'unanswered question must not disclose key');
 const order=run.questions.map(q=>q.id),one=run.questions[0];
 const skipped=await req('/test-runs/'+run.id+'/answers','POST',{questionId:run.questions[1].id,requestId:randomUUID(),answer:'nada'});assert.equal(skipped.code,409);
 const firstTry=await req('/test-runs/'+run.id+'/answers','POST',{questionId:one.id,requestId:randomUUID(),answer:'nada'});assert.equal(firstTry.code,200);
 const anotherTry=await req('/test-runs/'+run.id+'/answers','POST',{questionId:one.id,requestId:randomUUID(),answer:answer[one.id]});assert.equal(anotherTry.code,409);
 for(let i=1;i<run.questions.length;i++){
  const q=run.questions[i];const r=await req('/test-runs/'+run.id+'/answers','POST',{questionId:q.id,requestId:randomUUID(),answer:q.type==='boolean'?false==='not':[]});assert.equal(r.code,200);
 }
 const bronze=await req('/test-runs/'+run.id);assert.equal(bronze.data.run.medalTier,'bronze');assert.equal(bronze.data.run.status,'completed');
 assert.ok(bronze.data.run.questions.every(q=>q.explanation!==undefined&&q.correctAnswer!==undefined));
 const modules=await req('/modules');assert.equal(modules.data.find(m=>m.id==='public-logic').medalTier,'bronze');
 const second=await req('/modules/public-logic/runs','POST',{});assert.notEqual(second.data.run.id,run.id);
 const silver=await solve(second.data.run,5);assert.equal(silver.medalTier,'prata');
 const third=await req('/modules/public-logic/runs','POST',{});
 const gold=await solve(third.data.run,6);assert.equal(gold.medalTier,'ouro');
 const badge=(await req('/me')).data.badges.find(x=>x.badge_id==='mod:public-logic');assert.match(badge.label,/OURO/);
 const latest=await req('/modules/public-logic/runs/latest');assert.equal(latest.data.run.medalTier,'ouro');
 const module=(await req('/modules')).data.find(m=>m.id==='public-logic');assert.equal(module.bestPercent,100);assert.equal(module.passed,6);
});
test('v0.7: bridge traced path and new wood sprites',async()=>{
 const {buildBridgeRound,traceBridgeRound,validateBridgeRound}=await import('../server/bridges.mjs');
 const round=buildBridgeRound(0);const wrong=Object.fromEntries(round.tiles.map(t=>[t.id,t.rot]));
 const trace=traceBridgeRound(round,wrong);assert.equal(trace.completed,false);assert.ok(trace.walkPath.length>=1);assert.ok(trace.fallAt);
 const valid=Object.fromEntries(round.tiles.map(t=>[t.id,t.solution]));
 assert.equal(validateBridgeRound(round,valid),true);assert.equal(traceBridgeRound(round,valid).completed,true);
 const {existsSync}=await import('node:fs');assert.ok(existsSync(path.join(root,'web/assets/games/tiles/bridge-corner.png')));
});
