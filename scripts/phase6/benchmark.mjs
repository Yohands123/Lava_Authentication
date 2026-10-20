import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { build } from 'vite';
import { chromium } from '@playwright/test';
import { runtime, writeSyntheticRegistry } from './candidate.mjs';
import { readRegistrySnapshot } from './registry-store.mjs';
import { startLocalWorker, publish, quantiles } from './local-worker.mjs';
const rt=await runtime(),{fixture,candidate,pin}=await writeSyntheticRegistry(rt),snapshot=await readRegistrySnapshot(pin);
assert.equal(snapshot.revocationState,'current');assert.ok(!snapshot.revokedCandidateHashes.includes(pin.sha256));
const context={mode:'shadow',device:'mouse',datasetHash:candidate.datasetHash,datasetState:'current',...snapshot};delete context.candidate;
const beganPrepare=performance.now(),registry=new rt.ObservationRegistry('shadow');await registry.load(candidate,pin);const registryPreparationMs=performance.now()-beganPrepare;
const vector=fixture.vectors[0].features,prepared=rt.preparePortableModel(fixture.model);
for(const v of fixture.vectors)assert.ok(Math.abs(registry.score(v.features,context).riskScore-v.expectedRisk)<1e-12);
const points=Array.from({length:1024},(_,i)=>({x:.5+.3*Math.cos(i*.13),y:.5+.3*Math.sin(i*.17),t:45+i*32+i%5,targetX:.5+.2*Math.cos(i*.11),targetY:.5+.2*Math.sin(i*.09),targetId:Math.floor(i/100),bubbleCount:Math.max(0,12-Math.floor(i/100))}));
function time(fn,n){for(let i=0;i<100;i++)fn();const values=[];for(let i=0;i<n;i++){const t=performance.now();fn();values.push(performance.now()-t);}return {...quantiles(values),rawMs:values};}
const before=process.memoryUsage(),cpu=process.cpuUsage();
const node={node:process.version,platform:process.platform,registryPreparationMs,
  validatedEachCall:time(()=>rt.estimatePortableRisk(fixture.model,vector,context),5000),portablePrepared:time(()=>prepared(vector,context),5000),registryPrepared:time(()=>registry.score(vector,context),5000),
  off:time(()=>registry.score(vector,{...context,mode:'off'}),5000),unsupported:time(()=>registry.score(vector,{...context,device:'assisted'}),2000),
  max1024:{v1:time(()=>rt.extractFeatures(points),100),robust:time(()=>rt.robustFeatures(points),100),responseV3:time(()=>rt.experimentalFeatures(points),100),dynamicV4:time(()=>rt.dynamicResponse(points),100)},
  processBefore:before,processAfter:process.memoryUsage(),aggregateCpuMicros:process.cpuUsage(cpu),modelBytes:Buffer.byteLength(JSON.stringify(fixture.model)),candidateBytes:Buffer.byteLength(JSON.stringify(candidate))};
