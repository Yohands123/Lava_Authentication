import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { publish, hash } from './local-worker.mjs';
const folder=resolve('.cache/phase6/verification-'+Date.now());await mkdir(folder,{recursive:true});
const root=process.cwd(),target=resolve('.wrangler/e2e');if(target!==root+'\\.wrangler\\e2e'&&target!==root+'/.wrangler/e2e')throw new Error('E2E cleanup target not verified');
const npm=resolve(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const checksOnly=process.argv.includes('--checks-only')||process.argv.includes('--phase6-only');if(process.argv.slice(2).some(v=>!['--checks-only','--phase6-only'].includes(v)))throw new Error('Only --checks-only or --phase6-only is supported');
const commands=checksOnly?(process.argv.includes('--phase6-only')?[['test:phase6']]:[['check']]):[['check'],['build','--','--outDir','.cache/phase6/verification-build'],['test:ml'],['test:research'],['test:environment'],['test:e2e'],['test:enforce'],['test:enforce','research'],['test:hardening'],['test:phase6'],['audit']];
const report=checksOnly?JSON.parse(await readFile('ml/artifacts/phase6-verification.json','utf8')):{schema:'lava-phase6-verification-v1',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirtyTreeExpected:true,localOnly:true,commands:[]};
if(checksOnly)for(const row of report.commands)if(!/test:(e2e|enforce|hardening|phase6)(?: |$)/.test(row.command))row.browserCases=0;
// Preserve historical artifacts and the exact current approved PNG bytes.
const preserve=['ml/artifacts/phase5-import-check.json','ml/artifacts/automation-environment-coverage.json',...['clear','flag','block'].flatMap(v=>[1440,390].map(w=>`docs/media/lavaguard/${v}-${w}.png`))];
const saved=new Map();for(const file of preserve)saved.set(file,await readFile(file));
for(const [index,entry]of commands.entries()){
  const research=entry[1]==='research',audit=entry[0]==='audit',args=audit?['audit','--audit-level=low']:['run',...entry.filter(v=>v!=='research')];
  const command='npm '+args.join(' ')+(research?' [LAVAGUARD_RESEARCH=1]':''),began=performance.now();let output='';
  console.log('Executing '+command);
  let timedOut=false;
  const code=await new Promise(resolve=>{const child=spawn(process.execPath,[npm,...args],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'1',FORCE_COLOR:'0',WRANGLER_SEND_METRICS:'false',...(research?{LAVAGUARD_RESEARCH:'1'}:{})}});
    child.stdout.on('data',v=>{output+=v;});child.stderr.on('data',v=>{output+=v;});child.on('error',()=>resolve(-1));
    const timer=setTimeout(()=>{timedOut=true;if(process.platform==='win32'){try{execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{}}else child.kill('SIGTERM');},600000);
    child.on('exit',code=>{clearTimeout(timer);resolve(code??-1);});});
  await writeFile(folder+`/${index}.log`,output);
  const item={command,exitCode:code,timedOut,durationMs:performance.now()-began,
    typescriptUnit:Number(output.match(/Tests\s+(\d+) passed/)?.[1]??0),consoleUnit:Number(output.match(/(?:ℹ|#)\s*pass\s+(\d+)/)?.[1]??0),
    pythonUnit:Number(output.match(/Ran (\d+) tests/)?.[1]??0),storageUnit:Number([...output.matchAll(/(?:ℹ|#)\s*pass\s+(\d+)/g)][1]?.[1]??0),browserCases:/test:(e2e|enforce|hardening|phase6)$/.test(entry[0])?Number(output.match(/(\d+) passed \(/)?.[1]??0):0,
    importerAssertions:Number(output.match(/"passed":(\d+)/)?.[1]??0),skipped:Number(output.match(/(\d+) skipped/)?.[1]??0),logSha256:hash(output)};
  if(checksOnly){report.supplementaryRuns=[...(report.supplementaryRuns??[]),item];const old=report.commands.findIndex(r=>r.command===item.command);if(old>=0)report.commands[old]=item;else report.commands.push(item);}else report.commands.push(item);console.log(JSON.stringify(item));
  if(entry[0]==='test:environment'){
    try{await writeFile('ml/artifacts/phase6-environment-coverage.json',await readFile('ml/artifacts/automation-environment-coverage.json'));}finally{await writeFile('ml/artifacts/automation-environment-coverage.json',saved.get('ml/artifacts/automation-environment-coverage.json'));}
  }
  for(const file of preserve)if(file!=='ml/artifacts/automation-environment-coverage.json')await writeFile(file,saved.get(file));
  await publish('phase6-verification',report);
  if(code!==0){process.exitCode=1;break;}
}
report.complete=report.commands.length===11&&report.commands.every(v=>v.exitCode===0);await publish('phase6-verification',report);
