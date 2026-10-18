import type { GuardMode } from "../../shared/lavaguard";

interface GuardEnvironment { ORIGIN: string; LAVAGUARD_MODE?: string; LAVAGUARD_EXPERIMENTAL_MODEL?: string; LAVAGUARD_ML_MODE?: string; LAVAGUARD_ENVIRONMENT?: string; LAVAGUARD_RESEARCH_APPROVED?: string; LAVAGUARD_PRODUCTION_ML_APPROVED?: string }
export const guardMode = (env: GuardEnvironment): GuardMode => env.LAVAGUARD_MODE === "shadow" || env.LAVAGUARD_MODE === "enforce" ? env.LAVAGUARD_MODE : "off";
export function mlMode(env: GuardEnvironment): "off" | "shadow" | "research_enforce" | "production_enforce" {
  if (guardMode(env) === "off") return "off";
  const requested = env.LAVAGUARD_ML_MODE;
  if (requested === "off" || requested === "shadow") return requested;
  if (requested === "research_enforce" || requested === "production_enforce") return requested;
  return env.LAVAGUARD_EXPERIMENTAL_MODEL === "1" ? "research_enforce" : "shadow";
}

/** Owner-authorized local experiment; never promotes this model in production. */
export function experimentalModelAllowed(env: GuardEnvironment): boolean {
  try {
    if (guardMode(env) !== "enforce") return false;
    const mode = mlMode(env), local = new URL(env.ORIGIN).hostname === "localhost";
    if (mode === "research_enforce") return local || (env.LAVAGUARD_ENVIRONMENT === "staging" && env.LAVAGUARD_RESEARCH_APPROVED === "1");
    return mode === "production_enforce" && env.LAVAGUARD_ENVIRONMENT === "production" && env.LAVAGUARD_PRODUCTION_ML_APPROVED === "1";
  } catch { return false; }
}
