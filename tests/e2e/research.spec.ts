import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { enter, clearRing } from "./helpers";
import { validateResearchExport } from "../../src/shared/research";

test("local research requires consent before the attempt, exports provenance and deletes", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-action=lab]").click();
  await expect(page.locator("[data-research-consent]")).toBeVisible();
  await expect(page.locator("[data-export-research]")).toBeDisabled();
  await page.locator("[data-research-consent]").check();
  await expect(page.locator("[data-study-participant]")).not.toHaveValue("");
  await page.locator("[data-study-device]").selectOption("trackpad");
  await page.locator("[data-study-label]").selectOption("automation-declared");
  await page.locator("[data-study-environment]").selectOption("headless-playwright");
  await page.locator("[data-study-control]").selectOption("scripted");
  await page.locator("[data-study-display]").selectOption("headless");
  await page.getByText("Declared automation provenance", { exact: true }).click();
  for (const [field, value] of Object.entries({ family: "e2e-corrections", revision: "phase5-test-v1", seed: "42", run: "e2e-capture-run", trajectory: "e2e-path-lineage" })) await page.locator(`[data-generator-${field}]`).fill(value);
  await page.locator("[data-action=lab]").click();
  await enter(page); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await clearRing(page);
  await page.locator("[data-action=lab]").click();
  await expect(page.locator("[data-export-research]")).toBeEnabled();
  const downloaded = page.waitForEvent("download");
  await page.locator("[data-export-research]").click();
  const data = JSON.parse(await readFile((await (await downloaded).path())!, "utf8"));
  expect(data.schema).toBe("lava-consent-v3"); expect(data.device).toBe("trackpad");
  expect(data.label).toBe("automation-declared"); expect(data.participant).toBeTruthy();
  expect(data.environment).toMatchObject({ version: "lava-research-environment-v1", declaredEnvironment: "headless-playwright", declaredControl: "scripted", displayMode: "headless",
    evidence: { version: "lava-automation-environment-v1", authority: "advisory", signals: { webdriver: true } } });
  expect(Object.keys(data.environment.evidence.signals).sort()).toEqual(["headlessBrand", "headlessUserAgent", "webdriver"]);
  expect(data.samples.length).toBeGreaterThan(0); expect(data.outcome.status).toBe("completed");
  expect(validateResearchExport(data).data).not.toBeNull();
  expect(JSON.stringify(data)).not.toMatch(/clearance|cookie|credential|accountId|camera/);
  const deletion = page.waitForResponse(r => r.url().endsWith("/api/lavaguard/forget"));
  await page.locator("[data-forget-guard]").click(); expect((await deletion).status()).toBe(200);
  await expect(page.locator("[data-study-participant]")).toHaveValue("");
  await expect(page.locator("[data-export-research]")).toBeDisabled();
  await expect(page.locator("[data-research-consent]")).not.toBeChecked();
});

test("consented cancelled attempts remain exportable, session retries stay grouped and withdrawal clears them", async ({ page }) => {
  await page.goto("/"); await page.locator("[data-action=lab]").click();
  await page.locator("[data-research-consent]").check();
  await page.locator("[data-study-device]").selectOption("unknown");
  await page.locator("[data-action=lab]").click(); await enter(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("[data-screen=stir]")).toHaveAttribute("data-guard-state", "STIRRING");
    await page.mouse.move(600, 400); await page.mouse.move(610, 410);
    await page.getByRole("button", { name: "Back", exact: true }).click();
  }
  await page.locator("[data-action=lab]").click();
  await expect(page.locator("[data-study-quality]")).toContainText("2/32");
  const downloaded = page.waitForEvent("download"); await page.locator("[data-export-research-all]").click();
  const batch = JSON.parse(await readFile((await (await downloaded).path())!, "utf8"));
  expect(batch.exports).toHaveLength(2);
  expect(new Set(batch.exports.map((r: { session: string }) => r.session)).size).toBe(1);
  expect(new Set(batch.exports.map((r: { participant: string }) => r.participant)).size).toBe(1);
  expect(batch.exports.every((r: { outcome: { status: string }; label: string }) => r.outcome.status === "cancelled" && r.label === "unlabeled")).toBe(true);
  await page.locator("[data-decline-research]").click();
  await expect(page.locator("[data-export-research-all]")).toBeDisabled();
  await expect(page.locator("[data-study-participant]")).toHaveValue("");
});

test("late consent cannot recover an earlier attempt and declined research still permits passkeys", async ({ page, request }) => {
  const evaluated = page.waitForRequest(r => r.url().endsWith("/api/lavaguard/evaluate"));
  await page.goto("/"); await enter(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await clearRing(page);
  expect((await evaluated).postDataJSON().summary.automationEnvironment).toBeUndefined();
  await page.locator("[data-action=lab]").click(); await page.locator("[data-research-consent]").check();
  await expect(page.locator("[data-export-research]")).toBeDisabled();
  await page.locator("[data-decline-research]").click(); await expect(page.locator("[data-research-consent]")).not.toBeChecked();
  expect((await request.get("/api/session")).status()).toBe(401);
  await expect(page.getByRole("button", { name: "Continue with passkey" })).toBeVisible();
});

test("withdrawal during stirring removes the pending advisory environment snapshot", async ({ page }) => {
  await page.goto("/"); await page.locator("[data-action=lab]").click();
  await page.locator("[data-research-consent]").check();
  await page.locator("[data-action=lab]").click(); await enter(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("[data-screen=stir]")).toHaveAttribute("data-guard-state", "STIRRING");
  await page.locator("[data-action=lab]").click(); await page.locator("[data-decline-research]").click();
  await page.locator("[data-action=lab]").click();
  const request = page.waitForRequest(r => r.url().endsWith("/api/lavaguard/evaluate"));
  await clearRing(page); expect((await request).postDataJSON().summary.automationEnvironment).toBeUndefined();
  await page.locator("[data-action=lab]").click();
  await expect(page.locator("[data-export-research]")).toBeDisabled();
  await expect(page.locator("[data-guard-features]")).toContainText("Not retained");
});
