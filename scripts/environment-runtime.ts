export { collectAutomationEnvironment, parseAutomationEnvironment } from "../src/shared/automation-environment";
import { LavaDetector } from "../src/worker/guard/LavaDetector";
import { LavaPolicy } from "../src/worker/guard/LavaPolicy";
import { FEATURE_VERSION, type FeatureSummary } from "../src/shared/lavaguard";
import { extractFeatures } from "../src/shared/features";
import type { AutomationEnvironmentEvidence } from "../src/shared/automation-environment";

/** Fixed generated behavior control, never an actual human trajectory. */
export function fixedBehaviorComparison(environment: AutomationEnvironmentEvidence) {
  const summary: FeatureSummary = { version: FEATURE_VERSION, fingerprint: "a".repeat(43), geometryHash: "b".repeat(43),
    features: extractFeatures(Array.from({ length: 40 }, (_, i) => ({ x: .8 * i / 39, y: .5, t: 32 * i }))) };
  const detector = new LavaDetector(), policy = new LavaPolicy();
  return [false, true].map(experimentalModel => {
    const options = { experimentalModel }, baseline = detector.evaluate(summary, 10000, false, options);
    const next = detector.evaluate({ ...summary, automationEnvironment: environment }, 10000, false, options);
    return { experimentalModel, riskDelta: next.risk - baseline.risk, enforcementRiskDelta: next.enforcementRisk - baseline.enforcementRisk,
      behavioralModelUnchanged: JSON.stringify(next.estimator) === JSON.stringify(baseline.estimator) && JSON.stringify(next.experimental) === JSON.stringify(baseline.experimental),
      decisionUnchanged: policy.decide("enforce", baseline, false) === policy.decide("enforce", next, false) };
  });
}
