import { expect, test } from "@playwright/test";
import { post } from "./helpers";

// Runs last (files run in name order with one worker) so it can't starve other tests.
test("too many login attempts are rate limited with 429", async ({ page }) => {
  await page.goto("/");
  let limited = null;
  for (let i = 0; i < 25 && !limited; i++) {
    const res = await post(page, "/api/login/options", { digests: {} });
    if (res.status() === 429) limited = res;
    else {
      // Unguarded API calls now fail closed, and still count toward the IP limit.
      expect(res.status()).toBe(403);
      expect((await res.json()).error.code).toBe("guard_required");
    }
  }
  expect(limited, "no 429 within 25 requests").not.toBeNull();
  expect((await limited!.json()).error.code).toBe("rate_limited");
  expect(Number(limited!.headers()["retry-after"])).toBeGreaterThan(0);
});
