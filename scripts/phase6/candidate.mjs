import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { execFileSync } from 'node:child_process';
export async function runtime() {
  await build({configFile:false,logLevel:'error',build:{outDir:'.cache/phase6/runtime',emptyOutDir:false,lib:{entry:'scripts/phase6/runtime.ts',formats:['es'],fileName:()=> 'runtime.mjs'}}});
  return import(pathToFileURL(resolve('.cache/phase6/runtime/runtime.mjs')).href+'?revision='+Date.now());
}
export function syntheticCandidate(fixture) {
  if(!fixture.syntheticOnly||!fixture.notStudyEvidence)throw new Error('Explicit synthetic fixture required');
  return {schema:'lava-observation-candidate-v1',authority:'APPROVED_FOR_OBSERVATION_ONLY',syntheticOnly:true,model:fixture.model,
    datasetHash:fixture.model.datasetHash,cohortManifestHash:fixture.model.splitHash,
    provenance:{extraction:'lava-robust-v2',calibration:'separate-development-calibration',threshold:'frozen-before-evaluation',trainingEnvironment:'Python synthetic golden fixture; no application validation',review:'owner-authorized local engineering fixture only'}};
}
export async function writeSyntheticRegistry(rt) {
  const fixture=JSON.parse(await readFile('tests/fixtures/phase5-portable.json','utf8')), candidate=syntheticCandidate(fixture), sha256=await rt.candidateHash(candidate);
  await mkdir('ml/private/phase6/registry',{recursive:true});
  const file=`ml/private/phase6/registry/${sha256}.json`, text=rt.canonicalCandidate(candidate)+'\n';
  try{await writeFile(file,text,{flag:'wx'});}catch(error){if(error.code!=='EEXIST'||await readFile(file,'utf8')!==text)throw error;}
  await writeFile('ml/private/phase6/registry/revocations.json',JSON.stringify({schema:'lava-candidate-revocations-v1',revokedCandidateHashes:[]})+'\n',{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
  // Reproduce the known fixture's actual cohort manifest, never train/select.
  execFileSync(process.execPath,['scripts/python-local.mjs','ml/phase6.py','--registry-metadata-only'],{stdio:'pipe',windowsHide:true});
  // Review pins are explicit inputs; there is deliberately no newest-model index.
  return {fixture,candidate,pin:{version:candidate.model.version,sha256}};
}
