import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const tmp=mkdtempSync(path.join(os.tmpdir(),'bytepets-v06-'));
const port=49800+Math.floor(Math.random()*900);
const server=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,DATA_DIR:tmp,PORT:String(port)},stdio:'pipe'});
let error='';server.stderr.on('data',b=>error+=b.toString());
const base='http://127.0.0.1:'+port;
function client(){let cookie='';return {async call(url,method='GET',body){const r=await fetch(base+'/api'+url,{method,headers:{...cookie?{cookie}:{},...body===undefined?{}:{'content-type':'application/json'}},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()}}}}
const admin=client(),teacher=client(),learner=client(),outsider=client(),another=client();
async function ready(){for(let i=0;i<65;i++){try{if((await fetch(base+'/api/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,75))}throw Error('cannot boot: '+error)}
test('v0.6: codigo unico, gestor/professor sem pet jogavel, visitas e recados com escopo',async()=>{
 await ready();
 let r=await admin.call('/setup','POST',{mode:'school',schoolName:'Escola Estrela',username:'gestor_byte',password:'SenhaSegura456'});
 assert.equal(r.status,201,JSON.stringify(r));const schoolId=r.data.state.schools[0].id;
 assert.equal(r.data.state.pet.name,'Orion');
 assert.equal((await admin.call('/pet/care','POST',{action:'play'})).status,403);
 assert.equal((await admin.call('/games/start','POST',{type:'pattern'})).status,403);
 const cls=(await admin.call('/schools/'+schoolId+'/classes','POST',{name:'5 A'})).data;
 const clsB=(await admin.call('/schools/'+schoolId+'/classes','POST',{name:'5 B'})).data;
 r=await admin.call('/schools/'+schoolId+'/roster','POST',{studentName:'Bia Costa',enrollment:'2026123401',classId:cls.id});
 assert.equal(r.status,201);assert.ok(r.data.studentCode.length>=12);
 const code=r.data.studentCode;
 r=await learner.call('/student/verify-code','POST',{studentCode:code});assert.equal(r.status,200);assert.equal(r.data.schoolName,'Escola Estrela');
 r=await learner.call('/student/register','POST',{studentCode:code,username:'bia_star',password:'SenhaSegura989',petName:'Estrela'});
 assert.equal(r.status,201,JSON.stringify(r));const studentId=r.data.state.account.id;
 assert.equal(r.data.state.pet.name,'Estrela');
 assert.equal((await another.call('/student/verify-code','POST',{studentCode:code})).status,403);
 assert.equal((await another.call('/student/register','POST',{studentCode:code,username:'bia_clone',password:'SenhaSegura989',petName:'Fake'})).status,403);
 assert.equal((await learner.call('/visit/'+studentId)).status,200); // self view is allowed
 assert.equal((await admin.call('/visit/'+studentId)).status,403); // permission off by default
 assert.equal((await learner.call('/social/visits','POST',{allow:true})).status,200);
 const teacherLink=(await admin.call('/schools/'+schoolId+'/teacher-invites','POST',{})).data;
 r=await teacher.call('/teacher/register','POST',{inviteToken:teacherLink.token,username:'profa_luna',password:'SenhaSegura234'});assert.equal(r.status,201);
 const rosterBefore=(await admin.call('/schools/'+schoolId+'/roster')).data;
 await admin.call('/schools/'+schoolId+'/teacher-requests/'+rosterBefore.requests[0].id,'POST',{approve:true});
 const rosterAfter=(await admin.call('/schools/'+schoolId+'/roster')).data;
 const teacherId=rosterAfter.teachers.find(t=>t.username==='profa_luna').id;
 await admin.call('/schools/'+schoolId+'/teacher-classes','POST',{teacherId,classId:cls.id});
 assert.equal((await teacher.call('/pet/care','POST',{action:'play'})).status,403);
 assert.equal((await teacher.call('/games/start','POST',{type:'snake'})).status,403);
 assert.equal((await teacher.call('/visit/'+studentId)).status,200);
 const enter=await teacher.call('/visit/'+studentId,'POST',{});assert.equal(enter.status,200,JSON.stringify(enter));assert.equal(enter.data.visitor.role,'teacher');
 assert.equal(enter.data.visitor.sprite,'/assets/pets/mentor_teacher.png');
 const active=await learner.call('/visits/active');assert.equal(active.data.visitors.length,1);assert.equal(active.data.visitors[0].name,'Luna, a Guia');
 assert.equal((await teacher.call('/visits/heartbeat','POST',{ownerId:studentId})).status,200);
 assert.equal((await teacher.call('/visits/leave','POST',{})).status,200);
 assert.equal((await learner.call('/visits/active')).data.visitors.length,0);
 r=await teacher.call('/mentor/messages','POST',{studentId,key:'encouragement'});assert.equal(r.status,201);
 r=await learner.call('/mentor/messages');assert.equal(r.status,200);assert.equal(r.data.messages.length,1);assert.match(r.data.messages[0].message,/tentativa/i);
 assert.equal((await learner.call('/mentor/messages','POST',{studentId,key:'encouragement'})).status,403);
 // Teacher may not visit children in another unassigned class.
 r=await admin.call('/schools/'+schoolId+'/roster','POST',{studentName:'Luana Rios',enrollment:'2026123402',classId:clsB.id});
 assert.equal(r.status,201);
 r=await outsider.call('/student/register','POST',{studentCode:r.data.studentCode,username:'luana_r',password:'SenhaSegura879',petName:'Lua'});
 assert.equal(r.status,201);const outsiderId=r.data.state.account.id;
 await outsider.call('/social/visits','POST',{allow:true});
 assert.equal((await teacher.call('/visit/'+outsiderId)).status,403);
 assert.equal((await teacher.call('/mentor/messages','POST',{studentId:outsiderId,key:'encouragement'})).status,403);
 assert.equal((await admin.call('/visit/'+outsiderId,'POST',{})).status,200);
 assert.equal((await outsider.call('/visits/active')).data.visitors[0].role,'manager');
 // Reissue codes for existing, unclaimed roster entries.
 r=await admin.call('/schools/'+schoolId+'/roster','POST',{studentName:'Iris Azul',enrollment:'2026123403',classId:cls.id});
 const fresh=await admin.call('/schools/'+schoolId+'/roster/'+r.data.id+'/reissue','POST',{});
 assert.equal(fresh.status,200);assert.notEqual(fresh.data.studentCode,r.data.studentCode);
 assert.equal((await another.call('/student/verify-code','POST',{studentCode:r.data.studentCode})).status,403);
 assert.equal((await another.call('/student/verify-code','POST',{studentCode:fresh.data.studentCode})).status,200);
});
after(()=>{server.kill();rmSync(tmp,{recursive:true,force:true})});
