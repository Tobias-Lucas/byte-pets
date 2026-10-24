// BytePets data gateway. Docker/VPS must use PostgreSQL explicitly.
// No automatic SQLite fallback is permitted when a PostgreSQL connection fails.
const engine=String(process.env.DB_ENGINE||'sqlite').trim().toLowerCase();
if(!['sqlite','postgres'].includes(engine))throw new Error('DB_ENGINE must be postgres or sqlite');
const impl=engine==='postgres'?await import('./pg-bridge.mjs'):await import('./sqlite-db.mjs');
export const db=impl.db||null;
export const get=impl.get;
export const all=impl.all;
export const run=impl.run;
export const transaction=impl.transaction;
export const now=()=>Math.floor(Date.now()/1000);
export const databaseEngine=engine;
export const ping=()=>engine==='postgres'?impl.ping():{ok:!!db};
