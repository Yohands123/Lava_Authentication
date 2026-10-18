export type Verdict = "CLEAR" | "FLAG" | "BLOCK";
export type GuardMode = "off" | "shadow" | "enforce";
export type GuardState = "IDLE" | "PREPARING" | "STIRRING" | "RING_CLEARED_PENDING_DECISION" | Verdict | "ACCESSIBLE_ALTERNATIVE" | "ERROR" | "CANCELLED";
export type AttemptKind = "gesture" | "accessible";
export interface GuardChallenge {
  id: string;
  nonce: string;
  seed: string;
  expiresAt: number;
  kind: AttemptKind;
  mode: GuardMode;
}
export interface GuardDecision {
  verdict: Verdict;
  clearance?: string;
  expiresAt?: number;
  retryAfter: number;
  alternative: boolean;
  assessment?: "shadow" | "evaluated" | "protocol" | "accessible" | "disabled";
  stepUp?: { id: string; expiresAt: number; provider: "turnstile"; action: string };
}
export const FEATURE_VERSION = "lava-features-v1";
export const FEATURE_KEYS = [
  "samples", "durationMs", "pathLength", "efficiency", "speedP50", "speedP95", "speedCv",
  "accelP95", "decelP95", "jerkP95", "angularP95", "curvatureP95", "headingChangeMean",
  "dtP50", "dtP95", "dtCv", "pauseRatio", "bursts", "reversals", "corrections", "overshoots",
  "reactionMs", "coalescedRatio", "clockQuantumMs", "pressureRange", "pressurePresent",
  "touchRatio", "penRatio", "untrustedRatio", "invalidTiming", "bubbleEncounters",
  "bubbleChases", "bubbleMisses", "bubbleDisplacements", "strategyChanges", "firstEncounterMs",
] as const;
export type FeatureKey = typeof FEATURE_KEYS[number];
export type Features = Record<FeatureKey, number>;
export interface FeatureSummary {
  version: typeof FEATURE_VERSION;
  features: Features;
  fingerprint: string;
  geometryHash: string;
  /** Self-reported context hint, never a trusted attestation. Absence is normal. */
  signals?: { webdriver?: boolean };
  robust?: { version: "lava-robust-v2"; features: import("./robust-features").RobustFeatures };
}