await writeFile('.cache/phase6/node-benchmark-raw.json',JSON.stringify(node)+'\n');
function compact(v){if(Array.isArray(v))return v.map(compact);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>k!=='rawMs').map(([k,x])=>[k,compact(x)]));return v;}
await build({configFile:false,logLevel:'error',build:{outDir:'.cache/phase6/runtime',emptyOutDir:false,lib:{entry:'src/shared/observation-registry.ts',formats:['es'],fileName:()=> 'registry-only.mjs'}}});
node.registryBundleBytes=(await stat('.cache/phase6/runtime/registry-only.mjs')).size;
const worker=await startLocalWorker(8808,{shadow:true});let workerd,browserFeatures;
try{
  const headers={Origin:worker.origin,'X-Phase6':'synthetic-local-experiment','Content-Type':'application/json'};
  const post=async data=>{const start=performance.now(),r=await fetch(worker.origin+'/__phase6/score',{method:'POST',headers,body:JSON.stringify(data),signal:AbortSignal.timeout(8000)});assert.equal(r.status,200);const value=await r.json();return {httpWallMs:performance.now()-start,data:value};};
  const first=await post({mode:'shadow',input:'golden'});assert.ok(Math.abs(first.data.result.riskScore-fixture.vectors[0].expectedRisk)<1e-12);
  const before=worker.usage(),batches=[];
  for(const method of ['parse-each-call','prepared'])for(const mode of ['off','shadow']){
    const rows=[];for(let i=0;i<30;i++){const r=await post({mode,input:'golden',method,iterations:1000});rows.push(r);assert.equal(r.data.policyInfluence,false);}
    batches.push({method,mode,iterationsPerRequest:1000,http:quantiles(rows.map(r=>r.httpWallMs)),workerReportedWall:quantiles(rows.map(r=>r.data.elapsedWallMs)),observedNonzeroWorkerTimers:rows.filter(r=>r.data.elapsedWallMs>0).length});
    await writeFile(`.cache/phase6/workerd-${method}-${mode}-raw.json`,JSON.stringify(rows)+'\n');
  }
  const fallbacks={};for(const input of ['ood','unsupported','missing','revoked','withdrawn','unavailable','throw','stall']){
    const r=await post({mode:'shadow',input});assert.equal(r.data.result.riskScore,null);fallbacks[input]=r.data.result.reasons;
  }
  workerd={manifest:worker.manifest,coldRequestWallMs:first.httpWallMs,coldPreparationReportedWallMs:first.data.preparationWallMs,batches,fallbacks,hostProcessBefore:before,hostProcessAfter:worker.usage(),actualEdgeCpuMs:null,
    timerCaveat:'workerd timers may be frozen/quantized during CPU work; zero means unresolved, not zero CPU. HTTP includes IPC and wrapper overhead. Host CPU is aggregate process CPU.'};
}finally{worker.close();}
// Actual browser extraction, isolated loopback page, no visitor observations.
const bundle=await readFile('.cache/phase6/runtime/runtime.mjs'),server=createServer((req,res)=>{
  if(req.method!=='GET'||req.headers.host!==`127.0.0.1:${server.address().port}`){res.writeHead(403).end();return;}
  if(req.url==='/runtime.mjs'){res.setHeader('Content-Type','text/javascript');res.end(bundle);return;}
  if(req.url!=='/'){res.writeHead(404).end();return;}
  res.setHeader('Content-Type','text/html');res.end('<title>Local extraction benchmark</title><script type="module">import * as runtime from "/runtime.mjs";window.phase6Runtime=runtime;</script>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch();
try{
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.phase6Runtime);
  browserFeatures=await page.evaluate(points=>{
    const runtime=window.phase6Runtime,out={};
    for(const [name,fn]of Object.entries({v1:runtime.extractFeatures,robust:runtime.robustFeatures,responseV3:runtime.experimentalFeatures,dynamicV4:runtime.dynamicResponse})){
      const values=[];for(let i=0;i<120;i++){const start=performance.now();fn(points);values.push(performance.now()-start);}values.sort((a,b)=>a-b);out[name]={n:values.length,p50Ms:values[60],p95Ms:values[114],p99Ms:values[118]};
    }return out;
  },points);
  assert.deepEqual(await page.evaluate(p=>window.phase6Runtime.dynamicResponse(p),points),rt.dynamicResponse(points));
  browserFeatures={browserBuild:browser.version(),samples:1024,measurements:browserFeatures,dynamicParity:true,syntheticOnly:true};
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
const report={schema:'lava-phase6-inference-performance-v1',syntheticOnly:true,notStudyEvidence:true,candidateHash:pin.sha256,node:compact(node),workerd,browserFeatures,
  limitations:['Local Node, browser and workerd are different measurements, not Cloudflare edge CPU or capacity.','Heap deltas include GC/noise and are not allocation-per-inference or native peak guarantees.','No empirical application model or accuracy comparison.','Prepared scoring remains linear in a fixed at-most-28-feature vector; not a cryptographic constant-time guarantee.']};
await publish('phase6-inference-performance',report);console.log(JSON.stringify({node:compact(node.registryPrepared),workerdBatches:workerd.batches,browserFeatures}));
