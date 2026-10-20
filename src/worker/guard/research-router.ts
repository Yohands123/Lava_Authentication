/** LOCAL RESEARCH PROTOTYPE ONLY. No production store imports this router.
 * Signed placement is advisory to the prototype's authoritative directory;
 * an invalid hint never triggers a search of other shards. */
export type RouteScope = "attempt" | "clearance" | "challenge" | "session";
export interface RouteEpoch { version: number; shards: number; acceptUntil: number }
export interface Placement { epoch: number; shard: number }
export interface RouteClaim extends Placement {
  version: "lava-route-v1"; key: string; id: string; scope: RouteScope;
  contextHash: string; originHash: string; expiresAt: number;
}
export interface RouteDirectory {
  reserve(id: string, scope: RouteScope, placement: Placement): boolean;
  lookup(id: string, scope: RouteScope): Placement | null;
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
const text = (s: string) => new TextEncoder().encode(s);
const idPattern = /^[\w-]{43}$/;
const hash = async (s: string) => encode(new Uint8Array(await crypto.subtle.digest("SHA-256", text(s))));
const same = (a: Placement, b: Placement) => a.epoch === b.epoch && a.shard === b.shard;
export class ResearchShardRouter {
  private constructor(private readonly epochs: readonly RouteEpoch[], private readonly active: number,
    private readonly keyId: string, private readonly signingKey: CryptoKey, private readonly directory: RouteDirectory) {}
  static async create(config: { enabled: boolean; epochs: RouteEpoch[]; active: number; keyId: string; secret: Uint8Array; directory: RouteDirectory }) {
    if (config.enabled !== true || config.secret.length < 32 || !/^[\w-]{1,16}$/.test(config.keyId) || !config.epochs.length || config.epochs.length > 4 ||
      new Set(config.epochs.map(e => e.version)).size !== config.epochs.length || !config.epochs.some(e => e.version === config.active) ||
      config.epochs.some(e => !Number.isSafeInteger(e.version) || e.version < 1 || ![1, 4, 16].includes(e.shards) || !Number.isFinite(e.acceptUntil))) throw new Error("Explicit isolated routing configuration required");
    const key = await crypto.subtle.importKey("raw", config.secret.slice().buffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    return new ResearchShardRouter(structuredClone(config.epochs), config.active, config.keyId, key, config.directory);
  }
  async placement(context: string, epoch = this.active, now = Date.now()): Promise<Placement> {
    const e = this.epochs.find(e => e.version === epoch);
    if (!e || e.acceptUntil <= now || !idPattern.test(context)) throw new Error("Unknown or expired routing epoch/context");
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", this.signingKey, text(`placement:${epoch}:${context}`)));
    return { epoch, shard: new DataView(mac.buffer).getUint32(0) % e.shards };
  }
  async seal(id: string, scope: RouteScope, context: string, origin: string, expiresAt: number, parent?: Placement, now = Date.now()): Promise<string> {
    const maxAge = scope === "session" ? 604800000 : scope === "attempt" ? 120000 : scope === "challenge" ? 60000 : 90000;
    if (!idPattern.test(id) || !["attempt", "clearance", "challenge", "session"].includes(scope) || !Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + maxAge) throw new Error("Invalid server-issued route");
    const placement = await this.placement(context, parent?.epoch ?? this.active, now);
    if (parent && !same(parent, placement)) throw new Error("Ambiguous parent routing");
    if (!this.directory.reserve(id, scope, placement)) throw new Error("Duplicate authoritative ID");
    const claim: RouteClaim = { version: "lava-route-v1", key: this.keyId, id, scope, ...placement, contextHash: await hash(context), originHash: await hash(origin), expiresAt };
    const payload = encode(text(JSON.stringify(claim))), signature = encode(new Uint8Array(await crypto.subtle.sign("HMAC", this.signingKey, text(payload))));
    return payload + "." + signature;
  }
  async verify(token: string, scope: RouteScope, context: string, origin: string, now = Date.now()): Promise<RouteClaim | null> {
    try {
      if (typeof token !== "string" || token.length > 2048 || !/^[\w-]+\.[\w-]{43}$/.test(token)) return null;
      const [payload, signature] = token.split(".") as [string, string];
      if (!await crypto.subtle.verify("HMAC", this.signingKey, decode(signature).buffer, text(payload))) return null;
      const c = JSON.parse(new TextDecoder().decode(decode(payload))) as RouteClaim;
      if (!c || Object.keys(c).sort().join(",") !== "contextHash,epoch,expiresAt,id,key,originHash,scope,shard,version" ||
        c.version !== "lava-route-v1" || c.key !== this.keyId || c.scope !== scope || !idPattern.test(c.id) || !Number.isFinite(c.expiresAt) || c.expiresAt <= now ||
        c.contextHash !== await hash(context) || c.originHash !== await hash(origin)) return null;
      const expected = await this.placement(context, c.epoch, now), authoritative = this.directory.lookup(c.id, scope);
      return same(c, expected) && authoritative && same(c, authoritative) ? c : null;
    } catch { return null; }
  }
  /** Compatibility requires an explicit authoritative directory entry. No scan,
   * failed-signature fallback or implicit old-algorithm guessing is permitted. */
  legacyLookup(id: string, scope: RouteScope): Placement | null {
    return idPattern.test(id) ? this.directory.lookup(id, scope) : null;
  }
}
