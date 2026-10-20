import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
export async function sqlRuntime(){
  await mkdir('.cache/phase7',{recursive:true});const file=resolve('.cache/phase7/sql-runtime-'+Date.now()+'.mjs');
  await build({stdin:{contents:`export { ResearchRoutedGuard } from './src/worker/guard/research-routed-guard'; export { ResearchShardRouter } from './src/worker/guard/research-router'; export { ResearchShardMetrics } from './src/shared/shard-metrics'; export { LavaEnforcer } from './src/worker/guard/LavaEnforcer'; export { SessionStore } from './src/worker/durable/SessionStore'; export { UserStore } from './src/worker/durable/UserStore';`,resolveDir:process.cwd(),loader:'ts'},outfile:file,bundle:true,platform:'node',format:'esm',logLevel:'error',plugins:[{name:'local-do-base',setup(b){
    b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'base',namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }',loader:'js'}));
  }}]});return { ...await import(pathToFileURL(file).href), runtimeSha256:createHash('sha256').update(await readFile(file)).digest('hex') };
}
export function store(rt){
  const db=new DatabaseSync(':memory:');
  const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const s=db.prepare(query),v=args.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);rows=s.columns().length?s.all(...v):(s.run(...v),[]);}
    return {toArray:()=>rows,one:()=>{if(rows.length!==1)throw new Error('Expected one SQL row');return rows[0];},[Symbol.iterator]:()=>rows[Symbol.iterator]()};}};
  const ctx={storage:{sql,transactionSync(fn){db.exec('BEGIN');try{const out=fn();db.exec('COMMIT');return out;}catch(error){db.exec('ROLLBACK');throw error;}}}};
  return {db,sql,ctx,guard:new rt.LavaEnforcer(sql),sessions:new rt.SessionStore(ctx,{}),users:new rt.UserStore(ctx,{})};
}
export function directory(){
  const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE authority(scope TEXT,id TEXT,epoch INTEGER,shard INTEGER,PRIMARY KEY(scope,id))');
  return {db,reserve(id,scope,p){if(db.prepare('SELECT count(*) AS n FROM authority').get().n>=4096)return false;return db.prepare('INSERT OR IGNORE INTO authority VALUES(?,?,?,?)').run(scope,id,p.epoch,p.shard).changes===1;},lookup(id,scope){const r=db.prepare('SELECT epoch,shard FROM authority WHERE scope=? AND id=?').get(scope,id);return r?{epoch:r.epoch,shard:r.shard}:null;}};
}
