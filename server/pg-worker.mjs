import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {workerData} from 'node:worker_threads';
import {postgresSql,pgRow} from './pg-sql.mjs';
const {port}=workerData;
let client;
try {
 const pkg=await import('pg');
 const {Client,types}=pkg.default||pkg;
 types.setTypeParser(20, (v)=>{const n=Number(v);return Number.isSafeInteger(n)?n:v;});
 client=new Client({
  host:process.env.PGHOST||'db',port:Number(process.env.PGPORT||5432),
  user:process.env.PGUSER||'bytepets',password:process.env.PGPASSWORD,
  database:process.env.PGDATABASE||'bytepets',
  connectionTimeoutMillis:12000,
  ssl:process.env.PGSSLMODE==='require'?{rejectUnauthorized:process.env.PGSSL_ALLOW_SELF_SIGNED!=='true'}:undefined
 });
 await client.connect();
 client.on('error',error=>{console.error('[PostgreSQL] connection lost:',error.message);process.exit(1);});
 client.on('end',()=>{console.error('[PostgreSQL] connection ended');process.exit(1);});
 const schema=await readFile(join(dirname(fileURLToPath(import.meta.url)),'postgres-schema.sql'),'utf8');
 await client.query(schema);
} catch(err) {
 // An explicit initialization response prevents silently falling back to SQLite.
 port.postMessage({id:'__ready',error:String(err?.message||err)});
 port.close();
 throw err;
}
port.postMessage({id:'__ready',ok:true});
port.on('message',async ({id,operation,sql,args,signal})=>{
 let result,error;
 try{
  if(operation==='BEGIN')await client.query('BEGIN');
  else if(operation==='COMMIT')await client.query('COMMIT');
  else if(operation==='ROLLBACK')await client.query('ROLLBACK');
  else if(operation==='PING')result={ok:true};
  else {
   const response=await client.query(postgresSql(sql),args);
   if(operation==='get')result=response.rows.length?pgRow(response.rows[0]):undefined;
   if(operation==='all')result=response.rows.map(pgRow);
   if(operation==='run')result={changes:response.rowCount||0};
  }
 }catch(ex){error={message:ex.message,code:ex.code||null};}
 port.postMessage({id,result,error});
 // Notify only after enqueueing response; the main thread receives it synchronously.
 if(signal){const state=new Int32Array(signal);Atomics.store(state,0,1);Atomics.notify(state,0);}
});
