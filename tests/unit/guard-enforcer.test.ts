import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { LavaEnforcer } from "../../src/worker/guard/LavaEnforcer";
import { extractFeatures } from "../../src/shared/features";
import { FEATURE_VERSION } from "../../src/shared/lavaguard";
import type { FeatureSummary } from "../../src/shared/lavaguard";
import type { GuardSql } from "../../src/worker/guard/storage";
import { readFileSync } from "node:fs";
import { parseSummary } from "../../src/worker/guard/LavaDetector";
interface Database {
  exec(query: string): void;
  prepare(query: string): { columns(): unknown[]; all(...args: unknown[]): Record<string, unknown>[]; run(...args: unknown[]): unknown; get(): Record<string, unknown> | undefined };
}
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => Database };

// Execute the production SQL, rather than an in-memory imitation of the lifecycle.
function enforcer() {
  const database = new DatabaseSync(":memory:");
  const adapter = { exec(query: string, ...args: (string | number)[]) {
    if (!args.length && query.includes(";")) { database.exec(query); return []; }
    const statement = database.prepare(query);
    const rows = statement.columns().length ? statement.all(...args) : (statement.run(...args), []);
    return { toArray: () => rows, [Symbol.iterator]: () => rows[Symbol.iterator]() };
  } } as unknown as GuardSql;
  return { guard: new LavaEnforcer(adapter), database };
}
const origin = "http://localhost:8787", context = "a".repeat(43);
function issue(g: LavaEnforcer, kind: "gesture" | "accessible" = "accessible", now = Date.now()) {
  const c = g.issue(context, origin, kind, "shadow", now);
  if ("error" in c) throw new Error(c.error);
  return c;
}
describe("SQL challenge/clearance lifecycle", () => {
  it("issues cryptographic nonces, expires and consumes an attempt once", () => {
    const { guard } = enforcer(), now = Date.now(), a = issue(guard, "accessible", now), b = issue(guard, "accessible", now);
    expect(a.id).not.toBe(b.id); expect(a.nonce).not.toBe(b.nonce); expect(a.seed).not.toBe(b.seed);
    expect(guard.evaluate(context, origin, a.id, a.nonce, null, "shadow", now + 120001)).toEqual({ error: "expired" });
    const result = guard.evaluate(context, origin, b.id, b.nonce, null, "shadow", now + 1);
    expect(result).toHaveProperty("verdict", "CLEAR");
    expect(guard.evaluate(context, origin, b.id, b.nonce, null, "shadow", now + 2)).toEqual({ error: "used" });
  });
  it("checks origin, context and scope before atomic clearance redemption", () => {
    const { guard } = enforcer(), c = issue(guard);
    const r = guard.evaluate(context, origin, c.id, c.nonce, null, "shadow");
    if ("error" in r || !r.clearance) throw new Error("no clearance");
    expect(guard.redeem("other", origin, r.clearance)).toBe("binding");
    expect(guard.redeem(context, "https://other.example", r.clearance)).toBe("binding");
    expect(guard.redeem(context, origin, r.clearance, "register")).toBe("binding");
    expect(guard.redeem(context, origin, r.clearance)).toBe("ok");
    expect(guard.redeem(context, origin, r.clearance)).toBe("used");
  });
  it("spends bad nonces and never accepts a gesture with missing features", () => {
    const { guard } = enforcer(), c = issue(guard, "gesture");
    expect(guard.evaluate(context, origin, c.id, "wrong", null, "shadow")).toEqual({ error: "binding" });
    expect(guard.evaluate(context, origin, c.id, c.nonce, null, "shadow")).toEqual({ error: "used" });
    const d = issue(guard, "gesture");
    expect(guard.evaluate(context, origin, d.id, d.nonce, null, "shadow")).toEqual({ error: "missing_features" });
  });
  it("expiry is enforced on clearance and pending challenges are capped", () => {
    const { guard, database } = enforcer(), now = Date.now();
    for (let i = 0; i < 10; i++) issue(guard, "accessible", now + i);
    expect(database.prepare("SELECT COUNT(*) AS n FROM guard_attempts").get()!.n).toBe(3);
    const c = issue(guard, "accessible", now + 20), r = guard.evaluate(context, origin, c.id, c.nonce, null, "shadow", now + 25);
    if ("error" in r || !r.clearance) throw new Error("no clearance");
    expect(guard.redeem(context, origin, r.clearance, "login-options", now + 90026)).toBe("expired");
  });
  it("limits history retention, reverses restrictions and audits the reason", () => {
    const { guard, database } = enforcer(), now = Date.now();
    for (let i = 0; i < 25; i++) guard.reputation.record(context, "FLAG", true, "hash", "geometry", now);
    expect(guard.reputation.recent(context, now)).toHaveLength(16);
    expect(guard.issue(context, origin, "accessible", "shadow", now)).toHaveProperty("error", "restricted");
    guard.review(context, "Owner reviewed false restriction", now);
    expect(guard.reputation.recent(context, now)).toHaveLength(0);
    expect(database.prepare("SELECT action FROM guard_audit").get()!.action).toBe("restriction_reversed");
    guard.reputation.record(context, "CLEAR", false, "", "", now);
    guard.sweep(now + 600001);
    expect(database.prepare("SELECT COUNT(*) AS n FROM guard_history").get()!.n).toBe(0);
  });
  it("finds repeated geometry across fresh challenges, without BLOCKing", () => {
    const { guard } = enforcer();
    const summary: FeatureSummary = { version: FEATURE_VERSION, features: extractFeatures(Array.from({ length: 20 }, (_, i) => ({ x: i / 20, y: .5, t: i * 32 }))), fingerprint: "f".repeat(43), geometryHash: "g".repeat(43) };
    const a = issue(guard, "gesture");
    guard.evaluate(context, origin, a.id, a.nonce, summary, "shadow");
    const b = issue(guard, "gesture"), result = guard.evaluate(context, origin, b.id, b.nonce, summary, "enforce");
    // A straight constant-speed path is machine-regular: FLAG, never BLOCK.
    expect(result).toHaveProperty("verdict", "FLAG");
    if (!("error" in result)) expect(result.debug?.reasons).toContain("recent_path_recurrence");
  });
  it("schedules actual retention expiry rather than delaying cleanup behind auth challenges", () => {
    const { guard } = enforcer(), now = Date.now();
    expect(guard.nextCleanupAt()).toBeNull();
    guard.reputation.record(context, "CLEAR", false, "hash", "geometry", now);
    expect(guard.nextCleanupAt()).toBe(now + 600000);
    guard.sweep(now + 600000);
    expect(guard.reputation.recent(context, now + 600000)).toHaveLength(0);
    expect(guard.nextCleanupAt()).toBeNull();
    const c = issue(guard, "accessible", now), result = guard.evaluate(context, origin, c.id, c.nonce, null, "shadow", now);
    if ("error" in result || !result.clearance) throw new Error("no clearance");
    expect(guard.nextCleanupAt()).toBe(now + 90000);
    guard.redeem(context, origin, result.clearance, "login-options", now);
    expect(guard.nextCleanupAt()).toBe(now + 600000);
  });
  it("does not mint or persist clearance for the automated preview's model refusal", () => {
    const { guard, database } = enforcer(), now = Date.now();
    const captured = parseSummary(JSON.parse(readFileSync(new URL("../fixtures/automated-preview-summary.json", import.meta.url), "utf8")));
    if (!captured) throw new Error("Invalid synthetic browser capture fixture");
    const c = issue(guard, "gesture", now);
    const result = guard.evaluate(context, origin, c.id, c.nonce, captured, "enforce", now + 10000, { experimentalModel: true });
    expect(result).toHaveProperty("verdict", "FLAG");
    expect(result).not.toHaveProperty("clearance", expect.any(String));
    expect(database.prepare("SELECT COUNT(*) AS n FROM guard_clearances").get()!.n).toBe(0);
    expect(guard.reputation.recent(context, now + 10000)[0]!.protocol).toBe(0);
  });
});
