import { clearSessionCookie, readSessionId } from "../lib/cookies";
import { fail, json } from "../lib/http";
import { sessions, type Env } from "../env";

export async function getSession(request: Request, env: Env): Promise<Response> {
  const id = readSessionId(request);
  if (!id) return fail("unauthorized", 401, "Not signed in.");
  const session = await sessions(env).get(id);
  if (!session) return fail("unauthorized", 401, "Not signed in.", { "Set-Cookie": clearSessionCookie() });
  return json({ user: { id: session.userId, username: session.username }, expiresAt: session.expiresAt });
}

export async function logout(request: Request, env: Env): Promise<Response> {
  const id = readSessionId(request);
  if (id) await sessions(env).revoke(id);
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}

export async function revokeAll(request: Request, env: Env): Promise<Response> {
  const id = readSessionId(request);
  if (!id) return fail("unauthorized", 401, "Not signed in.");
  const store = sessions(env);
  const session = await store.get(id);
  if (!session) return fail("unauthorized", 401, "Not signed in.");
  const revoked = await store.revokeAll(session.userId);
  return json({ ok: true, revoked }, 200, { "Set-Cookie": clearSessionCookie() });
}
