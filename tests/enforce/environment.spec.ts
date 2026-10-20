import { forgedPlausibleFeatures } from "../fixtures/forged";
import { test, expect } from "@playwright/test";
import { FEATURE_VERSION } from "../../src/shared/lavaguard";
import { collectAutomationEnvironment } from "../../src/shared/automation-environment";
import { addAuthenticator, enter, register, signOut } from "../e2e/helpers";

const origin = "http://localhost:8786";
test("positive environment hints alone cannot refuse clearance or authenticate a credential-free browser", async ({ browser }) => {
  // Generated aggregates isolate environment effects, not human evidence.
  // The separate movement-policy tests exercise actual ring observation.
  for (const environment of [undefined, collectAutomationEnvironment({ webdriver: true, userAgent: "HeadlessChrome/1", userAgentData: { brands: [{ brand: "HeadlessChrome" }] } }), { version: "unsupported", rawUA: "discard" }]) {
    const context = await browser.newContext();
    try {
      const post = (path: string, data: unknown) => context.request.post(origin + path, { data, headers: { Origin: origin } });
      const challenge = await (await post("/api/lavaguard/challenge", { kind: "gesture" })).json();
      const summary = { version: FEATURE_VERSION, fingerprint: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"), geometryHash: "g".repeat(43),
        signals: { webdriver: false }, ...(environment ? { automationEnvironment: environment } : {}),
        features: forgedPlausibleFeatures() };
      const result = await (await post("/api/lavaguard/evaluate", { id: challenge.id, nonce: challenge.nonce, summary })).json();
      expect(result.verdict).toBe("CLEAR"); expect(result.clearance).toHaveLength(43);
      expect(result.lab.automationEnvironment.enforcementContribution).toBe(0);
      expect(result.lab.automationEnvironment.operatorIdentity).toBe("unknown");
      expect((await post("/api/login/options", { digests: {}, clearance: result.clearance })).status()).toBe(200);
      expect((await context.request.get(origin + "/api/session")).status()).toBe(401);
      // The page's own navigator.webdriver report does withhold this gesture's clearance.
      const second = await (await post("/api/lavaguard/challenge", { kind: "gesture" })).json();
      const reported = await (await post("/api/lavaguard/evaluate", { id: second.id, nonce: second.nonce, summary: { ...summary, signals: { webdriver: true } } })).json();
      expect(reported.verdict).toBe("FLAG"); expect(reported.clearance).toBeUndefined();
    } finally { await context.close(); }
  }
});

test("a declared human takeover with positive hints can use the accessible verified passkey route", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { configurable: true, get: () => true }));
  await addAuthenticator(page); await register(page); await signOut(page);
  await page.locator("[data-action=lab]").click(); await page.locator("[data-research-consent]").check();
  await page.locator("[data-study-environment]").selectOption("human-controlled-automation");
  await page.locator("[data-study-control]").selectOption("human");
  await page.locator("[data-action=lab]").click(); await enter(page);
  const request = page.waitForRequest(r => r.url().endsWith("/api/lavaguard/evaluate"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Use a passkey without stirring" }).press("Enter");
  expect((await request).postDataJSON().summary).toBeNull();
  await expect(page.getByRole("heading", { name: "You're in" })).toBeVisible();
  // The operator selection is an adversarial declaration in this scripted test.
  // It is never counted as a genuine human participant or labeled human data.
});
