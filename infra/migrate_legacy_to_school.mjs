// Controlled, local migration from an existing normal-mode installation to school mode.
// Usage: node infra/migrate_legacy_to_school.mjs --manager=old_adult_username --school="School" --confirm
import {get,run} from '../server/db.mjs';
import {setupState} from '../server/onboarding.mjs';
import {createSchool} from '../server/school.mjs';
const arg=(key)=>process.argv.find(x=>x.startsWith('--'+key+'='))?.split('=').slice(1).join('=');
const username=arg('manager')?.trim().toLowerCase(),schoolName=arg('school')?.trim();
if(!process.argv.includes('--confirm')||!username||!schoolName){
 console.error('Usage: node infra/migrate_legacy_to_school.mjs --manager=existing_adult --school="School Name" --confirm');
 process.exitCode=1;
}else{
 const account=get('SELECT id,role FROM accounts WHERE username=?',username);
 const state=setupState();
 if(!account||account.role!=='adult'||state.mode!=='normal'){
  console.error('Requires an existing adult account and an installation in normal mode.');process.exitCode=2;
 }else{
  const school=createSchool(account.id,schoolName);
  run("UPDATE app_settings SET value='school' WHERE key='mode'");
  console.log('Migrated. School:',school.name,'Code:',school.code,'Admin username:',username);
  console.log('Existing personal accounts remain. New enrolled pupils require roster entries and activation codes.');
 }
}
