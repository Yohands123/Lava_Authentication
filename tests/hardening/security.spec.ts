import { forgedPlausibleFeatures } from "../fixtures/forged";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { extractFeatures } from "../../src/shared/features";
import { clearRing, enter } from "../e2e/helpers";
const origin = "http://localhost:8784";
const post = (r: APIRequestContext, path: string, data: unknown) => r.post(path, { data, headers: { Origin: origin } });
const summary = { version: "lava-features-v1", fingerprint: "f".repeat(43), geometryHash: "g".repeat(43), features: extractFeatures(Array.from({ length: 40 }, (_, i) => ({ x: i / 40, y: .5, t: i * 32 }))) };
async function fastForgery(r: APIRequestContext) {
  const c = await (await post(r, "/api/lavaguard/challenge", { kind: "gesture" })).json();
  return (await post(r, "/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary })).json();
}
// Warm the Worker and ChallengeStore from a separate cookie context, so a cold
// start on a slow runner cannot push the first forgery past the 200 ms window.
test.beforeAll(async ({ playwright }) => {
  const warm = await playwright.request.newContext({ baseURL: origin });
  await post(warm, "/api/lavaguard/challenge", { kind: "gesture" });
  await warm.dispose();
});
test("rapid no-ring forgery requires verification, which remains bound and one-use", async ({ request, playwright }) => {
  const decision = await fastForgery(request);
  expect(decision.verdict).toBe("FLAG"); expect(decision.clearance).toBeUndefined(); expect(decision.stepUp.id).toHaveLength(43);
  expect((await post(request, "/api/login/options", { digests: {} })).status()).toBe(403);
  const other = await playwright.request.newContext({ baseURL: origin });
  await post(other, "/api/lavaguard/challenge", { kind: "accessible" });
  expect((await post(other, "/api/lavaguard/verify", { id: decision.stepUp.id, token: "XXXX.DUMMY.TOKEN.XXXX" })).status()).toBe(403);
  await other.dispose();
  // This calls the actual official Siteverify service once with public dummy keys.
  const verified = await post(request, "/api/lavaguard/verify", { id: decision.stepUp.id, token: "XXXX.DUMMY.TOKEN.XXXX" });
  expect(verified.status()).toBe(200);
  const clear = await verified.json(); expect(clear.clearance).toHaveLength(43);
  expect((await post(request, "/api/lavaguard/verify", { id: decision.stepUp.id, token: "XXXX.DUMMY.TOKEN.XXXX" })).status()).toBe(403);
  const options = await Promise.all([1, 2].map(() => post(request, "/api/login/options", { digests: {}, clearance: clear.clearance })));
  expect(options.map(r => r.status()).sort()).toEqual([200, 403]);
  expect((await request.get("/api/session")).status()).toBe(401);
});
test("accessible continuation cannot silently drop an existing required verification", async ({ request }) => {
  await fastForgery(request);
  const c = await (await post(request, "/api/lavaguard/challenge", { kind: "accessible" })).json();
  const result = await (await post(request, "/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary: null })).json();
  expect(result.verdict).toBe("FLAG"); expect(result.clearance).toBeUndefined(); expect(result.stepUp).toBeTruthy();
  expect((await post(request, "/api/lavaguard/verify", { id: result.stepUp.id, token: "" })).status()).toBe(400);
});
test("with step-up on, a direct no-stir request gets verification, never a free clearance", async ({ playwright }) => {
  const client = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { "CF-Connecting-IP": "192.0.2.77" } });
  const c = await (await post(client, "/api/lavaguard/challenge", { kind: "accessible" })).json();
  const result = await (await post(client, "/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary: null })).json();
  expect(result.verdict).toBe("FLAG"); expect(result.clearance).toBeUndefined(); expect(result.stepUp.id).toHaveLength(43);
  expect((await post(client, "/api/login/options", { digests: {} })).status()).toBe(403);
  await client.dispose();
});
test("a delayed fabricated summary remains a documented residual bypass", async ({ request }) => {
  const c = await (await post(request, "/api/lavaguard/challenge", { kind: "gesture" })).json();
  await new Promise(resolve => setTimeout(resolve, 250));
  const forged = { ...summary, features: forgedPlausibleFeatures() };
  const result = await (await post(request, "/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary: forged })).json();
  expect(result.verdict).toBe("CLEAR");
  expect((await post(request, "/api/login/options", { digests: {}, clearance: result.clearance })).status()).toBe(200);
  expect((await request.get("/api/session")).status()).toBe(401);
});
test("request caps apply to authentication routes and operational metrics require authorization", async ({ request }) => {
  expect((await request.get("/api/session", { headers: { Cookie: "lava_session=" + "x".repeat(43) } })).status()).toBe(401);
  expect((await post(request, "/api/register/options", { username: "x".repeat(40000) })).status()).toBe(400);
  expect((await request.get("/api/lavaguard/metrics")).status()).toBe(403);
  const response = await request.get("/api/lavaguard/metrics", { headers: { Authorization: "Bearer local-only-fixture-admin-key-00000000000000" } });
  expect(response.status()).toBe(200);
  const body = await response.json(); expect(body.policyVersion).toBe("lava-policy-v4");
  expect(JSON.stringify(body)).not.toMatch(/fingerprint|nonce|clearance|secret|context/);
});
test("alternating accessible/gesture limits cannot reduce the shared count; pending attempts are bounded", async ({ playwright }) => {
  const client = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { "CF-Connecting-IP": "192.0.2.220" } });
  const first = await (await post(client, "/api/lavaguard/challenge", { kind: "gesture" })).json();
  for (let i=0;i<15;i++) expect((await post(client, "/api/lavaguard/challenge", { kind: "gesture" })).status()).toBe(200);
  expect((await post(client, "/api/lavaguard/challenge", { kind: "gesture" })).status()).toBe(429);
  expect((await post(client, "/api/lavaguard/challenge", { kind: "accessible" })).status()).toBe(429);
  expect((await post(client, "/api/lavaguard/challenge", { kind: "gesture" })).status()).toBe(429);
  expect((await post(client, "/api/lavaguard/evaluate", { id: first.id, nonce: first.nonce, summary })).status()).toBe(409);
  await client.dispose();
});
test("optional provider presentation is inside the original circle and CSP is scoped", async ({ page }) => {
  const response = await page.goto("/");
  expect(response!.headers()["content-security-policy"]).toContain("https://challenges.cloudflare.com");
  expect(await page.locator("[data-verdict] [data-guard-widget]").count()).toBe(1);
  await expect(page.locator("[data-guard-verify]")).toBeHidden();
});
test("verification network failure keeps the in-circle retry and keyboard recovery", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const c = await (await post(page.request, "/api/lavaguard/challenge", { kind: "accessible" })).json();
  expect((await post(page.request, "/api/lavaguard/evaluate", { id: c.id, nonce: "z".repeat(43), summary: null })).status()).toBe(403);
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js**", route => route.abort());
  await page.goto("/"); await enter(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await clearRing(page);
  await expect(page.locator("[data-guard-verify]")).toBeVisible();
  await page.locator("[data-guard-verify]").focus(); await page.keyboard.press("Enter");
  await expect(page.locator("[data-verdict-note]")).toContainText("Verification couldn't finish");
  await expect(page.locator("[data-guard-verify]")).toBeFocused();
  await expect(page.locator("[data-action=passkey]")).toHaveCount(0);
  const issued = page.waitForResponse(r => r.url().endsWith("/api/lavaguard/challenge"));
  await page.getByRole("button", { name: /^Try again/ }).click(); expect((await issued).status()).toBe(200);
  await expect(page.locator("[data-screen=stir]")).toHaveAttribute("data-guard-state", "STIRRING");
});
test("official dummy widget reaches the real verification endpoint and its used token is refused", async ({ page }) => {
  const c = await (await post(page.request, "/api/lavaguard/challenge", { kind: "accessible" })).json();
  expect((await post(page.request, "/api/lavaguard/evaluate", { id: c.id, nonce: "y".repeat(43), summary: null })).status()).toBe(403);
  await page.goto("/"); await enter(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await clearRing(page);
  const submitted = page.waitForRequest(r => r.url().endsWith("/api/lavaguard/verify"));
  const verified = page.waitForResponse(r => r.url().endsWith("/api/lavaguard/verify"));
  await page.locator("[data-guard-verify]").click();
  expect((await submitted).postDataJSON().token).toBe("XXXX.DUMMY.TOKEN.XXXX");
  // The first API test consumed this globally constant public dummy token.
  expect((await verified).status()).toBe(403);
  await expect(page.locator("[data-verdict-note]")).toContainText("Verification couldn't finish");
  expect((await page.request.get("/api/session")).status()).toBe(401);
});
