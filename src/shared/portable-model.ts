import { ROBUST_KEYS } from "./robust-features";
import { EXPERIMENTAL_KEYS } from "./experimental-features";
export interface PortableModel {
  schema: "lava-portable-logistic-v3"; version: string; featureVersion: "lava-robust-v2" | "lava-robust-response-v3";
  features: string[]; enabled: false; applicationValidated: false; transform: "log1p-standardize";
  datasetHash: string; splitHash: string; mean: number[]; scale: number[]; coefficients: number[]; intercept: number;
  calibrationSlope: number; calibrationIntercept: number; researchThreshold: number; trainingMinimum: number[]; trainingMaximum: number[];
  supportedDevices: string[]; seed: number; calibrationScope: string; automaticPromotion: false;
}
export interface PortableEstimate {
  riskScore: number | null; version: string | null; featureVersion: string | null;
  uncertainty: "high"; reasons: string[]; action: "observe";
}
const keys = ["schema", "version", "featureVersion", "features", "enabled", "applicationValidated", "transform", "datasetHash", "splitHash", "mean", "scale", "coefficients", "intercept", "calibrationSlope", "calibrationIntercept", "researchThreshold", "trainingMinimum", "trainingMaximum", "supportedDevices", "seed", "calibrationScope", "automaticPromotion"];
/** Manual offline candidate format only. No production route loads this object.
 * Reject executable/unexpected payloads and all attempts to auto-enable it. */
export function parsePortableModel(value: unknown): PortableModel | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const m = value as Record<string, unknown>;
  if (Object.keys(m).length !== keys.length || keys.some(k => !Object.hasOwn(m, k))) return null;
  if (m.schema !== "lava-portable-logistic-v3" || m.enabled !== false || m.applicationValidated !== false || m.automaticPromotion !== false || m.transform !== "log1p-standardize") return null;
  if (typeof m.version !== "string" || !/^lava-[\w-]{3,100}$/.test(m.version) || typeof m.featureVersion !== "string" || !["lava-robust-v2", "lava-robust-response-v3"].includes(m.featureVersion)) return null;
  if (!Array.isArray(m.features) || m.features.length < 1 || m.features.length > 28 || new Set(m.features).size !== m.features.length || m.features.some(k => typeof k !== "string" || !(ROBUST_KEYS as readonly string[]).includes(k) && !(EXPERIMENTAL_KEYS as readonly string[]).includes(k))) return null;
  if (m.featureVersion === "lava-robust-v2" && m.features.some(k => !(ROBUST_KEYS as readonly unknown[]).includes(k))) return null;
  if (![m.datasetHash, m.splitHash].every(h => typeof h === "string" && /^[a-f0-9]{64}$/.test(h))) return null;
  for (const k of ["mean", "scale", "coefficients", "trainingMinimum", "trainingMaximum"]) {
    const v = m[k]; if (!Array.isArray(v) || v.length !== m.features.length || v.some(n => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1e12)) return null;
  }
  if ((m.scale as number[]).some(n => n <= 0) || (m.trainingMinimum as number[]).some((n, i) => n > (m.trainingMaximum as number[])[i]!)) return null;
  if (![m.intercept, m.calibrationSlope, m.calibrationIntercept, m.researchThreshold, m.seed].every(n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e12)) return null;
  if ((m.researchThreshold as number) < 0 || (m.researchThreshold as number) > 1.000000000000001) return null;
  if (!Array.isArray(m.supportedDevices) || m.supportedDevices.some(d => !["mouse", "trackpad"].includes(d)) || typeof m.calibrationScope !== "string" || m.calibrationScope.length > 300) return null;
  return m as unknown as PortableModel;
}

export interface ResearchModelContext { mode: "off" | "shadow"; device: string; expectedVersion?: string; datasetHash: string; datasetState: "current" | "withdrawn" | "unavailable"; withdrawnDatasetHashes: readonly string[] }
function scoreValidatedModel(model: PortableModel | null, features: unknown, context: ResearchModelContext): PortableEstimate {
  const result: PortableEstimate = { riskScore: null, version: null, featureVersion: null, uncertainty: "high", reasons: ["client_claims_forgeable", "application_domain_unvalidated"], action: "observe" };
  if (context.mode === "off") { result.reasons.push("model_off"); return result; }
  if (!model) { result.reasons.push("model_unavailable_or_invalid"); return result; }
  result.version = model.version; result.featureVersion = model.featureVersion;
  if (context.datasetState !== "current") { result.reasons.push("dataset_unavailable_or_withdrawn"); return result; }
  if (context.datasetHash !== model.datasetHash) { result.reasons.push("dataset_version_mismatch"); return result; }
  if (context.expectedVersion && context.expectedVersion !== model.version) { result.reasons.push("unknown_model_version"); return result; }
  if (context.withdrawnDatasetHashes?.includes(model.datasetHash)) { result.reasons.push("withdrawn_training_data"); return result; }
  if (!model.supportedDevices.includes(context.device)) { result.reasons.push("unsupported_device"); return result; }
  if (!features || typeof features !== "object" || Array.isArray(features)) { result.reasons.push("missing_features"); return result; }
  const f = features as Record<string, unknown>;
  if (Object.keys(f).length !== model.features.length || model.features.some(k => typeof f[k] !== "number" || !Number.isFinite(f[k]) || (f[k] as number) < 0 || (f[k] as number) > 1e12)) { result.reasons.push("invalid_or_mismatched_features"); return result; }
  let z = model.intercept, outside = false;
  for (let i = 0; i < model.features.length; i++) {
    const x = Math.log1p(f[model.features[i]!] as number);
    if (x < model.trainingMinimum[i]! - .01 || x > model.trainingMaximum[i]! + .01) outside = true;
    z += (x - model.mean[i]!) / model.scale[i]! * model.coefficients[i]!;
  }
  if (outside) { result.reasons.push("out_of_distribution"); return result; }
  z = z * model.calibrationSlope + model.calibrationIntercept;
  if (!Number.isFinite(z)) { result.reasons.push("numerical_instability"); return result; }
  result.riskScore = 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, z))));
  result.reasons.push(result.riskScore >= model.researchThreshold ? "research_elevated_score" : "research_lower_score");
  // Every Phase 5 candidate is advisory. No CLEAR/FLAG/BLOCK or passkey authority.
  return result;
}

export function estimatePortableRisk(artifact: unknown, features: unknown, context: ResearchModelContext): PortableEstimate {
  if (context.mode === "off") return scoreValidatedModel(null, features, context);
  return scoreValidatedModel(parsePortableModel(artifact), features, context);
}
/** Validate/clone once for repeated offline inference. Context and revocations
 * still apply on every call; caller mutations cannot change the cached model. */
export function preparePortableModel(artifact: unknown): (features: unknown, context: ResearchModelContext) => PortableEstimate {
  const parsed = parsePortableModel(artifact), model = parsed ? structuredClone(parsed) : null;
  return (features, context) => scoreValidatedModel(model, features, context);
}
