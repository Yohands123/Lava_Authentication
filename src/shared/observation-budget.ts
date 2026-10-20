import type { PortableEstimate } from "./portable-model";
/** Async failure containment only; synchronous CPU cannot be preempted by JS. */
export async function observeWithinBudget(score: () => PortableEstimate | Promise<PortableEstimate>, budgetMs = 20): Promise<PortableEstimate> {
  const fallback = (reason: string): PortableEstimate => ({ riskScore: null, version: null, featureVersion: null, uncertainty: "high", action: "observe", reasons: [reason] });
  if (!Number.isFinite(budgetMs) || budgetMs < 1 || budgetMs > 50) return fallback("invalid_observation_budget");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([Promise.resolve().then(score), new Promise<PortableEstimate>(resolve => { timer = setTimeout(() => resolve(fallback("inference_timeout")), budgetMs); })]); }
  catch { return fallback("inference_error"); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
