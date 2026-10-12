// SECURITY-CRITICAL. Cookie flags must never be weakened (CLAUDE.md section 2.1).

export const SESSION_COOKIE = "lava_session";

export function sessionCookie(id: string, maxAgeSeconds: number): string {
  // Browsers accept `Secure` cookies on http://localhost, so the flag is always set.
  return [
    `${SESSION_COOKIE}=${id}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

export function clearSessionCookie(): string {
  return sessionCookie("", 0);
}

export function readSessionId(request: Request): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      const value = rest.join("=");
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
    }
  }
  return null;
}
