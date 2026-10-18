import { defineConfig, devices } from "@playwright/test";

const origin = "http://localhost:8786";
const research = process.env.LAVAGUARD_RESEARCH === "1";
export default defineConfig({
  testDir: "tests/enforce", workers: 1, fullyParallel: false, timeout: 60000,
  reporter: "list",
  use: { baseURL: origin, ...devices["Desktop Chrome"], reducedMotion: "no-preference" },
  webServer: {
    command: `npx vite build --outDir .cache/e2e-assets-enforce && npx wrangler dev --port 8786 --assets .cache/e2e-assets-enforce --persist-to .wrangler/enforce-e2e-${Date.now()} --var ORIGIN:${origin} --var LAVAGUARD_MODE:enforce --var LAVAGUARD_EXPERIMENTAL_MODEL:${research ? 1 : 0}`,
    url: `${origin}/api/lavaguard/config`, reuseExistingServer: false, timeout: 120000, stdout: "ignore",
  },
});
