import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { DatabaseSync } from 'node:sqlite';
import { readRegistrySnapshot } from './registry-store.mjs';

test('private registry snapshots honor live revocation, missing state and withdrawal deletion',async()=>{
  await mkdir('.cache/phase6',{recursive:true});const root=await mkdtemp(resolve('.cache/phase6/private-registry-')),folder=root+'/phase6/registry';await mkdir(folder,{recursive:true});
  const pin={sha256:'a'.repeat(64)},candidate=folder+'/'+pin.sha256+'.json';await writeFile(candidate,'{}');
  assert.equal((await readRegistrySnapshot(pin,root)).revocationState,'unavailable');
  const ledger=folder+'/revocations.json';await writeFile(ledger,JSON.stringify({schema:'lava-candidate-revocations-v1',revokedCandidateHashes:[]}));
  assert.equal((await readRegistrySnapshot(pin,root)).revocationState,'current');
  await writeFile(candidate,JSON.stringify({cohortManifestHash:'b'.repeat(64)}));assert.equal((await readRegistrySnapshot(pin,root)).revocationState,'unavailable');await writeFile(candidate,'{}');
  await writeFile(ledger,JSON.stringify({schema:'lava-candidate-revocations-v1',revokedCandidateHashes:[pin.sha256]}));
  assert.deepEqual((await readRegistrySnapshot(pin,root)).revokedCandidateHashes,[pin.sha256]);
  await unlink(candidate);assert.equal((await readRegistrySnapshot(pin,root)).candidate,null);
  assert.equal((await readRegistrySnapshot({sha256:'../outside'},root)).revocationState,'unavailable');
});
test('actual RateLimiter SQL preserves a new window when an old alarm arrives late',async()=>{
  const dir=await mkdtemp(resolve('.cache/phase6/rate-alarm-')),file=dir+'/runtime.mjs';
  await build({entryPoints:['src/worker/durable/RateLimiter.ts'],outfile:file,bundle:true,platform:'node',format:'esm',logLevel:'error',plugins:[{name:'local-do-base',setup(build){
    build.onResolve({filter:/^cloudflare:workers$/},()=>({path:'base',namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }',loader:'js'}));
  }}]});
  const {RateLimiter}=await import(pathToFileURL(file).href),db=new DatabaseSync(':memory:');let alarm=null,deleted=0,now=1000;const original=Date.now;
  const sql={exec(query,...args){const s=db.prepare(query),rows=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows,[Symbol.iterator]:()=>rows[Symbol.iterator]()};}};
  Date.now=()=>now;
  try{
    const limiter=new RateLimiter({storage:{sql,setAlarm:async value=>{alarm=value;},deleteAll:async()=>{db.exec('DROP TABLE rate_window');deleted++;}}},{});
    assert.equal((await limiter.hit(5,1)).remaining,4);now=2100;assert.equal((await limiter.hit(5,1)).remaining,4);
    now=2200;await limiter.alarm();assert.equal(deleted,0);assert.equal(alarm,4100);
    assert.equal((await limiter.hit(5,1)).remaining,3);now=3200;await limiter.alarm();assert.equal(deleted,1);
    assert.equal((await limiter.hit(5,1)).remaining,4);
  }finally{Date.now=original;db.close();}
});
