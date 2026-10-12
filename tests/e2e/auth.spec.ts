import { expect, test } from "@playwright/test";
import {
  CHALLENGE_TTL_SECONDS,
  addAuthenticator,
  copyPasskeys,
  enter,
  post,
  register,
  session,
  signInWithSkip,
  signOut,
} from "./helpers";

// Order matters: one Worker, one client IP. Rate limiting runs last.

test("register → log in (hold Space to stir) → log out", async ({ page }) => {
  await addAuthenticator(page);
  const username = await register(page);
  await signOut(page);
  expect((await session(page)).status()).toBe(401);

  const before = await (await page.request.get("/api/health")).json();
  await enter(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Stir the lamp" })).toBeVisible();
  // Space on a focused button would press it; stir from the page itself.
  await page.waitForTimeout(800);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.down("Space");
  await expect(page.getByRole("heading", { name: "You're in" })).toBeVisible({ timeout: 20_000 });
  await page.keyboard.up("Space");

  const me = await session(page);
  expect(me.status()).toBe(200);
  expect((await me.json()).user.username).toBe(username);
  // Keyboard stirring produced a stir digest that reached the Worker.
  const after = await (await page.request.get("/api/health")).json();
  expect(after.clientDigests.stir * after.challengesIssued).toBeGreaterThan(
    before.clientDigests.stir * before.challengesIssued,
  );

  await signOut(page);
  expect((await session(page)).status()).toBe(401);
});

test("log in with stirring skipped", async ({ page }) => {
  await addAuthenticator(page);
  await register(page);
  await signOut(page);
  await signInWithSkip(page);
  expect((await session(page)).status()).toBe(200);
});

test("log in with the lamp frozen", async ({ page }) => {
  await addAuthenticator(page);
  await register(page);
  await signOut(page);
  await page.locator("#temperature").fill("0");
  await expect(page.locator("[data-health]")).toHaveText("Lamp offline. Secure generator holding the line.");
  await signInWithSkip(page);
  expect((await session(page)).status()).toBe(200);
});

test("login without user verification is refused", async ({ page }) => {
  const key = await addAuthenticator(page);
  await register(page);
  await signOut(page);
  // The passkey is present, but the user fails the biometric/PIN check.
  await key.cdp.send("WebAuthn.setUserVerified", { authenticatorId: key.id, isUserVerified: false });
  await signInWithSkip(page, false);
  await expect(page.getByRole("heading", { name: "No passwords here" })).toBeVisible({ timeout: 15_000 });
  expect((await session(page)).status()).toBe(401);
});

test("a reused challenge is rejected with 409", async ({ page }) => {
  await addAuthenticator(page);
  await register(page);
  await signOut(page);

  const verify = page.waitForRequest((r) => r.url().endsWith("/api/login/verify"));
  await signInWithSkip(page);
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
  await signInWithSkip(page, false);
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
  await signInWithSkip(phone);
  expect((await session(laptop)).status()).toBe(200);
  expect((await session(phone)).status()).toBe(200);

  await laptop.getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(laptop.getByRole("heading", { name: "LavaAuth" })).toBeVisible();
  expect((await session(laptop)).status()).toBe(401);
  expect((await session(phone)).status()).toBe(401);
});

test("too many login attempts are rate limited with 429", async ({ page }) => {
  await page.goto("/");
  let limited = null;
  for (let i = 0; i < 25 && !limited; i++) {
    const res = await post(page, "/api/login/options", { digests: {} });
    if (res.status() === 429) limited = res;
    else expect(res.status()).toBe(200);
  }
  expect(limited, "no 429 within 25 requests").not.toBeNull();
  expect((await limited!.json()).error.code).toBe("rate_limited");
  expect(Number(limited!.headers()["retry-after"])).toBeGreaterThan(0);
});
