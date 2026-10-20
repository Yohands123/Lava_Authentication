import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { addAuthenticator, register, signOut, enter } from "../e2e/helpers";
const origin = "http://localhost:8812", headers = { Origin: origin };
test("real metrics storage failure cannot change normal guard authority or create a session", async ({ page }) => {
  const probeHeaders = { ...headers, "X-Phase7": "local-synthetic-probe" };
  expect((await page.request.post("/__phase7/metrics-failure-on", { headers: probeHeaders })).status()).toBe(200);
  try {
    const c = await (await page.request.post("/api/lavaguard/challenge", { headers, data: { kind: "accessible" } })).json();
    const result = await page.request.post("/api/lavaguard/evaluate", { headers, data: { id: c.id, nonce: c.nonce, summary: null } });
    expect(result.status()).toBe(200); expect((await result.json()).verdict).toBe("CLEAR");
    expect((await page.request.get("/api/session")).status()).toBe(401);
  } finally { expect((await page.request.post("/__phase7/metrics-failure-off", { headers: probeHeaders })).status()).toBe(200); }
});
test("real same-origin proxy preserves passkeys, strict cookies, independent sessions and revocation", async ({ page }) => {
  await addAuthenticator(page); await register(page); await signOut(page);
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "webdriver", { get: () => true, configurable: true });
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, ...args: Parameters<typeof get>) { return String(args[0]).startsWith("webgl") ? null : Reflect.apply(get, this, args); } as typeof get;
  });
  await page.reload(); await enter(page);
  const verification = page.waitForResponse(r => r.url().endsWith("/api/login/verify"));
  await page.getByRole("button", { name: "Sign in", exact: true }).press("Enter");
  const verified = await verification; expect(verified.status()).toBe(200);
  const cookie = (await verified.headerValue("set-cookie"))!;
  for (const flag of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/"]) expect(cookie).toContain(flag);
  await expect(page.getByRole("heading", { name: "You're in" })).toBeVisible();
  const invalid = await page.request.post("/api/login/verify", { headers, data: {} }); expect(invalid.status()).toBe(400); expect(invalid.headers()["set-cookie"]).toBeUndefined();
  expect((await page.request.get("/api/session")).status()).toBe(200);
  expect((await page.request.post("/api/sessions/revoke-all", { headers, data: {} })).status()).toBe(200);
  expect((await page.request.get("/api/session")).status()).toBe(401);
});
test("proxy preserves CSRF origin and single-winner clearance; options never authenticate", async ({ page }) => {
  await page.goto("/");
  expect((await page.request.post("/api/lavaguard/challenge", { headers: { Origin: "https://wrong.invalid", "X-Forwarded-Host": "localhost:8812" }, data: { kind: "accessible" } })).status()).toBe(403);
  expect((await page.request.post("/api/login/options", { headers, data: { digests: {}, verdict: "CLEAR" } })).status()).toBe(400);
  const c = await (await page.request.post("/api/lavaguard/challenge", { headers, data: { kind: "accessible" } })).json();
  const d = await (await page.request.post("/api/lavaguard/evaluate", { headers, data: { id: c.id, nonce: c.nonce, summary: null } })).json();
  const results = await Promise.all(Array.from({ length: 8 }, () => page.request.post("/api/login/options", { headers, data: { digests: {}, clearance: d.clearance } })));
  expect(results.filter(r => r.status() === 200)).toHaveLength(1); expect(results.filter(r => r.status() === 403)).toHaveLength(7);
  expect((await page.request.get("/api/session")).status()).toBe(401);
});
test("local review/history and companion manifest stay consent-gated, and failed deletion is explicit", async ({ page }) => {
  const bodies: string[] = []; page.on("request", r => { if (r.url().includes("/api/")) bodies.push(r.postData() ?? ""); });
  await page.goto("/"); await page.locator("[data-action=lab]").click();
  await expect(page.locator("[data-export-study-manifest]")).toBeDisabled();
  await page.locator("[data-research-consent]").check(); await page.locator("[data-study-device]").selectOption("mouse");
  await page.locator("[data-action=lab]").click(); await enter(page); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("[data-screen=stir]")).toHaveAttribute("data-guard-state", "STIRRING");
  await page.mouse.move(400, 400); await page.mouse.move(420, 430); await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.locator("[data-action=lab]").click();
  await expect(page.locator("[data-study-preview]")).toContainText('"status": "cancelled"');
  await expect(page.locator("[data-study-history]")).toContainText("UNVERIFIED");
  const download = page.waitForEvent("download"); await page.locator("[data-export-study-manifest]").click();
  const manifest = JSON.parse(await readFile((await (await download).path())!, "utf8")); expect(manifest.schema).toBe("lava-local-session-v1"); expect(manifest.attempts).toHaveLength(1);
  expect(JSON.stringify(manifest)).not.toMatch(/cookie|credential|clearance|accountId/);
  expect(bodies.join("\n")).not.toMatch(/"samples"\s*:\s*\[/);
  await page.route("**/api/lavaguard/forget", r => r.abort()); await page.locator("[data-forget-guard]").click();
  await expect(page.locator("[data-guard-metrics]")).toContainText("Server deletion could not be confirmed");
  await expect(page.locator("[data-study-preview]")).toHaveText("No retained attempt."); await expect(page.locator("[data-export-study-manifest]")).toBeDisabled();
});
test("late consent cannot retrospectively capture an already started attempt", async ({ page }) => {
  await page.goto("/"); await enter(page); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("[data-screen=stir]")).toHaveAttribute("data-guard-state", "STIRRING");
  await page.locator("[data-action=lab]").click(); await page.locator("[data-research-consent]").check(); await page.locator("[data-action=lab]").click();
  await page.mouse.move(420, 410); await page.getByRole("button", { name: "Back", exact: true }).click(); await page.locator("[data-action=lab]").click();
  await expect(page.locator("[data-export-study-manifest]")).toBeDisabled(); await expect(page.locator("[data-study-history]")).toHaveText("No retained attempts.");
});
