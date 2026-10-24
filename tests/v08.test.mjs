import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=mkdtempSync(path.join(os.tmpdir(),'bytepets-v08-'));const port=51000+Math.floor(Math.random()*700);
const proc=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:dir},stdio:'pipe'});
let stderr='';proc.stderr.on('data',b=>stderr+=b.toString());
after(()=>{proc.kill();rmSync(dir,{recursive:true,force:true})});
const base='http://127.0.0.1:'+port;
function client(){let cookie='';return {async req(url,method='GET',body){const r=await fetch(base+'/api'+url,{method,headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()}}}}
async function ready(){for(let i=0;i<70;i++){try{if((await fetch(base+'/api/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,60))}throw Error(stderr)}
test('v0.8: school directory, daily limit, gradebook and 100% prevents another run',async()=>{
 await ready();const adm=client(),kid=client();
 const mismatch=await adm.req('/setup','POST',{mode:'school',schoolName:'Escola Aurora',username:'admin_aurora',password:'SenhaSegura456',passwordConfirm:'NaoBate456'});
 assert.equal(mismatch.status,422);
 let r=await adm.req('/setup','POST',{mode:'school',schoolName:'Escola Aurora',username:'admin_aurora',password:'SenhaSegura456',passwordConfirm:'SenhaSegura456'});
 assert.equal(r.status,201,JSON.stringify(r.data));const schoolId=r.data.state.schools[0].id;
 const cls=(await adm.req('/schools/'+schoolId+'/classes','POST',{name:'5 ano A'})).data;
 const roster=(await adm.req('/schools/'+schoolId+'/roster','POST',{studentName:'Julia Rosa',enrollment:'20250007',classId:cls.id})).data;
 r=await kid.req('/student/register','POST',{studentCode:roster.studentCode,username:'julia_rosa',password:'SenhaTestada567',passwordConfirm:'SenhaTestada567',petName:'Byte'});
 assert.equal(r.status,201,JSON.stringify(r.data));
 const summary=(await adm.req('/schools/'+schoolId)).data;assert.equal(summary.classes.length,1);assert.equal(summary.school.daily_game_limit,5);
 assert.equal((await adm.req('/schools/'+schoolId+'/game-limit','POST',{limit:3})).data.limit,3);
 assert.equal((await kid.req('/me')).data.gameDaily.limit,3);
 const m=(await adm.req('/schools/'+schoolId+'/modules','POST',{title:'Raciocinio e Numeros',subject:'Matematica'})).data;
 for(const [prompt,ans] of [['Quanto é 2+2?','4'],['Quanto é 3+3?','6']]){
  const q=await adm.req('/modules/'+m.id+'/questions','POST',{type:'single',prompt,options:['4','6','8'],answer:ans,score:10,explanation:`${prompt} = ${ans}`});assert.equal(q.status,201,JSON.stringify(q.data));
 }
 assert.equal((await adm.req('/modules/'+m.id+'/publish','POST',{classIds:[cls.id]})).status,200);
 let report=(await adm.req('/schools/'+schoolId+'/reports')).data;
 assert.equal(report.classes.length,1);assert.equal(report.classes[0].students[0].points,0);
 assert.equal(report.classes[0].students[0].grades[0].status,'pending');
 let run=(await kid.req('/modules/'+m.id+'/runs','POST',{})).data.run;assert.equal(run.questions.length,2);
 for(const q of run.questions){const answer=q.prompt.includes('2+2')?'4':'6';r=await kid.req('/test-runs/'+run.id+'/answers','POST',{questionId:q.id,answer,requestId:randomUUID()});assert.equal(r.status,200,JSON.stringify(r.data));}
 assert.equal(r.data.run.medalTier,'ouro');
 assert.equal((await kid.req('/modules/'+m.id+'/runs','POST',{})).status,409);
 const review=(await kid.req('/test-runs/'+run.id)).data.run;
 assert.equal(review.questions.length,2);assert.ok(review.questions.every(q=>q.explanation));
 report=(await adm.req('/schools/'+schoolId+'/reports')).data;
 const g=report.classes[0].students[0].grades[0];assert.equal(g.status,'completed');assert.equal(g.percent,100);assert.equal(g.medalTier,'ouro');assert.equal(g.attempts,1);assert.equal(report.classes[0].students[0].points,20);
 assert.equal(report.classes[0].summary.averagePercent,100);
});
