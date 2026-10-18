import type { ChallengeStore } from "./durable/ChallengeStore";
import type { RateLimiter } from "./durable/RateLimiter";
import type { SessionStore } from "./durable/SessionStore";
import type { UserStore } from "./durable/UserStore";

export interface Env {
  ASSETS: Fetcher;
  CHALLENGES: DurableObjectNamespace<ChallengeStore>;
  RATE_LIMITER: DurableObjectNamespace<RateLimiter>;
  SESSIONS: DurableObjectNamespace<SessionStore>;
  USERS: DurableObjectNamespace<UserStore>;
  RP_NAME: string;
  RP_ID: string;
  ORIGIN: string;
  CHALLENGE_TTL_SECONDS: string;
  SESSION_TTL_SECONDS: string;
  LAVAGUARD_MODE?: "off" | "shadow" | "enforce";
  LAVAGUARD_ADMIN_TOKEN?: string;
  LAVAGUARD_LAB?: string;
  LAVAGUARD_EXPERIMENTAL_MODEL?: string;
  LAVAGUARD_STEP_UP?: string;
  LAVAGUARD_METRICS?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  LAVAGUARD_TURNSTILE_TEST?: string;
  LAVAGUARD_ML_MODE?: string;
  LAVAGUARD_MODEL_VERSION?: string;
  LAVAGUARD_ENVIRONMENT?: string;
  LAVAGUARD_RESEARCH_APPROVED?: string;
  LAVAGUARD_PRODUCTION_ML_APPROVED?: string;
}

// Single global instances keep the demo simple. Shard by user later if needed.
export const challenges = (env: Env) => env.CHALLENGES.get(env.CHALLENGES.idFromName("global"));
export const sessions = (env: Env) => env.SESSIONS.get(env.SESSIONS.idFromName("global"));
export const users = (env: Env) => env.USERS.get(env.USERS.idFromName("global"));
export const limiter = (env: Env, key: string) => env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(key));

export const challengeTtl = (env: Env) => Number(env.CHALLENGE_TTL_SECONDS) || 60;
export const sessionTtl = (env: Env) => Number(env.SESSION_TTL_SECONDS) || 604800;
