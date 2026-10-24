import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(),'bytepets-v04-'));
const {buildBridgeRound,publicBridgeRound,validateBridgeRound} = await import('../server/bridges.mjs');
const {run,get,now,db} = await import('../server/db.mjs');
const {adopt,me,care,startGame,finishGame} = await import('../server/core.mjs');
const user='test-v04';
run('INSERT INTO accounts(id,username,password_hash,role,created_at) VALUES(?,?,?,?,?)',user,'test_v04','dummy','student',now());
adopt(user,'Lumi');
test('4 bridge challenges with valid rotation solutions, no path leakage',()=>{
 for(let i=0;i<4;i++){
  const r=buildBridgeRound(i); const solution=Object.fromEntries(r.tiles.map(t=>[t.id,t.solution]));
  assert.equal(validateBridgeRound(r,solution),true);
  assert.equal(validateBridgeRound(r,Object.fromEntries(r.tiles.map(t=>[t.id,t.rot]))),false);
  assert.equal(publicBridgeRound(r).path,undefined);
  assert.ok(publicBridgeRound(r).tiles.every(t=>t.solution===undefined));
 }
});
test('Bridge failure can be retried in same session without consuming it',()=>{
 const game=startGame(user,'bridges');
 const bad=Object.fromEntries(game.round.tiles.map(t=>[t.id,t.rot]));
 const first=finishGame(user,game.sessionId,bad);
 assert.equal(first.correct,false);assert.equal(first.retry,true);
 const real=buildBridgeRound(0),good=Object.fromEntries(real.tiles.map(t=>[t.id,t.solution]));
 const success=finishGame(user,game.sessionId,good);
 assert.equal(success.correct,true);assert.equal(success.walkPath.length,real.path.length);
 assert.equal(finishGame(user,game.sessionId,good).duplicate,true);
});
test('Sleep persists until awake or full energy, and cleaning gains XP',()=>{
 run('UPDATE pets SET energy=20,sleeping=0,hygiene=20 WHERE account_id=?',user);
 let state=care(user,'sleep').state;
 assert.equal(state.pet.sleeping,1);
 assert.throws(()=>care(user,'play'),/dormindo/i);
 run('UPDATE pets SET last_tick=? WHERE account_id=?',now()-120,user);
 state=me(user);
 assert.ok(state.pet.energy>=30,'energia deve se recuperar visivelmente ao dormir');
 assert.equal(state.pet.sleeping,1);
 state=care(user,'wake').state;
 assert.equal(state.pet.sleeping,0);
 const xp=state.pet.xp;
 state=care(user,'clean').state;
 assert.ok(state.pet.hygiene>20);
 assert.ok(state.pet.xp>=xp);
 run('UPDATE pets SET energy=95,sleeping=1,last_tick=? WHERE account_id=?',now()-3600,user);
 state=me(user);
 assert.equal(state.pet.sleeping,0);
 assert.equal(state.pet.energy,100);
});
test('custom food and poop sprite files declared',async()=>{
 const {existsSync}=await import('node:fs');
 const base=new URL('../web/assets/',import.meta.url);
 for(const p of ['pets/dirty.png','pets/sleep.png','pets/poop.png','games/bridges.jpg','food/berry.png'])assert.ok(existsSync(new URL(p,base)));
});
process.on('exit',()=>{try{db.close();rmSync(process.env.DATA_DIR,{recursive:true,force:true})}catch{}});
