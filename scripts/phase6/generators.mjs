import { generator, captureSettings, captureCases } from '../phase5-generators.mjs';
import { generate, random } from '../attacks.mjs';
export const cases=[...captureCases.map(pattern=>({pattern,headless:true})),
  ...['lognormal','noisy','stop-go','adaptive','target-switching','timing-jitter','cancel-race'].map(pattern=>({pattern,headless:true})),
  {pattern:'corrections',headless:false},{pattern:'puppeteer',headless:false},
  ...['webdriver-hidden','ua-hidden','all-hidden','unavailable','disagreement','human-takeover-declared'].map(mask=>({pattern:'corrections',headless:true,mask}))];
export function settingsFor(test,seed){
  const base=captureSettings(test.pattern,seed);
  return {...base,revision:'phase6-generators-v1',seed,physicsSeed:seed+77,
    // Corrections variants, masks and browser modes remain the same family/lineage.
    family:test.pattern==='timing-jitter'?'corrections':base.family,
    lineage:test.pattern==='timing-jitter'?captureSettings('corrections',seed).lineage:base.lineage};
}
export async function makeAgent(test,seed){
  const base=await generator(test.pattern==='timing-jitter'?'corrections':test.pattern,seed),rng=random(seed),lognormal=generate('lognormal',seed,180);
  let previous={x:.5,y:.5},step=0;
  return {kind:'deterministic-scripted-fallback',externalAgentCalled:false,async next(target){
    const index=step++;let p=base(index,target);
    if(test.pattern==='lognormal')p={...lognormal[index%lognormal.length],wait:10+Math.floor(rng()*20)};
    if(test.pattern==='noisy')p={x:.5+.4*Math.cos(index*.2)+(rng()-.5)*.12,y:.5+.4*Math.sin(index*.2)+(rng()-.5)*.12,wait:16};
    if(test.pattern==='stop-go')p={...p,wait:index%17===0?200:12};
    if(['adaptive','target-switching'].includes(test.pattern)&&Number.isFinite(target?.x)&&Number.isFinite(target?.y)){
      const mix=test.pattern==='adaptive'?.5:.85,dx=target.x-.5,dy=target.y-.5,d=Math.max(.05,Math.hypot(dx,dy));
      p={x:previous.x+(target.x+.13*dx/d-previous.x)*mix,y:previous.y+(target.y+.13*dy/d-previous.y)*mix,wait:12+Math.floor(rng()*20)};
    }
    if(test.pattern==='timing-jitter')p.wait=5+Math.floor(rng()*55);
    previous=p;return p;
  }};
}
