import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const origin='http://localhost:8789';
let cookie;
async function issue() {
  const r=await fetch(origin+'/api/lavaguard/challenge',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.221',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({kind:'accessible'})});
  cookie=r.headers.get('set-cookie')?.split(';')[0]??cookie;
  await r.arrayBuffer(); return r.status;
}
const before=[];
for(let i=0;i<9;i++) before.push(await issue());
assert.deepEqual(before,[200,200,200,200,200,200,200,200,429]);
console.log('Rate window reached its real Worker limit; waiting for expiry/cleanup.');
for(let i=0;i<2;i++) await new Promise(resolve=>setTimeout(resolve,31000));
const after=await issue(); assert.equal(after,200);
await writeFile('ml/artifacts/phase4-rate-expiry.json',JSON.stringify({actualLocalWorker:true,initialStatuses:before,waitMs:62000,afterExpiryStatus:after,sessionStatus:(await fetch(origin+'/api/session')).status},null,2)+'\n');
console.log('Actual Worker rate-window expiry/recovery passed.');
