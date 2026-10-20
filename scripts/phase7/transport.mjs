import assert from 'node:assert/strict';
import { request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { startLocalWorker, publish, pause } from './local-worker.mjs';
import { startProxy } from './proxy.mjs';
async function probe(origin,kind){return new Promise(resolve=>{
  const start=performance.now();let complete=false,timer;
  const finish=value=>{if(complete)return;complete=true;clearTimeout(timer);resolve({...value,elapsedMs:performance.now()-start});};
  const req=request(origin+'/api/lavaguard/challenge',{method:'POST',headers:{Origin:'http://localhost:8812','Content-Type':'application/json','Transfer-Encoding':'chunked','X-Phase7-Trace':'local-synthetic-probe'}},res=>{res.resume();res.on('end',()=>finish({httpStatus:res.statusCode,timeout:false}));});
  req.on('error',()=>finish({httpStatus:null,timeout:kind!=='aborted',clientAborted:kind==='aborted'}));
  req.setTimeout(6500,()=>req.destroy());req.write('{"kind":"gesture"');
  if(kind==='finished-slow')timer=setTimeout(()=>req.end('}'),4500);
  if(kind==='aborted')timer=setTimeout(()=>req.destroy(),50);
  req.on('response',()=>req.end());
});}
const worker=await startLocalWorker(8810),proxy=await startProxy(),rows=[];
try{
  const trace=async()=>{const s=await readFile(worker.folder+'/worker.log','utf8');return {entered:(s.match(/phase7_transport_app_enter/g)??[]).length,returned:(s.match(/phase7_transport_app_return/g)??[]).length};};
  for(const [target,kind]of [['direct','unfinished'],['proxy','unfinished'],['direct','finished-slow'],['proxy','finished-slow'],['proxy','aborted']]){
    const before=await trace(),result=await probe(target==='direct'?worker.origin:proxy.origin,kind);await pause(80);const after=await trace();
    const log=await readFile(worker.folder+'/worker.log','utf8'),returns=[...log.matchAll(/phase7_transport_app_return:(\d+):(\d+)/g)].slice(before.returned);
    rows.push({target,kind,...result,applicationEntries:after.entered-before.entered,applicationReturns:after.returned-before.returned,applicationReturnDetails:returns.map(v=>({httpStatus:Number(v[1]),handlerMs:Number(v[2])}))});
  }
  const start=performance.now(),internal=await fetch(worker.origin+'/__phase7/direct-reader',{method:'POST',headers:{Origin:proxy.origin,'X-Phase7':'local-synthetic-probe'}});await internal.arrayBuffer();
  assert.equal(internal.status,400);assert.equal(rows[1].httpStatus,400);assert.equal(rows[3].httpStatus,400);
  const sessionStatus=(await fetch(proxy.origin+'/api/session')).status;assert.equal(sessionStatus,401);
  const report={schema:'lava-phase7-transport-v1',manifest:worker.manifest,observations:rows,internalReader:{httpStatus:internal.status,elapsedMs:performance.now()-start},sessionStatus,
    priorPhase6ExternalStatus:500,currentExternalFailureRetained:rows[0].httpStatus!==400,
    mitigation:'Bounded 32KB/three-second ingress in isolated loopback proxy; not deployed or asserted to be Vercel/Cloudflare edge behavior',
    productionChanged:false,externalRuntimeFixed:false,platformServingPathTested:false};
  await publish('phase7-transport',report);console.log(JSON.stringify(report));
}finally{await proxy.close();worker.close();}
