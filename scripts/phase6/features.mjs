import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { runtime } from './candidate.mjs';
import { publish, hash } from './local-worker.mjs';
const rt=await runtime(),folder='ml/private/phase6',rows=[],audit={invalid:0,declaredBotExports:0,humanExportsNotImported:0};
let files=[];try{files=await readdir(folder+'/runs',{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
for(const file of files.filter(f=>f.replaceAll('\\','/').includes('/exports/')&&f.endsWith('.json')).sort()){
  const raw=JSON.parse(await readFile(folder+'/runs/'+file,'utf8')),checked=rt.validateResearchExport(raw);
  if(!checked.data){audit.invalid++;continue;}if(raw.label!=='automation-declared'){audit.humanExportsNotImported++;continue;}
  audit.declaredBotExports++;const derived=await rt.deriveStudyRecord(raw);
  rows.push({...derived,dynamic:{version:rt.DYNAMIC_VERSION,features:rt.dynamicResponse(raw.samples)},rawSamples:raw.samples});
}
const totals={},privateViews={},dynamic=[];
for(const row of rows){
  const baseline=row.dynamic.features;dynamic.push(baseline);
  privateViews[row.id]={lineage:row.generator.trajectory,variants:{}};
  for(const [name,v]of Object.entries(rt.researchVariants(row.rawSamples,6101))){
    const response=rt.dynamicResponse(v.samples),robust=rt.robustFeatures(v.samples),old=rt.experimentalFeatures(v.samples);
    const cell=totals[name]??={derivedViews:0,insufficientSamples:0,nonfinite:0,maxDynamicDelta:0,maxRobustDelta:0};cell.derivedViews++;
    cell.insufficientSamples+=Number(v.samples.length<12);cell.nonfinite+=Number(![...Object.values(response),...Object.values(robust),...Object.values(old)].every(Number.isFinite));
    cell.maxDynamicDelta=Math.max(cell.maxDynamicDelta,...rt.DYNAMIC_KEYS.map(k=>Math.abs(response[k]-baseline[k])));
    cell.maxRobustDelta=Math.max(cell.maxRobustDelta,...rt.ROBUST_KEYS.map(k=>Math.abs(robust[k]-row.robust.features[k])));
    privateViews[row.id].variants[name]={robust,responseV3:old,dynamic:response,insufficient:v.samples.length<12};
  }
}
await mkdir(folder,{recursive:true});
const records=rows.map(({rawSamples:_rawSamples,...row})=>JSON.stringify(row)).join('\n')+'\n',datasetHash=hash(records);
await writeFile(folder+'/records.jsonl',records);
await writeFile(folder+'/manifest.json',JSON.stringify({schema:'lava-phase6-bot-derived-v1',datasetHash,declaredAutomationOnly:true,records:rows.length,extraction:rt.DYNAMIC_VERSION},null,2)+'\n');
await writeFile(folder+'/perturbations.json',JSON.stringify({schema:'lava-phase6-private-views-v1',datasetHash,variants:privateViews})+'\n');
const report={schema:'lava-phase6-perturbations-v1',datasetHash,audit,originals:rows.length,eligibleOriginals:rows.filter(r=>r.quality.eligible).length,
  incompleteOriginals:rows.filter(r=>!r.quality.eligible).length,source:'Declared browser automation only; not application-human validation',featureSchema:rt.DYNAMIC_VERSION,
  variants:totals,targetObservedTraces:dynamic.filter(v=>v.targetCoverage>0).length,switchObservedTraces:dynamic.filter(v=>v.switchCount>0).length,
  dynamicSignalBenefit:null,empiricalHumanComparisons:'NOT_READY_NO_MATCHED_CONSENTING_HUMANS',
  limitations:['Derived views are not new participants or independent generators.','Nearest observed bubble targets are forgeable proxies, not intention or canvas attestation.','Physics seeds do not remove runtime scheduling variation.','Ring-normalized v4 reacquisition distance is not arbitrary-scale invariant.']};
await publish('phase6-perturbations',report);console.log(JSON.stringify(report));
