import { defineConfig, devices } from "@playwright/test";
import { CHALLENGE_TTL_SECONDS, ORIGIN, PORT } from "./tests/e2e/helpers";

// E2E runs against a real local Worker on its own port, with fresh Durable
// Object state each run and a short challenge TTL so the expiry test is quick.

export default defineConfig({
  testDir: "tests/e2e",
  // Tests share one Worker and one client IP, so run them in order; the
  // rate-limit test runs last so it can't starve the others.
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  reporter: "list",
  use: {
    baseURL: ORIGIN,
    ...devices["Desktop Chrome"],
    // The lamp follows the OS setting; keep motion at full speed in tests.
    reducedMotion: "no-preference",
  },
  webServer: {
    command: [
      `node -e "require('fs').rmSync('.wrangler/e2e',{recursive:true,force:true})"`,
      "npx vite build",
      `npx wrangler dev --port ${PORT} --persist-to .wrangler/e2e --var ORIGIN:${ORIGIN} --var CHALLENGE_TTL_SECONDS:${CHALLENGE_TTL_SECONDS}`,
    ].join(" && "),
    url: `${ORIGIN}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
  },
});
