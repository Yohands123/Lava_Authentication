import app from "../../src/worker/index";
export * from "../../src/worker/index";
import type { Env } from "../../src/worker/env";
import { boundedBody } from "../../src/worker/lib/body";
import { ChallengeStore as ProductionChallenges } from "../../src/worker/durable/ChallengeStore";
/** Fault injection affects only this isolated entry's disposable store. */
export class ChallengeStore extends ProductionChallenges {
  private metricsFailure = false;
  async phase7MetricsFailure(enabled: boolean) { this.metricsFailure = enabled; }
  override async guardMetric(event: string) {
    if (this.metricsFailure) throw new Error("Injected local metrics failure");
    return super.guardMetric(event);
  }
}
// Isolated test entry; never referenced by production wrangler.toml.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const u = new URL(request.url);
    if (u.pathname.startsWith("/__phase7/")) {
      if (u.hostname !== "localhost" || !["8810", "8812"].includes(u.port) || request.headers.get("Origin") !== env.ORIGIN || request.headers.get("X-Phase7") !== "local-synthetic-probe") return new Response(null, { status: 403 });
      if (["/__phase7/metrics-failure-on", "/__phase7/metrics-failure-off"].includes(u.pathname) && request.method === "POST") {
        const namespace = env.CHALLENGES as unknown as DurableObjectNamespace<ChallengeStore>;
        await namespace.get(namespace.idFromName("global")).phase7MetricsFailure(u.pathname.endsWith("-on"));
        return Response.json({ fixtureOnly: true });
      }
      if (u.pathname === "/__phase7/direct-reader" && request.method === "POST") {
        const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{"kind":"gesture"')); } });
        const parsed = await boundedBody(new Request("http://localhost/synthetic", { method: "POST", headers: { "Content-Type": "application/json" }, body }), ["kind"], 8192);
        return Response.json({ boundedReaderRejected: parsed === null }, { status: parsed === null ? 400 : 500 });
      }
      return new Response(null, { status: 404 });
    }
    const trace = request.headers.get("X-Phase7-Trace") === "local-synthetic-probe";
    const started = Date.now();
    if (trace) console.info("phase7_transport_app_enter");
    const response = await app.fetch(request, env, ctx);
    if (trace) console.info("phase7_transport_app_return:" + response.status + ":" + (Date.now() - started));
    return response;
  },
};
