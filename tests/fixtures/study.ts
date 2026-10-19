import { CONSENT_REVISION, RESEARCH_SCHEMA, NORMALIZATION_VERSION, type ResearchExport } from "../../src/shared/research";
import { FEATURE_VERSION } from "../../src/shared/lavaguard";
import { ROBUST_VERSION } from "../../src/shared/robust-features";
/** Entirely generated unit input; never a consenting participant measurement. */
export function syntheticStudyExport(): ResearchExport {
  return { schema: RESEARCH_SCHEMA, consent: true, consentScope: "one-local-attempt-export", source: "lava-consenting-local",
    participant: "synthetic-operator", attempt: "synthetic-attempt-00001", session: "synthetic-session-0001", device: "mouse", label: "automation-declared", labelProvenance: "operator-declared-automation",
    featureVersion: FEATURE_VERSION, robustVersion: ROBUST_VERSION, normalizationVersion: NORMALIZATION_VERSION,
    consentProvenance: { revision: CONSENT_REVISION, beforeCapture: true, localOnly: true },
    capture: { revision: "lava-capture-v3", cadenceMs: 32, maxSamples: 1024, acquisition: "playwright", viewport: { width: 1200, height: 900, dpr: 1 }, guardMode: "enforce", modelMode: "shadow" },
    generator: { family: "synthetic-curves", revision: "unit-v1", seed: "42", run: "synthetic-run-00001", trajectory: "synthetic-lineage-0001" },
    outcome: { status: "completed", ringCompleted: true, verdict: "CLEAR", passkeyOptions: "not-tested", authentication: "not-tested" },
    samples: Array.from({ length: 80 }, (_, i) => ({ x: .5 + .3 * Math.cos(i * .19), y: .5 + .3 * Math.sin(i * .21), t: 45 + i * 32 + i % 5,
      pointer: "mouse", trusted: true, pressure: 0, bubbleCount: 12 - Math.floor(i / 10), targetId: Math.floor(i / 20), targetX: .5 + .2 * Math.cos(i * .14), targetY: .5 + .2 * Math.sin(i * .16) })) };
}
