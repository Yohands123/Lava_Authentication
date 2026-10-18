interface Env { ORIGIN: string; LAVAGUARD_MODE?: string; LAVAGUARD_STEP_UP?: string; TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string; LAVAGUARD_TURNSTILE_TEST?: string }

export function stepUpEnabled(env: Env) { return env.LAVAGUARD_STEP_UP === "turnstile" && env.LAVAGUARD_MODE === "enforce"; }
export function testTurnstile(env: Env) { return env.LAVAGUARD_TURNSTILE_TEST === "1" && new URL(env.ORIGIN).hostname === "localhost"; }
export function stepUpConfigured(env: Env) {
  if (!stepUpEnabled(env) || !env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) return false;
  if (/^[123]x0+/.test(env.TURNSTILE_SECRET_KEY) && !testTurnstile(env)) return false;
  return true;
}
/** Only server code calls Siteverify. Missing configuration or service failure denies. */
export async function verifyTurnstile(env: Env, token: string, id: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!stepUpConfigured(env)) return false;
  try {
    const response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", redirect: "manual",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }), signal: AbortSignal.timeout(8000) });
    if (!response.ok) { if (testTurnstile(env)) console.warn("Local test Siteverify HTTP status", response.status); return false; }
    const value: unknown = await response.json();
    if (!value || typeof value !== "object") return false;
    const result = value as Record<string, unknown>;
    if (result.success !== true) return false;
    // Official dummy keys omit action/cdata and return example.com. Exception is
    // explicit localhost-only test configuration, never staging or production.
    if (testTurnstile(env)) {
      const valid = result.hostname === "example.com" && (result.metadata as Record<string, unknown> | undefined)?.result_with_testing_key === true;
      if (!valid) console.warn("Local test Siteverify metadata mismatch", result.hostname);
      return valid;
    }
    const age = Date.now() - Date.parse(String(result.challenge_ts));
    return Number.isFinite(age) && age >= -30000 && age <= 300000 && result.hostname === new URL(env.ORIGIN).hostname && result.action === "lava_guard" && result.cdata === id;
  } catch (error) { if (testTurnstile(env)) console.warn("Local test Siteverify transport unavailable", error instanceof Error ? error.message : "unknown"); return false; }
}
