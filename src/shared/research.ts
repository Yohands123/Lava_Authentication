import { extractFeatures, type PointerSample } from "./features";
import { FEATURE_VERSION } from "./lavaguard";
import { ROBUST_VERSION, robustFeatures } from "./robust-features";
import { EXPERIMENTAL_VERSION, experimentalFeatures, acquisitionDiagnostics } from "./experimental-features";
import { parseResearchEnvironment, type ResearchEnvironment } from "./automation-environment";

export const RESEARCH_SCHEMA = "lava-consent-v3";
export const STUDY_SCHEMA = "lava-study-record-v3";
export const NORMALIZATION_VERSION = "ring-diameter-v1";
export const CONSENT_REVISION = "lava-local-research-2026-10-18";
export const DEVICES = ["mouse", "trackpad", "touch", "pen", "assisted", "unknown"] as const;
export type StudyDevice = typeof DEVICES[number];
export type StudyLabel = "unlabeled" | "human-self-report" | "automation-declared";
export type StudyOutcome = { status: "completed" | "cancelled" | "expired" | "network-error" | "accessible" | "incomplete"; ringCompleted: boolean; verdict: "CLEAR" | "FLAG" | "BLOCK" | null; passkeyOptions: "not-tested"; authentication: "not-tested" };
export interface Generator { family: string; revision: string; seed: string; run: string; trajectory: string }
export interface Capture {
  revision: "lava-capture-v3"; cadenceMs: 16 | 32 | 64; maxSamples: 1024;
  acquisition: "regular-browser" | "playwright" | "puppeteer" | "unknown";
  viewport: { width: number; height: number; dpr: number }; guardMode: string; modelMode: string;
}
export interface ResearchExport {
  schema: typeof RESEARCH_SCHEMA; consent: true; consentScope: "one-local-attempt-export"; source: "lava-consenting-local";
  participant: string; attempt: string; session: string; device: StudyDevice; label: StudyLabel;
  labelProvenance: "participant-self-report" | "operator-declared-automation" | "unlabeled";
  featureVersion: typeof FEATURE_VERSION; robustVersion: typeof ROBUST_VERSION; normalizationVersion: typeof NORMALIZATION_VERSION;
  consentProvenance: { revision: typeof CONSENT_REVISION; beforeCapture: true; localOnly: true };
  capture: Capture; generator: Generator | null; outcome: StudyOutcome; samples: PointerSample[];
  /** Optional independently versioned extension; old v3 data stays unchanged. */
  environment?: ResearchEnvironment;
}
export interface ResearchIssue { kind: "invalid" | "incomplete"; code: string }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: unknown, keys: string[]) => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const id = (v: unknown, min = 8) => typeof v === "string" && new RegExp(`^[a-zA-Z0-9_-]{${min},64}$`).test(v);
const finite = (v: unknown, min = 0, max = 1e12): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const member = (v: unknown, values: readonly string[]) => typeof v === "string" && values.includes(v);

