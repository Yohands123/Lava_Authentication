import { expect, test } from "@playwright/test";
import { addAuthenticator, enter, register, session, signInWithSkip, signOut } from "./helpers";

// README "Demo script", start to finish, without touching code. The final
// beat (a real lava lamp in front of the webcam) needs a camera, so it's manual.

test("the README demo script runs end to end", async ({ page }) => {
  await addAuthenticator(page);
  const lab = page.locator("[data-lab]");
  const meter = (name: string) => lab.locator(`[data-meter="${name}"]`);
  const flow = (name: string) => lab.locator(`path[data-flow="${name}"]`);

  // 0:00 Landing. Move the cursor; blobs rise toward it.
  await page.goto("/");
  for (let i = 0; i < 20; i++) await page.mouse.move(400 + i * 12, 420 - i * 6);

  // 0:08 Enter → Sign up. Portal forms, passkey, burst.
  await register(page);

  // 0:18 Log in. Stir the lamp (hold Space); ring fills; passkey; lamp glows.
  await signOut(page);
  await enter(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Stir the lamp" })).toBeVisible();
  await page.waitForTimeout(800);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.down("Space");
  await expect(page.getByRole("heading", { name: "You're in" })).toBeVisible({ timeout: 20_000 });
  await page.keyboard.up("Space");

  // 0:30 Open Lab mode. The pipeline and meters show real numbers.
  await page.getByRole("button", { name: "Lab mode" }).click();
  await expect(lab).toBeVisible();
  await expect(meter("stir")).toHaveText(/^\d+ bits, conservative estimate$/);
  await expect(meter("lamp")).toHaveText(/^healthy · [1-9]\d* ok · 0 rejected$/);
  await expect(meter("challenges")).toHaveText(/^[1-9]\d* issued · \d+ expired · \d+ reused$/);
  await expect(meter("digests")).toHaveText(/^stir [0-9a-f]{8}… · lamp [0-9a-f]{8}… · camera none$/);
  await expect(meter("tests")).toHaveText(/^monobit p [01]\.\d\d pass · runs p [01]\.\d\d pass · \d+ bits$/);
  await expect(flow("stir")).toHaveAttribute("data-state", "active");
  await expect(flow("server")).toHaveAttribute("data-state", "active");
  await page.waitForTimeout(1200); // let the panel finish fading in
  await page.screenshot({ path: "test-results/demo-lab.png" });

  // 0:40 Freeze the Lamp. Wax stops, frost spreads, health goes red.
  await page.locator("#temperature").fill("0");
  await expect(page.locator("[data-health]")).toHaveText("Lamp offline. Secure generator holding the line.");
  await expect(meter("lamp")).toHaveText("offline, frozen");
  await expect(flow("lamp")).toHaveAttribute("data-state", "frozen");
  await expect(flow("server")).toHaveAttribute("data-state", "active");

  // 0:48 Log in again while frozen. It works.
  await signOut(page);
  await signInWithSkip(page);
  expect((await session(page)).status()).toBe(200);
  await expect(meter("stir")).toHaveText("skipped, not sent");
  await expect(meter("digests")).toHaveText(/lamp none · camera none$/);
  await page.waitForTimeout(2500); // frost and ice palette settle
  await page.screenshot({ path: "test-results/demo-frozen.png" });
});
