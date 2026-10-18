import { test, expect } from "@playwright/test";
import { extractFeatures } from "../../src/shared/features";
import { FEATURE_VERSION } from "../../src/shared/lavaguard";

const origin = "http://localhost:8786";
test("real enforcement: missing features, altered IDs and impossible time cannot mint clearance", async ({ request }) => {
  const post = (path: string, data: unknown) => request.post(path, { data, headers: { Origin: origin } });
  const issue = async () => (await post("/api/lavaguard/challenge", { kind: "gesture" })).json();
  const a = await issue();
  const missing = await (await post("/api/lavaguard/evaluate", { id: a.id, nonce: a.nonce })).json();
  expect(missing.verdict).toBe("FLAG"); expect(missing.clearance).toBeUndefined();
  const empty = { version: FEATURE_VERSION, fingerprint: "a".repeat(43), geometryHash: "b".repeat(43), features: extractFeatures([]) };
  expect((await post("/api/lavaguard/evaluate", { id: a.id, nonce: a.nonce, summary: empty })).status()).toBe(400);
  const b = await issue();
  expect((await post("/api/lavaguard/evaluate", { id: "x".repeat(43), nonce: b.nonce })).status()).toBe(409);
  const summary = { version: FEATURE_VERSION, fingerprint: "f".repeat(43), geometryHash: "g".repeat(43), features: extractFeatures(Array.from({ length: 40 }, (_, i) => ({ x: i / 40, y: .5, t: i * 1000 }))) };
  const impossible = await (await post("/api/lavaguard/evaluate", { id: b.id, nonce: b.nonce, summary })).json();
  expect(impossible.verdict).toBe("FLAG"); expect(impossible.clearance).toBeUndefined();
  expect(impossible.lab.reasons).toContain("time_inconsistent");
  expect((await post("/api/login/options", { digests: {} })).status()).toBe(403);
  expect((await request.get("/api/session")).status()).toBe(401);
});

test("fabricated plausible aggregates can obtain options but cannot authenticate", async ({ request, browser }) => {
  const post = (path: string, data: unknown) => request.post(path, { data, headers: { Origin: origin } });
  const c = await (await post("/api/lavaguard/challenge", { kind: "gesture" })).json();
  // Known generated straight path, not a human sample; no ring was visited.
  const summary = { version: FEATURE_VERSION, fingerprint: "h".repeat(43), geometryHash: "i".repeat(43), signals: { webdriver: false }, features: extractFeatures(Array.from({ length: 40 }, (_, i) => ({ x: .8 * i / 39, y: .5, t: 32 * i }))) };
  const d = await (await post("/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary })).json();
  expect(d.verdict).toBe("CLEAR"); expect(d.clearance).toHaveLength(43);
  // Binding checks must not let a thief consume the legitimate owner's token.
  const other = await browser.newContext();
  await other.request.post(origin + "/api/lavaguard/challenge", { data: { kind: "accessible" }, headers: { Origin: origin } });
  expect((await other.request.post(origin + "/api/login/options", { data: { digests: {}, clearance: d.clearance }, headers: { Origin: origin } })).status()).toBe(403);
  await other.close();
  const options = await Promise.all([1, 2].map(() => post("/api/login/options", { digests: {}, clearance: d.clearance })));
  expect(options.map(r => r.status()).sort()).toEqual([200, 403]);
  expect((await post("/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary })).status()).toBe(409);
  expect((await request.get("/api/session")).status()).toBe(401);
});

test("concurrent evaluation, cross-context evaluation and bad nonces preserve one-use binding", async ({ request, browser }) => {
  const post = (path: string, data: unknown) => request.post(path, { data, headers: { Origin: origin } });
  const issue = async () => (await post("/api/lavaguard/challenge", { kind: "accessible" })).json();
  const c = await issue(), payload = { id: c.id, nonce: c.nonce, summary: null };
  const other = await browser.newContext();
  await other.request.post(origin + "/api/lavaguard/challenge", { data: { kind: "accessible" }, headers: { Origin: origin } });
  expect((await other.request.post(origin + "/api/lavaguard/evaluate", { data: payload, headers: { Origin: origin } })).status()).toBe(403);
  await other.close();
  const concurrent = await Promise.all([post("/api/lavaguard/evaluate", payload), post("/api/lavaguard/evaluate", payload)]);
  expect(concurrent.map(r => r.status()).sort()).toEqual([200, 409]);
  const d = await issue();
  expect((await post("/api/lavaguard/evaluate", { id: d.id, nonce: "z".repeat(43), summary: null })).status()).toBe(403);
  expect((await post("/api/lavaguard/evaluate", { id: d.id, nonce: d.nonce, summary: null })).status()).toBe(409);
  expect((await request.get("/api/session")).status()).toBe(401);
});
