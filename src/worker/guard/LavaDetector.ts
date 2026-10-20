import { FEATURE_KEYS, FEATURE_VERSION, type FeatureSummary, type Features } from "../../shared/lavaguard";
import { experimentalInference } from "./inference";
import { parseRobust, ROBUST_VERSION } from "../../shared/robust-features";
import { estimateRisk, candidateResearchThreshold, type RiskEstimate } from "./risk-estimator";
import { parseAutomationEnvironment, assessAutomationEnvironment } from "../../shared/automation-environment";
import { consistentFeatures } from "../../shared/feature-consistency";

export interface Detection { risk: number; enforcementRisk: number; uncertainty: number; reasons: string[]; modelVersion: string; fingerprint: string; geometryHash: string; estimator?: RiskEstimate; experimental?: { version: string; experimentalRisk: number }; automationEnvironment?: ReturnType<typeof assessAutomationEnvironment> }
export interface DetectorOptions { experimentalModel?: boolean; computeModel?: boolean; modelVersion?: string }
export function parseSummary(value: unknown): FeatureSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>;
  if (Object.keys(s).some(k => !["version", "features", "fingerprint", "geometryHash", "signals", "robust", "automationEnvironment"].includes(k)) || s.version !== FEATURE_VERSION) return null;
  if (typeof s.fingerprint !== "string" || !/^[\w-]{43}$/.test(s.fingerprint) || typeof s.geometryHash !== "string" || !/^[\w-]{43}$/.test(s.geometryHash)) return null;
  if (!s.features || typeof s.features !== "object" || Array.isArray(s.features)) return null;
  const f = s.features as Record<string, unknown>;
  if (Object.keys(f).length !== FEATURE_KEYS.length || FEATURE_KEYS.some(k => typeof f[k] !== "number" || !Number.isFinite(f[k]) || (f[k] as number) < 0 || (f[k] as number) > 1e12)) return null;
  if ((f.samples as number) < 1 || f.samples as number > 1024 || f.durationMs as number > 180000 || f.reactionMs as number > 180000) return null;
  for (const k of ["efficiency", "pauseRatio", "coalescedRatio", "pressureRange", "pressurePresent", "touchRatio", "penRatio", "untrustedRatio"] as const) if ((f[k] as number) > 1) return null;
  if ((f.touchRatio as number) + (f.penRatio as number) > 1.000001) return null;
  for (const k of ["samples", "bursts", "reversals", "corrections", "overshoots", "invalidTiming", "bubbleEncounters", "bubbleChases", "bubbleMisses", "bubbleDisplacements", "strategyChanges"] as const) if (!Number.isInteger(f[k])) return null;
  if (!consistentFeatures(f as Features)) return null;
  let signals: FeatureSummary["signals"];
  if (s.signals !== undefined) {
    if (!s.signals || typeof s.signals !== "object" || Array.isArray(s.signals)) return null;
    const context = s.signals as Record<string, unknown>;
    if (Object.keys(context).some(k => k !== "webdriver") || (context.webdriver !== undefined && typeof context.webdriver !== "boolean")) return null;
    signals = context.webdriver === undefined ? {} : { webdriver: context.webdriver as boolean };
  }
  let robust: FeatureSummary["robust"];
  if (s.robust !== undefined) {
    const r = s.robust as { version?: string; features?: unknown } | null;
    if (!r || r.version !== ROBUST_VERSION || Object.keys(r).some(k => !["version", "features"].includes(k))) return null;
    const parsed = parseRobust(r.features); if (!parsed) return null;
    robust = { version: ROBUST_VERSION, features: parsed };
  }
  // Optional context must never turn a valid behavioral request into refusal.
  const environment = parseAutomationEnvironment(s.automationEnvironment);
  return { version: FEATURE_VERSION, features: f as Features, fingerprint: s.fingerprint, geometryHash: s.geometryHash, signals, robust, ...(environment ? { automationEnvironment: environment } : {}) };
}

