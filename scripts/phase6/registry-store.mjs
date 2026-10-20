import { readFile, lstat, realpath, access } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { createHash } from 'node:crypto';
/** Private files only; no discovery, network or automatic approval. */
export async function readRegistrySnapshot(pin, privateRoot=resolve('ml/private')) {
  const folder=resolve(privateRoot,'phase6/registry');
  if(!pin||!/^[a-f0-9]{64}$/.test(pin.sha256))return {candidate:null,revocationState:'unavailable',revokedCandidateHashes:[],withdrawnDatasetHashes:[]};
  const file=resolve(folder,pin.sha256+'.json');
  try {
    const info=await lstat(file),inside=relative(await realpath(privateRoot),await realpath(file));
    if((await lstat(privateRoot)).isSymbolicLink()||info.isSymbolicLink()||inside.startsWith('..'+sep)||isAbsolute(inside)||!info.isFile()||info.size>65536)throw new Error('Candidate exceeds private path/size bound');
    const candidate=JSON.parse(await readFile(file,'utf8'));
    if(candidate.cohortManifestHash!==undefined){
      if(!/^[a-f0-9]{64}$/.test(candidate.cohortManifestHash))throw new Error('Invalid cohort pin');
      const cohortFile=resolve(folder,'cohorts-'+candidate.cohortManifestHash+'.json'),cohortStat=await lstat(cohortFile);
      const relation=relative(await realpath(privateRoot),await realpath(cohortFile));
      if(cohortStat.isSymbolicLink()||cohortStat.size>2000000||relation.startsWith('..'+sep)||isAbsolute(relation))throw new Error('Invalid cohort file boundary');
      const cohorts=JSON.parse(await readFile(cohortFile,'utf8'));
      const canonical=JSON.stringify(cohorts,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
      if(cohorts.schema!=='lava-cohorts-v3'||createHash('sha256').update(canonical).digest('hex')!==candidate.cohortManifestHash)throw new Error('Cohort manifest not pinned');
    }
    const revocations=JSON.parse(await readFile(folder+'/revocations.json','utf8'));
    if(revocations.schema!=='lava-candidate-revocations-v1'||!Array.isArray(revocations.revokedCandidateHashes)||revocations.revokedCandidateHashes.some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))throw new Error('Unknown candidate revocations');
    // Missing candidate after withdrawal is an abstention, never stale cached use.
    await access(file);
    let ledger={revokedDatasetHashes:[]};
    try {ledger=JSON.parse(await readFile(resolve(privateRoot,'phase5/withdrawals.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    if(!Array.isArray(ledger.revokedDatasetHashes)||ledger.revokedDatasetHashes.some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))throw new Error('Unknown withdrawal state');
    return {candidate,revocationState:'current',revokedCandidateHashes:revocations.revokedCandidateHashes,withdrawnDatasetHashes:ledger.revokedDatasetHashes};
  }catch{return {candidate:null,revocationState:'unavailable',revokedCandidateHashes:[],withdrawnDatasetHashes:[]};}
}
