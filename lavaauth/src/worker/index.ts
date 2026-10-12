import { fail } from "./lib/http";
import type { Env } from "./env";
import { registerOptions, registerVerify } from "./routes/register";
import { loginOptions, loginVerify } from "./routes/login";
import { getSession, logout, revokeAll } from "./routes/session";
import { health } from "./routes/health";

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
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const handler = routes[`${request.method} ${url.pathname}`];
    if (!handler) return fail("not_found", 404, "No such endpoint.");

    // CSRF defence: state-changing requests must come from our own origin.
    if (request.method !== "GET" && request.headers.get("Origin") !== env.ORIGIN) {
      return fail("bad_origin", 403, "Requests must come from this site.");
    }

    try {
      return await handler(request, env);
    } catch (err) {
      console.error("Unhandled error", err instanceof Error ? err.message : "unknown");
      return fail("server_error", 500, "Something went wrong on our side. Try again.");
    }
  },
} satisfies ExportedHandler<Env>;
