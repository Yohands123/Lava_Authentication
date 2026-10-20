import { createServer } from 'node:http';
import { Readable } from 'node:stream';
// Local same-origin proxy analogue only. It accepts no configurable remote URL.
// Bounded ingress also tests a mitigation for the unfinished-stream dev bridge.
export async function startProxy(upstream='http://localhost:8810', port=8812) {
  if (upstream!=='http://localhost:8810'||port!==8812) throw new Error('Fixed loopback research routes required');
  const server=createServer(async(req,res)=>{
    if(req.headers.host!==`localhost:${port}`){res.writeHead(400);res.end();return;}
    try {
      const method=req.method??'GET',headers=new Headers();
      for(const [key,value]of Object.entries(req.headers))if(value&&!['host','connection','transfer-encoding','content-length','expect'].includes(key))headers.set(key,Array.isArray(value)?value.join(','):value);
      headers.set('X-Forwarded-Host',`localhost:${port}`);headers.set('X-Forwarded-Proto','http');
      let body;
      if(!['GET','HEAD'].includes(method))body=await new Promise((resolve,reject)=>{
        const chunks=[];let bytes=0,done=false;
        const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);if(error)reject(error);else resolve(Buffer.concat(chunks));};
        const timer=setTimeout(()=>finish(new Error('bounded_ingress_timeout')),3000);
        req.on('data',chunk=>{bytes+=chunk.length;if(bytes>32768)finish(new Error('bounded_ingress_size'));else if(!done)chunks.push(chunk);});
        req.on('end',()=>finish());req.on('aborted',()=>finish(new Error('bounded_ingress_abort')));req.on('error',finish);
      });
      // URL(path, base) would accept an attacker-supplied //remote host. Build
      // the fixed destination explicitly and reject ambiguous request targets.
      if(!req.url?.startsWith('/')||req.url.startsWith('//'))throw new Error('invalid_target');
      const response=await fetch(upstream+req.url,{method,headers,body,redirect:'manual',signal:AbortSignal.timeout(10000)});
      res.statusCode=response.status;
      for(const [key,value]of response.headers)if(!['set-cookie','content-length','content-encoding','transfer-encoding','connection'].includes(key))res.setHeader(key,value);
      if(response.headers.getSetCookie().length)res.setHeader('Set-Cookie',response.headers.getSetCookie());
      if(response.body)Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);else res.end();
    } catch(error) {
      if(!res.headersSent){res.writeHead(error.message.startsWith('bounded_')||error.message==='invalid_target'?400:502,{'Content-Type':'application/json','Cache-Control':'no-store',Connection:'close'});res.end(JSON.stringify({error:{code:'local_proxy_request_failed'}}));}
      else res.destroy();
      req.resume();
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {origin:`http://localhost:${port}`,close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