/** Experimental evidence, never a calibrated probability or identity proof. */
export class LavaDetector {
  static readonly version = "lava-heuristic-v5";
  evaluate(summary: FeatureSummary, elapsedMs: number, duplicate: boolean, options: DetectorOptions = {}): Detection {
    const f = summary.features, reasons: string[] = [];
    let risk = 0, enforcementRisk = 0;
    const add = (condition: boolean, score: number, reason: string) => { if (condition) { risk += score; reasons.push(reason); } };
    add(f.samples < 12 || f.pathLength < 0.1, .65, "insufficient_evidence");
    add(f.durationMs + f.reactionMs > elapsedMs + 1500, .6, "time_inconsistent");
    // This bounds a claim against the server's own clock. It cannot attest a path.
    if (f.durationMs + f.reactionMs > elapsedMs + 1500) enforcementRisk = .6;
    add(f.invalidTiming > 0, .4, "invalid_timing");
    add(f.untrustedRatio > .1, .4, "synthetic_event_hint");
    // A human can take over a WebDriver browser. This is context, not operator identity.
    const automationEnvironment = assessAutomationEnvironment(summary.automationEnvironment ?? null, summary.signals?.webdriver);
    // Joint evidence only: smooth paths and missing pressure are ordinary.
    add(f.efficiency > .995 && f.speedCv < .015 && f.dtCv < .015, .55, "joint_regular_path");
    add(duplicate && f.samples >= 12, .5, "recent_path_recurrence");
    const supportedPointer = f.touchRatio === 0 && f.penRatio === 0;
    const legacy = !options.modelVersion || options.modelVersion === "lava-logistic-experimental-v1";
    const experimental = options.experimentalModel && supportedPointer && legacy ? experimentalInference(f) : undefined;
    const estimator = options.computeModel || options.experimentalModel ? estimateRisk(summary, options.modelVersion ?? "lava-logistic-experimental-v1") : undefined;
    // Experimental evidence can withhold this gesture's clearance, never ban or BLOCK.
    // The server enables this only for the explicitly configured localhost experiment.
    add(!!experimental && experimental.experimentalRisk >= .9, .65, "experimental_model_anomaly");
    const candidate = options.modelVersion === "lava-robust-logistic-v2";
    if (!candidate && experimental && experimental.experimentalRisk >= .9) enforcementRisk = Math.max(enforcementRisk, .65);
    if (candidate && options.experimentalModel && estimator?.riskScore != null && !estimator.uncertainty.outOfDistribution && estimator.riskScore >= candidateResearchThreshold) {
      enforcementRisk = Math.max(enforcementRisk, .65); reasons.push("research_candidate_anomaly");
    }
    // Owner-requested hard evidence (October 20, 2026). Each condition is rare for
    // a person and withholds only this gesture's clearance (FLAG: fresh retry or
    // step-up), never BLOCK. A forged summary can still omit all of them.
    const hard = [
      // Default Playwright/Puppeteer/Selenium sessions report this; a person
      // driving an automated browser is the accepted false-positive case.
      summary.signals?.webdriver === true && "automation_webdriver",
      // Script-dispatched DOM events carry isTrusted=false; real input cannot.
      f.untrustedRatio > .1 && "synthetic_events",
      reasons.includes("joint_regular_path") && "machine_regular_path",
      // Clearing the ring takes real stirring; this few samples cannot be it.
      reasons.includes("insufficient_evidence") && "no_real_stirring",
    ].filter((r): r is string => !!r);
    if (hard.length) { enforcementRisk = Math.max(enforcementRisk, .65); reasons.push(...hard); }
    // Recurrence and statistical models stay advisory until validated on people.
    return { risk: Math.min(1, risk), enforcementRisk, uncertainty: .8, reasons, modelVersion: LavaDetector.version, fingerprint: summary.fingerprint, geometryHash: summary.geometryHash, experimental, estimator, automationEnvironment };
  }
}
