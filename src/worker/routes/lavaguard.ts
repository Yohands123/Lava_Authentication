import { challenges, type Env } from "../env";
import { clientIp, fail, json } from "../lib/http";
import { opaqueId } from "../guard/LavaEnforcer";
import { parseSummary } from "../guard/LavaDetector";
import { experimentalInference } from "../guard/inference";
import { experimentalEvaluation } from "../guard/experimental-evaluation";
import { guardMode, experimentalModelAllowed, mlMode } from "../guard/config";
import { POLICY_VERSION } from "../guard/metrics";
import { rateLimit } from "./shared";
import { boundedBody } from "../lib/body";
import { stepUpConfigured, stepUpEnabled, verifyTurnstile } from "../guard/turnstile";

const COOKIE = "lava_guard";
export function guardContext(request: Request): string | null {
  const raw = request.headers.get("Cookie")?.split(";").map(p => p.trim()).find(p => p.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return raw && /^[\w-]{43}$/.test(raw) ? raw : null;
}
const cookie = (value: string, age = 600) => `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
const labAllowed = (env: Env) => env.LAVAGUARD_LAB === "1" && new URL(env.ORIGIN).hostname === "localhost";

/** Bounded even for streaming requests and lying Content-Length headers. */
const body = (request: Request, allowed: string[]) => boundedBody(request, allowed, 8192);

export async function guardConfig(_request: Request, env: Env): Promise<Response> {
  return json({ mode: guardMode(env), lab: labAllowed(env), experimentalModel: experimentalModelAllowed(env), featureVersion: "lava-features-v1", retentionSeconds: 600,
    modelMode: mlMode(env), modelVersion: env.LAVAGUARD_MODEL_VERSION ?? "lava-logistic-experimental-v1", policyVersion: POLICY_VERSION,
    ...(stepUpEnabled(env) ? { stepUp: { provider: "turnstile", siteKey: stepUpConfigured(env) ? env.TURNSTILE_SITE_KEY : null } } : {}) });
}
export async function guardIssue(request: Request, env: Env): Promise<Response> {
  const broad = await rateLimit(env, "global:guard-issue", 300, 60);
  if (broad) return broad;
  const limited = await rateLimit(env, `ip:${clientIp(request)}:guard-issue`, 30, 60);
  if (limited) return limited;
  const data = await body(request, ["kind"]);
  if (!data || (data.kind !== "gesture" && data.kind !== "accessible")) return fail("bad_request", 400, "Choose an interaction method.");
  const context = guardContext(request) ?? opaqueId();
  const contextLimited = await rateLimit(env, `guard:${context}`, data.kind === "accessible" ? 8 : 16, 60);
  if (contextLimited) return contextLimited;
  const result = await challenges(env).guardIssue(context, env.ORIGIN, data.kind, guardMode(env));
  if ("error" in result) return json({ verdict: "BLOCK", retryAfter: result.retryAfter ?? 60, alternative: false }, 429, { "Retry-After": String(result.retryAfter ?? 60) });
  return json(result, 200, { "Set-Cookie": cookie(context) });
}
export async function guardEvaluate(request: Request, env: Env): Promise<Response> {
  const broad = await rateLimit(env, "global:guard-evaluate", 600, 60);
  if (broad) return broad;
  const limited = await rateLimit(env, `ip:${clientIp(request)}:guard-evaluate`, 40, 60);
  if (limited) return limited;
  const data = await body(request, ["id", "nonce", "summary"]), context = guardContext(request);
  if (!context) return fail("guard_required", 403, "Start a fresh lamp attempt.");
  if (!data || typeof data.id !== "string" || !/^[\w-]{43}$/.test(data.id) || typeof data.nonce !== "string" || !/^[\w-]{43}$/.test(data.nonce)) return fail("bad_request", 400, "Invalid lamp attempt.");
  const summary = data.summary == null ? null : parseSummary(data.summary);
  if (data.summary != null && !summary) return fail("bad_request", 400, "Invalid interaction summary.");
  // Production off mode explicitly refuses behavioral collection.
  if (guardMode(env) === "off" && summary) return fail("bad_request", 400, "Interaction evaluation is disabled.");
  const result = await challenges(env).guardEvaluate(context, env.ORIGIN, data.id, data.nonce, summary, guardMode(env));
  if ("error" in result) {
    if (result.error === "missing_features") return json({ verdict: "FLAG", retryAfter: 0, alternative: true });
    return fail(result.error === "expired" ? "challenge_expired" : result.error === "used" ? "challenge_used" : "guard_required", result.error === "expired" ? 410 : result.error === "used" ? 409 : 403, "This attempt is unavailable. Start again.");
  }
  const { debug, elapsedMs, ...publicResult } = result;
  return json(labAllowed(env) ? { ...publicResult, lab: { ...debug, elapsedMs, experimental: summary && mlMode(env) !== "off" ? { ...experimentalInference(summary.features), enabled: !!debug?.experimental } : null } } : publicResult);
}
export async function requireClearance(request: Request, env: Env, value: unknown): Promise<Response | null> {
  if (guardMode(env) === "off") return null;
  const context = guardContext(request);
  if (!context || typeof value !== "string" || !/^[\w-]{43}$/.test(value)) return fail("guard_required", 403, "Complete a fresh lamp attempt or use the accessible passkey route.");
  const result = await challenges(env).guardRedeem(context, env.ORIGIN, value);
  return result === "ok" ? null : fail(result === "expired" ? "challenge_expired" : "guard_required", result === "expired" ? 410 : 403, "This clearance is unavailable. Start again.");
}
export async function guardForget(request: Request, env: Env): Promise<Response> {
  const context = guardContext(request);
  if (context) await challenges(env).guardForget(context);
  return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
}
async function isAdmin(request: Request, env: Env): Promise<boolean> {
  if (!env.LAVAGUARD_ADMIN_TOKEN || env.LAVAGUARD_ADMIN_TOKEN.length < 32) return false;
  const value = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const hash = (s: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  const [a, b] = await Promise.all([hash(value), hash(env.LAVAGUARD_ADMIN_TOKEN)]);
  let diff = 0; const x = new Uint8Array(a), y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}
export async function guardReview(request: Request, env: Env): Promise<Response> {
  if (!(await isAdmin(request, env))) return fail("unauthorized", 403, "Operator authorization required.");
  const data = await body(request, ["context", "reason"]);
  if (!data || typeof data.context !== "string" || !/^[\w-]{43}$/.test(data.context) || typeof data.reason !== "string" || data.reason.length < 3 || data.reason.length > 160) return fail("bad_request", 400, "A context and review reason are required.");
  await challenges(env).guardReview(data.context, data.reason);
  return json({ ok: true });
}
export async function guardDiagnostics(request: Request, env: Env): Promise<Response> {
  if (!labAllowed(env) && !(await isAdmin(request, env))) return fail("unauthorized", 403, "Lab authorization required.");
  const context = guardContext(request);
  return json({ history: context ? await challenges(env).guardDiagnostics(context) : { recent: [] }, evaluation: experimentalEvaluation });
}
export async function guardOperationalMetrics(request: Request, env: Env): Promise<Response> {
  if (!(await isAdmin(request, env))) return fail("unauthorized", 403, "Operator authorization required.");
  return json(await challenges(env).guardMetrics());
}
export async function guardVerify(request: Request, env: Env): Promise<Response> {
  if (!stepUpEnabled(env)) return fail("not_found", 404, "Verification is not enabled.");
  const broad = await rateLimit(env, "global:guard-verify", 60, 60);
  if (broad) return broad;
  const context = guardContext(request);
  if (!context) return fail("guard_required", 403, "Start a fresh attempt.");
  const limited = await rateLimit(env, `guard-verify:${context}`, 6, 60);
  if (limited) return limited;
  const data = await body(request, ["id", "token"]);
  if (!data || typeof data.id !== "string" || !/^[\w-]{43}$/.test(data.id) || typeof data.token !== "string" || data.token.length < 1 || data.token.length > 2048) return fail("bad_request", 400, "Invalid verification.");
  if (!stepUpConfigured(env)) return fail("verification_failed", 503, "Verification is temporarily unavailable. Please try again.");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data.token));
  const hash = [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, "0")).join("");
  if (!(await challenges(env).guardReserveVerification(context, env.ORIGIN, data.id, hash))) return fail("guard_required", 403, "This verification is unavailable. Start again.");
  const valid = await verifyTurnstile(env, data.token, data.id);
  const result = await challenges(env).guardFinishVerification(context, env.ORIGIN, data.id, valid);
  return result ? json(result) : fail("verification_failed", 403, "Verification didn't complete. Please try again.");
}
