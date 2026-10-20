import { forgedPlausibleFeatures } from "../fixtures/forged";
import { test, expect } from "@playwright/test";
import { extractFeatures } from "../../src/shared/features";
import { FEATURE_VERSION } from "../../src/shared/lavaguard";

test("contradictory telemetry gets no clearance; a consistent scripted summary is still not proof of a human", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  // Isolate this new case's negative-request budget from other local fixtures.
  // Cloudflare supplies this header at its edge; this is localhost test input.
  const post = (path: string, data: unknown) => context.request.post(baseURL + path, { headers: { Origin: baseURL!, "CF-Connecting-IP": "192.0.2.64" }, data });
  try {
    const features = extractFeatures(Array.from({ length: 40 }, (_, i) => ({ x: i / 40, y: .5, t: i * 32 })));
    const summary = { version: FEATURE_VERSION, features, fingerprint: "f".repeat(43), geometryHash: "g".repeat(43), signals: { webdriver: true } };
    for (const changes of [{ speedP50: 4, speedP95: 1 }, { invalidTiming: 40 }, { pressurePresent: 0, pressureRange: .5 }]) {
      const issued = await post("/api/lavaguard/challenge", { kind: "gesture" });
      expect(issued.status()).toBe(200);
      const c = await issued.json();
      const evaluated = await post("/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary: { ...summary, features: { ...features, ...changes } } });
      expect(evaluated.status()).toBe(400);
      expect((await evaluated.json()).clearance).toBeUndefined();
      expect((await post("/api/login/options", { digests: {} })).status()).toBe(403);
      expect((await context.request.get(baseURL + "/api/session")).status()).toBe(401);
    }
    // This control is deliberately fabricated, not a genuine human observation.
    // Schema validation cannot stop a forger who submits consistent aggregates.
    const issued = await post("/api/lavaguard/challenge", { kind: "gesture" });
    expect(issued.status()).toBe(200);
    const c = await issued.json();
    const evaluated = await post("/api/lavaguard/evaluate", { id: c.id, nonce: c.nonce, summary: { ...summary, features: forgedPlausibleFeatures(), signals: { webdriver: false } } });
    expect(evaluated.status()).toBe(200);
    const permission = await evaluated.json();
    expect(permission.verdict).toBe("CLEAR");
    expect((await post("/api/login/options", { digests: {}, clearance: permission.clearance })).status()).toBe(200);
    expect((await context.request.get(baseURL + "/api/session")).status()).toBe(401);
  } finally { await context.close(); }
});
