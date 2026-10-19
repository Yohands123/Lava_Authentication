import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { runtime } from './candidate.mjs';
import { hash, publish, quantiles } from './local-worker.mjs';
const rt=await runtime();
function factory(stores){const db=new DatabaseSync(':memory:');stores.push(db);return new rt.LavaEnforcer({exec(query,...args){
  if(!args.length&&query.includes(';')){db.exec(query);return [];}
  const s=db.prepare(query),rows=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows,[Symbol.iterator]:()=>rows[Symbol.iterator]()};
}});}
const measurements=[];
for(const shards of [1,4,16]){
  const stores=[],router=new rt.GuardShardSimulator(shards,()=>factory(stores)),timings=[],distribution=Array(shards).fill(0),cpuBefore=process.cpuUsage(),began=performance.now();
  let clear=0,redeemed=0,replayed=0;
  try{
    for(let i=0;i<512;i++){
      const context=hash('phase6-context-'+i).slice(0,43),g=router.forContext(context),start=performance.now();distribution[rt.contextShard(context,shards)]++;
      const c=g.issue(context,'http://localhost','accessible','enforce');assert.ok(!('error'in c));
      const d=g.evaluate(context,'http://localhost',c.id,c.nonce,null,'enforce');assert.ok(!('error'in d));
      clear+=Number(d.verdict==='CLEAR');redeemed+=Number(g.redeem(context,'http://localhost',d.clearance)==='ok');replayed+=Number(g.redeem(context,'http://localhost',d.clearance)==='used');
      timings.push(performance.now()-start);
    }
    assert.equal(clear,512);assert.equal(redeemed,512);assert.equal(replayed,512);
    measurements.push({shards,generatedContextOperations:512,clear,firstRedemptionWinners:redeemed,replaysRejected:replayed,distribution,
      elapsedWallMs:performance.now()-began,nodeCpuMicros:process.cpuUsage(cpuBefore),...quantiles(timings),nodeRssBytes:process.memoryUsage().rss});
  }finally{for(const db of stores)db.close();}
}
const db=new DatabaseSync(':memory:');let indexPrototype;
try{
  db.exec('CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);CREATE INDEX sessions_user ON sessions(user_id)');
  const put=db.prepare('INSERT INTO sessions VALUES(?,?,?)');db.exec('BEGIN');for(let i=0;i<10000;i++)put.run('synthetic-session-'+i,'synthetic-user-'+(i%100),i);db.exec('COMMIT');
  const query='SELECT id FROM sessions WHERE expires_at < 5000',before=db.prepare('EXPLAIN QUERY PLAN '+query).all();
  const time=()=>{const a=[];for(let i=0;i<30;i++){const start=performance.now();assert.equal(db.prepare(query).all().length,5000);a.push(performance.now()-start);}return quantiles(a);};
  const beforeCost=time();db.exec('CREATE INDEX phase6_prototype_sessions_expiry ON sessions(expires_at)');const after=db.prepare('EXPLAIN QUERY PLAN '+query).all(),afterCost=time();
  indexPrototype={syntheticSqlRows:10000,query:'expiry selection only; no production change',beforePlan:before.map(v=>v.detail),afterPlan:after.map(v=>v.detail),beforeCost,afterCost,selectedRowsUnchanged:5000};
}finally{db.close();}
const report={schema:'lava-phase6-sharding-simulator-v1',node:process.version,runtime:'Node SQLite using actual LavaEnforcer; no distributed parallelism',
  measurements,indexPrototype,productionRoutingChanged:false,globalCapEquivalence:false,productionCutoverApproved:false,
  limitations:['Public FNV routing is a simulator, not adversarial shard placement protection.','Per-shard 4096 caps multiply global capacity; global admission and migration are unresolved.','Node timings are not Durable Object or edge throughput.','Ten thousand synthetic SQL rows are not ten thousand simultaneous users.']};
await publish('phase6-sharding',report);console.log(JSON.stringify(report));
