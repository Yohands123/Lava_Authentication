import { expect, test } from "@playwright/test";
import {
  CHALLENGE_TTL_SECONDS,
  passkeyButton,
  ringIsClear,
  stirAndSignIn,
  addAuthenticator,
  copyPasskeys,
  enter,
  post,
  register,
  session,
  signIn,
  signOut,
} from "./helpers";

// One Worker, one client IP: rate limiting runs last, in rate-limit.spec.ts.

test("register → log in (clear the ring) → log out", async ({ page }) => {
  await addAuthenticator(page);
  const username = await register(page);
  await signOut(page);
  expect((await session(page)).status()).toBe(401);

  const before = await (await page.request.get("/api/health")).json();
  await enter(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Sign in isn't reachable until the ring is clear.
  await expect(passkeyButton(page)).toHaveAttribute("aria-hidden", "true");
  await stirAndSignIn(page);

  const me = await session(page);
  expect(me.status()).toBe(200);
  expect((await me.json()).user.username).toBe(username);
  // Stirring produced a stir digest that reached the Worker.
  const after = await (await page.request.get("/api/health")).json();
  expect(after.clientDigests.stir * after.challengesIssued).toBeGreaterThan(
    before.clientDigests.stir * before.challengesIssued,
  );

  await signOut(page);
  expect((await session(page)).status()).toBe(401);
});

test("a straight scripted drag can't clear the ring", async ({ page }) => {
  await addAuthenticator(page);
  await register(page);
  await signOut(page);
  await enter(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Stir the lamp" })).toBeVisible();
  const { width, height } = page.viewportSize()!;
  // Back and forth along one line at a constant stride: robotic, so the wax doesn't move.
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i <= 60; i++) {
      const t = pass % 2 ? 1 - i / 60 : i / 60;
      await page.mouse.move(width * (0.2 + 0.6 * t), height / 2);
    }
  }
  await expect(page.locator("[data-status]")).toHaveText("Too regular, keep stirring.");
  expect(await ringIsClear(page).count()).toBe(0);
  await expect(passkeyButton(page)).toHaveAttribute("aria-hidden", "true");
  expect((await session(page)).status()).toBe(401);
});

test("log in with the lamp frozen", async ({ page }) => {
  await addAuthenticator(page);
  await register(page);
  await signOut(page);
  await page.locator("#temperature").fill("0");
  await expect(page.locator("[data-health]")).toHaveText("Lamp offline. Secure generator holding the line.");
  await signIn(page);
  expect((await session(page)).status()).toBe(200);
});

test("login without user verification is refused", async ({ page }) => {
  const key = await addAuthenticator(page);
  await register(page);
  await signOut(page);
  // The passkey is present, but the user fails the biometric/PIN check.
  await key.cdp.send("WebAuthn.setUserVerified", { authenticatorId: key.id, isUserVerified: false });
  await signIn(page, false);
  await expect(page.getByRole("heading", { name: "No passwords here" })).toBeVisible({ timeout: 15_000 });
  expect((await session(page)).status()).toBe(401);
});

test("a reused challenge is rejected with 409", async ({ page }) => {
  await addAuthenticator(page);
  await register(page);
  await signOut(page);

  const verify = page.waitForRequest((r) => r.url().endsWith("/api/login/verify"));
  await signIn(page);
  const body = (await verify).postDataJSON();

  const replay = await post(page, "/api/login/verify", body);
  expect(replay.status()).toBe(409);
  expect((await replay.json()).error.code).toBe("challenge_used");
});

test("an expired challenge is rejected with 410", async ({ page }) => {
  await addAuthenticator(page);
  await register(page);
  await signOut(page);

  // Hold the signed assertion until its challenge has expired.
  await page.route("**/api/login/verify", async (route) => {
    await new Promise((r) => setTimeout(r, (CHALLENGE_TTL_SECONDS + 1.5) * 1000));
    await route.continue();
  });
  const response = page.waitForResponse((r) => r.url().endsWith("/api/login/verify"), { timeout: 20_000 });
  await signIn(page, false);
  expect((await response).status()).toBe(410);
  await expect(page.locator("[data-status]")).toHaveText("That request timed out. Start again.");
  expect((await session(page)).status()).toBe(401);
});

test("sign out everywhere revokes every session", async ({ browser }) => {
  const laptop = await (await browser.newContext()).newPage();
  const phone = await (await browser.newContext()).newPage();
  const laptopKey = await addAuthenticator(laptop);
  const phoneKey = await addAuthenticator(phone);

  await register(laptop);
  await copyPasskeys(laptopKey, phoneKey); // the same passkey, synced to a second device
  await phone.goto("/");
  await signIn(phone);
  expect((await session(laptop)).status()).toBe(200);
  expect((await session(phone)).status()).toBe(200);

  await laptop.getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(laptop.getByRole("heading", { name: "LavaAuth" })).toBeVisible();
  expect((await session(laptop)).status()).toBe(401);
  expect((await session(phone)).status()).toBe(401);
});
