import { parsePortableModel, preparePortableModel, type PortableModel, type PortableEstimate, type ResearchModelContext } from "./portable-model";
export interface ObservationCandidate {
  schema: "lava-observation-candidate-v1"; authority: "APPROVED_FOR_OBSERVATION_ONLY"; syntheticOnly: boolean;
  model: PortableModel; datasetHash: string; cohortManifestHash: string;
  provenance: { extraction: string; calibration: "separate-development-calibration"; threshold: "frozen-before-evaluation"; trainingEnvironment: string; review: string };
}
export interface TrustPin { version: string; sha256: string }
export interface ObservationContext extends ResearchModelContext { revokedCandidateHashes: readonly string[]; revocationState: "current" | "unavailable" }
export function canonicalCandidate(value: unknown): string {
  return JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
}
export async function candidateHash(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalCandidate(value)));
  return Array.from(new Uint8Array(bytes), v => v.toString(16).padStart(2,"0")).join("");
}
export function parseObservationCandidate(v: unknown): ObservationCandidate | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const c = v as Record<string, unknown>, keys = ["schema", "authority", "syntheticOnly", "model", "datasetHash", "cohortManifestHash", "provenance"];
  if (Object.keys(c).sort().join() !== keys.sort().join() || c.schema !== "lava-observation-candidate-v1" || c.authority !== "APPROVED_FOR_OBSERVATION_ONLY" || typeof c.syntheticOnly !== "boolean") return null;
  const model = parsePortableModel(c.model); if (!model || c.datasetHash !== model.datasetHash || c.cohortManifestHash !== model.splitHash) return null;
  const p = c.provenance as ObservationCandidate["provenance"];
  if (!p || typeof p !== "object" || Object.keys(p).sort().join() !== ["extraction","calibration","threshold","trainingEnvironment","review"].sort().join()) return null;
  if (p.calibration !== "separate-development-calibration" || p.threshold !== "frozen-before-evaluation" || ![p.extraction,p.trainingEnvironment,p.review].every(s => typeof s === "string" && s.length >= 1 && s.length <= 240)) return null;
  return structuredClone(v) as ObservationCandidate;
}
/** Explicit immutable pin, never newest-by-date discovery. No policy methods. */
export class ObservationRegistry {
  private prepared: ReturnType<typeof preparePortableModel> | null = null;
  private hash: string | null = null;
  private version: string | null = null;
  private error = "registry_off";
  constructor(private readonly mode: "off" | "shadow" = "off") {}
  async load(value: unknown, pin: TrustPin | null): Promise<boolean> {
    this.prepared = null; this.hash = null; this.version = null;
    if (this.mode !== "shadow") { this.error = "registry_off"; return false; }
    const c = parseObservationCandidate(value);
    if (!c || !pin || !/^[a-f0-9]{64}$/.test(pin.sha256) || pin.version !== c.model.version || pin.sha256 !== await candidateHash(c)) { this.error = "candidate_untrusted_or_invalid"; return false; }
    this.hash = pin.sha256; this.version = pin.version; this.prepared = preparePortableModel(c.model); this.error = ""; return true;
  }
  score(features: unknown, context: ObservationContext): PortableEstimate & { candidateHash: string | null; policyAuthority: "none" } {
    const base: PortableEstimate = { riskScore: null, version: this.version, featureVersion: null, uncertainty: "high", action: "observe", reasons: [] };
    const fail = (reason: string) => ({ ...base, reasons: [reason], candidateHash: this.hash, policyAuthority: "none" as const });
    if (!this.prepared || this.mode === "off" || context.mode === "off") return fail(this.error || "registry_off");
    if (context.revocationState !== "current") return fail("revocation_state_unavailable");
    if (this.hash && context.revokedCandidateHashes.includes(this.hash)) return fail("candidate_revoked");
    return { ...this.prepared(features, context), candidateHash: this.hash, policyAuthority: "none" };
  }
}
