import { it, expect } from "vitest";
import { ResearchShardRouter, type Placement, type RouteDirectory, type RouteScope } from "../../src/worker/guard/research-router";
import { ResearchShardMetrics, SHARD_EVENTS } from "../../src/shared/shard-metrics";
import { sqliteGuard } from "../fixtures/sqlite-guard";
import { ResearchRecorder } from "../../src/client/guard/research";
import { syntheticStudyExport } from "../fixtures/study";
class Directory implements RouteDirectory {
  entries = new Map<string, Placement>();
  reserve(id: string, scope: RouteScope, p: Placement) { const k = scope + id; if (this.entries.has(k)) return false; this.entries.set(k, { ...p }); return true; }
  lookup(id: string, scope: RouteScope) { return this.entries.get(scope + id) ?? null; }
}
const context = "c".repeat(43), origin = "http://localhost:8812", now = 1000;
const config = (shards = 4) => ({ enabled: true, epochs: [{ version: 1, shards, acceptUntil: 100000 }], active: 1, keyId: "local", secret: crypto.getRandomValues(new Uint8Array(32)), directory: new Directory() });
it("routing is opt-in and rejects ambiguous versions or unsupported shard counts", async () => {
  for (const c of [{ ...config(), enabled: false }, { ...config(), secret: new Uint8Array(4) }, config(3), { ...config(), epochs: [{ version: 1, shards: 4, acceptUntil: NaN }] }]) await expect(ResearchShardRouter.create(c)).rejects.toThrow();
});
it.each([1, 4, 16])("signed %i-shard placement preserves real SQL one-use, context and nonce boundaries", async shards => {
  const d = config(shards), router = await ResearchShardRouter.create(d), stores = Array.from({ length: shards }, sqliteGuard);
  try {
    const p = await router.placement(context, 1, now), g = stores[p.shard]!.guard, c = g.issue(context, origin, "accessible", "enforce");
    if ("error" in c) throw new Error("fixture issuance failed");
    const token = await router.seal(c.id, "attempt", context, origin, now + 60000, p, now);
    const claim = await router.verify(token, "attempt", context, origin, now); expect(claim?.shard).toBe(p.shard);
    expect(await router.verify(token, "attempt", "d".repeat(43), origin, now)).toBeNull();
    expect(await router.verify(token, "attempt", context, "https://wrong.invalid", now)).toBeNull();
    const verdict = g.evaluate(context, origin, c.id, c.nonce, null, "enforce"); if ("error" in verdict || !verdict.clearance) throw new Error("fixture evaluation failed");
    const clearance = await router.seal(verdict.clearance, "clearance", context, origin, now + 90000, p, now);
    const route = await router.verify(clearance, "clearance", context, origin, now); expect(route?.epoch).toBe(1);
    const results = await Promise.all(Array.from({ length: 32 }, async () => g.redeem(context, origin, verdict.clearance!)));
    expect(results.filter(r => r === "ok")).toHaveLength(1);
    if (shards > 1) expect(stores[(p.shard + 1) % shards]!.guard.redeem(context, origin, verdict.clearance)).not.toBe("ok");
    expect(await router.verify(clearance, "clearance", context, origin, now + 90000)).toBeNull();
    expect(await router.verify(token, "session", context, origin, now)).toBeNull();
  } finally { for (const s of stores) s.database.close(); }
});
it("changed payloads/signatures, unknown IDs and revoked directory entries cannot choose shards", async () => {
  const c = config(), r = await ResearchShardRouter.create(c), id = "a".repeat(43);
  const token = await r.seal(id, "attempt", context, origin, 9000, undefined, now);
  const [payload, sig] = token.split(".");
  const claim = JSON.parse(Buffer.from(payload!, "base64url").toString()); claim.shard = (claim.shard + 1) % 4;
  expect(await r.verify(Buffer.from(JSON.stringify(claim)).toString("base64url") + "." + sig, "attempt", context, origin, now)).toBeNull();
  expect(await r.verify(payload + "." + "x".repeat(43), "attempt", context, origin, now)).toBeNull();
  expect(r.legacyLookup(token, "attempt")).toBeNull(); expect(r.legacyLookup("b".repeat(43), "attempt")).toBeNull();
  await expect(r.seal(id, "attempt", context, origin, 9000, { epoch: 1, shard: 99 }, now)).rejects.toThrow();
  await expect(r.seal(id, "attempt", context, origin, 9000, undefined, now)).rejects.toThrow("Duplicate");
  c.directory.entries.clear(); expect(await r.verify(token, "attempt", context, origin, now)).toBeNull();
});
it("old and new epochs coexist only in their acceptance windows; lost keys and directory fail closed", async () => {
  const c = config(1), old = await ResearchShardRouter.create(c), token = await old.seal("a".repeat(43), "challenge", context, origin, 61000, undefined, now);
  const next = await ResearchShardRouter.create({ ...c, active: 2, epochs: [{ version: 1, shards: 1, acceptUntil: 62000 }, { version: 2, shards: 16, acceptUntil: 200000 }] });
  expect((await next.verify(token, "challenge", context, origin, now))?.epoch).toBe(1);
  expect((await next.placement(context, undefined, now)).epoch).toBe(2);
  expect(await next.verify(token, "challenge", context, origin, 62000)).toBeNull();
  const changedKey = await ResearchShardRouter.create({ ...c, secret: crypto.getRandomValues(new Uint8Array(32)) });
  expect(await changedKey.verify(token, "challenge", context, origin, now)).toBeNull();
  const unavailable = await ResearchShardRouter.create({ ...c, directory: { reserve() { throw new Error("storage unavailable"); }, lookup() { throw new Error("storage unavailable"); } } });
  expect(await unavailable.verify(token, "challenge", context, origin, now)).toBeNull();
  await expect(unavailable.seal("b".repeat(43), "challenge", context, origin, 9000, undefined, now)).rejects.toThrow();
});
it("per-shard metrics have fixed names, bounded rows, expiry and detached snapshots", () => {
  const m = new ResearchShardMetrics(16); for (let i = 0; i < 5000; i++) m.record(i % 16, "issued", i * 3600000);
  const s = m.snapshot(4999 * 3600000); expect(s.rows.length).toBeLessThanOrEqual(24); expect(s.capacity).toBe(1024);
  s.rows[0]!.count = 99; expect(m.snapshot(4999 * 3600000).rows[0]!.count).toBe(1);
  expect(m.snapshot(6000 * 3600000).rows).toHaveLength(0);
  expect(() => m.record(17, "issued")).toThrow(); expect(() => m.record(1, "private-id" as "issued")).toThrow();
  const crowded = new ResearchShardMetrics(16);
  for (let hour = 0; hour < 24; hour++) for (let shard = 0; shard < 16; shard++) for (const event of SHARD_EVENTS) crowded.record(shard, event, hour * 3600000);
  expect(crowded.snapshot(23 * 3600000).rows).toHaveLength(1024);
  expect(crowded.snapshot(23 * 3600000).droppedEventsSinceInstanceStart).toBeGreaterThan(0);
});
it("memory-only manifest preserves pre-capture consent, participant continuity, declared labels and withdrawal", () => {
  const raw = syntheticStudyExport(), r = new ResearchRecorder(), setup = { consent: true, participant: raw.participant, device: raw.device, label: raw.label, generator: raw.generator };
  r.begin({ ...setup, consent: false }, raw.capture); r.finish("cancelled", raw.samples); expect(r.count).toBe(0);
  r.begin(setup, raw.capture); r.finish("cancelled", raw.samples); r.begin(setup, raw.capture); r.finish("completed", raw.samples, "CLEAR");
  const h = r.sessionManifest(); expect(h.attempts[0]!.session).toBe(h.attempts[1]!.session); expect(h.supervision).toBe("UNVERIFIED");
  expect(h.attempts[0]!.consentObservedAtMs).toBeLessThanOrEqual(h.attempts[0]!.captureStartObservedAtMs);
  r.begin({ ...setup, participant: "synthetic-other-person" }, raw.capture); r.finish("cancelled", raw.samples);
  expect(r.sessionManifest().attempts[2]!.session).not.toBe(h.attempts[0]!.session);
  r.clear(); expect(r.count).toBe(0); expect(r.sessionManifest().attempts).toHaveLength(0);
});
