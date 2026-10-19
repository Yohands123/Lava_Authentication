import { test, expect } from "@playwright/test";
import { enter, clearRing, ORIGIN } from "./helpers";

// Only the decision response is mocked: real WebGL, pointer stirring and DOM.
// These are design fixtures, never classification evidence.
for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  for (const verdict of ["CLEAR", "FLAG", "BLOCK"] as const) {
    test(`in-ring ${verdict} at ${viewport.width}px`, async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize(viewport);
      await page.route("**/api/lavaguard/evaluate", route => route.fulfill({ json: { verdict, retryAfter: verdict === "BLOCK" ? 60 : 0, alternative: verdict !== "BLOCK", assessment: "evaluated", ...(verdict === "CLEAR" ? { clearance: "fixture" } : {}) } }));
      await page.goto("/"); await enter(page);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.locator("[data-screen=stir]")).toHaveAttribute("data-guard-state", "STIRRING");
      await clearRing(page);
      const result = page.locator("[data-verdict]");
      await expect(result).toBeVisible();
      await expect(page.locator("[data-screen=stir]")).toHaveAttribute("data-guard-state", verdict);
      expect(await page.locator("[data-verdict]:visible").count()).toBe(1);
      expect(await page.locator("[role=dialog]:visible").count()).toBe(0);
      const geometry = await page.evaluate(() => {
        const box = document.querySelector("[data-ring-arc]")!.getBoundingClientRect();
        const surface = document.querySelector("[data-verdict]")!.getBoundingClientRect();
        const nodes = [...document.querySelectorAll<HTMLElement>(".verdict-content > *")].filter(e => !e.hidden && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0);
        const radius = box.width / 2 + 3, cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        return { sameCircle: Math.abs(box.x - surface.x) < 3 && Math.abs(box.y - surface.y) < 3 && Math.abs(box.width - surface.width) < 4,
          inside: nodes.every(e => { const b = e.getBoundingClientRect(); return [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]].every(([x, y]) => Math.hypot(x! - cx, y! - cy) <= radius); }),
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(geometry).toEqual({ sameCircle: true, inside: true, overflow: false });
      await page.waitForTimeout(900);
      await page.screenshot({ path: `docs/media/lavaguard/${verdict.toLowerCase()}-${viewport.width}.png` });
      await page.screenshot({ path: `docs/media/lavaguard/phase7-${verdict.toLowerCase()}-${viewport.width}.png` });
      if (verdict === "FLAG") {
        const issued = page.waitForResponse(r => r.url().endsWith("/api/lavaguard/challenge"));
        await page.getByRole("button", { name: /Try again/ }).click();
        expect((await issued).status()).toBe(200);
        await expect(page.locator("[data-screen=stir]")).toHaveAttribute("data-guard-state", "STIRRING");
        expect(page.url()).toBe(`${ORIGIN}/`);
      }
      if (verdict === "BLOCK") {
        await expect(page.getByRole("button", { name: /Try again/ })).toHaveCount(0);
        await page.getByRole("button", { name: "Back", exact: true }).click();
        await expect(page.getByRole("heading", { name: "No passwords here" })).toBeVisible();
      }
    });
  }
}

test("cancel slow network without stale verdict and retry network errors", async ({ page }) => {
  await page.route("**/api/lavaguard/challenge", async route => {
    await new Promise(r => setTimeout(r, 1200));
    await route.abort();
  });
  await page.goto("/"); await enter(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForTimeout(1500);
  await expect(page.getByRole("heading", { name: "No passwords here" })).toBeVisible();
  await expect(page.locator("[data-verdict]")).not.toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Connection interrupted" })).toBeVisible();
});

test("reduced motion keeps the verdict still and the fallback remains keyboard accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/lavaguard/evaluate", route => route.fulfill({ json: { verdict: "FLAG", retryAfter: 0, alternative: true } }));
  await page.goto("/"); await enter(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await clearRing(page);
  await expect(page.getByRole("heading", { name: "Let's try that again" })).toBeVisible();
  const motion = await page.locator(".verdict-fluid i").first().evaluate(e => getComputedStyle(e).animationName);
  expect(motion).toBe("none");
  await expect(page.getByRole("button", { name: "Use a passkey instead" })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to sign-in" }).press("Enter");
  await page.getByRole("button", { name: "Sign in", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Use a passkey without stirring" }).focus();
  await expect(page.getByRole("button", { name: "Use a passkey without stirring" })).toBeFocused();
});

test("a real shadow decision is never presented as human detection", async ({ page }) => {
  await page.goto("/"); await enter(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await clearRing(page);
  await expect(page.getByRole("heading", { name: "Interaction recorded" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Human detected|Likely human/i })).toHaveCount(0);
});
