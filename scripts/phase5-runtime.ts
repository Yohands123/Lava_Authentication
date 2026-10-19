export { validateResearchExport, deriveStudyRecord, canonicalPath } from "../src/shared/research";
export { robustFeatures, ROBUST_KEYS } from "../src/shared/robust-features";
export { experimentalFeatures, EXPERIMENTAL_KEYS, acquisitionDiagnostics } from "../src/shared/experimental-features";
export { extractFeatures } from "../src/shared/features";
export { estimatePortableRisk, parsePortableModel, preparePortableModel } from "../src/shared/portable-model";
export { estimateRisk, candidateResearchThreshold } from "../src/worker/guard/risk-estimator";
export { researchVariants } from "../src/shared/research-perturbations";
export { collectAutomationEnvironment, parseAutomationEnvironment, parseResearchEnvironment, assessAutomationEnvironment, ENVIRONMENT_SIGNALS } from "../src/shared/automation-environment";
