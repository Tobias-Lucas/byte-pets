import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dirname=path.dirname(fileURLToPath(import.meta.url));
const directory=process.env.DATA_DIR||path.resolve(dirname,'../data');mkdirSync(directory,{recursive:true});
export const db=new DatabaseSync(path.join(directory,'bytepets.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'student',created_at INTEGER NOT NULL,allow_visits INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS pets(account_id TEXT PRIMARY KEY REFERENCES accounts(id),name TEXT NOT NULL,level INTEGER NOT NULL DEFAULT 1,xp INTEGER NOT NULL DEFAULT 0,coins INTEGER NOT NULL DEFAULT 250,world_id TEXT NOT NULL DEFAULT 'refugio',skin TEXT NOT NULL DEFAULT 'normal',hunger REAL NOT NULL DEFAULT 76,energy REAL NOT NULL DEFAULT 78,hygiene REAL NOT NULL DEFAULT 83,happiness REAL NOT NULL DEFAULT 78,health REAL NOT NULL DEFAULT 92,last_tick INTEGER NOT NULL,heal_reserve REAL NOT NULL DEFAULT 0,poop_at INTEGER NOT NULL DEFAULT 0,poop INTEGER NOT NULL DEFAULT 0,care_reward_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS owned_worlds(account_id TEXT NOT NULL REFERENCES accounts(id),world_id TEXT NOT NULL,PRIMARY KEY(account_id,world_id));
CREATE TABLE IF NOT EXISTS inventory(account_id TEXT NOT NULL REFERENCES accounts(id),item_id TEXT NOT NULL,world_id TEXT NOT NULL DEFAULT '',quantity INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(account_id,item_id,world_id));
CREATE TABLE IF NOT EXISTS world_equipment(account_id TEXT NOT NULL REFERENCES accounts(id),world_id TEXT NOT NULL,slot TEXT NOT NULL,item_id TEXT NOT NULL,PRIMARY KEY(account_id,world_id,slot));
CREATE TABLE IF NOT EXISTS rewards(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),reason TEXT NOT NULL,xp INTEGER NOT NULL DEFAULT 0,coins INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS badges(account_id TEXT NOT NULL REFERENCES accounts(id),badge_id TEXT NOT NULL,label TEXT NOT NULL,issuer TEXT NOT NULL,awarded_at INTEGER NOT NULL,PRIMARY KEY(account_id,badge_id));
CREATE TABLE IF NOT EXISTS issued_games(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),type TEXT NOT NULL,payload TEXT NOT NULL,answer TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,correct INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),question_id TEXT NOT NULL,answer TEXT NOT NULL,correct INTEGER NOT NULL,score INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS schools(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES accounts(id),created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS school_members(school_id TEXT NOT NULL REFERENCES schools(id),account_id TEXT NOT NULL REFERENCES accounts(id),role TEXT NOT NULL CHECK(role IN ('manager','teacher','student')),PRIMARY KEY(school_id,account_id));
CREATE TABLE IF NOT EXISTS classes(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),name TEXT NOT NULL,join_code TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS class_members(class_id TEXT NOT NULL REFERENCES classes(id),account_id TEXT NOT NULL REFERENCES accounts(id),PRIMARY KEY(class_id,account_id));
CREATE TABLE IF NOT EXISTS modules(id TEXT PRIMARY KEY,school_id TEXT REFERENCES schools(id),title TEXT NOT NULL,subject TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',published INTEGER NOT NULL DEFAULT 0,created_by TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS module_classes(module_id TEXT NOT NULL REFERENCES modules(id),class_id TEXT NOT NULL REFERENCES classes(id),PRIMARY KEY(module_id,class_id));
CREATE TABLE IF NOT EXISTS questions(id TEXT PRIMARY KEY,module_id TEXT NOT NULL REFERENCES modules(id),type TEXT NOT NULL,prompt TEXT NOT NULL,options_json TEXT NOT NULL,answer_json TEXT NOT NULL,explanation TEXT NOT NULL DEFAULT '',media_path TEXT NOT NULL DEFAULT '',score INTEGER NOT NULL DEFAULT 10,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS friendships(id TEXT PRIMARY KEY,requester TEXT NOT NULL REFERENCES accounts(id),recipient TEXT NOT NULL REFERENCES accounts(id),status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,UNIQUE(requester,recipient));
CREATE TABLE IF NOT EXISTS media_assets(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),created_by TEXT NOT NULL REFERENCES accounts(id),filename TEXT NOT NULL,mime TEXT NOT NULL,sha256 TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_attempts_account_question ON attempts(account_id,question_id);
CREATE INDEX IF NOT EXISTS idx_rewards_account ON rewards(account_id);
CREATE INDEX IF NOT EXISTS idx_membership_class ON class_members(account_id);
`);
// BytePets v0.5: additive migrations; never erase an existing SQLite database.
db.exec(`
CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS school_roster(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),enrollment TEXT NOT NULL,student_name TEXT NOT NULL,class_id TEXT NOT NULL REFERENCES classes(id),activation_hash TEXT NOT NULL,account_id TEXT UNIQUE REFERENCES accounts(id),active INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,UNIQUE(school_id,enrollment));
CREATE TABLE IF NOT EXISTS teacher_invites(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,used_at INTEGER,created_by TEXT NOT NULL REFERENCES accounts(id),created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS teacher_requests(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),created_at INTEGER NOT NULL,resolved_at INTEGER);
CREATE TABLE IF NOT EXISTS teacher_classes(school_id TEXT NOT NULL REFERENCES schools(id),account_id TEXT NOT NULL REFERENCES accounts(id),class_id TEXT NOT NULL REFERENCES classes(id),PRIMARY KEY(account_id,class_id));
CREATE INDEX IF NOT EXISTS idx_school_roster_class ON school_roster(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_user ON teacher_classes(account_id);
CREATE INDEX IF NOT EXISTS idx_issued_games_user_time ON issued_games(account_id,created_at);
`);
function addColumn(table,col,definition){
 if(!db.prepare(`PRAGMA table_info(${table})`).all().some(r=>r.name===col))db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`);
}
addColumn('schools','code','TEXT');
addColumn('schools','daily_game_limit','INTEGER NOT NULL DEFAULT 5');
// Populates codes for schools created on older installations.
for(const school of db.prepare('SELECT id,code FROM schools').all()){
 if(!school.code)db.prepare('UPDATE schools SET code=? WHERE id=?').run('ESC'+school.id.replaceAll('-','').slice(0,9).toUpperCase(),school.id);
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_code ON schools(code)');

// Migra banco existente sem apagar dados de usuarios.
if (!db.prepare('PRAGMA table_info(pets)').all().some(col=>col.name==='sleeping')) db.exec('ALTER TABLE pets ADD COLUMN sleeping INTEGER NOT NULL DEFAULT 0');
db.exec(`
CREATE TABLE IF NOT EXISTS active_visits(visitor_id TEXT PRIMARY KEY REFERENCES accounts(id),owner_id TEXT NOT NULL REFERENCES accounts(id),entered_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_active_visits_owner ON active_visits(owner_id,expires_at);
CREATE TABLE IF NOT EXISTS mentor_messages(id TEXT PRIMARY KEY,sender_id TEXT NOT NULL REFERENCES accounts(id),recipient_id TEXT NOT NULL REFERENCES accounts(id),message_key TEXT NOT NULL,created_at INTEGER NOT NULL,read_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_to ON mentor_messages(recipient_id,created_at);
`);
export const get=(sql,...args)=>db.prepare(sql).get(...args);
export const all=(sql,...args)=>db.prepare(sql).all(...args);
export const run=(sql,...args)=>db.prepare(sql).run(...args);
export function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
export const now=()=>Math.floor(Date.now()/1000);

// Etapa v0.7: cada tentativa avalia um teste completo, com embaralhamento persistente.
db.exec(`
CREATE TABLE IF NOT EXISTS module_runs(
 id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),module_id TEXT NOT NULL REFERENCES modules(id),
 order_json TEXT NOT NULL,display_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed')),
 total INTEGER NOT NULL,max_score INTEGER NOT NULL,correct_count INTEGER NOT NULL DEFAULT 0,score INTEGER NOT NULL DEFAULT 0,
 medal_tier TEXT,created_at INTEGER NOT NULL,completed_at INTEGER);
CREATE TABLE IF NOT EXISTS module_run_answers(
 run_id TEXT NOT NULL REFERENCES module_runs(id),question_id TEXT NOT NULL REFERENCES questions(id),
 request_id TEXT NOT NULL UNIQUE,answer_json TEXT NOT NULL,correct INTEGER NOT NULL,points INTEGER NOT NULL,answered_at INTEGER NOT NULL,
 PRIMARY KEY(run_id,question_id));
CREATE TABLE IF NOT EXISTS module_medals(account_id TEXT NOT NULL REFERENCES accounts(id),module_id TEXT NOT NULL REFERENCES modules(id),
 tier TEXT NOT NULL,best_percent INTEGER NOT NULL,awarded_at INTEGER NOT NULL,PRIMARY KEY(account_id,module_id));
CREATE INDEX IF NOT EXISTS idx_module_runs_owner ON module_runs(account_id,module_id,created_at);
`);
