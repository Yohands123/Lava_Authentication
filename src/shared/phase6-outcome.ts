/** Independent experimental observations, never a human/bot label. */
export const OUTCOME_FIELDS = ["visualRingCompleted", "challengeIssued", "serverEvaluated", "serverVerdict", "clearanceIssued", "optionsHttpStatus", "credentialPresent", "authenticatedSessionCreated", "modelScoreAvailable", "modelFlagAtFrozenResearchThreshold", "protocolViolationObserved", "experimentCompleted", "reasonIncomplete"] as const;
export interface ExperimentOutcome {
  visualRingCompleted: boolean | null; challengeIssued: boolean | null; serverEvaluated: boolean | null;
  serverVerdict: "CLEAR" | "FLAG" | "BLOCK" | null; clearanceIssued: boolean | null; optionsHttpStatus: number | null;
  credentialPresent: boolean; authenticatedSessionCreated: boolean | null; modelScoreAvailable: boolean;
  modelFlagAtFrozenResearchThreshold: boolean | null; protocolViolationObserved: boolean | null;
  experimentCompleted: boolean; reasonIncomplete: string | null;
}
export function emptyOutcome(): ExperimentOutcome {
  return { visualRingCompleted: null, challengeIssued: null, serverEvaluated: null, serverVerdict: null, clearanceIssued: null, optionsHttpStatus: null,
    credentialPresent: false, authenticatedSessionCreated: null, modelScoreAvailable: false, modelFlagAtFrozenResearchThreshold: null,
    protocolViolationObserved: null, experimentCompleted: false, reasonIncomplete: "not_started" };
}
export function validOutcome(v: ExperimentOutcome): boolean {
  if (Object.keys(v).sort().join() !== [...OUTCOME_FIELDS].sort().join()) return false;
  for (const k of ["visualRingCompleted", "challengeIssued", "serverEvaluated", "clearanceIssued", "authenticatedSessionCreated", "protocolViolationObserved", "modelFlagAtFrozenResearchThreshold"] as const) if (v[k] !== null && typeof v[k] !== "boolean") return false;
  if (![v.credentialPresent, v.modelScoreAvailable, v.experimentCompleted].every(b => typeof b === "boolean")) return false;
  if (v.serverVerdict !== null && !["CLEAR", "FLAG", "BLOCK"].includes(v.serverVerdict)) return false;
  if (v.optionsHttpStatus !== null && (!Number.isInteger(v.optionsHttpStatus) || v.optionsHttpStatus < 100 || v.optionsHttpStatus > 599)) return false;
  if (v.reasonIncomplete !== null && !/^[a-z_]{1,80}$/.test(v.reasonIncomplete)) return false;
  return !(v.authenticatedSessionCreated === true && !v.credentialPresent || !v.modelScoreAvailable && v.modelFlagAtFrozenResearchThreshold !== null || v.experimentCompleted && v.reasonIncomplete !== null);
}
export function summarizeOutcomes(rows: readonly ExperimentOutcome[]) {
  return { attempts: rows.length, experimentsCompleted: rows.filter(v => v.experimentCompleted).length,
    visualCompleted: rows.filter(v => v.visualRingCompleted === true).length, visualIncomplete: rows.filter(v => v.visualRingCompleted === false).length,
    visualNotMeasured: rows.filter(v => v.visualRingCompleted === null).length, evaluated: rows.filter(v => v.serverEvaluated).length,
    clearances: rows.filter(v => v.clearanceIssued).length, optionsAllowed: rows.filter(v => v.optionsHttpStatus === 200).length,
    authenticatedSessions: rows.filter(v => v.authenticatedSessionCreated).length, sessionNotMeasured: rows.filter(v => v.authenticatedSessionCreated === null).length, modelScores: rows.filter(v => v.modelScoreAvailable).length,
    incompleteClassifierDetectionCredit: 0, missingCredentialDetectionCredit: 0, humanAccuracy: null };
}
