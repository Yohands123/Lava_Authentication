import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { buildChallenge, parseDigests, BadDigestError } from "../entropy/mix";
import { toBase64Url } from "../lib/base64url";
import { sessionCookie } from "../lib/cookies";
import { clientIp, fail, json, readBody } from "../lib/http";
import { challenges, challengeTtl, sessions, sessionTtl, users, type Env } from "../env";
import { challengeFromResponse, consumeFailure, rateLimit, USERNAME_PATTERN } from "./shared";

export async function registerOptions(request: Request, env: Env): Promise<Response> {
  const limited = await rateLimit(env, `ip:${clientIp(request)}:register-options`, 20, 60);
  if (limited) return limited;

  const body = await readBody(request, ["username", "digests"]);
  if (!body) return fail("bad_request", 400, "Expected { username, digests }.");

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!USERNAME_PATTERN.test(username)) {
    return fail("username_invalid", 400, "Use 3 to 32 characters: lowercase letters, numbers, - or _.");
  }

  const userLimited = await rateLimit(env, `user:${username}:register`, 5, 600);
  if (userLimited) return userLimited;

  if (await users(env).usernameTaken(username)) {
    return fail("username_taken", 409, "That username is taken.");
  }

  let digests;
  try {
    digests = parseDigests(body.digests);
  } catch (err) {
    if (err instanceof BadDigestError) return fail("bad_digest", 400, err.message);
    throw err;
  }

  const challenge = await buildChallenge(digests);
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const options = await generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    userName: username,
    userID: userId,
    challenge,
    attestationType: "none",
    timeout: challengeTtl(env) * 1000,
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });

  await challenges(env).issue(
    { challenge: options.challenge, purpose: "register", userId: toBase64Url(userId), username },
    challengeTtl(env),
  );
  return json(options);
}

export async function registerVerify(request: Request, env: Env): Promise<Response> {
  const limited = await rateLimit(env, `ip:${clientIp(request)}:register-verify`, 10, 60);
  if (limited) return limited;

  const body = await readBody(request, ["response"]);
  if (!body || typeof body.response !== "object") return fail("bad_response", 400, "Expected { response }.");
  const response = body.response as RegistrationResponseJSON;

  const challenge = challengeFromResponse(response);
  if (!challenge) return fail("bad_response", 400, "Malformed passkey response.");

  const consumed = await challenges(env).consume(challenge, "register");
  const failure = consumeFailure(consumed);
  if (failure || consumed.status !== "ok") return failure ?? fail("server_error", 500, "Unexpected state.");
  const { userId, username } = consumed.record;
  if (!userId || !username) return fail("server_error", 500, "Challenge is missing its user.");

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: env.ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: false,
    });
  } catch {
    return fail("verification_failed", 401, "That passkey couldn't be verified.");
  }
  if (!verification.verified || !verification.registrationInfo) {
    return fail("verification_failed", 401, "That passkey couldn't be verified.");
  }

  const { credential } = verification.registrationInfo;
  const created = await users(env).createUserWithCredential(
    { id: userId, username },
    {
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: response.response.transports ?? [],
    },
  );
  if (!created) return fail("username_taken", 409, "That username is taken.");

  const session = await sessions(env).create(userId, username, sessionTtl(env));
  return json(
    { verified: true, user: { id: userId, username } },
    200,
    { "Set-Cookie": sessionCookie(session.id, sessionTtl(env)) },
  );
}
