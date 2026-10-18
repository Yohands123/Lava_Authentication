import { describe, expect, it } from "vitest";
import { boundedBody } from "../../src/worker/lib/body";
import { verifyTurnstile, stepUpConfigured } from "../../src/worker/guard/turnstile";
describe("bounded streaming and optional verification", () => {
  it("rejects lying sizes and unknown fields", async () => {
    const request = new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "1" }, body: JSON.stringify({ field: "x".repeat(9000) }) });
    expect(await boundedBody(request, ["field"], 8192)).toBeNull();
    expect(await boundedBody(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"unknown":1}' }), [])).toBeNull();
  });
  const env = { ORIGIN: "https://staging.example.com", LAVAGUARD_MODE: "enforce", LAVAGUARD_STEP_UP: "turnstile", TURNSTILE_SITE_KEY: "example-public-site-key", TURNSTILE_SECRET_KEY: "unit-only-placeholder" };
  it("requires exact hostname, action, binding and token age for non-test credentials", async () => {
    const valid = { success: true, hostname: "staging.example.com", action: "lava_guard", cdata: "attempt", challenge_ts: new Date().toISOString() };
    for (const change of [{}, { hostname: "attacker.example" }, { action: "other" }, { cdata: "other" }, { challenge_ts: "2000-01-01" }, { success: false }]) {
      const fetcher = (async () => Response.json({ ...valid, ...change })) as typeof fetch;
      expect(await verifyTurnstile(env, "token", "attempt", fetcher)).toBe(Object.keys(change).length === 0);
    }
  });
  it("fails closed for missing secrets, network failure and staging dummy keys", async () => {
    expect(stepUpConfigured({ ...env, TURNSTILE_SECRET_KEY: "" })).toBe(false);
    expect(stepUpConfigured({ ...env, TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA", LAVAGUARD_TURNSTILE_TEST: "1" })).toBe(false);
    expect(await verifyTurnstile(env, "token", "attempt", (async () => { throw new Error("offline"); }) as typeof fetch)).toBe(false);
  });
});
