import { expect, test } from "@playwright/test";
import { addAuthenticator, register, session, signIn, signOut } from "./helpers";

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

  // 0:18 Log in. Stir the wax out of the ring; Sign in appears; passkey; lamp glows.
  await signOut(page);
  await signIn(page);

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

  // 0:48 Log in again while frozen: the wax is thick but still stirs out. It works.
  await signOut(page);
  await signIn(page);
  expect((await session(page)).status()).toBe(200);
  await expect(meter("digests")).toHaveText(/^stir [0-9a-f]{8}… · lamp none · camera none$/);
  await page.waitForTimeout(2500); // frost and ice palette settle
  await page.screenshot({ path: "test-results/demo-frozen.png" });
});
