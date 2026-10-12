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

/** From the landing screen: Enter → Sign in → Skip stirring → passkey. */
export async function signInWithSkip(page: Page, expectSuccess = true): Promise<void> {
  await enter(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Stir the lamp" })).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  if (expectSuccess) await signedIn(page);
}

export const session = (page: Page): Promise<APIResponse> => page.request.get("/api/session");

/** POST with our Origin, as the browser would send it. */
export const post = (page: Page, path: string, data: unknown): Promise<APIResponse> =>
  page.request.post(path, { data, headers: { Origin: ORIGIN } });
