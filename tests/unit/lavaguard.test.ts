import { describe, expect, it } from "vitest";
import { extractFeatures, trajectorySignature, type PointerSample } from "../../src/shared/features";
import { FEATURE_KEYS, FEATURE_VERSION, type FeatureSummary } from "../../src/shared/lavaguard";
import { LavaDetector, parseSummary } from "../../src/worker/guard/LavaDetector";
import { LavaPolicy } from "../../src/worker/guard/LavaPolicy";
import { experimentalModelAllowed, guardMode } from "../../src/worker/guard/config";
import { readFileSync } from "node:fs";

const path = (n = 100): PointerSample[] => Array.from({ length: n }, (_, i) => ({ x: i / 100, y: .4, t: i * 32, trusted: true }));
const summary = (samples = path()): FeatureSummary => ({ version: FEATURE_VERSION, features: extractFeatures(samples), fingerprint: "a".repeat(43), geometryHash: "b".repeat(43) });
describe("deterministic normalized features", () => {
  it("handles empty, singleton and missing pressure without NaN", () => {
    for (const s of [[], path(1), path()]) expect(Object.values(extractFeatures(s)).every(Number.isFinite)).toBe(true);
    expect(extractFeatures(path()).pressurePresent).toBe(0);
  });
  it("measures a known straight constant-speed trajectory", () => {
    const f = extractFeatures(path());
    expect(f.efficiency).toBeCloseTo(1); expect(f.pathLength).toBeCloseTo(.99);
    expect(f.speedP50).toBeCloseTo(.3125); expect(f.dtP50).toBe(32);
    expect(f.headingChangeMean).toBe(0); expect(f.speedCv).toBeCloseTo(0);
  });
  it("detects reversals, pauses, timing edits and correction evidence", () => {
    const f = extractFeatures([{ x: 0, y: 0, t: 0 }, { x: .5, y: .1, t: 32 }, { x: 0, y: 0, t: 64 }, { x: .1, y: .2, t: 500 }, { x: .2, y: .1, t: 500 }]);
    expect(f.reversals).toBeGreaterThan(0); expect(f.pauseRatio).toBeGreaterThan(0); expect(f.invalidTiming).toBe(1);
  });
  it("tracks bubble encounters, displacements and touch independently of labels", () => {
    const f = extractFeatures([{ x: 0, y: 0, t: 40, bubbleDistance: .2, bubbleCount: 5, pointer: "touch" }, { x: .1, y: .2, t: 80, bubbleDistance: .1, bubbleCount: 5, pointer: "touch" }, { x: .3, y: .2, t: 140, bubbleDistance: .05, bubbleCount: 4, pointer: "touch" }]);
    expect(f.bubbleEncounters).toBe(1); expect(f.bubbleDisplacements).toBe(1); expect(f.touchRatio).toBe(1); expect(f.firstEncounterMs).toBe(80);
  });
  it("bounds input and excludes invalid coordinates", () => {
    expect(extractFeatures(path(5000)).samples).toBe(1024);
    expect(extractFeatures([{ x: NaN, y: 1, t: 0 }]).samples).toBe(0);
  });
  it("has translation-invariant replay signatures with independent timing", () => {
    const a = path(), b = a.map(s => ({ ...s, x: s.x + 2, y: s.y + 3 }));
    expect(trajectorySignature(a)).toBe(trajectorySignature(b));
    const c = a.map(s => ({ ...s, t: s.t * 2 }));
    expect(trajectorySignature(a, true)).toBe(trajectorySignature(c, true));
    expect(trajectorySignature(a)).not.toBe(trajectorySignature(c));
  });
});
describe("untrusted summary validation", () => {
  it("accepts only versioned complete finite bounded aggregates", () => {
    expect(parseSummary(summary())).not.toBeNull();
    for (const s of [null, [], { ...summary(), verdict: "CLEAR" }, { ...summary(), version: "future" }, { ...summary(), fingerprint: "raw path" }, { ...summary(), features: { ...summary().features, samples: 2000 } }, { ...summary(), features: { ...summary().features, speedP50: NaN } }]) expect(parseSummary(s)).toBeNull();
    expect(Object.keys(summary().features)).toHaveLength(FEATURE_KEYS.length);
  });
  it("does not accept ratios over one or unknown feature fields", () => {
    expect(parseSummary(summary([]))).toBeNull();
    expect(parseSummary({ ...summary(), features: { ...summary().features, touchRatio: 2 } })).toBeNull();
    expect(parseSummary({ ...summary(), features: { ...summary().features, raw: [] } })).toBeNull();
  });
  it("validates optional automation hints without trusting absence as human evidence", () => {
    for (const signals of [{}, { webdriver: true }, { webdriver: false }]) expect(parseSummary({ ...summary(), signals })).not.toBeNull();
    for (const signals of [null, [], { webdriver: "false" }, { human: true }, { webdriver: false, risk: 0 }]) expect(parseSummary({ ...summary(), signals })).toBeNull();
  });
});
describe("probabilistic evidence and proportionate policy", () => {
  const detector = new LavaDetector(), policy = new LavaPolicy();
  it("recognizes joint regularity without claiming calibrated probability", () => {
    const d = detector.evaluate(summary(), 4000, false);
    expect(d.reasons).toContain("joint_regular_path"); expect(d.uncertainty).toBeGreaterThan(.5);
    expect(policy.decide("shadow", d, false)).toBe("CLEAR");
    expect(policy.decide("enforce", d, false)).toBe("CLEAR");
  });
  it("only corroborated protocol restriction can BLOCK", () => {
    const d = { ...detector.evaluate(summary(), 4000, true), risk: 1, enforcementRisk: .6 };
    expect(policy.decide("enforce", d, false)).toBe("FLAG");
    expect(policy.decide("shadow", d, true)).toBe("BLOCK");
    expect(policy.decide("enforce", null, false)).toBe("CLEAR");
  });
  it("smooth variable-speed motion and absent pressure are not independently penalized", () => {
    const s = summary(path().map((s, i) => ({ ...s, x: (i / 100) ** 2 })));
    expect(detector.evaluate(s, 4000, false).risk).toBe(0);
  });
  it("records recurrence and impossible duration as hints, not proof", () => {
    expect(detector.evaluate(summary(), 100, true).reasons).toEqual(expect.arrayContaining(["time_inconsistent", "recent_path_recurrence"]));
  });
  it("does not reject a human taking over a WebDriver browser on the browser hint alone", () => {
    const s = { ...summary(path().map((p, i) => ({ ...p, x: (i / 100) ** 2 }))), signals: { webdriver: true } };
    const result = detector.evaluate(s, 5000, false);
    expect(result.automationEnvironment?.positiveSignals).toContain("webdriver");
    expect(result.reasons).not.toContain("browser_automation_reported");
    expect(policy.decide("enforce", result, false)).toBe("CLEAR");
    expect(policy.decide("shadow", result, false)).toBe("CLEAR");
    expect(policy.decide("enforce", result, false)).not.toBe("BLOCK");
  });
  it("repeated ordinary input cannot become a movement ban or retry loop", () => {
    const captured = parseSummary(JSON.parse(readFileSync(new URL("../fixtures/automated-preview-summary.json", import.meta.url), "utf8")))!;
    for (let i = 0; i < 4; i++) {
      const result = detector.evaluate({ ...captured, signals: { webdriver: true } }, 10000, i > 0);
      expect(result.automationEnvironment?.positiveSignals).toContain("webdriver");
      expect(result.reasons).not.toContain("browser_automation_reported");
      expect(policy.decide("enforce", result, false)).toBe("CLEAR");
    }
  });
  it("catches the real passing preview's behavior when its automation hint is hidden", () => {
    const captured = parseSummary(JSON.parse(readFileSync(new URL("../fixtures/automated-preview-summary.json", import.meta.url), "utf8")));
    if (!captured) throw new Error("Invalid synthetic browser capture fixture");
    expect(captured.signals?.webdriver).toBe(false);
    const elapsed = captured.features.durationMs + captured.features.reactionMs + 100;
    const before = detector.evaluate(captured, elapsed, false);
    expect(before.risk).toBe(0);
    const after = detector.evaluate(captured, elapsed, false, { experimentalModel: true });
    expect(after.reasons).toEqual(["experimental_model_anomaly"]);
    expect(after.experimental!.experimentalRisk).toBeGreaterThanOrEqual(.9);
    expect(policy.decide("enforce", after, false)).toBe("FLAG");
  });
  it("does not apply the mouse model to unvalidated touch or pen movement", () => {
    const captured = parseSummary(JSON.parse(readFileSync(new URL("../fixtures/automated-preview-summary.json", import.meta.url), "utf8")));
    if (!captured) throw new Error("Invalid synthetic browser capture fixture");
    for (const pointer of ["touchRatio", "penRatio"] as const) {
      const s = { ...captured, features: { ...captured.features, [pointer]: 1 } };
      const result = detector.evaluate(s, 10000, false, { experimentalModel: true });
      expect(result.experimental).toBeUndefined(); expect(result.risk).toBe(0);
    }
  });
});

describe("local experimental rollout boundary", () => {
  it("requires explicit opt-in, enforce mode and localhost together", () => {
    const env = { ORIGIN: "http://localhost:8787", LAVAGUARD_MODE: "enforce", LAVAGUARD_EXPERIMENTAL_MODEL: "1" };
    expect(experimentalModelAllowed(env)).toBe(true);
    for (const override of [{ ORIGIN: "https://lavaauth.example.com" }, { ORIGIN: "not-a-url" }, { LAVAGUARD_MODE: "shadow" }, { LAVAGUARD_MODE: "off" }, { LAVAGUARD_EXPERIMENTAL_MODEL: "0" }]) expect(experimentalModelAllowed({ ...env, ...override })).toBe(false);
    expect(guardMode({ ORIGIN: env.ORIGIN })).toBe("off");
    expect(experimentalModelAllowed({ ORIGIN: env.ORIGIN })).toBe(false);
  });
});
