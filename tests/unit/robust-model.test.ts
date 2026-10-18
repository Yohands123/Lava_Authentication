import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { robustFeatures, parseRobust } from "../../src/shared/robust-features";
import { extractFeatures } from "../../src/shared/features";
import { estimateRisk } from "../../src/worker/guard/risk-estimator";
import { experimentalModelAllowed, mlMode } from "../../src/worker/guard/config";
const path = Array.from({ length: 200 }, (_, i) => ({ x: Math.sin(i / 20), y: Math.cos(i / 30), t: i * 32 }));
const summary = { version: "lava-features-v1" as const, features: extractFeatures(path), fingerprint: "a".repeat(43), geometryHash: "b".repeat(43) };
describe("versioned robust features and candidate inference", () => {
  it("is invariant to coordinate translation/scaling and never emits NaN for degenerate input", () => {
    expect(robustFeatures(path)).toEqual(robustFeatures(path.map(s => ({ ...s, x: s.x * 3 + 5, y: s.y * 3 - 4 }))));
    for (const input of [[], path.slice(0, 1), [{ x: 0, y: 0, t: 1 }, { x: 0, y: 0, t: 1 }]]) expect(Object.values(robustFeatures(input)).every(Number.isFinite)).toBe(true);
    expect(parseRobust({ ...robustFeatures(path), speedCv: Infinity })).toBeNull();
  });
  it("matches offline Python calibration numerically without promoting the artifact", () => {
    const artifact = JSON.parse(readFileSync("ml/artifacts/robust-logistic-v2.json", "utf8"));
    const result = estimateRisk({ ...summary, robust: { version: "lava-robust-v2", features: artifact.parityFixture.features } }, artifact.version);
    expect(result.riskScore).toBeCloseTo(artifact.parityFixture.expectedRisk, 12);
    expect(artifact.enabled).toBe(false); expect(result.calibration.applicationValidated).toBe(false);
  });
  it("identifies missing/invalid schemas, unknown versions, unsupported devices and outliers", () => {
    expect(estimateRisk(summary, "lava-robust-logistic-v2").uncertainty.missingFeatures).toBe(true);
    expect(estimateRisk(summary, "unknown").riskScore).toBeNull();
    expect(estimateRisk({ ...summary, features: { ...summary.features, touchRatio: 1 } }, "lava-robust-logistic-v2").uncertainty.unsupportedDevice).toBe(true);
    const f = { ...robustFeatures(path), speedP95: 1e10 };
    expect(estimateRisk({ ...summary, robust: { version: "lava-robust-v2", features: f } }, "lava-robust-logistic-v2").uncertainty.outOfDistribution).toBe(true);
  });
  it("requires separate explicit approvals for staging research and production model enforcement", () => {
    const env = { ORIGIN: "https://staging.example", LAVAGUARD_MODE: "enforce", LAVAGUARD_ML_MODE: "research_enforce", LAVAGUARD_ENVIRONMENT: "staging" };
    expect(mlMode(env)).toBe("research_enforce"); expect(experimentalModelAllowed(env)).toBe(false);
    expect(experimentalModelAllowed({ ...env, LAVAGUARD_RESEARCH_APPROVED: "1" })).toBe(true);
    const production = { ...env, LAVAGUARD_ENVIRONMENT: "production", LAVAGUARD_ML_MODE: "production_enforce" };
    expect(experimentalModelAllowed(production)).toBe(false);
    expect(experimentalModelAllowed({ ...production, LAVAGUARD_PRODUCTION_ML_APPROVED: "1" })).toBe(true);
    expect(experimentalModelAllowed({ ...production, LAVAGUARD_ML_MODE: "off", LAVAGUARD_PRODUCTION_ML_APPROVED: "1" })).toBe(false);
  });
});
