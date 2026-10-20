import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { hash } from './local-worker.mjs';
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const checks=await json('ml/artifacts/phase7-verification.json'),study=await json('ml/artifacts/phase7a-readiness.json'),load=await json('ml/artifacts/phase7-local-load.json'),shards=await json('ml/artifacts/phase7-sharding.json'),transport=await json('ml/artifacts/phase7-transport.json');
assert.ok(checks.complete&&checks.commands.length===12&&checks.commands.every(c=>c.exitCode===0),'Finish actual verification first');
assert.equal(study.genuineHumanParticipants,0);assert.equal(study.humanFalseFlagRate,null);
const privateHash=hash(await readFile('ml/private/phase5/records.jsonl'));
assert.equal(privateHash,'b384bc4f27a9dc321f8b29f0d62ecc827e0fbad497aad2b6699b4cd44c9b0425');
const initial=await json('.cache/phase7/baseline.json');
const protectedFiles=Object.keys(initial).filter(f=>['wrangler.toml','package-lock.json','src/worker/index.ts'].includes(f)||/^src\/(?:worker\/(?:routes|durable|entropy|lib)\/|client\/(?:lamp|stir|entropy|auth)\/)/.test(f)||f.startsWith('docs/media/'));
for(const file of protectedFiles)assert.equal(hash(await readFile(file)),initial[file],`Original protected file changed: ${file}`);
const tests=checks.commands.reduce((a,c)=>({typescript:a.typescript+c.typescriptUnit,node:a.node+c.consoleUnit+c.storageUnit,python:a.python+c.pythonUnit,browser:a.browser+c.browserCases,importer:a.importer+c.importerAssertions}),{typescript:0,node:0,python:0,browser:0,importer:0});
const optional=async file=>{try{return await json(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}};
const publication=await optional('.cache/phase7/lavaguard-phase7-pr.json');
const baseline=await json('.cache/phase7/lavaguard-phase5-pr.json');
const codeFiles=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(f=>f&&(/^(src|tests|scripts)\//.test(f)||/^ml\/[^/]+\.py$/.test(f)||/^(package\.json|tsconfig.*\.json|playwright.*\.ts|index\.html|ml\/study-protocol\.json)$/.test(f)));
const sourceSnapshot=hash(Object.fromEntries(await Promise.all(codeFiles.sort().map(async f=>[f,hash(await readFile(f))]))));
const report={schema:'lava-phase7-readiness-v1',engineering:'LOCAL_ENGINEERING_REVIEWABLE_WITH_RECORDED_LIMITATIONS',study:study.status,
  genuineHumanParticipants:0,humanFalseFlagRate:null,applicationAccuracy:null,finalStudyEvaluationPerformed:false,productionModelEligible:false,
  latestDistinctTests:tests,totalDistinctTests:tests.typescript+tests.node+tests.python+tests.browser,measuredBrowserConfigurations:10,
  sourceSnapshotSha256:sourceSnapshot,phase5PrivateDatasetPreserved:true,phase5PrivateDatasetHash:privateHash,protectedOriginalFilesVerified:protectedFiles.length,
  baselinePullRequest:baseline.url,phase7PullRequest:publication?.url??null,engineeringCommitAtPrCreation:publication?.head??null,
  phase7Branch:'feature/lavaguard-phase7',phase7PrBase:'feature/lavaguard-phase5',baselinePrBase:'main',merged:false,deployed:false,productionFlagsUnchanged:true,
  vercelProjectCreated:false,vercelPreview:null,functionalVercelAuthTested:false,cloudflareDeployment:false,remoteMonitoring:false,moneySpent:false,
  localLoadLevels:load.phases.length,mainLoadUnexpected5xx:load.phases.reduce((n,p)=>n+p.issuance.unexpected5xx+p.evaluation.unexpected5xx,0),
  localShardingConfigurations:shards.measurements.length,localBoundedIngressStatus:transport.observations[1].httpStatus,upstreamRuntimeFixed:false,
  actualEdgeCpu:null,capacity10kUsers:null,capacity100kUsers:null,
  releaseDecision:'NO_GO_FOR_DEPLOYMENT_PRODUCTION_ML_OR_STORAGE_CUTOVER',
  blockedOn:['Owner/applicable ethics approval and actual consenting supervised participants','Independent security/privacy/usability/generalization review','Physical assistive/touch/pen/takeover and real hardware authenticator trials','Scalable authority directory, global budgets and actual edge/serving-path validation','Separate explicit merge/hosting/domain/RP/backend/budget/deployment decisions']};
await writeFile('ml/artifacts/phase7-readiness.json',JSON.stringify(report,null,2)+'\n');
const table='\n| Command | Actual result | Counts / scope |\n| --- | --- | --- |\n'+checks.commands.map(c=>`| \`${c.command}\` | PASS (${(c.durationMs/1000).toFixed(1)} s) | ${c.typescriptUnit?`${c.typescriptUnit} TS + ${c.consoleUnit+c.storageUnit} Node`:c.pythonUnit?`${c.pythonUnit} Python`:c.browserCases?`${c.browserCases} browser`:c.importerAssertions?`${c.importerAssertions} importer assertions`:c.command.includes('test:environment')?'10 browser configurations':c.command.includes('audit')?'zero vulnerabilities':'isolated build'} |`).join('\n')+`\n\n**${report.totalDistinctTests} distinct unit/integration/browser tests**; ${tests.importer} importer assertions and 10 browser configuration probes are additional. Focused replacement runs do not inflate the total.\n`;
const statuses=[['Local tests','DONE',`${report.totalDistinctTests} distinct passing tests`],['Failed-sign-in UX','DONE','Current permission/retry/Back; mandatory WebAuthn'],['Phase 7 local commit',publication?'DONE':'NOT DONE',publication?.head??'Publication pending'],['Phase 7 branch push',publication?'DONE':'NOT DONE','feature/lavaguard-phase7'],['Phase 7 pull request',publication?'DONE':'NOT DONE',publication?`[PR #${publication.number}](${publication.url}) into feature/lavaguard-phase5`:'Pending'],['Merge to main','NOT DONE','Explicitly excluded; baseline PR #3 remains open'],['Vercel project','NOT DONE','Read-only matching lookup returned zero; none created'],['Vercel preview','NOT DONE','No deployment authorized'],['Functional sign-in on Vercel','NOT TESTED','Local same-origin analogue passed; no real preview/hardware trial'],['Cloudflare backend deployment','NOT DONE','Explicitly excluded'],['Production ML-off verification','DONE','Original config/source hashes preserved'],['Phase 7A study/data readiness','BLOCKED','Engineering implemented; genuine human corpus empty, approval/review pending'],['Phase 7B scaling readiness','BLOCKED','Local prototypes/load done; authority/global budgets/ingress/edge remain unresolved']];
const statusTable='\n| Item | Status | Evidence / limitation |\n| --- | --- | --- |\n'+statuses.map(v=>'| '+v.join(' | ')+' |').join('\n')+'\n';
const changed=execFileSync('git',['diff','--name-only','3e87aae5733702187f2834a28064138ed0ce5283','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const inventory='\n'+[...new Set([...changed,...untracked])].sort().map(f=>`- [${f}](../${f})`).join('\n')+'\n';
const file='docs/LAVAGUARD_PHASE7_HANDOFF.md',body=await readFile(file,'utf8');
await writeFile(file,body.replace(/<!-- PHASE7_TESTS_START -->[\s\S]*?<!-- PHASE7_TESTS_END -->/,'<!-- PHASE7_TESTS_START -->'+table+'<!-- PHASE7_TESTS_END -->').replace(/<!-- PHASE7_STATUS_START -->[\s\S]*?<!-- PHASE7_STATUS_END -->/,'<!-- PHASE7_STATUS_START -->'+statusTable+'<!-- PHASE7_STATUS_END -->').replace(/<!-- PHASE7_FILES_START -->[\s\S]*?<!-- PHASE7_FILES_END -->/,'<!-- PHASE7_FILES_START -->'+inventory+'<!-- PHASE7_FILES_END -->'));
const loadTable='\n| Concurrency | Issues 200/actual | Issue 503 | Eval 200/actual | Eval 503 / skipped | Accepted issue/eval p95 ms |\n| --- | --- | --- | --- | --- | --- |\n'+load.phases.map(p=>`| ${p.concurrency} | ${p.issuance.accepted}/${p.issuance.actualRequests} | ${p.issuance.rejected503} | ${p.evaluation.accepted}/${p.evaluation.actualRequests} | ${p.evaluation.rejected503} / ${p.evaluation.skipped} | ${p.issuance.latencyAccepted.p95Ms.toFixed(2)} / ${p.evaluation.latencyAccepted.p95Ms.toFixed(2)} |`).join('\n')+'\n';
const scaling='docs/LAVAGUARD_PHASE7B_SCALING_RESULTS.md';await writeFile(scaling,(await readFile(scaling,'utf8')).replace(/<!-- PHASE7_LOAD_START -->[\s\S]*?<!-- PHASE7_LOAD_END -->/,'<!-- PHASE7_LOAD_START -->'+loadTable+'<!-- PHASE7_LOAD_END -->'));
// Standalone local aggregate review, no server, scripts, remote assets or raw data.
await mkdir('.cache/phase7',{recursive:true});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await writeFile('.cache/phase7/study-readiness.html',`<!doctype html><meta charset="utf-8"><title>LavaGuard study readiness</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font:18px system-ui;max-width:70ch;margin:3rem auto;padding:1rem;background:#10101a;color:#eee}td,th{padding:.6rem;text-align:left;border-bottom:1px solid #777}</style><h1>Study readiness</h1><p>${escape(study.status)}. Zero human participants. Accuracy and FPR unavailable.</p><table><tr><th>Gate</th><th>Status</th></tr>${statuses.map(v=>'<tr><td>'+escape(v[0])+'</td><td>'+escape(v[1])+'</td></tr>').join('')}</table><p>Synthetic fixtures and local capacity measurements are not human or cloud validation.</p>`);
console.log(JSON.stringify(report));
