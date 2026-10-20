import { describe, expect, it } from "vitest";
import { syntheticStudyExport } from "../fixtures/study";
import { validateResearchExport, deriveStudyRecord, canonicalPath } from "../../src/shared/research";
import { experimentalFeatures, EXPERIMENTAL_KEYS } from "../../src/shared/experimental-features";
import { robustFeatures, ROBUST_KEYS } from "../../src/shared/robust-features";
import { ResearchRecorder } from "../../src/client/guard/research";
import { researchVariants } from "../../src/shared/research-perturbations";

describe("strict consent and provenance", () => {
  it("derives shared features and hashes without raw coordinates or credentials", async () => {
    const input = syntheticStudyExport(), row = await deriveStudyRecord(input);
    expect(validateResearchExport(input).issues).toEqual([]);
    expect(row.label).toBe("bot"); expect(row.schema).toBe("lava-study-record-v3");
    expect(row.robust.features).toEqual(robustFeatures(input.samples));
    expect(row.experimental.features).toEqual(experimentalFeatures(input.samples));
    expect(Object.hasOwn(row, "samples")).toBe(false); expect(row.signatures.raw).toMatch(/^[a-f0-9]{64}$/);
  });
  for (const [name, mutate] of [
    ["missing consent", (v: Record<string, unknown>) => { v.consent = false; }],
    ["label inferred from verdict", (v: Record<string, unknown>) => { v.label = "human-self-report"; }],
    ["generator missing", (v: Record<string, unknown>) => { v.generator = null; }],
    ["unsupported device", (v: Record<string, unknown>) => { v.device = "robot"; }],
    ["wrong version", (v: Record<string, unknown>) => { v.robustVersion = "future"; }],
    ["normalization mismatch", (v: Record<string, unknown>) => { v.normalizationVersion = "screen-pixels"; }],
    ["credential field", (v: Record<string, unknown>) => { v.cookie = "not-allowed"; }],
    ["nonfinite point", (v: Record<string, unknown>) => { (v.samples as { x: number }[])[2]!.x = NaN; }],
    ["backwards clock", (v: Record<string, unknown>) => { (v.samples as { t: number }[])[2]!.t = 0; }],
    ["hidden sample data", (v: Record<string, unknown>) => { Object.assign((v.samples as object[])[2]!, { account: "forbidden" }); }],
  ] as const) it(`rejects ${name}`, () => {
    const v = syntheticStudyExport(); mutate(v as unknown as Record<string, unknown>);
    expect(validateResearchExport(v).data).toBeNull();
  });
  it("audits incomplete and unlabeled input without inventing labels", () => {
    const v = syntheticStudyExport(); v.label = "unlabeled"; v.labelProvenance = "unlabeled"; v.generator = null; v.samples = [];
    v.outcome.status = "cancelled"; v.outcome.ringCompleted = false; v.outcome.verdict = null;
    const result = validateResearchExport(v);
    expect(result.data).not.toBeNull();
    expect(result.issues.map(i => i.code)).toEqual(expect.arrayContaining(["unlabeled", "incomplete_task", "insufficient_samples"]));
  });
});

describe("versioned motion research", () => {
  it("preserves the exact twelve-feature baseline and finite experimental values", () => {
    const points = syntheticStudyExport().samples;
    expect(Object.keys(robustFeatures(points))).toEqual([...ROBUST_KEYS]);
    const response = experimentalFeatures(points);
    expect(Object.keys(response)).toEqual([...EXPERIMENTAL_KEYS]);
    expect(Object.values(response).every(v => Number.isFinite(v) && v >= 0)).toBe(true);
    expect(response.targetCoverage).toBe(1);
  });
  it("normalizes pointer and target scale/translation together", () => {
    const points = syntheticStudyExport().samples;
    const shifted = points.map(s => ({ ...s, x: s.x * 2 + 7, y: s.y * 2 - 3, targetX: s.targetX! * 2 + 7, targetY: s.targetY! * 2 - 3 }));
    expect(robustFeatures(shifted)).toEqual(robustFeatures(points));
    expect(experimentalFeatures(shifted)).toEqual(experimentalFeatures(points));
    expect(canonicalPath(shifted)).toBe(canonicalPath(points));
  });
  it("handles degeneracy and broken timing without nonfinite outputs", () => {
    for (const points of [[], [{ x: 0, y: 0, t: 1 }], [{ x: 0, y: 0, t: 1 }, { x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: 2 }]]) {
      expect(Object.values(experimentalFeatures(points)).every(Number.isFinite)).toBe(true);
    }
  });
  it("keeps perturbation timing monotonic and records cadence/point-count controls", () => {
    const points = syntheticStudyExport().samples, variants = researchVariants(points);
    expect(Object.keys(variants)).toEqual(expect.arrayContaining(["cadence16", "cadence32", "cadence64", "reduced6", "scaled2", "translated", "clockJitter", "variableSpeed"]));
    for (const value of Object.values(variants)) {
      expect(value.samples.every((s, i) => i === 0 || s.t > value.samples[i-1]!.t)).toBe(true);
      expect(Object.values(robustFeatures(value.samples)).every(Number.isFinite)).toBe(true);
    }
    expect(robustFeatures(variants.scaled2!.samples)).toEqual(robustFeatures(points));
    expect(robustFeatures(variants.translated!.samples)).toEqual(robustFeatures(points));
  });
});

describe("ephemeral research lifecycle", () => {
  const setup = () => { const x = syntheticStudyExport(); return { consent: true, participant: x.participant, label: x.label, device: x.device, generator: x.generator }; };
  it("needs consent before capture and discards snapshots on withdrawal", () => {
    const r = new ResearchRecorder(), fixture = syntheticStudyExport();
    r.begin({ ...setup(), consent: false }, fixture.capture); r.finish("completed", fixture.samples, "CLEAR");
    expect(r.count).toBe(0);
    r.begin(setup(), fixture.capture); r.finish("cancelled", fixture.samples.slice(0, 5));
    expect(r.latest()!.outcome.status).toBe("cancelled");
    r.clear(); expect(r.count).toBe(0); expect(r.latest()).toBeNull();
  });
  it("keeps study/session identity across retries, caps records and copies exports", () => {
    const r = new ResearchRecorder(), fixture = syntheticStudyExport();
    for (let i = 0; i < 34; i++) { r.begin(setup(), fixture.capture); r.finish("completed", fixture.samples, "CLEAR"); }
    const batch = r.batch(); expect(batch.exports).toHaveLength(32);
    expect(new Set(batch.exports.map(x => x.participant)).size).toBe(1);
    expect(new Set(batch.exports.map(x => x.session)).size).toBe(1);
    expect(new Set(batch.exports.map(x => x.attempt)).size).toBe(32);
    batch.exports[0]!.samples = []; expect(r.batch().exports[0]!.samples.length).toBeGreaterThan(0);
  });
});