/** Strict allowlist prevents credentials/unrelated activity hitching a ride in exports. */
export function validateResearchExport(value: unknown): { data: ResearchExport | null; issues: ResearchIssue[] } {
  const issues: ResearchIssue[] = [];
  const invalid = (code: string) => issues.push({ kind: "invalid", code });
  const incomplete = (code: string) => issues.push({ kind: "incomplete", code });
  const keys = ["schema", "consent", "consentScope", "source", "participant", "attempt", "session", "device", "label", "labelProvenance", "featureVersion", "robustVersion", "normalizationVersion", "consentProvenance", "capture", "generator", "outcome", "samples"];
  if (object(value) && Object.hasOwn(value, "environment")) keys.push("environment");
  if (!exact(value, keys)) return { data: null, issues: [{ kind: "invalid", code: "unexpected_or_missing_fields" }] };
  const v = value as Record<string, unknown>;
  if (Object.hasOwn(v, "environment") && !parseResearchEnvironment(v.environment)) invalid("invalid_automation_environment");
  if (v.schema !== RESEARCH_SCHEMA) invalid("unsupported_schema");
  if (v.consent !== true || v.consentScope !== "one-local-attempt-export" || v.source !== "lava-consenting-local") invalid("invalid_consent_or_source");
  if (!id(v.attempt, 16) || !id(v.participant) || !id(v.session)) invalid("invalid_study_identifiers");
  if (!DEVICES.includes(v.device as StudyDevice)) invalid("unsupported_device");
  const provenance = { "human-self-report": "participant-self-report", "automation-declared": "operator-declared-automation", unlabeled: "unlabeled" };
  if (typeof v.label !== "string" || !Object.hasOwn(provenance, v.label) || v.labelProvenance !== provenance[v.label as StudyLabel]) invalid("invalid_label_provenance");
  if (v.label === "unlabeled") incomplete("unlabeled");
  if (v.featureVersion !== FEATURE_VERSION || v.robustVersion !== ROBUST_VERSION) invalid("feature_version_mismatch");
  if (v.normalizationVersion !== NORMALIZATION_VERSION) invalid("normalization_mismatch");
  const c = v.consentProvenance;
  if (!exact(c, ["revision", "beforeCapture", "localOnly"]) || !object(c) || c.revision !== CONSENT_REVISION || c.beforeCapture !== true || c.localOnly !== true) invalid("invalid_consent_provenance");
  const capture = v.capture;
  if (!exact(capture, ["revision", "cadenceMs", "maxSamples", "acquisition", "viewport", "guardMode", "modelMode"]) || !object(capture)) invalid("invalid_capture_configuration");
  else {
    if (capture.revision !== "lava-capture-v3" || ![16, 32, 64].includes(capture.cadenceMs as number) || capture.maxSamples !== 1024 || !member(capture.acquisition,["regular-browser", "playwright", "puppeteer", "unknown"])) invalid("invalid_capture_configuration");
    if (!member(capture.guardMode,["off", "shadow", "enforce"]) || !member(capture.modelMode,["off", "shadow", "research_enforce", "production_enforce", "unknown"])) invalid("invalid_capture_mode");
    const vp = capture.viewport;
    if (!exact(vp, ["width", "height", "dpr"]) || !object(vp) || !finite(vp.width, 1, 32000) || !finite(vp.height, 1, 32000) || !finite(vp.dpr, .1, 16)) invalid("invalid_viewport");
    if (v.label === "human-self-report" && member(capture.modelMode,["research_enforce", "production_enforce"])) incomplete("human_capture_requires_advisory_model");
  }
  if (v.label === "automation-declared") {
    const g = v.generator;
    if (!exact(g, ["family", "revision", "seed", "run", "trajectory"]) || !object(g) || ![g.family, g.revision].every(s => typeof s === "string" && /^[\w.-]{3,80}$/.test(s)) || !id(g.run) || !id(g.trajectory) || typeof g.seed !== "string" || !/^[\w.-]{1,64}$/.test(g.seed)) invalid("missing_or_invalid_generator");
  } else if (v.generator !== null) invalid("generator_label_conflict");
  const o = v.outcome;
  if (!exact(o, ["status", "ringCompleted", "verdict", "passkeyOptions", "authentication"]) || !object(o) || !member(o.status,["completed", "cancelled", "expired", "network-error", "accessible", "incomplete"]) || typeof o.ringCompleted !== "boolean" || ![null, "CLEAR", "FLAG", "BLOCK"].includes(o.verdict as string | null) || o.passkeyOptions !== "not-tested" || o.authentication !== "not-tested") invalid("invalid_outcome");
  else {
    if (o.status === "completed" && !o.ringCompleted) invalid("outcome_conflict");
    if (o.status !== "completed") incomplete("incomplete_task");
  }
  if (!Array.isArray(v.samples) || v.samples.length > 1024) invalid("invalid_samples");
  else {
    const allowed = ["x", "y", "t", "pressure", "pointer", "trusted", "coalesced", "bubbleDistance", "bubbleCount", "targetX", "targetY", "targetId"];
    for (let i = 0; i < v.samples.length; i++) {
      const s = v.samples[i], prev = v.samples[i - 1];
      if (!object(s) || Object.keys(s).some(k => !allowed.includes(k)) || !finite(s.x, -.3, 1.3) || !finite(s.y, -.3, 1.3) || !finite(s.t, 0, 180000)) { invalid("malformed_sample"); break; }
      if (object(prev) && (s.t as number) <= (prev.t as number)) { invalid("nonmonotonic_timing"); break; }
      if ((s.trusted !== undefined && typeof s.trusted !== "boolean") || (s.coalesced !== undefined && typeof s.coalesced !== "boolean") || (s.pointer !== undefined && !member(s.pointer,["mouse", "touch", "pen"]))) { invalid("invalid_event_attributes"); break; }
      for (const k of ["pressure", "bubbleDistance", "bubbleCount", "targetX", "targetY", "targetId"]) if (s[k] !== undefined && !finite(s[k], k === "targetX" || k === "targetY" ? -10 : 0, k === "pressure" || k === "bubbleDistance" ? 1 : k === "targetX" || k === "targetY" ? 10 : 1e6)) invalid("nonfinite_or_invalid_sample_attribute");
      for (const k of ["bubbleCount", "targetId"]) if (s[k] !== undefined && !Number.isInteger(s[k])) invalid("invalid_discrete_target_attribute");
      const targetN = [s.targetX, s.targetY, s.targetId].filter(x => x !== undefined).length;
      if (targetN !== 0 && targetN !== 3) invalid("incomplete_target_observation");
    }
    if (v.samples.length < 12) incomplete("insufficient_samples");
    else if (!issues.some(i => i.kind === "invalid")) {
      const f = extractFeatures(v.samples as PointerSample[]);
      if (f.pathLength < .1 || f.durationMs < 200) incomplete("insufficient_movement");
    }
  }
  return { data: issues.some(i => i.kind === "invalid") ? null : value as ResearchExport, issues };
}

