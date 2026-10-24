import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {postgresSql} from '../server/pg-sql.mjs';
test('PG SQL compatibility converts parameters and INSERT OR IGNORE without losing quoting',()=>{
 assert.equal(postgresSql('SELECT * FROM accounts WHERE id=? AND username=?'), 'SELECT * FROM accounts WHERE id=$1 AND username=$2');
 assert.equal(postgresSql("INSERT OR IGNORE INTO badges(account_id,label) VALUES(?,?)"),'INSERT INTO badges(account_id,label) VALUES($1,$2) ON CONFLICT DO NOTHING');
 assert.equal(postgresSql("SELECT '?', a FROM t WHERE x=?"),"SELECT '?', a FROM t WHERE x=$1");
 assert.equal(postgresSql('UPDATE pets SET heal_reserve=MIN(60,heal_reserve+?) WHERE account_id=?'),'UPDATE pets SET heal_reserve=LEAST(60,heal_reserve+$1) WHERE account_id=$2');
});
test('Docker files have PostgreSQL, private networking and HTTPS reverse-proxy overlays',()=>{
 const base=readFileSync(new URL('../compose.yaml',import.meta.url),'utf8');
 const vps=readFileSync(new URL('../compose.vps.yaml',import.meta.url),'utf8');
 assert.match(base,/image: postgres:/);
 assert.match(base,/DB_ENGINE: postgres/);
 assert.doesNotMatch(base,/(?:^|\n)\s+ports:/);
 assert.match(vps,/traefik:/);assert.match(vps,/COOKIE_SECURE: 'true'/);
 assert.match(vps,/tlschallenge=true/);
 assert.ok(!existsSync(new URL('../INICIAR_WINDOWS.bat',import.meta.url)));
 assert.ok(!existsSync(new URL('../mobile_flutter/PREPARAR_ANDROID_WINDOWS.bat',import.meta.url)));
});
