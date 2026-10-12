// Never loosen this policy without asking (CLAUDE.md section 4).
// Static assets get their own CSP from public/_headers.
export function securityHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}
