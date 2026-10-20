import assert from 'node:assert/strict';
import { sqlRuntime, store } from './sql-runtime.mjs';
import { quantiles, publish } from './local-worker.mjs';
const rt=await sqlRuntime(),s=store(rt);
try{
  const insert=s.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)');s.db.exec('BEGIN');
  for(let i=0;i<10000;i++)insert.run('synthetic-'+i,'synthetic-user-'+(i%100),'synthetic',0,i);
  s.db.exec('COMMIT');
  const query='SELECT id FROM sessions WHERE expires_at < 5000';
  const measure=()=>{const ms=[];for(let n=0;n<30;n++){const start=performance.now();assert.equal(s.db.prepare(query).all().length,5000);ms.push(performance.now()-start);}return quantiles(ms);};
  const beforePlan=s.db.prepare('EXPLAIN QUERY PLAN '+query).all().map(r=>r.detail),before=measure();
  s.db.exec('CREATE INDEX phase7_prototype_sessions_expiry ON sessions(expires_at)');
  const afterPlan=s.db.prepare('EXPLAIN QUERY PLAN '+query).all().map(r=>r.detail),after=measure();
  const report={schema:'lava-phase7-index-v1',runtimeSha256:rt.runtimeSha256,runtime:'Local in-memory Node SQLite; no live migration',syntheticRows:10000,selectedRows:5000,beforePlan,afterPlan,before,after,
    sessionUserPlan:s.db.prepare("EXPLAIN QUERY PLAN SELECT id FROM sessions WHERE user_id='synthetic-user-1'").all().map(r=>r.detail),
    credentialPlan:s.db.prepare('EXPLAIN QUERY PLAN SELECT * FROM credentials WHERE id=?').all('synthetic-absent').map(r=>r.detail),
    productionSchemaChanged:false,capacity10kConcurrentUsers:null};
  await publish('phase7-index',report);console.log(JSON.stringify(report));
}finally{s.db.close();}
