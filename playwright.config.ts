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
  // Software WebGL on CI runners makes multi-sign-in tests much slower.
  timeout: process.env.CI ? 180_000 : 45_000,
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
      "npx vite build --outDir .cache/e2e-assets-shadow",
      `npx wrangler dev --port ${PORT} --assets .cache/e2e-assets-shadow --persist-to .wrangler/e2e --var ORIGIN:${ORIGIN} --var CHALLENGE_TTL_SECONDS:${CHALLENGE_TTL_SECONDS} --var LAVAGUARD_MODE:shadow --var LAVAGUARD_EXPERIMENTAL_MODEL:0`,
    ].join(" && "),
    url: `${ORIGIN}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
  },
});
