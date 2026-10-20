import { describe, expect, it } from "vitest";
import { collectAutomationEnvironment, parseAutomationEnvironment, parseResearchEnvironment, assessAutomationEnvironment, ENVIRONMENT_SIGNALS, type ResearchEnvironment } from "../../src/shared/automation-environment";
import { LavaDetector, parseSummary } from "../../src/worker/guard/LavaDetector";
import { LavaPolicy } from "../../src/worker/guard/LavaPolicy";
import { FEATURE_VERSION, type FeatureSummary } from "../../src/shared/lavaguard";
import { extractFeatures } from "../../src/shared/features";
import { syntheticStudyExport } from "../fixtures/study";
import { deriveStudyRecord, validateResearchExport } from "../../src/shared/research";

const evidence = (webdriver: boolean | null = true) => ({ version: "lava-automation-environment-v1" as const, authority: "advisory" as const, signals: { webdriver, headlessUserAgent: false, headlessBrand: false } });
const context = (): ResearchEnvironment => ({ version: "lava-research-environment-v1", declaredEnvironment: "human-controlled-automation", declaredControl: "human", displayMode: "headed", evidence: evidence() });
const summary = (): FeatureSummary => ({ version: FEATURE_VERSION, fingerprint: "a".repeat(43), geometryHash: "b".repeat(43), features: extractFeatures(syntheticStudyExport().samples) });
describe("minimal automation environment evidence", () => {
  it("collects only three booleans, never raw UA, brands, platform or identifiers", () => {
    const accessed: string[] = [];
    const source = new Proxy({ webdriver: true, userAgent: "Private OS HeadlessChrome/123", userAgentData: { brands: [{ brand: "HeadlessChrome", version: "private-version" }] } }, { get(target, key) { accessed.push(String(key)); return Reflect.get(target, key); } });
    const result = collectAutomationEnvironment(source);
    expect(result.signals).toEqual({ webdriver: true, headlessUserAgent: true, headlessBrand: true });
    expect(accessed.sort()).toEqual(["userAgent", "userAgentData", "webdriver"]);
    expect(JSON.stringify(result)).not.toMatch(/Private|123|private-version/);
  });
  it("treats missing and throwing browser getters as unavailable, not human", () => {
    const result = collectAutomationEnvironment(new Proxy({}, { get() { throw new Error("blocked"); } }));
    expect(Object.values(result.signals)).toEqual([null, null, null]);
    expect(assessAutomationEnvironment(result).status).toBe("unavailable");
    expect(assessAutomationEnvironment(collectAutomationEnvironment({ webdriver: false, userAgent: "Chrome/123" })).operatorIdentity).toBe("unknown");
    const brands = new Proxy([], { get() { throw new Error("changed browser API"); } });
    expect(collectAutomationEnvironment({ webdriver: false, userAgentData: { brands } }).signals.headlessBrand).toBeNull();
  });
  it("records changes and suppressible signals without certifying absence", () => {
    const source = { webdriver: true, userAgent: "HeadlessChrome/123" };
    const before = collectAutomationEnvironment(source); source.webdriver = false; source.userAgent = "Chrome/123";
    const after = collectAutomationEnvironment(source);
    expect(before.signals.webdriver).toBe(true); expect(after.signals.webdriver).toBe(false);
    expect(assessAutomationEnvironment(after).status).toBe("no-positive-hints");
    expect(assessAutomationEnvironment(after).enforcementContribution).toBe(0);
  });
  it("rejects unknown versions, raw fields, non-booleans and invented authority", () => {
    for (const v of [{ ...evidence(), authority: "verified" }, { ...evidence(), version: "future" }, { ...evidence(), userAgent: "raw" }, { ...evidence(), signals: { ...evidence().signals, webdriver: 1 } }, { ...evidence(), signals: {} }]) expect(parseAutomationEnvironment(v)).toBeNull();
    expect(parseAutomationEnvironment(evidence(null))).not.toBeNull();
    expect(parseResearchEnvironment({ ...context(), vmDetected: true })).toBeNull();
  });
});
describe("environment never becomes behavior or refusal authority", () => {
  it("all eight boolean combinations leave behavioral/model/protocol risk and policy unchanged", () => {
    const detector = new LavaDetector(), policy = new LavaPolicy(), s = summary();
    for (const options of [{}, { experimentalModel: true }]) {
      const baseline = detector.evaluate(s, 10000, false, options);
      for (let bits = 0; bits < 8; bits++) {
        const env = { ...evidence(), signals: Object.fromEntries(ENVIRONMENT_SIGNALS.map((k, i) => [k, Boolean(bits & (1 << i))])) } as ReturnType<typeof evidence>;
        // Consented research evidence stays advisory; the page's own webdriver signal is tested separately.
        const result = detector.evaluate({ ...s, automationEnvironment: env }, 10000, false, options);
        expect(result.risk).toBe(baseline.risk); expect(result.enforcementRisk).toBe(baseline.enforcementRisk);
        expect(result.reasons).toEqual(baseline.reasons);
        expect(result.estimator).toEqual(baseline.estimator); expect(result.experimental).toEqual(baseline.experimental);
        expect(policy.decide("enforce", result, false)).toBe(policy.decide("enforce", baseline, false));
        expect(result.automationEnvironment!.enforcementContribution).toBe(0);
      }
    }
  });
  it("drops invalid optional context without refusing otherwise valid behavioral requests", () => {
    expect(parseSummary({ ...summary(), automationEnvironment: { version: "unknown", userAgent: "raw" } })).not.toBeNull();
    expect(parseSummary({ ...summary(), automationEnvironment: evidence() })!.automationEnvironment).toEqual(evidence());
  });
  it("preserves genuine protocol checks independently of hints", () => {
    const detector = new LavaDetector(), s = summary();
    const before = detector.evaluate(s, 10, false);
    const after = detector.evaluate({ ...s, automationEnvironment: evidence() }, 10, false);
    expect(after.enforcementRisk).toBe(before.enforcementRisk); expect(after.reasons).toContain("time_inconsistent");
  });
  it("optional research metadata round-trips separately and never changes vectors or labels", async () => {
    const raw = syntheticStudyExport(), withEnvironment = { ...raw, environment: context() };
    expect(validateResearchExport(withEnvironment).data).not.toBeNull();
    const old = await deriveStudyRecord(raw), next = await deriveStudyRecord(withEnvironment);
    expect(next.features).toEqual(old.features); expect(next.robust).toEqual(old.robust); expect(next.experimental).toEqual(old.experimental);
    expect(next.label).toBe("bot"); expect(next.environment!.declaredControl).toBe("human");
    expect(validateResearchExport({ ...raw, environment: { ...context(), evidence: { ...evidence(), rawUA: "forbidden" } } }).data).toBeNull();
  });
});
