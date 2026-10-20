import type { FeatureSummary } from "../../shared/lavaguard";
import type { LavaEnforcer } from "./LavaEnforcer";
import { ResearchShardRouter, type Placement } from "./research-router";
/** Isolated facade: every redeem verifies directory authority. Production
 * routes and Durable Object namespace bindings do not import this module. */
export class ResearchRoutedGuard {
  private readonly epochs: Map<number, readonly LavaEnforcer[]>;
  constructor(private readonly router: ResearchShardRouter, epochs: Map<number, readonly LavaEnforcer[]>) {
    this.epochs = new Map([...epochs].map(([e, stores]) => [e, [...stores]]));
  }
  private store(p: Placement): LavaEnforcer {
    const store = this.epochs.get(p.epoch)?.[p.shard];
    if (!store) throw new Error("Authoritative shard unavailable; no fallback");
    return store;
  }
  async issue(context: string, origin: string, now = Date.now()) {
    const p = await this.router.placement(context, undefined, now), c = this.store(p).issue(context, origin, "accessible", "enforce", now);
    if ("error" in c) return c;
    return { ...c, id: await this.router.seal(c.id, "attempt", context, origin, c.expiresAt, p, now) };
  }
  async evaluate(context: string, origin: string, token: string, nonce: string, summary: FeatureSummary | null = null, now = Date.now()) {
    const c = await this.router.verify(token, "attempt", context, origin, now);
    if (!c) return { error: "binding" as const };
    const g = this.store(c), result = g.evaluate(context, origin, c.id, nonce, summary, "enforce", now);
    if ("error" in result || !result.clearance || !result.expiresAt) return result;
    try { return { ...result, clearance: await this.router.seal(result.clearance, "clearance", context, origin, result.expiresAt, c, now) }; }
    catch (error) { g.revoke(result.clearance); throw error; }
  }
  async redeem(context: string, origin: string, token: string, now = Date.now(), injectedPlacement?: Placement) {
    const c = await this.router.verify(token, "clearance", context, origin, now);
    if (!c || injectedPlacement && (injectedPlacement.epoch !== c.epoch || injectedPlacement.shard !== c.shard)) return "binding";
    return this.store(c).redeem(context, origin, c.id, "login-options", now);
  }
}
