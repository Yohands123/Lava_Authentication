import { fromBase64Url } from "../lib/base64url";
import { fail } from "../lib/http";
import { limiter, type Env } from "../env";
import type { ConsumeResult } from "../durable/ChallengeStore";

/** Returns a 429 response if the key is over its limit, otherwise null. */
export async function rateLimit(env: Env, key: string, limit: number, windowSeconds: number): Promise<Response | null> {
  const result = await limiter(env, key).hit(limit, windowSeconds);
  if (result.ok) return null;
  return fail("rate_limited", 429, "Too many attempts. Try again shortly.", {
    "Retry-After": String(result.retryAfterSeconds),
  });
}

/** Pull the challenge out of a WebAuthn response's clientDataJSON. */
export function challengeFromResponse(response: unknown): string | null {
  try {
    const clientDataJSON = (response as { response?: { clientDataJSON?: unknown } }).response?.clientDataJSON;
    if (typeof clientDataJSON !== "string") return null;
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(clientDataJSON))) as { challenge?: unknown };
    return typeof parsed.challenge === "string" ? parsed.challenge : null;
  } catch {
    return null;
  }
}

export function consumeFailure(result: ConsumeResult): Response | null {
  if (result.status === "expired") return fail("challenge_expired", 410, "This request expired. Start again.");
  if (result.status === "unknown") return fail("challenge_used", 409, "This request was already used. Start again.");
  return null;
}

export const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/;
