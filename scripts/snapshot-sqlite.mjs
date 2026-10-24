#!/usr/bin/env node
// Consistent one-file SQLite snapshot, including writes still in WAL mode.
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const args=process.argv.slice(2);
const source=args[0]||'data/bytepets.sqlite';
const target=args[1]||'backup/bytepets.sqlite';
if(!existsSync(source))throw Error(`No SQLite database at ${source}`);
if(existsSync(target))throw Error(`Snapshot already exists (refusing overwrite): ${target}`);
mkdirSync(dirname(resolve(target)),{recursive:true});
const db=new DatabaseSync(resolve(source),{readOnly:true});
try{await backup(db,resolve(target));console.log(`Snapshot saved: ${resolve(target)}`);}finally{db.close();}
