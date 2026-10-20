import { test, expect } from "@playwright/test";
import { post, ORIGIN, addAuthenticator, register, signOut, enter, session } from "./helpers";
import { extractFeatures } from "../../src/shared/features";
import { FEATURE_VERSION } from "../../src/shared/lavaguard";

test("direct API cannot invent a decision or obtain options without clearance", async ({ page }) => {
  const missing = await post(page, "/api/login/options", { digests: {} });
  expect(missing.status()).toBe(403);
  expect((await missing.json()).error.code).toBe("guard_required");
  const forged = await post(page, "/api/login/options", { digests: {}, verdict: "CLEAR", risk: 0, complete: true });
  expect(forged.status()).toBe(400);
  const badOrigin = await page.request.post("/api/lavaguard/challenge", { data: { kind: "accessible" }, headers: { Origin: "https://other.example" } });
  expect(badOrigin.status()).toBe(403);
  expect((await session(page)).status()).toBe(401);
});

test("accessible clearance is one-use and still requires a verified passkey", async ({ page }) => {
  const c = await (await post(page, "/api/lavaguard/challenge", { kind: "accessible" })).json();
  const result = await (await post(page, "/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary: null })).json();
  expect(result.verdict).toBe("CLEAR"); expect(result.clearance).toHaveLength(43);
  const responses = await Promise.all([1, 2].map(() => post(page, "/api/login/options", { digests: {}, clearance: result.clearance })));
  expect(responses.map(r => r.status()).sort()).toEqual([200, 403]);
  expect((await session(page)).status()).toBe(401);
});

test("concurrent evaluation wins once and another browser cannot redeem clearance", async ({ page, browser }) => {
  const c = await (await post(page, "/api/lavaguard/challenge", { kind: "accessible" })).json();
  const responses = await Promise.all([1, 2].map(() => post(page, "/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary: null })));
  expect(responses.map(r => r.status()).sort()).toEqual([200, 409]);
  const decision = await responses.find(r => r.status() === 200)!.json();
  const other = await browser.newContext();
  const copied = await other.request.post(`${ORIGIN}/api/login/options`, { data: { digests: {}, clearance: decision.clearance }, headers: { Origin: ORIGIN } });
  expect(copied.status()).toBe(403);
  await other.close();
});

test("omitted telemetry FLAGS and raw or forged fields are rejected", async ({ page }) => {
  const c = await (await post(page, "/api/lavaguard/challenge", { kind: "gesture" })).json();
  const missing = await (await post(page, "/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce })).json();
  expect(missing.verdict).toBe("FLAG"); expect(missing.clearance).toBeUndefined();
  const bad = await post(page, "/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary: { raw: [[1, 2, 3]], risk: 0 } });
  expect(bad.status()).toBe(400);
  const oversized = await post(page, "/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary: "x".repeat(9000) });
  expect(oversized.status()).toBe(400);
});

test("shadow evaluates actual summaries and repeated geometry without behavioral punishment", async ({ page }) => {
  const summary = { version: FEATURE_VERSION, features: extractFeatures(Array.from({ length: 40 }, (_, i) => ({ x: i / 40, y: .5, t: i * 32 }))), fingerprint: "s".repeat(43), geometryHash: "t".repeat(43) };
  for (let i = 0; i < 2; i++) {
    const c = await (await post(page, "/api/lavaguard/challenge", { kind: "gesture" })).json();
    const d = await (await post(page, "/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary })).json();
    expect(d.verdict).toBe("CLEAR");
    expect(d.assessment).toBe("shadow");
    if (i) expect(d.lab.reasons).toContain("recent_path_recurrence");
  }
  const forbidden = await post(page, "/api/lavaguard/review", { context: "a".repeat(43), reason: "forged review" });
  expect(forbidden.status()).toBe(403);
  expect((await post(page, "/api/lavaguard/forget", {})).status()).toBe(200);
  expect((await (await page.request.get("/api/lavaguard/lab")).json()).history.recent).toEqual([]);
});

test("the no-stir passkey route is hidden from pointer users and revealed by Tab", async ({ page }) => {
  await page.goto("/"); await enter(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const alternative = page.getByRole("button", { name: "Use a passkey without stirring" });
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
  expect((await alternative.boundingBox())!.width).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Back", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(alternative).toBeFocused();
  expect((await alternative.boundingBox())!.width).toBeGreaterThan(100);
});

test("keyboard alternative completes separate passkey authentication", async ({ page }) => {
  await addAuthenticator(page); await register(page); await signOut(page); await enter(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Use a passkey without stirring" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "You're in" })).toBeVisible();
  expect((await session(page)).status()).toBe(200);
});

test("no WebGL uses explicit accessible issuance without movement telemetry", async ({ page }) => {
  await addAuthenticator(page); await register(page); await signOut(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (args[0] === "webgl2") return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.reload(); await enter(page);
  const issued = page.waitForRequest(r => r.url().endsWith("/api/lavaguard/challenge"));
  const evaluated = page.waitForRequest(r => r.url().endsWith("/api/lavaguard/evaluate"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await issued).postDataJSON().kind).toBe("accessible");
  expect((await evaluated).postDataJSON().summary).toBeNull();
  await expect(page.getByRole("heading", { name: "You're in" })).toBeVisible();
});

test("corroborated protocol replay causes a temporary server restriction", async ({ page }) => {
  const c = await (await post(page, "/api/lavaguard/challenge", { kind: "accessible" })).json();
  const payload = { id: c.id, nonce: c.nonce, summary: null };
  expect((await post(page, "/api/lavaguard/evaluate", payload)).status()).toBe(200);
  for (let i = 0; i < 3; i++) expect((await post(page, "/api/lavaguard/evaluate", payload)).status()).toBe(409);
  const restricted = await post(page, "/api/lavaguard/challenge", { kind: "accessible" });
  expect(restricted.status()).toBe(429);
  const result = await restricted.json(); expect(result.verdict).toBe("BLOCK");
  expect(Number(restricted.headers()["retry-after"])).toBeGreaterThan(0);
});
