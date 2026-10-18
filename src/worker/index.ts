import { fail } from "./lib/http";
import type { Env } from "./env";
import { registerOptions, registerVerify } from "./routes/register";
import { loginOptions, loginVerify } from "./routes/login";
import { getSession, logout, revokeAll } from "./routes/session";
import { health } from "./routes/health";
import { guardConfig, guardIssue, guardEvaluate, guardForget, guardReview, guardDiagnostics, guardVerify, guardOperationalMetrics } from "./routes/lavaguard";
import { stepUpEnabled } from "./guard/turnstile";
import { challenges } from "./env";

export { ChallengeStore } from "./durable/ChallengeStore";
export { RateLimiter } from "./durable/RateLimiter";
export { SessionStore } from "./durable/SessionStore";
export { UserStore } from "./durable/UserStore";

type Handler = (request: Request, env: Env) => Promise<Response>;

const routes: Record<string, Handler> = {
  "POST /api/register/options": registerOptions,
  "POST /api/register/verify": registerVerify,
  "POST /api/login/options": loginOptions,
  "POST /api/login/verify": loginVerify,
  "GET /api/session": getSession,
  "POST /api/logout": logout,
  "POST /api/sessions/revoke-all": revokeAll,
  "GET /api/health": health,
  "GET /api/lavaguard/config": guardConfig,
  "POST /api/lavaguard/challenge": guardIssue,
  "POST /api/lavaguard/evaluate": guardEvaluate,
  "POST /api/lavaguard/forget": guardForget,
  "POST /api/lavaguard/review": guardReview,
  "GET /api/lavaguard/lab": guardDiagnostics,
  "POST /api/lavaguard/verify": guardVerify,
  "GET /api/lavaguard/metrics": guardOperationalMetrics,
};
// Per-isolate admission, separate from global storage/rate bounds. Short-lived
// overload is an availability response, never behavioral punishment.
let activeGuard = 0, activeVerification = 0;
let lastOverloadMetric = 0;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      const response = await env.ASSETS.fetch(request);
      if (!stepUpEnabled(env)) return response;
      // Owner's optional Turnstile request authorizes this narrow CSP exception.
      const copy = new Response(response.body, response);
      copy.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      return copy;
    }

    const handler = routes[`${request.method} ${url.pathname}`];
    if (!handler) return fail("not_found", 404, "No such endpoint.");

    // CSRF defence: state-changing requests must come from our own origin.
    if (request.method !== "GET" && request.headers.get("Origin") !== env.ORIGIN) {
      return fail("bad_origin", 403, "Requests must come from this site.");
    }
    const verification = url.pathname === "/api/lavaguard/verify";
    const guarded = request.method === "POST" && url.pathname.startsWith("/api/lavaguard/");
    if (guarded && (verification ? activeVerification >= 4 : activeGuard >= 16)) {
      if (env.LAVAGUARD_METRICS === "1" && Date.now()-lastOverloadMetric > 1000) {
        lastOverloadMetric = Date.now();
        ctx.waitUntil(challenges(env).guardMetric("overload_pulse").catch(() => {}));
      }
      return fail("server_error", 503, "The lamp is busy. Please try again shortly.", { "Retry-After": "2" });
    }
    if (guarded) { if (verification) activeVerification++; else activeGuard++; }
    try {
      const start = Date.now(), response = await handler(request, env);
      if (env.LAVAGUARD_METRICS === "1" && url.pathname.startsWith("/api/lavaguard/") && !["/api/lavaguard/metrics", "/api/lavaguard/config"].includes(url.pathname)) {
        const elapsed = Date.now() - start;
        ctx.waitUntil((async () => {
          await challenges(env).guardMetric(`latency_${elapsed <= 10 ? 10 : elapsed <= 50 ? 50 : elapsed <= 200 ? 200 : elapsed <= 1000 ? 1000 : "slow"}`);
          if (response.status === 429) await challenges(env).guardMetric("rate_limited");
          if (response.status === 400) await challenges(env).guardMetric("invalid");
        })().catch(() => {}));
      }
      return response;
    } catch (err) {
      console.error("Unhandled error", err instanceof Error ? err.message : "unknown");
      return fail("server_error", 500, "Something went wrong on our side. Try again.");
    } finally { if (guarded) { if (verification) activeVerification--; else activeGuard--; } }
  },
} satisfies ExportedHandler<Env>;
