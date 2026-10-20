import assert from 'node:assert/strict';
import { request } from 'node:http';
import { startLocalWorker, publish, quantiles } from './local-worker.mjs';

async function batch(count,concurrency,fn){let next=0;const rows=[],began=performance.now();
  await Promise.all(Array.from({length:Math.min(count,concurrency)},async()=>{while(next<count){const i=next++,start=performance.now();try{rows[i]={...await fn(i),ms:performance.now()-start};}catch(error){rows[i]={status:0,timeout:error.name==='TimeoutError',ms:performance.now()-start};}}}));
  const actual=rows.filter(v=>!v.skipped),durationMs=performance.now()-began,statuses={};for(const r of actual)statuses[r.status]=(statuses[r.status]??0)+1;
  return {rows,summary:{attempted:count,actualRequests:actual.length,skipped:rows.length-actual.length,statuses,accepted:statuses[200]??0,rejected429:statuses[429]??0,rejected503:statuses[503]??0,
    unexpected5xx:actual.filter(r=>r.status>=500&&r.status!==503).length,transportErrors:statuses[0]??0,timeouts:actual.filter(r=>r.timeout).length,durationMs,
    successfulRequestsPerSecond:(statuses[200]??0)*1000/durationMs,...quantiles(actual.map(r=>r.ms))}};
}
function streamed(origin,slow=false){return new Promise((resolve,reject)=>{
  const began=performance.now(),req=request(origin+'/api/lavaguard/challenge',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Transfer-Encoding':'chunked','CF-Connecting-IP':'198.51.100.249'}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,elapsedMs:performance.now()-began}));});
  req.on('error',reject);req.setTimeout(6000,()=>req.destroy(new Error('Local stream test timeout')));
  req.write(slow?'{"kind":"gesture"':'{"padding":"'+'x'.repeat(9000));if(!slow)req.end('"}');
  if(slow)req.on('response',()=>req.end());
});}
const report={schema:'lava-phase6-local-load-v1',runtime:'Frozen local workerd/SQLite only, not edge capacity',levels:[1,4,16,64,128],phases:[],
  syntheticClientHeaders:true,noHumanSubjects:true,actualEdgeCpuMs:null,capacity10kUsers:null,capacity100kUsers:null,productionChanged:false};
for(const concurrency of report.levels){
  const worker=await startLocalWorker(8807,{metrics:true,shadow:true}),origin=worker.origin,n=Math.max(32,concurrency);
  const post=async(path,data,i,cookie)=>{const r=await fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':`198.51.100.${i%240+1}`,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
    let value=null;try{value=await r.json();}catch{}return {status:r.status,data:value,cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  try{
    const before=worker.usage(),issued=await batch(n,concurrency,i=>post('/api/lavaguard/challenge',{kind:'accessible'},i));
    const evaluated=await batch(n,concurrency,i=>{const c=issued.rows[i];return c.status!==200?{status:c.status,skipped:true}:post('/api/lavaguard/evaluate',{id:c.data.id,nonce:c.data.nonce,summary:null},i,c.cookie);});
    const winner=evaluated.rows.findIndex(r=>r.status===200&&r.data?.clearance);
    const redemption=winner<0?null:await batch(8,8,()=>post('/api/login/options',{digests:{},clearance:evaluated.rows[winner].data.clearance},winner,issued.rows[winner].cookie));
    assert.equal(redemption?.summary.accepted,1,'Exactly one redemption must succeed');
    const recoveryIssue=await post('/api/lavaguard/challenge',{kind:'accessible'},239),recovery=await post('/api/lavaguard/evaluate',{id:recoveryIssue.data.id,nonce:recoveryIssue.data.nonce,summary:null},239,recoveryIssue.cookie);
    assert.equal(recovery.status,200,'Pressure must drain and recover');
    const abuse=await batch(35,8,()=>post('/api/lavaguard/challenge',{kind:'gesture'},238));
    const metrics=await(await fetch(origin+'/api/lavaguard/metrics',{headers:{Authorization:'Bearer phase6-local-fixture-administrator-0000000000'}})).json();
    let streaming=null;if(concurrency===1){
      streaming={oversized:await streamed(origin),externalSlowBridge:await streamed(origin,true)};
      const start=performance.now(),direct=await fetch(origin+'/__phase6/slow-body',{method:'POST',headers:{Origin:origin,'X-Phase6':'synthetic-local-experiment'},signal:AbortSignal.timeout(8000)});
      streaming.directWorkerSlowBody={status:direct.status,elapsedMs:performance.now()-start};await direct.arrayBuffer();
      streaming.externalSlowStatus=streaming.externalSlowBridge.status===400?'PASSED':'UNRESOLVED_LOCAL_PROXY_FAILURE';
    }
    const phase={concurrency,manifest:worker.manifest,issuance:issued.summary,evaluation:evaluated.summary,parallelRedemption:redemption.summary,abusiveCookieResetsSameNetwork:abuse.summary,
      recoveryStatus:recovery.status,unauthenticatedSessionStatus:(await fetch(origin+'/api/session')).status,streaming,hostBefore:before,hostAfter:worker.usage(),storage:await worker.storage(),metrics};
    report.phases.push(phase);await publish('phase6-local-load',report);console.log(JSON.stringify({concurrency,issuance:phase.issuance,evaluation:phase.evaluation,recoveryStatus:recovery.status,streaming}));
    if(streaming){assert.equal(streaming.oversized.status,400);assert.equal(streaming.directWorkerSlowBody.status,400);}
    assert.equal(phase.unauthenticatedSessionStatus,401);
  }finally{worker.close();}
}
report.complete=true;await publish('phase6-local-load',report);
