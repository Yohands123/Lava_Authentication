import { test, expect } from "@playwright/test";
import { addAuthenticator, register, signOut, enter, clearRing } from "../e2e/helpers";
const origin = "http://localhost:8809";
for (const verdict of ["FLAG", "BLOCK", "ERROR"] as const) test(`failed ${verdict} verdict offers fresh retry/back, no accessible continue`, async ({ page }) => {
  test.setTimeout(60000);
  await page.route("**/api/lavaguard/evaluate", route => verdict === "ERROR" ? route.abort() : route.fulfill({ json: { verdict, retryAfter: 60, alternative: true } }));
  await page.goto("/"); await enter(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (verdict === "ERROR") {
    await page.getByRole("button", { name: "Use a passkey without stirring" }).click();
  } else await clearRing(page);
  const result = page.locator("[data-verdict]"); await expect(result).toBeVisible();
  await expect(page.locator("[data-screen=stir]")).toHaveAttribute("data-guard-state", verdict);
  expect(await result.getByRole("button", { name: /passkey|skip|continue/i }).count()).toBe(0);
  await expect(page.locator("[data-verdict-action]")).toBeFocused();
  if (verdict !== "BLOCK") {
    const ids: string[] = [];
    page.on("response", async r => { if (r.url().endsWith("/api/lavaguard/challenge") && r.ok()) ids.push((await r.json()).id); });
    await result.getByRole("button", { name: /Try again/ }).press("Enter");
    await expect(page.locator("[data-screen=stir]")).toHaveAttribute("data-guard-state", "STIRRING");
    expect(ids).toHaveLength(1);
  } else {
    await expect(result.getByRole("button", { name: /Try again/ })).toHaveCount(0);
    await result.getByRole("button", { name: "Back", exact: true }).press("Enter");
    await expect(page.getByRole("heading", { name: "No passwords here" })).toBeVisible();
  }
  expect((await page.request.get("/api/session")).status()).toBe(401);
});
test("an expired CLEAR cannot redeem permission or a late click", async ({ page }) => {
  test.setTimeout(60000);
  await page.route("**/api/lavaguard/evaluate", route => route.fulfill({ json: { verdict: "CLEAR", clearance: "ui-fixture-only", expiresAt: Date.now() + 6000, alternative: false, retryAfter: 0 } }));
  await page.goto("/"); await enter(page); await page.getByRole("button", { name: "Sign in", exact: true }).click(); await clearRing(page);
  await expect(page.getByRole("button", { name: "Continue with passkey" })).toBeEnabled();
  // Long enough for a slow CI runner to observe CLEAR before it expires.
  await expect(page.locator("[data-screen=stir]")).toHaveAttribute("data-guard-state", "ERROR", { timeout: 20000 });
  await page.locator("[data-verdict-action]").evaluate(el => { const button = el as HTMLElement; button.dataset.action = "passkey"; button.click(); button.click(); });
  expect((await page.request.get("/api/session")).status()).toBe(401);
  await expect(page.getByRole("heading", { name: "You're in" })).not.toBeVisible();
});
test("passkey cancellation returns to sign-in; fresh valid assertion succeeds", async ({ page }) => {
  await addAuthenticator(page); await register(page); await signOut(page); await enter(page);
  await page.evaluate(() => { const get = navigator.credentials.get.bind(navigator.credentials); let first = true;
    navigator.credentials.get = options => { if (first) { first = false; return Promise.reject(new DOMException("Cancelled", "NotAllowedError")); } return get(options); }; });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Use a passkey without stirring" }).click();
  await expect(page.getByRole("heading", { name: "No passwords here" })).toBeVisible();
  expect((await page.request.get("/api/session")).status()).toBe(401);
  const options = page.waitForResponse(r => r.url().endsWith("/api/login/options"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Use a passkey without stirring" }).click();
  expect((await options).status()).toBe(200); await expect(page.getByRole("heading", { name: "You're in" })).toBeVisible();
});
for (const alteration of ["origin", "rp", "uv"] as const) test(`real assertion with invalid ${alteration} never sets an auth cookie`, async ({ page }) => {
  await addAuthenticator(page); await register(page); await signOut(page); await enter(page);
  await page.route("**/api/login/verify", async route => {
    const b = route.request().postDataJSON();
    if (alteration === "origin") { const data = JSON.parse(Buffer.from(b.response.response.clientDataJSON, "base64url").toString()); data.origin = "https://wrong.invalid"; b.response.response.clientDataJSON = Buffer.from(JSON.stringify(data)).toString("base64url"); }
    else { const a = Buffer.from(b.response.response.authenticatorData, "base64url"); if (alteration === "rp") a[0]! ^= 1; else a[32]! &= ~4; b.response.response.authenticatorData = a.toString("base64url"); }
    await route.continue({ postData: JSON.stringify(b) });
  });
  const response = page.waitForResponse(r => r.url().endsWith("/api/login/verify"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.getByRole("button", { name: "Use a passkey without stirring" }).click();
  const result = await response; expect(result.status()).toBe(401); expect(result.headers()["set-cookie"]).toBeUndefined();
  expect((await page.request.get("/api/session")).status()).toBe(401);
  expect((await page.request.post("/api/login/verify", { headers: { Origin: origin }, data: {} })).status()).toBe(400);
});
