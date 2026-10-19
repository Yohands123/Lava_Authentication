import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { emptyOutcome, summarizeOutcomes, validOutcome } from "../../src/shared/phase6-outcome";
import { candidateHash, ObservationRegistry, type ObservationCandidate, type ObservationContext } from "../../src/shared/observation-registry";
import { observeWithinBudget } from "../../src/shared/observation-budget";
import { ShadowMetrics } from "../../src/shared/shadow-metrics";
import { dynamicResponse } from "../../src/shared/dynamic-response";
import { contextShard, GuardShardSimulator } from "../../src/worker/guard/sharding-simulator";
import { sqliteGuard } from "../fixtures/sqlite-guard";
import type { PortableModel } from "../../src/shared/portable-model";
import { syntheticStudyExport } from "../fixtures/study";
import { boundedBody } from "../../src/worker/lib/body";
import { validateResearchExport } from "../../src/shared/research";
import { estimatePortableRisk, parsePortableModel } from "../../src/shared/portable-model";
const fixture = JSON.parse(readFileSync(new URL("../fixtures/phase5-portable.json",import.meta.url),"utf8")) as {model:PortableModel;vectors:{features:Record<string,number>;expectedRisk:number}[]};
const candidate = (): ObservationCandidate => ({schema:"lava-observation-candidate-v1",authority:"APPROVED_FOR_OBSERVATION_ONLY",syntheticOnly:true,model:structuredClone(fixture.model),datasetHash:fixture.model.datasetHash,cohortManifestHash:fixture.model.splitHash,provenance:{extraction:"lava-robust-v2",calibration:"separate-development-calibration",threshold:"frozen-before-evaluation",trainingEnvironment:"synthetic Python golden fixture",review:"local unit-test fixture only"}});
const context = (): ObservationContext => ({mode:"shadow",device:"mouse",datasetHash:fixture.model.datasetHash,datasetState:"current",withdrawnDatasetHashes:[],revokedCandidateHashes:[],revocationState:"current"});
async function loaded() { const c=candidate(),r=new ObservationRegistry("shadow"),pin={version:c.model.version,sha256:await candidateHash(c)}; expect(await r.load(c,pin)).toBe(true);return {c,r,pin}; }
describe("Phase 6 observation registry",()=>{
  it("off mode does not read or parse a candidate, and malformed JSON enum objects safely reject",()=>{
    const artifact=new Proxy({},{get(){throw new Error("off must not inspect models");}});
    expect(estimatePortableRisk(artifact,null,{...context(),mode:"off"}).reasons).toContain("model_off");
    const bad={toString:"not callable"};expect(parsePortableModel({...fixture.model,featureVersion:bad})).toBeNull();
    const raw=syntheticStudyExport();
    for(const value of [{...raw,label:bad},{...raw,capture:{...raw.capture,acquisition:bad}},{...raw,outcome:{...raw.outcome,status:bad}},{...raw,samples:raw.samples.map(p=>({...p,pointer:bad}))}])expect(validateResearchExport(value).data).toBeNull();
  });
  it("defaults off and never selects an unpinned model",async()=>{
    const c=candidate(),pin={version:c.model.version,sha256:await candidateHash(c)},off=new ObservationRegistry();
    expect(await off.load(c,pin)).toBe(false);expect(off.score(fixture.vectors[0]!.features,context()).riskScore).toBeNull();
    const r=new ObservationRegistry("shadow");expect(await r.load(c,null)).toBe(false);
  });
  it("pins immutable content, schema, lineage, review authority and explicit version",async()=>{
    const c=candidate(),pin={version:c.model.version,sha256:await candidateHash(c)};
    for(const change of [{authority:"production"},{datasetHash:"0".repeat(64)},{model:{...c.model,enabled:true}},{unexpected:"code"},{provenance:{...c.provenance,threshold:"tuned-on-final"}},{model:{...c.model,intercept:c.model.intercept+1}}]) {
      expect(await new ObservationRegistry("shadow").load({...c,...change},pin)).toBe(false);
    }
    expect(await new ObservationRegistry("shadow").load(c,{...pin,version:"unknown"})).toBe(false);
  });
  it("prepared registry matches every Python golden vector without policy authority",async()=>{
    const {r,c}=await loaded();
    for(const v of fixture.vectors) {const s=r.score(v.features,context());expect(Math.abs(s.riskScore!-v.expectedRisk)).toBeLessThan(1e-12);expect(s.action).toBe("observe");expect(s.policyAuthority).toBe("none");expect(Object.keys(s)).not.toContain("clearance");}
    const baseline=r.score(fixture.vectors[0]!.features,context());c.model.intercept+=1e6;expect(r.score(fixture.vectors[0]!.features,context())).toEqual(baseline);
  });
  it("checks live candidate/data revocation, unavailable state, missing/OOD features and unsupported devices",async()=>{
    const {r,pin}=await loaded(),f=fixture.vectors[0]!.features;
    for(const change of [{mode:"off" as const},{revokedCandidateHashes:[pin.sha256]},{revocationState:"unavailable" as const},{datasetState:"withdrawn" as const},{withdrawnDatasetHashes:[fixture.model.datasetHash]},...["touch","pen","assisted","unknown"].map(device=>({device}))])expect(r.score(f,{...context(),...change}).riskScore).toBeNull();
    for(const features of [null,{}, {...f,pathLength:NaN},{...f,pathLength:1e11},{...f,webdriver:1}])expect(r.score(features,context()).riskScore).toBeNull();
  });
  it("contains asynchronous scoring failures and timeouts",async()=>{
    expect((await observeWithinBudget(()=>{throw new Error("failure");})).reasons).toEqual(["inference_error"]);
    expect((await observeWithinBudget(()=>new Promise(()=>{}),2)).reasons).toEqual(["inference_timeout"]);
    expect((await observeWithinBudget(()=>{throw new Error("must not run");},0)).reasons).toEqual(["invalid_observation_budget"]);
  });
  it("times out an unfinished request stream and cancels the reader",async()=>{
    let cancelled=false;const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode('{"kind":'));},cancel(){cancelled=true;}});
    const request=new Request("http://localhost",{method:"POST",headers:{"Content-Type":"application/json"},body:stream,duplex:"half"} as RequestInit);
    expect(await boundedBody(request,["kind"])).toBeNull();expect(cancelled).toBe(true);
  });
});
describe("honest observations and finite dynamic response",()=>{
  it("does not credit incomplete rings or missing passkeys as detection",()=>{
    const v={...emptyOutcome(),visualRingCompleted:false,authenticatedSessionCreated:false};expect(validOutcome(v)).toBe(true);
    expect(summarizeOutcomes([v])).toMatchObject({attempts:1,visualIncomplete:1,modelScores:0,humanAccuracy:null,incompleteClassifierDetectionCredit:0,missingCredentialDetectionCredit:0});
    expect(validOutcome({...v,authenticatedSessionCreated:true})).toBe(false);expect(validOutcome({...v,modelFlagAtFrozenResearchThreshold:true})).toBe(false);
  });
  it("measures subsequent same-target steering after a switch, with missing targets kept missing",()=>{
    const p=[{x:0,y:0,t:0,targetX:1,targetY:0,targetId:0},{x:0,y:0,t:10,targetX:1,targetY:0,targetId:1},{x:.5,y:0,t:20,targetX:1,targetY:0,targetId:1},{x:.9,y:0,t:30,targetX:1,targetY:0,targetId:1}];
    expect(dynamicResponse(p)).toMatchObject({targetCoverage:1,switchCount:1,switchResponseShare:1,medianResponseFraction:1/3,unansweredSwitchShare:0});
    expect(dynamicResponse(p.map(({x,y,t})=>({x,y,t}))).targetCoverage).toBe(0);
  });
  it("bounds input and handles invalid time, coordinates and abandoned target switches",()=>{
    const p=syntheticStudyExport().samples;
    expect(dynamicResponse([...p,...Array.from({length:1100},(_,i)=>({...p[0]!,t:5000+i}))])).toEqual(dynamicResponse([...p,...Array.from({length:944},(_,i)=>({...p[0]!,t:5000+i}))]));
    for(const bad of [[],[{...p[0]!,t:NaN}],p.map((s,i)=>({...s,t:i?0:1}))])expect(Object.values(dynamicResponse(bad)).every(v=>v===0)).toBe(true);
    expect(Object.values(dynamicResponse(p)).every(v=>Number.isFinite(v)&&v>=0)).toBe(true);
  });
  it("metrics reject identity-shaped labels, stay bounded and expire after 24 hours",()=>{
    const m=new ShadowMetrics(true),now=100*3600000;
    m.record("participant-secret");m.record("issued","off",now);m.record("score_null","synthetic",now);
    expect(JSON.stringify(m.snapshot(now))).not.toMatch(/secret|context|cookie|webdriver/);
    expect(m.snapshot(now).counts).toHaveLength(2);expect(m.snapshot(now+24*3600000).counts).toHaveLength(0);
    expect(new ShadowMetrics().snapshot().counts).toHaveLength(0);
  });
});
describe("shard prototype uses real SQLite enforcement",()=>{
  it("routes stably, rejects attacker-chosen invalid routing and preserves context binding across collisions",()=>{
    const stores:ReturnType<typeof sqliteGuard>[]=[],router=new GuardShardSimulator(4,()=>{const s=sqliteGuard();stores.push(s);return s.guard;});
    try{const a="a".repeat(43),b=Array.from({length:128},(_,i)=>i.toString(36).padStart(43,"x")).find(c=>contextShard(c,4)===contextShard(a,4))!,g=router.forContext(a);
      expect(router.forContext(b)).toBe(g);expect(contextShard(a,4)).toBe(contextShard(a,4));
      const c=g.issue(a,"http://localhost","accessible","enforce");if("error"in c)throw new Error(c.error);
      const d=g.evaluate(a,"http://localhost",c.id,c.nonce,null,"enforce");if("error"in d||!d.clearance)throw new Error("missing clearance");
      expect(router.forContext(b).redeem(b,"http://localhost",d.clearance)).toBe("binding");
      expect(router.forContext("b".repeat(43)).redeem("b".repeat(43),"http://localhost",d.clearance)).not.toBe("ok");expect(g.redeem(a,"http://localhost",d.clearance)).toBe("ok");
      expect(()=>contextShard("invalid",4)).toThrow();expect(()=>contextShard(a,3)).toThrow();
    }finally{for(const s of stores)s.database.close();}
  });
  it("parallel redemptions have exactly one winner in each authoritative shard",async()=>{
    const s=sqliteGuard();try{const a="c".repeat(43),origin="http://localhost",c=s.guard.issue(a,origin,"accessible","enforce");if("error"in c)throw new Error(c.error);
      const d=s.guard.evaluate(a,origin,c.id,c.nonce,null,"enforce");if("error"in d||!d.clearance)throw new Error("missing clearance");
      const results=await Promise.all(Array.from({length:32},()=>Promise.resolve().then(()=>s.guard.redeem(a,origin,d.clearance!))));expect(results.filter(v=>v==="ok")).toHaveLength(1);
    }finally{s.database.close();}
  });
  it("expiry and per-context pending/history limits survive routing without claiming a global capacity equivalence",()=>{
    const s=sqliteGuard();try{const a="d".repeat(43),origin="http://localhost",now=Date.now();for(let i=0;i<10;i++)s.guard.issue(a,origin,"accessible","enforce",now+i);
      expect(s.database.prepare("SELECT COUNT(*) AS n FROM guard_attempts").get()!.n).toBe(3);
      s.guard.sweep(now+800000);expect(s.database.prepare("SELECT COUNT(*) AS n FROM guard_attempts").get()!.n).toBe(0);
    }finally{s.database.close();}
  });
});
