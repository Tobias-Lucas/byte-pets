// Compatibility transport: BytePets currently exposes synchronous domain methods.
// The single PostgreSQL worker preserves their transaction boundaries and semantics.
// Intended for a single application replica; replace this layer with an async ORM
// before scaling to high concurrency / multiple server replicas.
import {Worker,MessageChannel,receiveMessageOnPort} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const {port1,port2}=new MessageChannel();
const worker=new Worker(join(dirname(fileURLToPath(import.meta.url)),'pg-worker.mjs'),{workerData:{port:port2},transferList:[port2]});
worker.on('error',error=>{console.error('[PostgreSQL] worker failure:',error.message);process.exitCode=1;});
worker.on('exit',code=>{console.error('[PostgreSQL] worker terminated:',code);process.exit(1);});
// Worker readiness is the only top-level asynchronous step.
let nextId=0;
function readOne(timeout=45000,signal){
 if(signal){const flag=new Int32Array(signal);if(Atomics.wait(flag,0,0,timeout)==='timed-out')throw new Error('PostgreSQL: query timeout');}
 return receiveMessageOnPort(port1)?.message;
}
const ready=await new Promise((resolve,reject)=>{
 const onMsg=(msg)=>{
  if(msg.id!=='__ready')return;
  clearTimeout(timer);
  port1.off('message',onMsg);
  msg.error?reject(new Error('PostgreSQL: '+msg.error)):resolve(true);
 };
 const timer=setTimeout(()=>{port1.off('message',onMsg);reject(new Error('PostgreSQL did not become ready within 45s'));},45000);
 port1.on('message',onMsg);
});
export function operation(operation,sql='',...args){
 const id=++nextId;
 const buffer=new SharedArrayBuffer(4);
 port1.postMessage({id,operation,sql,args,signal:buffer});
 const resp=readOne(45000,buffer);
 if(!resp||resp.id!==id)throw new Error('PostgreSQL response unavailable/mismatched');
 if(resp.error){const ex=new Error(resp.error.message);ex.code=resp.error.code;throw ex;}
 return resp.result;
}
export const get=(sql,...args)=>operation('get',sql,...args);
export const all=(sql,...args)=>operation('all',sql,...args);
export const run=(sql,...args)=>operation('run',sql,...args);
export function transaction(fn){operation('BEGIN');try{const res=fn();operation('COMMIT');return res;}catch(error){try{operation('ROLLBACK');}catch{}throw error;}}
export function ping(){return operation('PING');}
