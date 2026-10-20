import { CONSENT_REVISION, NORMALIZATION_VERSION, RESEARCH_SCHEMA, validateResearchExport, type ResearchExport, type Capture, type Generator, type StudyDevice, type StudyLabel, type StudyOutcome } from "../../shared/research";
import { FEATURE_VERSION } from "../../shared/lavaguard";
import { ROBUST_VERSION } from "../../shared/robust-features";
import type { PointerSample } from "../../shared/features";
import type { ResearchEnvironment } from "../../shared/automation-environment";

export interface StudySetup { consent: boolean; participant: string; device: StudyDevice; label: StudyLabel; generator: Generator | null; environment?: ResearchEnvironment }
/** Memory-only, capped, one consent snapshot before each attempt. No listeners,
 * persistence, credentials or inferred labels are part of this recorder. */
export class ResearchRecorder {
  private active: ResearchExport | null = null;
  private records: ResearchExport[] = [];
  private session = crypto.randomUUID();
  begin(setup: StudySetup, capture: Capture): string[] {
    this.active = null;
    if (!setup.consent) return [];
    const data: ResearchExport = { schema: RESEARCH_SCHEMA, consent: true, consentScope: "one-local-attempt-export", source: "lava-consenting-local",
      participant: setup.participant, attempt: crypto.randomUUID(), session: this.session, device: setup.device, label: setup.label,
      labelProvenance: setup.label === "human-self-report" ? "participant-self-report" : setup.label === "automation-declared" ? "operator-declared-automation" : "unlabeled",
      featureVersion: FEATURE_VERSION, robustVersion: ROBUST_VERSION, normalizationVersion: NORMALIZATION_VERSION,
      consentProvenance: { revision: CONSENT_REVISION, beforeCapture: true, localOnly: true }, capture: structuredClone(capture),
      generator: structuredClone(setup.generator), outcome: { status: "incomplete", ringCompleted: false, verdict: null, passkeyOptions: "not-tested", authentication: "not-tested" }, samples: [], ...(setup.environment ? { environment: structuredClone(setup.environment) } : {}) };
    const invalid = validateResearchExport(data).issues.filter(i => i.kind === "invalid").map(i => i.code);
    if (!invalid.length) this.active = data;
    return invalid;
  }
  finish(status: StudyOutcome["status"], samples: readonly PointerSample[], verdict: StudyOutcome["verdict"] = null): void {
    if (!this.active) return;
    this.active.samples = structuredClone(samples.slice(0, 1024)) as PointerSample[];
    this.active.outcome = { status, ringCompleted: status === "completed", verdict, passkeyOptions: "not-tested", authentication: "not-tested" };
    // Undefined optional event attributes must be absent in the JSON schema.
    const snapshot = JSON.parse(JSON.stringify(this.active)) as ResearchExport;
    if (validateResearchExport(snapshot).data) {
      this.records.push(snapshot);
      if (this.records.length > 32) this.records.shift();
    }
    this.active = null;
  }
  get recording(): boolean { return this.active !== null; }
  get count(): number { return this.records.length; }
  latest(): ResearchExport | null { return this.records.length ? structuredClone(this.records.at(-1)!) : null; }
  batch(): { schema: "lava-consent-batch-v1"; exports: ResearchExport[] } { return { schema: "lava-consent-batch-v1", exports: structuredClone(this.records) }; }
  clear(): void { this.active = null; this.records = []; this.session = crypto.randomUUID(); }
}
