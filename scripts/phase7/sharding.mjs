import assert from 'node:assert/strict';
import { sqlRuntime, store, directory } from './sql-runtime.mjs';
import { hash, quantiles, publish } from './local-worker.mjs';
const rt=await sqlRuntime(),origin='http://localhost:8812',measurements=[];
for(const count of [1,4,16])for(const skew of ['spread','80-percent-hot-context']){
  const stores=Array.from({length:count},()=>store(rt)),d=directory(),now=Date.now(),metrics=new rt.ResearchShardMetrics(count);
  const router=await rt.ResearchShardRouter.create({enabled:true,epochs:[{version:1,shards:count,acceptUntil:now+604800000}],active:1,keyId:'ephemeral',secret:crypto.getRandomValues(new Uint8Array(32)),directory:d});
  const guard=new rt.ResearchRoutedGuard(router,new Map([[1,stores.map(s=>s.guard)]])),distribution=Array(count).fill(0),times=[],cpu=process.cpuUsage(),started=performance.now();
  let replayRejected=0,sessionRevocations=0,credentialReads=0;
  try{
    for(let i=0;i<256;i++){
      const context=hash(skew==='80-percent-hot-context'&&i%5?'hot-local-context':'local-context-'+i).slice(0,43),p=await router.placement(context),begin=performance.now();distribution[p.shard]++;
      const c=await guard.issue(context,origin);assert.ok(!('error'in c));metrics.record(p.shard,'issued');
      const v=await guard.evaluate(context,origin,c.id,c.nonce);assert.equal(v.verdict,'CLEAR');
      const results=await Promise.all(Array.from({length:8},()=>guard.redeem(context,origin,v.clearance)));
      assert.equal(results.filter(v=>v==='ok').length,1);replayRejected+=results.filter(v=>v==='used').length;metrics.record(p.shard,'redeemed');metrics.record(p.shard,'replay');
      const s=stores[p.shard],user='synthetic-user-'+i,credential='synthetic-public-credential-'+i;
      assert.equal(await s.users.createUserWithCredential({id:user,username:user},{id:credential,publicKey:new Uint8Array(32),counter:0,transports:[]}),true);
      assert.equal((await s.users.getCredential(credential)).userId,user);credentialReads++;
      const session=await s.sessions.create(user,user,60);assert.ok(await s.sessions.get(session.id));await s.sessions.revoke(session.id);assert.equal(await s.sessions.get(session.id),null);sessionRevocations++;
      times.push(performance.now()-begin);
    }
    measurements.push({shards:count,skew,syntheticOperations:256,distribution,successfulGuardRedemptions:256,replayRejected,sessionRevocations,credentialReads,
      ...quantiles(times),wallMs:performance.now()-started,nodeCpuMicros:process.cpuUsage(cpu),nodeRssBytes:process.memoryUsage().rss,metrics:metrics.snapshot()});
  }finally{for(const s of stores)s.db.close();d.db.close();}
}
// Copy unconsumed synthetic SQL rows to model a dangerous dual-store migration.
// Only directory authority can redeem; copied rows cannot authorize a new shard.
const a=store(rt),b=store(rt),d=directory(),secret=crypto.getRandomValues(new Uint8Array(32)),now=Date.now(),context=hash('migration-fixture').slice(0,43);
let migration;
try{
  const old=await rt.ResearchShardRouter.create({enabled:true,epochs:[{version:1,shards:1,acceptUntil:now+120000}],active:1,keyId:'migration',secret,directory:d});
  const first=new rt.ResearchRoutedGuard(old,new Map([[1,[a.guard]]]));const c=await first.issue(context,origin),v=await first.evaluate(context,origin,c.id,c.nonce);
  const row=a.db.prepare('SELECT * FROM guard_clearances').get();b.db.prepare('INSERT INTO guard_clearances VALUES(?,?,?,?,?)').run(row.token,row.context,row.origin,row.scope,row.expires);
  const next=await rt.ResearchShardRouter.create({enabled:true,epochs:[{version:1,shards:1,acceptUntil:now+120000},{version:2,shards:1,acceptUntil:now+240000}],active:2,keyId:'migration',secret,directory:d});
  const moved=new rt.ResearchRoutedGuard(next,new Map([[1,[a.guard]],[2,[b.guard]]]));
  assert.equal(await moved.redeem(context,origin,v.clearance,Date.now(),{epoch:2,shard:0}),'binding');
  assert.equal(await moved.redeem(context,origin,v.clearance),'ok');assert.equal(await moved.redeem(context,origin,v.clearance),'used');
  assert.equal(d.reserve(row.token,'clearance',{epoch:2,shard:0}),false);
  const restart=new rt.SessionStore(a.ctx,{}),session=await restart.create('synthetic-restart','synthetic-restart',60);await restart.revokeAll('synthetic-restart');assert.equal(await new rt.SessionStore(a.ctx,{}).get(session.id),null);
  assert.throws(()=>a.sql.exec('INSERT INTO sessions(nonexistent_column) VALUES (?)','x'));assert.equal(await restart.get(session.id),null);
  migration={disposableSqlCopies:2,duplicateRowCopied:true,wrongEpochRejected:true,oldAuthoritySingleWinner:true,duplicateDirectoryIdRejected:true,coldRestartRevocationPreserved:true,malformedSqlDoesNotGrantSession:true,actualProductionMigration:false};
}finally{a.db.close();b.db.close();d.db.close();}
const report={schema:'lava-phase7-sharding-v1',node:process.version,runtimeSha256:rt.runtimeSha256,runtime:'Single-process Node SQLite with production LavaEnforcer, SessionStore and UserStore methods; DO base stub only',measurements,migration,
  realHumanParticipants:0,productionRoutingChanged:false,directoryCapacityPerExperiment:4096,globalBudgetEquivalence:false,actualEdgeCpu:null,capacity10kUsers:null,
  limitations:['Sequential operations with Promise races do not measure distributed shard throughput.','The authoritative SQL directory is a potential central bottleneck; production cutover requires a scalable consistency design.','Independent per-shard caps multiply capacity unless reserved budgets or global admission are designed.','Synthetic credential bytes exercise SQL lookups only, not cryptographic authentication.']};
await publish('phase7-sharding',report);console.log(JSON.stringify({measurements:measurements.map(m=>({shards:m.shards,skew:m.skew,p95Ms:m.p95Ms,distribution:m.distribution})),migration}));
