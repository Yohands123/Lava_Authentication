import { defineConfig, devices } from "@playwright/test";
export default defineConfig({testDir:"tests/phase6",workers:1,timeout:process.env.CI?150000:45000,reporter:"list",outputDir:".cache/phase6/browser-results",
  use:{baseURL:"http://localhost:8809",...devices["Desktop Chrome"]},
  webServer:{command:"node scripts/phase6/serve.mjs",url:"http://localhost:8809/api/lavaguard/config",reuseExistingServer:false,timeout:120000,stdout:"ignore"}});
