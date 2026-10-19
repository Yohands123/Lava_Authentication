/** Three low-entropy hints only. No raw UA/brand list or device probing. */
export const AUTOMATION_ENVIRONMENT_VERSION = "lava-automation-environment-v1";
export const ENVIRONMENT_SIGNALS = ["webdriver", "headlessUserAgent", "headlessBrand"] as const;
export const DECLARED_ENVIRONMENTS = ["unknown", "ordinary-browser", "ordinary-chrome", "headed-playwright", "headless-playwright", "puppeteer", "ghost-cursor", "human-controlled-automation"] as const;
export interface AutomationEnvironmentEvidence {
  version: typeof AUTOMATION_ENVIRONMENT_VERSION;
  authority: "advisory";
  signals: Record<typeof ENVIRONMENT_SIGNALS[number], boolean | null>;
}
export interface ResearchEnvironment {
  version: "lava-research-environment-v1";
  declaredEnvironment: typeof DECLARED_ENVIRONMENTS[number];
  declaredControl: "unknown" | "human" | "scripted" | "mixed";
  displayMode: "unknown" | "headed" | "headless";
  evidence: AutomationEnvironmentEvidence;
}
export interface ResearchCaptureOptions { cadenceMs: number; environment: ResearchEnvironment }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: unknown, keys: readonly string[]) => record(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const read = (source: unknown, key: string): unknown => { try { return source && typeof source === "object" ? Reflect.get(source, key) : undefined; } catch { return undefined; } };
export function readWebdriver(source: unknown): boolean | null { const value = read(source, "webdriver"); return typeof value === "boolean" ? value : null; }
function headlessBrand(brands: unknown): boolean | null {
  try {
    return Array.isArray(brands) && brands.length <= 10 && brands.every(v => typeof read(v, "brand") === "string")
      ? brands.some(v => /^HeadlessChrom(?:e|ium)$/.test(String(read(v, "brand")))) : null;
  } catch { return null; }
}

/** Caller must gate this snapshot to a consented local research attempt. */
export function collectAutomationEnvironment(source: unknown): AutomationEnvironmentEvidence {
  const ua = read(source, "userAgent"), brands = read(read(source, "userAgentData"), "brands");
  return { version: AUTOMATION_ENVIRONMENT_VERSION, authority: "advisory", signals: {
    webdriver: readWebdriver(source),
    headlessUserAgent: typeof ua === "string" && ua.length <= 4096 ? /\bHeadlessChrom(?:e|ium)(?:\/|\b)/.test(ua) : null,
    headlessBrand: headlessBrand(brands),
  } };
}
export function parseAutomationEnvironment(value: unknown): AutomationEnvironmentEvidence | null {
  if (!exact(value, ["version", "authority", "signals"]) || !record(value) || value.version !== AUTOMATION_ENVIRONMENT_VERSION || value.authority !== "advisory" || !exact(value.signals, ENVIRONMENT_SIGNALS) || !record(value.signals)) return null;
  if (ENVIRONMENT_SIGNALS.some(k => value.signals && record(value.signals) && value.signals[k] !== null && typeof value.signals[k] !== "boolean")) return null;
  return structuredClone(value) as unknown as AutomationEnvironmentEvidence;
}
export function parseResearchEnvironment(value: unknown): ResearchEnvironment | null {
  if (!exact(value, ["version", "declaredEnvironment", "declaredControl", "displayMode", "evidence"]) || !record(value) || value.version !== "lava-research-environment-v1" || !DECLARED_ENVIRONMENTS.includes(value.declaredEnvironment as ResearchEnvironment["declaredEnvironment"]) || typeof value.declaredControl !== "string" || !["unknown", "human", "scripted", "mixed"].includes(value.declaredControl) || typeof value.displayMode !== "string" || !["unknown", "headed", "headless"].includes(value.displayMode) || !parseAutomationEnvironment(value.evidence)) return null;
  return structuredClone(value) as unknown as ResearchEnvironment;
}
export function assessAutomationEnvironment(evidence: AutomationEnvironmentEvidence | null, legacyWebdriver?: boolean) {
  const observed = evidence ?? { version: AUTOMATION_ENVIRONMENT_VERSION, authority: "advisory" as const, signals: { webdriver: legacyWebdriver ?? null, headlessUserAgent: null, headlessBrand: null } };
  const positiveSignals = ENVIRONMENT_SIGNALS.filter(k => observed.signals[k] === true);
  return { evidence: observed, positiveSignals, status: positiveSignals.length ? "hint-present" : ENVIRONMENT_SIGNALS.every(k => observed.signals[k] === null) ? "unavailable" : "no-positive-hints",
    operatorIdentity: "unknown", enforcementContribution: 0, reliability: "client-claimed-spoofable", source: evidence ? "versioned-local-research" : "legacy-webdriver-only" } as const;
}
