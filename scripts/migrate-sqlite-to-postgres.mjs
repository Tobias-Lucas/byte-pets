#!/usr/bin/env node
// One-time migration: BytePets SQLite -> empty PostgreSQL instance.
// Run with a verified backup. Default is read-only preview; --apply executes.
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const argv=process.argv.slice(2);
const idx=argv.indexOf('--source');
const source=idx===-1?'data/bytepets.sqlite':argv[idx+1];
const apply=argv.includes('--apply');
if(!source||!existsSync(source))throw Error('Source SQLite file not found: '+source);
const sqlite=new DatabaseSync(resolve(source),{readOnly:true});
const tables=[
 'accounts','app_settings','sessions','pets','owned_worlds','inventory','world_equipment',
 'rewards','badges','issued_games','attempts','schools','school_members','classes',
 'class_members','modules','module_classes','questions','friendships','media_assets',
 'school_roster','teacher_invites','teacher_requests','teacher_classes','active_visits',
 'mentor_messages','module_runs','module_run_answers','module_medals'
];
// sqlite rows for schools depend on accounts, classes depend on schools, ...
const order=['accounts','app_settings','sessions','pets','owned_worlds','inventory',
 'world_equipment','rewards','badges','issued_games','attempts','schools',
 'school_members','classes','class_members','modules','module_classes','questions',
 'friendships','media_assets','school_roster','teacher_invites','teacher_requests',
 'teacher_classes','active_visits','mentor_messages','module_runs',
 'module_run_answers','module_medals'];
const srcTables=new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
let count=0;
for(const t of order){if(!srcTables.has(t))continue;const n=sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;count+=n;console.log(t.padEnd(23),n);}
console.log('Total:',count,'rows; source:',resolve(source));
if(!apply){console.log('PREVIEW ONLY: add --apply and a verified backup to migrate.');sqlite.close();process.exit(0);}
if(process.env.DB_ENGINE!=='postgres')throw Error('Set DB_ENGINE=postgres explicitly before --apply');
const pgPackage=await import('pg');
const {Client}=pgPackage.default||pgPackage;
const client=new Client({
 host:process.env.PGHOST||'db',port:Number(process.env.PGPORT||5432),
 user:process.env.PGUSER||'bytepets',password:process.env.PGPASSWORD,
 database:process.env.PGDATABASE||'bytepets'
});
await client.connect();
try{
 const accounts=await client.query('SELECT COUNT(*)::int AS n FROM accounts');
 if(accounts.rows[0].n>0)throw Error('Target PostgreSQL has accounts: aborting to avoid overwrites');
 await client.query('BEGIN');
 let imported=0;
 for(const table of order){
  if(!srcTables.has(table))continue;
  const records=sqlite.prepare(`SELECT ${table==='module_runs'?'rowid AS __legacy_rowid,':''} * FROM ${table}`).all();
  for(const record of records){
   if(table==='module_runs')record.rowid=record.__legacy_rowid;
   delete record.__legacy_rowid;
   const columns=Object.keys(record);
   const names=columns.map(c=>'"'+c+'"').join(',');
   const placeholders=columns.map((_,i)=>'$'+(i+1)).join(',');
   const sql=`INSERT INTO "${table}" (${names}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
   const inserted=await client.query(sql,columns.map(c=>record[c]));
   imported+=inserted.rowCount;
  }
 }
 await client.query(`SELECT setval(pg_get_serial_sequence('module_runs','rowid'),
   GREATEST(1,(SELECT COALESCE(MAX(rowid),1) FROM module_runs)),true)`);
 await client.query('COMMIT');
 console.log('Imported',imported,'rows into PostgreSQL. Compare totals and login before retiring SQLite.');
}catch(e){try{await client.query('ROLLBACK')}catch{}throw e;}
finally{sqlite.close();await client.end();}
