import { readFile, realpath, lstat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { importStudy } from '../study-import.mjs';
// Explicit local files only; validate-only is default and never imports silently.
const args=process.argv.slice(2),apply=args.includes('--apply'),files=args.filter(v=>v!=='--apply');
if(!files.length||files.length>64||files.some(v=>v.startsWith('--')))throw new Error('Explicit private exports required; optional --apply after study approval');
const root=resolve('ml/private'),folder=resolve('ml/private/phase7a');
for(const p of [root,folder,folder+'/exports',...['records.jsonl','manifest.json','last-import-audit.json'].flatMap(n=>[folder+'/'+n,folder+'/'+n+'.tmp'])]){
  try{if((await lstat(p)).isSymbolicLink())throw new Error('Private symlink refused');}catch(e){if(e.code!=='ENOENT')throw e;}
}
for(const file of files){const p=await realpath(file);if(!p.startsWith(root+sep)||(await lstat(file)).isSymbolicLink()||(await lstat(p)).size>8388608)throw new Error('Only bounded private opt-in export files are accepted');}
if(apply){const protocol=JSON.parse(await readFile('ml/study-protocol.json','utf8'));if(protocol.approvalStatus!=='OWNER_APPROVED')throw new Error('Study design approval pending; validation remains available');}
await build({entryPoints:['scripts/phase5-runtime.ts'],outfile:'.cache/phase7/import-runtime.mjs',bundle:true,platform:'node',format:'esm',logLevel:'error'});
const runtime=await import(pathToFileURL(resolve('.cache/phase7/import-runtime.mjs')).href);
const audit=await importStudy(files,runtime,{validateOnly:!apply,storageFolder:folder});
console.log(JSON.stringify(audit));if(audit.invalid)process.exitCode=1;
