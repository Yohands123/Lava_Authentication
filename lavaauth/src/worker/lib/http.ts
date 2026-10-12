import { securityHeaders } from "./csp";

export type ErrorCode =
  | "bad_request"
  | "bad_digest"
  | "bad_response"
  | "bad_origin"
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) return null;
  }
  return body as Record<string, unknown>;
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "local";
}
