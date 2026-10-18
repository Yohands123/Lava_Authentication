import { robustModel } from "./robust-model";
import { experimentalInference } from "./inference";
import { parseRobust } from "../../shared/robust-features";
import type { FeatureSummary } from "../../shared/lavaguard";
export interface RiskEstimate {
  riskScore: number | null; modelVersion: string; featureVersion: string;
  calibration: { method: string; applicationValidated: false };
  uncertainty: { high: true; outOfDistribution: boolean | null; unsupportedDevice: boolean; missingFeatures: boolean };
  reasons: string[];
}
export function estimateRisk(summary: FeatureSummary, version: string): RiskEstimate {
  const unsupported = summary.features.touchRatio > 0 || summary.features.penRatio > 0;
  const candidate = version === robustModel.version;
  const base: RiskEstimate = { riskScore: null, modelVersion: version, featureVersion: candidate ? robustModel.featureVersion : "lava-features-v1",
    calibration: { method: "source-folder sigmoid; no application validation", applicationValidated: false },
    uncertainty: { high: true, outOfDistribution: null, unsupportedDevice: unsupported, missingFeatures: false }, reasons: ["client_claims_forgeable", "application_domain_unvalidated"] };
  if (unsupported) { base.reasons.push("unsupported_input_device"); return base; }
  if (!candidate) {
    if (version !== "lava-logistic-experimental-v1") { base.reasons.push("unknown_model_version"); return base; }
    base.riskScore = experimentalInference(summary.features).experimentalRisk; return base;
  }
  const features = parseRobust(summary.robust?.features);
  if (!features || summary.robust?.version !== robustModel.featureVersion) {
    base.uncertainty.missingFeatures = true; base.reasons.push("missing_versioned_features"); return base;
  }
  let z = robustModel.intercept, outside = 0;
  robustModel.features.forEach((k, i) => {
    const value = Math.log1p(features[k]);
    outside += Number(value < robustModel.trainingMinimum[i]! - .01 || value > robustModel.trainingMaximum[i]! + .01);
    z += (value - robustModel.mean[i]!) / robustModel.scale[i]! * robustModel.coefficients[i]!;
  });
  base.uncertainty.outOfDistribution = outside > 0;
  if (outside) base.reasons.push("outside_training_feature_range");
  z = z * robustModel.calibrationSlope + robustModel.calibrationIntercept;
  base.riskScore = 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, z))));
  return base;
}
export const candidateResearchThreshold = robustModel.researchThreshold;
