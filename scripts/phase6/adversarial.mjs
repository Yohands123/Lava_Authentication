import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { startLocalWorker, publish } from './local-worker.mjs';
import { runtime } from './candidate.mjs';
import { cases } from './generators.mjs';
import { browserCase } from './browser-case.mjs';
import { apiCases } from './api-cases.mjs';
const recovery=process.argv.includes('--recovery'),unseen=process.argv.includes('--unseen-seed');
if(process.argv.slice(2).some(a=>!['--recovery','--unseen-seed'].includes(a))||recovery&&unseen)throw new Error('Only --recovery or --unseen-seed supported');
let previous=[];try{previous=JSON.parse(await readFile('ml/artifacts/phase6-adversarial.json','utf8')).runs??[];}catch(error){if(error.code!=='ENOENT')throw error;}
const seed=unseen?6102:6101;
const selected=recovery?cases.filter(t=>previous.some(r=>r.results.some(v=>v.outcome.reasonIncomplete==='harness_error'&&v.case===t.pattern+(t.mask?':'+t.mask:'')&&v.headless===t.headless))):unseen?cases.filter(t=>['adaptive','target-switching','corrections','timing-jitter'].includes(t.pattern)&&!t.mask&&t.headless):cases;
const rt=await runtime(),worker=await startLocalWorker(8806),privateFolder=`ml/private/phase6/runs/${worker.manifest.run}/exports`;
const run={...worker.manifest,schema:'lava-phase6-adversarial-run-v1',seed,recoveryOfFailedCases:recovery,results:[],externalVisionAgent:{status:'NOT_RUN_NO_LOCAL_AUTHORIZED_MODEL',adapter:'deterministic-scripted-fallback',externalCalls:0},actualHumanParticipants:0};
const checkpoint=async()=>{
  run.summary=rt.summarizeOutcomes(run.results.map(r=>r.outcome));
  await writeFile(worker.folder+'/checkpoint.json',JSON.stringify(run,null,2)+'\n');
  await publish('phase6-adversarial',{schema:'lava-phase6-adversarial-v1',runs:[...previous,run],humanAccuracy:null,classificationClaims:false});
};
try{
  await mkdir(privateFolder,{recursive:true});
  for(const test of selected){const row=await browserCase(worker,test,seed,rt,privateFolder);run.results.push(row);await checkpoint();console.log(JSON.stringify({case:row.case,headless:test.headless,...row.outcome}));}
  if(!recovery&&!unseen)run.results.push(...await apiCases(worker,rt));await checkpoint();
  if(run.results.some(r=>r.outcome.reasonIncomplete==='harness_error'))process.exitCode=1;
}catch(error){run.failure=error.message;process.exitCode=1;}
finally{await checkpoint();worker.close();console.log(JSON.stringify(run.summary));}
