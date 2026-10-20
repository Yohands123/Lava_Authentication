import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlRuntime, store, directory } from './sql-runtime.mjs';
test('actual account/session SQL rejects duplicate credentials atomically and preserves expiry/revocation across restart',async()=>{
  const rt=await sqlRuntime(),s=store(rt);let now=1000;const clock=Date.now;Date.now=()=>now;
  try{
    const key={id:'fixture-public-id',publicKey:new Uint8Array(32),counter:0,transports:[]};
    assert.equal(await s.users.createUserWithCredential({id:'fixture-user-a',username:'fixture-a'},key),true);
    await assert.rejects(s.users.createUserWithCredential({id:'fixture-user-b',username:'fixture-b'},key));
    assert.equal(s.db.prepare('SELECT count(*) AS n FROM users').get().n,1);
    await s.users.updateCounter(key.id,5);assert.equal((await s.users.getCredential(key.id)).counter,5);assert.equal(await s.users.getCredential('absent'),null);
    const session=await s.sessions.create('fixture-user-a','fixture-a',1);now=2001;assert.equal(await s.sessions.get(session.id),null);
    const second=await s.sessions.create('fixture-user-a','fixture-a',60);await s.sessions.revokeAll('fixture-user-a');
    assert.equal(await new rt.SessionStore(s.ctx,{}).get(second.id),null);
  }finally{Date.now=clock;s.db.close();}
});
test('signed facade binds nonce, expires/revokes actual SQL clearances and fails closed when authority is unavailable',async()=>{
  const rt=await sqlRuntime(),s=store(rt),d=directory(),now=Date.now(),context='c'.repeat(43),origin='http://localhost:8812';
  try{
    const router=await rt.ResearchShardRouter.create({enabled:true,epochs:[{version:1,shards:1,acceptUntil:now+240000}],active:1,keyId:'fixture',secret:crypto.getRandomValues(new Uint8Array(32)),directory:d});
    const g=new rt.ResearchRoutedGuard(router,new Map([[1,[s.guard]]]));
    const c=await g.issue(context,origin,now);assert.equal((await g.evaluate(context,origin,c.id,'wrong',null,now)).error,'binding');
    assert.equal((await g.evaluate(context,origin,c.id,c.nonce,null,now)).error,'used');
    const c2=await g.issue(context,origin,now),v=await g.evaluate(context,origin,c2.id,c2.nonce,null,now);
    const decoded=await router.verify(v.clearance,'clearance',context,origin,now);s.guard.revoke(decoded.id);
    assert.equal(await g.redeem(context,origin,v.clearance,now),'used');
    const c3=await g.issue(context,origin,now),v3=await g.evaluate(context,origin,c3.id,c3.nonce,null,now);
    assert.equal(await g.redeem(context,origin,v3.clearance,now+90000),'binding');
    const noStores=new rt.ResearchRoutedGuard(router,new Map());await assert.rejects(noStores.issue(context,origin,now));
    d.db.exec('DROP TABLE authority');assert.equal(await router.verify(v3.clearance,'clearance',context,origin,now),null);
  }finally{s.db.close();d.db.close();}
});
