/** Dedicated local benchmark entry, never imported by the production router. */
import app from "../../src/worker/index";
import type { Env } from "../../src/worker/env";
import fixture from "../../tests/fixtures/phase5-portable.json";
import { ObservationRegistry, candidateHash, type ObservationCandidate } from "../../src/shared/observation-registry";
import { observeWithinBudget } from "../../src/shared/observation-budget";
import { ShadowMetrics } from "../../src/shared/shadow-metrics";
import { boundedBody } from "../../src/worker/lib/body";
import { estimatePortableRisk, type PortableEstimate } from "../../src/shared/portable-model";
export { ChallengeStore, RateLimiter, SessionStore, UserStore } from "../../src/worker/index";
const candidate = { schema: "lava-observation-candidate-v1", authority: "APPROVED_FOR_OBSERVATION_ONLY", syntheticOnly: true, model: fixture.model,
  datasetHash: fixture.model.datasetHash, cohortManifestHash: fixture.model.splitHash,
  provenance: { extraction: "lava-robust-v2", calibration: "separate-development-calibration", threshold: "frozen-before-evaluation", trainingEnvironment: "Python synthetic golden fixture; no application validation", review: "owner-authorized local engineering fixture only" } } as ObservationCandidate;
const registry = new ObservationRegistry("shadow"), metrics = new ShadowMetrics(true);
// Synthetic fixture trust established by the frozen entry bundle, no network loader.
let ready: Promise<boolean> | undefined;
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/__phase6/")) return app.fetch(request,env,ctx);
    if (new URL(env.ORIGIN).hostname !== "localhost" || !["8807","8808","8809"].includes(url.port) || request.headers.get("Origin") !== env.ORIGIN || request.headers.get("X-Phase6") !== "synthetic-local-experiment") return new Response(null,{status:403});
    if (url.pathname === "/__phase6/metrics" && request.method === "GET") return Response.json(metrics.snapshot());
    if (url.pathname === "/__phase6/stall-verification" && request.method === "POST") {
      // Fault-inject only the reserve RPC; the actual router's four-slot admission runs.
      const faulty = {...env,LAVAGUARD_METRICS:"0",LAVAGUARD_STEP_UP:"turnstile",LAVAGUARD_TURNSTILE_TEST:"1",TURNSTILE_SITE_KEY:"1x00000000000000000000AA",TURNSTILE_SECRET_KEY:"1x0000000000000000000000000000000AA",
        CHALLENGES:{idFromName:()=>({}),get:()=>({guardReserveVerification:async()=>{await new Promise(resolve=>setTimeout(resolve,100));return false;}})}} as unknown as Env;
      const forwarded = new Request(env.ORIGIN+"/api/lavaguard/verify",{method:"POST",headers:{Origin:env.ORIGIN,"Content-Type":"application/json",Cookie:"lava_guard="+"a".repeat(43)},body:JSON.stringify({id:"b".repeat(43),token:"local-declared-fixture"})});
      return app.fetch(forwarded,faulty,ctx);
    }
    if (url.pathname === "/__phase6/slow-body" && request.method === "POST") {
      const stream = new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode('{"kind":"gesture"'));}});
      const forwarded = new Request(env.ORIGIN+"/api/lavaguard/challenge",{method:"POST",headers:{Origin:env.ORIGIN,"Content-Type":"application/json"},body:stream});
      return app.fetch(forwarded,env,ctx);
    }
    if (url.pathname !== "/__phase6/score" || request.method !== "POST") return new Response(null,{status:404});
    const data = await boundedBody(request,["mode","input","iterations","method"],2048) as {mode?: string; input?: string; iterations?: number; method?: string} | null;
    if (!data || !["off","shadow"].includes(data.mode ?? "") || !["golden","ood","unsupported","missing","revoked","withdrawn","unavailable","throw","stall"].includes(data.input ?? "") || !["prepared","parse-each-call"].includes(data.method ?? "prepared") || !Number.isInteger(data.iterations ?? 1) || (data.iterations ?? 1)<1 || (data.iterations ?? 1)>5000 || ["throw","stall"].includes(data.input ?? "") && (data.iterations ?? 1)!==1) return new Response(null,{status:400});
    const preparationStart = performance.now();
    if (data.mode === "shadow") await (ready ??= candidateHash(candidate).then(sha256=>registry.load(candidate,{version:candidate.model.version,sha256})));
    const preparationWallMs = performance.now()-preparationStart;
    const context = { mode: data.mode as "off"|"shadow", device: data.input === "unsupported" ? "assisted" : "mouse", datasetHash: candidate.datasetHash,
      datasetState: data.input === "withdrawn" ? "withdrawn" as const : "current" as const, withdrawnDatasetHashes: [],
      revokedCandidateHashes: data.input === "revoked" ? [await candidateHash(candidate)] : [], revocationState: data.input === "unavailable" ? "unavailable" as const : "current" as const };
    const vector = data.input === "missing" ? null : {...fixture.vectors[0]!.features, ...(data.input === "ood" ? {pathLength:1e11} : {})};
    const began = performance.now(); let result;
    for (let i=0;i<(data.iterations??1);i++) result = await observeWithinBudget(()=>{
      if (data.input === "throw") throw new Error("Local failure injection");
      if (data.input === "stall") return new Promise<PortableEstimate>(()=>{});
      if (data.method === "parse-each-call" && context.revocationState === "current" && context.revokedCandidateHashes.length === 0) return estimatePortableRisk(candidate.model,vector,context);
      return registry.score(vector,context);
    });
    metrics.record(result?.riskScore == null ? "score_null" : "score_available","synthetic");
    return Response.json({ syntheticOnly:true, policyInfluence:false, result, preparationWallMs, iterations:data.iterations??1, elapsedWallMs:performance.now()-began, actualEdgeCpuMs:null });
  },
};
