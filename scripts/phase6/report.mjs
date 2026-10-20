import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { runtime } from './candidate.mjs';
import { hash, publish } from './local-worker.mjs';
const rt=await runtime(),json=async file=>JSON.parse(await readFile(file,'utf8'));
const baseline=await json('.cache/phase6/baseline.json'),verification=await json('ml/artifacts/phase6-verification.json');
const experiments=await json('ml/artifacts/phase6-adversarial.json'),ml=await json('ml/artifacts/phase6-ml.json'),features=await json('ml/artifacts/phase6-perturbations.json'),load=await json('ml/artifacts/phase6-local-load.json');
assert.equal(hash(await readFile('ml/private/phase5/records.jsonl')),ml.application.datasetHash);
const outcomes=experiments.runs.flatMap(r=>r.results.map(v=>v.outcome));assert.ok(outcomes.every(rt.validOutcome));
assert.ok(verification.complete&&verification.commands.every(c=>c.exitCode===0),'Finish successful verification first');
const tests=verification.commands.reduce((a,c)=>({typescript:a.typescript+c.typescriptUnit,nodeConsole:a.nodeConsole+c.consoleUnit,nodeStorage:a.nodeStorage+(c.storageUnit??0),python:a.python+c.pythonUnit,browser:a.browser+c.browserCases,importer:a.importer+c.importerAssertions}),{typescript:0,nodeConsole:0,nodeStorage:0,python:0,browser:0,importer:0});
const protectedFiles=Object.keys(baseline.files).filter(f=>f==='wrangler.toml'||f==='package-lock.json'||f==='src/worker/index.ts'||/^src\/(?:client\/(?:lamp|stir|ui)\/|worker\/(?:routes|durable|entropy|lib)\/)/.test(f)||f.startsWith('docs/media/'));
const protectedHistory=Object.keys(baseline.files).filter(f=>/^ml\/artifacts\/(?:phase[45]-|automation-environment-|local-testing-)/.test(f));
for(const f of [...protectedFiles,...protectedHistory])assert.equal(hash(await readFile(f)),baseline.files[f],`Protected pre-existing file changed: ${f}`);
const readiness={schema:'lava-phase6-readiness-v1',engineering:'ENGINEERING_READY_FOR_REVIEW_WITH_LOCAL_LIMITATIONS',humanStudy:ml.application.status,
  modelProductionEligibility:false,shadowOnly:true,productionDeployed:false,productionFlagsUnchanged:true,productionAuthUiFilesPreserved:protectedFiles.length,historicalArtifactsPreserved:protectedHistory.length,
  humanParticipants:ml.application.independentlyVettedHumanParticipants,declaredHumanAttempts:ml.application.declaredHumanAttempts,
  phase5DatasetPreserved:true,phase5DatasetHash:ml.application.datasetHash,phase6BotExports:features.audit.declaredBotExports,phase6Eligible:features.eligibleOriginals,phase6Incomplete:features.incompleteOriginals,
  adversarial:rt.summarizeOutcomes(outcomes),actualTests:tests,unitIntegrationBrowserTests:tests.typescript+tests.nodeConsole+tests.nodeStorage+tests.python+tests.browser,
  environmentProbes:(await json('ml/artifacts/phase6-environment-coverage.json')).summary.measured,loadLevels:load.phases.length,
  knownLocalFailure:'External unfinished chunked stream receives development bridge HTTP 500; actual Worker reader timed out safely with 400',
  externalModelCalls:0,actualEdgeCpuMs:null,capacity10k:null,capacity100k:null,applicationAccuracy:null,shardingCutover:false,
  committed:false,pushed:false,deployed:false,remoteMonitoringStarted:false,spentMoney:false,
  blockedOn:['Prospective consenting independent human participants and matched accessibility/device study','Independently supervised agent/generalization and security evaluation','Untouched application cohorts and justified calibration','Actual edge/DO capacity and external slow-client serving path validation','Owner approval for staging, credentials/spend, production or storage migration'],
  releaseDecision:'NO_GO_FOR_STAGING_OR_PRODUCTION_WITHOUT_REQUIRED_EVIDENCE_AND_OWNER_APPROVAL'};
await publish('phase6-readiness',readiness);
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const changed=[];for(const f of files)if(!baseline.files[f]||hash(await readFile(f))!==baseline.files[f])changed.push({file:f,change:baseline.files[f]?'Modified existing local file':'Added in Phase 6'});
const inventory='\n| File | Phase 6 change |\n| --- | --- |\n'+changed.sort((a,b)=>a.file.localeCompare(b.file)).map(v=>`| [${v.file}](../${v.file}) | ${v.change} |`).join('\n')+'\n';
const handoff='docs/LAVAGUARD_PHASE6_HANDOFF.md',body=await readFile(handoff,'utf8');
const testTable='\n| Command | Result | Counts / scope |\n| --- | --- | --- |\n'+verification.commands.map(c=>`| \`${c.command}\` | ${c.exitCode===0?'PASS':'FAIL'}; ${c.skipped} skipped | ${c.typescriptUnit?c.typescriptUnit+' TS + '+c.consoleUnit+' console + '+(c.storageUnit??0)+' storage tests':c.pythonUnit?c.pythonUnit+' Python tests':c.browserCases?c.browserCases+' browser cases':c.importerAssertions?c.importerAssertions+' importer assertions':c.command.includes('test:environment')?'10 controlled browser probes':c.command.includes('audit')?'No vulnerabilities at low-or-higher audit threshold':'Isolated production build'} |`).join('\n')+'\n\nTotal distinct unit/integration/browser tests: **'+readiness.unitIntegrationBrowserTests+'**; importer checks and environment probes are additional. Counts exclude repeated verification runs.\n';
await writeFile(handoff,body.replace(/<!-- PHASE6_FILES_START -->[\s\S]*?<!-- PHASE6_FILES_END -->/,'<!-- PHASE6_FILES_START -->'+inventory+'<!-- PHASE6_FILES_END -->').replace(/<!-- PHASE6_TESTS_START -->[\s\S]*?<!-- PHASE6_TESTS_END -->/,'<!-- PHASE6_TESTS_START -->'+testTable+'<!-- PHASE6_TESTS_END -->'));
console.log(JSON.stringify(readiness));
