import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import { build } from 'esbuild';
import { build as viteBuild } from 'vite';

export const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
export async function publish(name, value) {
  if (!/^phase6-[a-z-]+$/.test(name)) throw new Error('Fixed Phase 6 artifact name required');
  await mkdir('ml/artifacts',{recursive:true}); await mkdir('.cache/phase6/evidence',{recursive:true});
  const text = JSON.stringify(value,null,2)+'\n';
  await writeFile(`.cache/phase6/evidence/${hash(text)}.json`,text,{flag:'wx'}).catch(error => { if(error.code!=='EEXIST') throw error; });
  await writeFile(`ml/artifacts/${name}.json`,text);
}
export function quantiles(values) {
  const a=[...values].sort((a,b)=>a-b), q=p=>a[Math.floor((a.length-1)*p)]??null;
  return {n:a.length,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99)};
}
async function portFree(port) {
  return new Promise(resolve => { const socket=createConnection({host:'127.0.0.1',port}); socket.once('connect',()=>{socket.destroy();resolve(false);}); socket.once('error',()=>resolve(true)); });
}
export async function startLocalWorker(port, {shadow = false, metrics = false} = {}) {
  if (![8806,8807,8808,8809].includes(port) || !await portFree(port)) throw new Error('Dedicated test port unavailable; existing server left untouched');
  const id=randomUUID(), folder=resolve('.cache/phase6/run-'+id), origin=`http://localhost:${port}`;
  await mkdir(folder,{recursive:true});
  await viteBuild({logLevel:'error',build:{outDir:folder+'/assets',emptyOutDir:false}});
  await build({entryPoints:[shadow?'scripts/phase6/worker.ts':'src/worker/index.ts'],outfile:folder+'/worker.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:workers','node:*'],logLevel:'error'});
  const config=(await readFile('wrangler.toml','utf8')).replace('main = "src/worker/index.ts"','main = "./worker.mjs"').replace('directory = "./dist"','directory = "./assets"');
  await writeFile(folder+'/wrangler.toml',config);
  const manifest={run:id,origin,localOnly:true,workerSha256:hash(await readFile(folder+'/worker.mjs')),configSha256:hash(config),
    assetsSha256:hash(await readFile(folder+'/assets/index.html')),node:process.version,productionFlagsChanged:false};
  const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--config',folder+'/wrangler.toml',
    '--port',String(port),'--inspector-port',String(port+1000),'--persist-to',folder+'/state',
    '--var','ORIGIN:'+origin,'--var','LAVAGUARD_MODE:enforce','--var','LAVAGUARD_ML_MODE:shadow','--var','LAVAGUARD_EXPERIMENTAL_MODEL:0',
    '--var','LAVAGUARD_STEP_UP:off','--var','LAVAGUARD_LAB:1','--var','LAVAGUARD_METRICS:'+Number(metrics),
    '--var','LAVAGUARD_ADMIN_TOKEN:phase6-local-fixture-administrator-0000000000'],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
  const log=createWriteStream(folder+'/worker.log'); child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  let spawnError=null;child.on('error',error=>{spawnError=error;});
  const close=()=>{if(child.pid&&child.exitCode===null){try{if(process.platform==='win32')execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill('SIGTERM');}catch{}}log.end();};
  try {
    let ready=false,observedConfiguration=null;
    for(let i=0;i<100;i++){if(spawnError)throw spawnError;if(child.exitCode!==null)throw new Error('Isolated Worker exited; inspect ignored run log');
      try{const r=await fetch(origin+'/api/lavaguard/config',{signal:AbortSignal.timeout(1000)});if(r.ok){const c=await r.json();if(c.mode==='enforce'&&c.modelMode==='shadow'&&!c.experimentalModel){observedConfiguration=c;ready=true;break;}}}catch{}await pause(200);}
    if(!ready)throw new Error('Isolated Worker readiness timeout');
    manifest.observedConfiguration=observedConfiguration;
    await writeFile(folder+'/manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
    return {origin,folder,manifest,close,async storage(){const {DatabaseSync}=await import('node:sqlite');const counts={};
      for(const f of await readdir(folder+'/state',{recursive:true})){if(!f.endsWith('.sqlite'))continue;const db=new DatabaseSync(resolve(folder+'/state',f),{readOnly:true});
        for(const {name}of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('guard_attempts','guard_clearances','guard_history','guard_metrics','rate_window','sessions','credentials')").all())counts[name]=(counts[name]??0)+db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n;db.close();}return counts;},
      usage(){try {return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`$phase6WorkerPid=(Get-NetTCPConnection -State Listen -LocalPort ${port}|Select-Object -First 1).OwningProcess;Get-Process -Id $phase6WorkerPid|Select-Object CPU,WorkingSet64,PeakWorkingSet64|ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true}));}catch{return null;}}};
  }catch(error){close();throw error;}
}
