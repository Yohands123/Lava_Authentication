import { expect, type APIResponse, type CDPSession, type Page } from "@playwright/test";

export const PORT = 8788;
export const ORIGIN = `http://localhost:${PORT}`;
/** Matches --var CHALLENGE_TTL_SECONDS in playwright.config.ts. */
export const CHALLENGE_TTL_SECONDS = 5;

export interface Authenticator {
  cdp: CDPSession;
  id: string;
}

/** Chrome's virtual authenticator: a platform passkey that always verifies the user. */
export async function addAuthenticator(page: Page): Promise<Authenticator> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, id: authenticatorId };
}

/** Copy every passkey from one virtual authenticator to another (a second device). */
export async function copyPasskeys(from: Authenticator, to: Authenticator): Promise<void> {
  const { credentials } = await from.cdp.send("WebAuthn.getCredentials", { authenticatorId: from.id });
  for (const credential of credentials) {
    await to.cdp.send("WebAuthn.addCredential", { authenticatorId: to.id, credential });
  }
}

let counter = 0;
export const uniqueUsername = () => `e2e_${Date.now().toString(36)}_${counter++}`;

const signedIn = (page: Page) => expect(page.getByRole("heading", { name: "You're in" })).toBeVisible();

export async function enter(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByRole("heading", { name: "No passwords here" })).toBeVisible();
}

export async function register(page: Page, username = uniqueUsername()): Promise<string> {
  await page.goto("/");
  await enter(page);
  await page.getByRole("button", { name: "Create a passkey" }).click();
  await page.getByLabel("Choose a username").fill(username);
  await page.getByRole("button", { name: "Create passkey", exact: true }).click();
  await signedIn(page);
  await expect(page.locator("[data-username]")).toHaveText(username);
  return username;
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "LavaAuth" })).toBeVisible();
}

export const passkeyButton = (page: Page) => page.locator("[data-action=passkey]");
export const ringIsClear = (page: Page) => page.locator("[data-screen=stir].is-clear");

/** Wobbly, irregular circles around the ring, the way a person stirs, until the ring is clear. */
export async function clearRing(page: Page, timeoutMs = 30_000): Promise<void> {
  const { width, height } = page.viewportSize()!;
  const cx = width / 2;
  const cy = height / 2;
  const short = Math.min(width, height);
  const start = Date.now();
  let a = 0;
  while (!(await ringIsClear(page).count())) {
    if (Date.now() - start > timeoutMs) throw new Error("ring not cleared in time");
    for (let i = 0; i < 40; i++) {
      a += 0.12 + Math.random() * 0.1; // test input only
      const r = short * (0.08 + 0.3 * Math.abs(Math.sin(a * 0.31)) + Math.random() * 0.03);
      await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a * 1.17) * r);
    }
  }
}

/** From the choose screen's Sign in: clear the ring, then press Sign in. */
export async function stirAndSignIn(page: Page, expectSuccess = true): Promise<void> {
  await expect(page.getByRole("heading", { name: "Stir the lamp" })).toBeVisible();
  await clearRing(page);
  await passkeyButton(page).click();
  if (expectSuccess) await signedIn(page);
}

/** From the landing screen: Enter → Sign in → clear the ring → Sign in → passkey. */
export async function signIn(page: Page, expectSuccess = true): Promise<void> {
  await enter(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await stirAndSignIn(page, expectSuccess);
}

export const session = (page: Page): Promise<APIResponse> => page.request.get("/api/session");

/** POST with our Origin, as the browser would send it. */
export const post = (page: Page, path: string, data: unknown): Promise<APIResponse> =>
  page.request.post(path, { data, headers: { Origin: ORIGIN } });
