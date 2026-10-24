import {get,all,now} from './db.mjs';
const FORMAT=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Belem',year:'numeric',month:'2-digit',day:'2-digit'});
export const localDay=(timestamp)=>FORMAT.format(new Date(timestamp*1000));
export function dailyCap(id){
 const rows=all("SELECT s.daily_game_limit AS cap FROM school_members m JOIN schools s ON s.id=m.school_id WHERE m.account_id=? AND m.role='student'",id);
 return rows.length?Math.min(...rows.map(x=>x.cap)):5;
}
export function dailyStatus(id){
 const today=localDay(now());const times=all('SELECT created_at FROM issued_games WHERE account_id=? AND created_at>=?',id,now()-48*3600);
 const used=times.filter(t=>localDay(t.created_at)===today).length;
 const limit=dailyCap(id);return {date:today,limit,used,remaining:Math.max(0,limit-used),timezone:'America/Belem'};
}
