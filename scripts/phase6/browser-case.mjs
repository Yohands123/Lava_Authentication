import { chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { settingsFor, makeAgent } from './generators.mjs';

export async function browserCase(worker,test,seed,rt,privateFolder){
  const outcome=rt.emptyOutcome(),settings=settingsFor(test,seed),began=performance.now();let browser,puppet,rawExport=null;
  const contextData={case:test.pattern+(test.mask?':'+test.mask:''),generatorFamily:settings.family,revision:settings.revision,seed,
    lineageHash:await rt.candidateHash(settings.lineage),capture:'playwright',headless:test.headless,declaredAutomation:true,
    instrumentationControlled:true,clientPhysicsSeed:settings.physicsSeed,physicsSchedulingDeterministic:false,sourceControlled:true,featureSchema:'lava-features-v1',responseSchema:rt.DYNAMIC_VERSION};
  try{
    if(test.pattern==='puppeteer'){
      const {default:puppeteer}=await import('puppeteer-core');puppet=await puppeteer.launch({executablePath:chromium.executablePath(),headless:test.headless});
      browser=await chromium.connectOverCDP(puppet.wsEndpoint());contextData.capture='puppeteer';
    }else browser=await chromium.launch({headless:test.headless});
    contextData.browserBuild=browser.version();
    const context=puppet?browser.contexts()[0]:await browser.newContext({viewport:{width:1200,height:900}}),page=await context.newPage();
    await page.setViewportSize({width:1200,height:900});page.setDefaultTimeout(8000);
    await page.addInitScript(({seed,mask})=>{
      // Disclosed local physics control, never Worker/WebAuthn crypto.
      let s=seed;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
      if(['webdriver-hidden','all-hidden','unavailable','disagreement'].includes(mask))Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>mask==='unavailable'?undefined:mask==='disagreement',configurable:true});
      if(['ua-hidden','all-hidden','unavailable','disagreement'].includes(mask))Object.defineProperty(Navigator.prototype,'userAgent',{get:()=>mask==='unavailable'?undefined:'Chrome/controlled-test',configurable:true});
      if(['all-hidden','unavailable','disagreement'].includes(mask))Object.defineProperty(Navigator.prototype,'userAgentData',{get:()=>mask==='unavailable'?undefined:{brands:[{brand:'Chromium',version:'0'}]},configurable:true});
    },{seed:settings.physicsSeed,mask:test.mask??''});
    let issued=null,evaluated=null,summary=null;
    page.on('response',response=>{
      if(response.url().endsWith('/api/lavaguard/challenge'))issued=response.json().then(v=>({value:v,status:response.status()}),()=>({status:response.status()}));
      if(response.url().endsWith('/api/lavaguard/evaluate')){summary=response.request().postDataJSON().summary;evaluated=response.json().then(v=>({value:v,status:response.status()}),()=>({status:response.status()}));}
    });
    await page.goto(worker.origin);await page.locator('[data-action=lab]').click();await page.locator('[data-research-consent]').check();
    await page.locator('[data-study-label]').selectOption('automation-declared');await page.locator('[data-study-device]').selectOption('mouse');
    await page.locator('[data-study-acquisition]').selectOption(contextData.capture);
    const environment=test.mask==='human-takeover-declared'?'human-controlled-automation':puppet?'puppeteer':test.pattern==='ghost-cursor'?'ghost-cursor':test.headless?'headless-playwright':'headed-playwright';
    await page.locator('[data-study-environment]').selectOption(environment);await page.locator('[data-study-control]').selectOption(test.mask==='human-takeover-declared'?'human':'scripted');
    await page.locator('[data-study-display]').selectOption(test.headless?'headless':'headed');await page.locator('[data-study-cadence]').selectOption(String(settings.cadence));
    await page.getByText('Declared automation provenance',{exact:true}).click();
    for(const [k,v]of Object.entries({family:settings.family,revision:settings.revision,seed:String(seed),run:worker.manifest.run,trajectory:settings.lineage}))await page.locator(`[data-generator-${k}]`).fill(v);
    await page.locator('[data-action=lab]').click();await page.getByRole('button',{name:'Enter',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-screen=stir]')?.dataset.guardState==='STIRRING');
    const challenge=issued?await issued:null;outcome.challengeIssued=challenge?.status===200;
    const box=await page.locator('[data-ring-arc]').boundingBox(),agent=await makeAgent(test,seed);if(!box)throw new Error('Ring unavailable');
    const puppetPage=puppet?(await puppet.pages()).find(p=>p.url()===worker.origin+'/'):null;
    const motionStart=performance.now();let moves=0,state;
    while((state=await page.locator('[data-screen=stir]').getAttribute('data-guard-state'))==='STIRRING'&&performance.now()-motionStart<5500){
      const targetJson=await page.locator('.guard-lab').getAttribute('data-study-target'),p=await agent.next(targetJson?JSON.parse(targetJson):null);
      const x=box.x+p.x*box.width,y=box.y+p.y*box.height;
      if(test.pattern==='dom-synthetic')await page.evaluate(({x,y})=>window.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y,pointerType:'mouse'})),{x,y});
      else if(puppetPage)await puppetPage.mouse.move(x,y);else await page.mouse.move(x,y);
      moves++;await page.waitForTimeout(p.wait);
      if(test.pattern==='cancel-race'&&moves===8){await page.getByRole('button',{name:'Back',exact:true}).click();state='CANCELLED';break;}
    }
    if(state==='RING_CLEARED_PENDING_DECISION'){await page.waitForFunction(()=>['CLEAR','FLAG','BLOCK','ERROR'].includes(document.querySelector('[data-screen=stir]')?.dataset.guardState));state=await page.locator('[data-screen=stir]').getAttribute('data-guard-state');}
    outcome.visualRingCompleted=['CLEAR','FLAG','BLOCK'].includes(state);
    if(state==='STIRRING'){
      try{await page.getByRole('button',{name:'Back',exact:true}).click({timeout:1000});}
      catch{await page.waitForFunction(()=>['CLEAR','FLAG','BLOCK','ERROR','CANCELLED'].includes(document.querySelector('[data-screen=stir]')?.dataset.guardState),null,{timeout:10000});state=await page.locator('[data-screen=stir]').getAttribute('data-guard-state');outcome.visualRingCompleted=['CLEAR','FLAG','BLOCK'].includes(state);if(!outcome.visualRingCompleted&&state!=='CANCELLED')throw new Error('Cancel/completion race unresolved');}
    }
    const response=evaluated?await evaluated:null,decision=response?.value;
    outcome.serverEvaluated=response?response.status===200:false;outcome.serverVerdict=decision?.verdict??null;outcome.clearanceIssued=Boolean(decision?.clearance);
    const score=decision?.lab?.estimator?.riskScore;outcome.modelScoreAvailable=typeof score==='number';
    // Historical v1 diagnostic threshold is frozen at 0.9; never used by Phase 6 policy.
    outcome.modelFlagAtFrozenResearchThreshold=outcome.modelScoreAvailable?score>=.9:null;
    const options=await context.request.post(worker.origin+'/api/login/options',{headers:{Origin:worker.origin},data:{digests:{},...(decision?.clearance?{clearance:decision.clearance}:{})}});
    outcome.optionsHttpStatus=options.status();outcome.authenticatedSessionCreated=(await context.request.get(worker.origin+'/api/session')).status()===200;
    if(outcome.authenticatedSessionCreated)throw new Error('Credential-free session creation');
    await page.locator('[data-action=lab]').click();
    if(await page.locator('[data-export-research]').isEnabled()){
      const download=page.waitForEvent('download');await page.locator('[data-export-research]').click();rawExport=JSON.parse(await readFile(await(await download).path(),'utf8'));
      if(!rt.validateResearchExport(rawExport).data||rawExport.label!=='automation-declared')throw new Error('Actual research export invalid or mislabeled');
      await writeFile(`${privateFolder}/${randomUUID()}.json`,JSON.stringify(rawExport)+'\n',{flag:'wx'});
    }
    contextData.moves=moves;contextData.environment=summary?.automationEnvironment??rawExport?.environment?.evidence??null;
    contextData.motionTermination=outcome.visualRingCompleted?'completed':test.pattern==='cancel-race'?'cancelled':'motion_budget_exhausted';
    contextData.response=rawExport?rt.dynamicResponse(rawExport.samples):null;
    contextData.recordedSamples=rawExport?.samples.length??0;contextData.rawExportRetained=Boolean(rawExport);
    outcome.experimentCompleted=true;outcome.reasonIncomplete=null;
    contextData.policyVersion='lava-policy-v4';contextData.modelVersion=decision?.lab?.estimator?.modelVersion??null;contextData.frozenResearchThreshold=.9;
  }catch(error){outcome.reasonIncomplete='harness_error';contextData.failure=error.message.split('\n')[0].replace(/[A-Za-z]:[\\/][^\s'"]+/g,'<local-path>').slice(0,200);}
  finally{await browser?.close().catch(()=>{});await puppet?.close().catch(()=>{});}
  contextData.durationMs=performance.now()-began;
  if(!rt.validOutcome(outcome))throw new Error('Outcome accounting violated');
  return {...contextData,outcome};
}
