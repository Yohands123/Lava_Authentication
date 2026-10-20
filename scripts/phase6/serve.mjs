import { startLocalWorker } from './local-worker.mjs';
const worker=await startLocalWorker(8809,{shadow:true});
console.log('Phase 6 isolated browser Worker ready');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{worker.close();process.exit(0);});
await new Promise(()=>{});
