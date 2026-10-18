import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { buildChallenge, parseDigests, BadDigestError } from "../entropy/mix";
import { sessionCookie } from "../lib/cookies";
import { clientIp, fail, json, readBody } from "../lib/http";
import { challenges, challengeTtl, sessions, sessionTtl, users, type Env } from "../env";
import { presentSources } from "../entropy/stats";
import { challengeFromResponse, consumeFailure, rateLimit } from "./shared";
import { requireClearance } from "./lavaguard";

export async function loginOptions(request: Request, env: Env): Promise<Response> {
  const limited = await rateLimit(env, `ip:${clientIp(request)}:login-options`, 20, 60);
  if (limited) return limited;

  const body = await readBody(request, ["digests", "clearance"]);
  if (!body) return fail("bad_request", 400, "Expected { digests }.");

  let digests;
  try {
    digests = parseDigests(body.digests);
  } catch (err) {
    if (err instanceof BadDigestError) return fail("bad_digest", 400, err.message);
    throw err;
  }

  const guardFailure = await requireClearance(request, env, body.clearance);
  if (guardFailure) return guardFailure;
  const challenge = await buildChallenge(digests);
  const options = await generateAuthenticationOptions({
    rpID: env.RP_ID,
    challenge,
    userVerification: "required",
    timeout: challengeTtl(env) * 1000,
  });

  await challenges(env).issue(
    { challenge: options.challenge, purpose: "login", userId: null, username: null },
    challengeTtl(env),
    presentSources(digests),
  );
  return json(options);
}

export async function loginVerify(request: Request, env: Env): Promise<Response> {
  const limited = await rateLimit(env, `ip:${clientIp(request)}:login-verify`, 10, 60);
  if (limited) return limited;

  const body = await readBody(request, ["response"]);
  if (!body || typeof body.response !== "object") return fail("bad_response", 400, "Expected { response }.");
  const response = body.response as AuthenticationResponseJSON;

  const challenge = challengeFromResponse(response);
  if (!challenge) return fail("bad_response", 400, "Malformed passkey response.");

  // Consume before anything else: a failed attempt still spends the challenge.
  const consumed = await challenges(env).consume(challenge, "login");
  const failure = consumeFailure(consumed);
  if (failure) return failure;

  const stored = await users(env).getCredential(response.id);
  if (!stored) return fail("verification_failed", 401, "That passkey isn't registered here.");

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: env.ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: true, // CLAUDE.md 2.1 rule 6
      credential: {
        id: stored.id,
        publicKey: stored.publicKey,
        counter: stored.counter,
        transports: stored.transports as AuthenticatorTransportFuture[],
      },
    });
  } catch {
    return fail("verification_failed", 401, "That passkey couldn't be verified.");
  }
  if (!verification.verified) return fail("verification_failed", 401, "That passkey couldn't be verified.");

  await users(env).updateCounter(stored.id, verification.authenticationInfo.newCounter);

  const session = await sessions(env).create(stored.userId, stored.username, sessionTtl(env));
  return json(
    { verified: true, user: { id: stored.userId, username: stored.username } },
    200,
    { "Set-Cookie": sessionCookie(session.id, sessionTtl(env)) },
  );
}
