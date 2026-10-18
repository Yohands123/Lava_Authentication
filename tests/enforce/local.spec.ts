import { test, expect } from "@playwright/test";
import { enter, clearRing, addAuthenticator, register, signOut } from "../e2e/helpers";

for (const masked of [false, true]) {
  test(`actual local movement policy with webdriver ${masked ? "hidden" : "reported"}`, async ({ page }) => {
    if (masked) await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false, configurable: true }));
    const config = await (await page.request.get("/api/lavaguard/config")).json();
    expect(config.mode).toBe("enforce");
    const response = page.waitForResponse(r => r.url().endsWith("/api/lavaguard/evaluate"));
    await page.goto("/"); await enter(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await clearRing(page, 45000);
    const evaluated = await response, decision = await evaluated.json();
    expect(decision.verdict).toBe(config.experimentalModel ? "FLAG" : "CLEAR");
    expect(Boolean(decision.clearance)).toBe(!config.experimentalModel);
    const summary = evaluated.request().postDataJSON().summary;
    expect(summary.signals.webdriver).toBe(!masked);
    if (config.experimentalModel) expect(decision.lab.reasons).toContain("experimental_model_anomaly");
    await expect(page.getByRole("heading", { name: config.experimentalModel ? "Let's try that again" : "Ready to sign in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Likely human|Human detected/ })).toHaveCount(0);
    const options = await page.request.post("/api/login/options", { data: { digests: {} }, headers: { Origin: "http://localhost:8786" } });
    expect(options.status()).toBe(403);
    expect((await page.request.get("/api/session")).status()).toBe(401);
  });
}

test("explicit accessible route keeps independent passkey verification working", async ({ page }) => {
  await addAuthenticator(page); await register(page); await signOut(page); await enter(page);
  const request = page.waitForRequest(r => r.url().endsWith("/api/lavaguard/evaluate"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Use a passkey without stirring" }).press("Enter");
  expect((await request).postDataJSON().summary).toBeNull();
  await expect(page.getByRole("heading", { name: "You're in" })).toBeVisible();
});
