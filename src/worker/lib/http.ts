import { securityHeaders } from "./csp";
import { boundedBody } from "./body";

export type ErrorCode =
  | "bad_request"
  | "bad_digest"
  | "bad_response"
  | "bad_origin"
  | "guard_required"
  | "username_invalid"
  | "username_taken"
  | "verification_failed"
  | "challenge_expired"
  | "challenge_used"
  | "unauthorized"
  | "rate_limited"
  | "not_found"
  | "server_error";

export function json(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  const headers = new Headers(securityHeaders());
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  new Headers(extra).forEach((value, key) => headers.append(key, value));
  return new Response(JSON.stringify(data), { status, headers });
}

export function fail(code: ErrorCode, status: number, message: string, extra: HeadersInit = {}): Response {
  return json({ error: { code, message } }, status, extra);
}

/** Parse a JSON object body and reject unknown fields. */
export async function readBody(request: Request, allowed: readonly string[]): Promise<Record<string, unknown> | null> {
  return boundedBody(request, allowed);
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "local";
}
