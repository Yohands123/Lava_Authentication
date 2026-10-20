import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: "tests/phase7", workers: 1, timeout: 45000, reporter: "list", outputDir: ".cache/phase7/browser-results",
  use: { baseURL: "http://localhost:8812", ...devices["Desktop Chrome"] },
  webServer: { command: "node scripts/phase7/serve.mjs", url: "http://localhost:8812/api/lavaguard/config", reuseExistingServer: false, timeout: 120000, stdout: "ignore" } });
