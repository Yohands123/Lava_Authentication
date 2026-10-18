import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { GuardSql } from "../../src/worker/guard/storage";
import { StepUpStore } from "../../src/worker/guard/step-up";
import { GuardMetrics } from "../../src/worker/guard/metrics";
import { LavaEnforcer } from "../../src/worker/guard/LavaEnforcer";
function sqlFixture() {
  const db = new DatabaseSync(":memory:");
  const sql = { exec(query: string, ...args: (string | number | null)[]) {
    if (!args.length && query.includes(";")) { db.exec(query); return { toArray: () => [] }; }
    const s = db.prepare(query), rows = s.columns().length ? s.all(...args) : (s.run(...args), []);
    return { toArray: () => rows, [Symbol.iterator]: () => rows[Symbol.iterator]() };
  } } as GuardSql;
  return { db, sql };
}
describe("real SQLite step-up, capacities and aggregate expiry", () => {
  it("reserves before network work, binds context and prevents token reuse after failure", () => {
    const { sql } = sqlFixture(), store = new StepUpStore(sql), now = Date.now();
    const c = store.issue("context", "origin", "attempt", now)!;
    expect(store.reserve("other", "origin", c.id, "hash", now)).toBe(false);
    expect(store.reserve("context", "origin", c.id, "hash", now)).toBe(true);
    expect(store.reserve("context", "origin", c.id, "another", now)).toBe(false);
    expect(store.finish("context", "origin", c.id, false, now)).toBe(false);
    expect(store.reserve("context", "origin", c.id, "hash", now)).toBe(false);
    expect(store.reserve("context", "origin", c.id, "newHash", now)).toBe(true);
    expect(store.finish("context", "origin", c.id, true, now)).toBe(true);
    expect(store.finish("context", "origin", c.id, true, now)).toBe(false);
    store.sweep(now + 300001); expect(store.nextCleanupAt()).toBeNull();
  });
  it("expired step-ups cannot be redeemed and deletion revokes pending state", () => {
    const { sql } = sqlFixture(), store = new StepUpStore(sql), now = Date.now();
    const c = store.issue("context", "origin", "attempt", now)!;
    expect(store.reserve("context", "origin", c.id, "hash", now + 180001)).toBe(false);
    store.forget("context"); expect(store.required("context", now)).toBe(false);
  });
  it("bounds global challenge capacity, and expiry cleanup releases it", () => {
    const { sql, db } = sqlFixture(), guard = new LavaEnforcer(sql), now = Date.now();
    const insert = db.prepare("INSERT INTO guard_attempts VALUES (?,?,?,?,?,?,?,?)");
    for (let i=0;i<4096;i++) insert.run(String(i), "nonce", "seed", "accessible", "context", "origin", now, now+1);
    expect(guard.issue("new-context", "origin", "accessible", "enforce", now)).toHaveProperty("error", "restricted");
    guard.sweep(now+600002);
    expect(guard.issue("new-context", "origin", "accessible", "enforce", now+600002)).toHaveProperty("id");
  });
  it("metrics reject arbitrary labels, contain no identifiers, and expire after 24 hours", () => {
    const { sql } = sqlFixture(), metrics = new GuardMetrics(sql), now = Date.now();
    metrics.record("CLEAR", "model-v1", now); metrics.record("CLEAR", "model-v1", now);
    metrics.record("private-context", "model-v1", now);
    expect(metrics.snapshot().counts).toHaveLength(1);
    expect(metrics.snapshot().counts[0]!.n).toBe(2);
    metrics.sweep(now+86400001); expect(metrics.snapshot().counts).toHaveLength(0);
    const disabled = new GuardMetrics(sql, false); disabled.record("CLEAR"); expect(disabled.snapshot().counts).toHaveLength(0);
  });
});