/** Canonical grid signature links translated/scaled replays without exposing raw coordinates. */
export function canonicalPath(samples: readonly PointerSample[]): string {
  if (samples.length < 2) return "empty";
  const minX = Math.min(...samples.map(s => s.x)), minY = Math.min(...samples.map(s => s.y));
  const span = Math.max(1e-8, Math.hypot(Math.max(...samples.map(s => s.x)) - minX, Math.max(...samples.map(s => s.y)) - minY));
  let cursor = 1;
  const start = samples[0]!.t, duration = samples.at(-1)!.t - start;
  return Array.from({ length: 32 }, (_, i) => {
    const t = start + duration * i / 31;
    while (cursor < samples.length - 1 && samples[cursor]!.t < t) cursor++;
    const a = samples[cursor - 1]!, b = samples[cursor]!, w = (t - a.t) / Math.max(1e-8, b.t - a.t);
    return [Math.round((a.x + (b.x - a.x) * w - minX) / span * 1e4), Math.round((a.y + (b.y - a.y) * w - minY) / span * 1e4)].join(",");
  }).join(";");
}

export async function deriveStudyRecord(data: ResearchExport) {
  const checked = validateResearchExport(data);
  if (!checked.data) throw new Error(checked.issues.map(i => i.code).join(","));
  const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))).map(x => x.toString(16).padStart(2, "0")).join("");
  const { samples, attempt, consent: _consent, consentScope, ...metadata } = data;
  return { ...metadata, schema: STUDY_SCHEMA, id: attempt, consentScope,
    label: data.label === "human-self-report" ? "human" : data.label === "automation-declared" ? "bot" : "unlabeled",
    features: extractFeatures(samples), robust: { version: ROBUST_VERSION, features: robustFeatures(samples) },
    experimental: { version: EXPERIMENTAL_VERSION, features: experimentalFeatures(samples) },
    signatures: { raw: await hash(JSON.stringify(samples.map(s => [s.x, s.y, s.t]))), path: await hash(canonicalPath(samples)) },
    quality: { eligible: checked.issues.length === 0, issues: checked.issues, diagnostics: acquisitionDiagnostics(samples) } };
}
