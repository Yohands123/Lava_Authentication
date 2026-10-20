import { startLocalWorker } from './local-worker.mjs';
import { startProxy } from './proxy.mjs';
const worker=await startLocalWorker(8810,{metrics:true});
let proxy;
try { proxy=await startProxy(); } catch(error) {worker.close();throw error;}
let closing=false;
const close=async()=>{if(closing)return;closing=true;await proxy.close();worker.close();process.exit();};
process.on('SIGINT',close);process.on('SIGTERM',close);
console.log('Isolated Phase 7 proxy and Worker ready on loopback only');
