import { readFile, writeFile, rename } from 'node:fs/promises';
import { runtime, writeSyntheticRegistry } from './candidate.mjs';
import { readRegistrySnapshot } from './registry-store.mjs';
const rt=await runtime(), {pin}=await writeSyntheticRegistry(rt);
if(process.argv[2]==='--revoke'){
  const digest=process.argv[3];if(!/^[a-f0-9]{64}$/.test(digest??''))throw new Error('Explicit candidate hash required');
  const file='ml/private/phase6/registry/revocations.json',ledger=JSON.parse(await readFile(file,'utf8'));
  if(ledger.schema!=='lava-candidate-revocations-v1'||!Array.isArray(ledger.revokedCandidateHashes))throw new Error('Unknown ledger');
  ledger.revokedCandidateHashes=[...new Set([...ledger.revokedCandidateHashes,digest])].sort();
  await writeFile(file+'.tmp',JSON.stringify(ledger)+'\n');await rename(file+'.tmp',file);
}else if(process.argv.length>2)throw new Error('Only optional --revoke HASH is supported');
const snapshot=await readRegistrySnapshot(pin);
console.log(JSON.stringify({syntheticOnly:true,candidateHash:pin.sha256,version:pin.version,revocationState:snapshot.revocationState,
  revoked:snapshot.revokedCandidateHashes.includes(pin.sha256),productionInfluence:false,automaticSelection:false}));
