import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { estimatePortableRisk, parsePortableModel, preparePortableModel, type PortableModel, type ResearchModelContext } from "../../src/shared/portable-model";
const golden = JSON.parse(readFileSync(new URL("../fixtures/phase5-portable.json", import.meta.url), "utf8")) as { syntheticOnly: boolean; model: PortableModel; vectors: { features: Record<string, number>; expectedRisk: number }[]; tolerance: number };
const context: ResearchModelContext = { mode: "shadow", device: "mouse", datasetHash: golden.model.datasetHash, datasetState: "current", withdrawnDatasetHashes: [] };

describe("portable research inference, synthetic fixture only", () => {
  it("matches Python golden scores for central and boundary values", () => {
    expect(golden.syntheticOnly).toBe(true);
    for (const vector of golden.vectors) {
      const risk = estimatePortableRisk(golden.model, vector.features, context);
      expect(risk.riskScore).not.toBeNull();
      expect(Math.abs(risk.riskScore! - vector.expectedRisk)).toBeLessThan(golden.tolerance);
      expect(risk.action).toBe("observe");
    }
  });
  it("rejects unavailable, unknown, withdrawn and unsupported contexts", () => {
    const vector = golden.vectors[0]!.features;
    for (const c of [{ ...context, mode: "off" as const }, { ...context, expectedVersion: "unknown" }, { ...context, datasetState: "withdrawn" as const }, { ...context, withdrawnDatasetHashes: [golden.model.datasetHash] }, ...["touch", "pen", "assisted", "unknown"].map(device => ({ ...context, device }))]) {
      const value = estimatePortableRisk(golden.model, vector, c);
      expect(value.riskScore).toBeNull(); expect(value.action).toBe("observe");
    }
    expect(estimatePortableRisk(null, vector, context).riskScore).toBeNull();
    expect(estimatePortableRisk(golden.model, vector, { ...context, datasetHash: "0".repeat(64) }).riskScore).toBeNull();
  });
  it("never invents scores for malformed, missing or OOD vectors", () => {
    const f = golden.vectors[0]!.features;
    for (const vector of [null, {}, { ...f, pathLength: NaN }, { ...f, pathLength: -1 }, { ...f, pathLength: 1e11 }, { ...f, source: 1 }]) {
      expect(estimatePortableRisk(golden.model, vector, context).riskScore).toBeNull();
    }
  });
  it("rejects activation, unexpected fields, executable payloads and invalid coefficients", () => {
    for (const mutation of [{ enabled: true }, { automaticPromotion: true }, { featureVersion: "unknown" }, { code: "forbidden" }, { coefficients: [Infinity] }, { scale: golden.model.scale.map(() => 0) }]) {
      expect(parsePortableModel({ ...golden.model, ...mutation })).toBeNull();
    }
  });
  it("cached inference is identical and keeps a private copy with live revocation checks", () => {
    const artifact = structuredClone(golden.model), prepared = preparePortableModel(artifact), f = golden.vectors[0]!.features;
    const expected = prepared(f, context); artifact.intercept += 1e6;
    expect(prepared(f, context)).toEqual(expected);
    expect(prepared(f, { ...context, withdrawnDatasetHashes: [artifact.datasetHash] }).riskScore).toBeNull();
  });
  it("fails closed on numerical overflow even when JSON parameters are finite", () => {
    const model = structuredClone(golden.model);
    model.scale.fill(1e-320); model.coefficients.fill(1e12);
    const result = estimatePortableRisk(model, golden.vectors[0]!.features, context);
    expect(result.riskScore).toBeNull(); expect(result.reasons).toContain("numerical_instability");
  });
});
