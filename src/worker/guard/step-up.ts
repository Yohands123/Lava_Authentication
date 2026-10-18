import type { GuardSql } from "./storage";
import { opaqueId } from "./LavaEnforcer";

export class StepUpStore {
  constructor(private sql: GuardSql) {
    sql.exec("CREATE TABLE IF NOT EXISTS guard_stepups (id TEXT PRIMARY KEY, context TEXT, origin TEXT, attempt TEXT, expires INTEGER, busy INTEGER DEFAULT 0); CREATE INDEX IF NOT EXISTS guard_stepups_context ON guard_stepups(context); CREATE TABLE IF NOT EXISTS guard_verification_tokens (hash TEXT PRIMARY KEY, expires INTEGER)");
  }
  required(context: string, now = Date.now()) { return !!this.sql.exec("SELECT id FROM guard_stepups WHERE context=? AND expires>? LIMIT 1", context, now).toArray().length; }
  issue(context: string, origin: string, attempt: string, now = Date.now()) {
    this.sweep(now);
    if (this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM guard_stepups").toArray()[0]!.n >= 2048) return null;
    this.sql.exec("DELETE FROM guard_stepups WHERE context=?", context);
    const id = opaqueId(), expiresAt = now + 180000;
    this.sql.exec("INSERT INTO guard_stepups VALUES (?,?,?,?,?,0)", id, context, origin, attempt, expiresAt);
    return { id, expiresAt, provider: "turnstile" as const, action: "lava_guard" };
  }
  reserve(context: string, origin: string, id: string, tokenHash: string, now = Date.now()) {
    const row = this.sql.exec<{ context: string; origin: string; expires: number; busy: number }>("SELECT * FROM guard_stepups WHERE id=?", id).toArray()[0];
    if (!row || row.context !== context || row.origin !== origin || row.expires <= now || row.busy) return false;
    if (this.sql.exec("SELECT hash FROM guard_verification_tokens WHERE hash=?", tokenHash).toArray().length) return false;
    if (this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM guard_verification_tokens").toArray()[0]!.n >= 4096) return false;
    this.sql.exec("INSERT INTO guard_verification_tokens VALUES (?,?)", tokenHash, now + 300000);
    this.sql.exec("UPDATE guard_stepups SET busy=1 WHERE id=?", id);
    return true;
  }
  finish(context: string, origin: string, id: string, valid: boolean, now = Date.now()): boolean {
    const row = this.sql.exec<{ context: string; origin: string; expires: number; busy: number }>("SELECT * FROM guard_stepups WHERE id=?", id).toArray()[0];
    if (!row || row.context !== context || row.origin !== origin || row.expires <= now || !row.busy) return false;
    if (!valid) { this.sql.exec("UPDATE guard_stepups SET busy=0 WHERE id=?", id); return false; }
    this.sql.exec("DELETE FROM guard_stepups WHERE id=?", id);
    return true;
  }
  forget(context: string) { this.sql.exec("DELETE FROM guard_stepups WHERE context=?", context); }
  sweep(now = Date.now()) {
    this.sql.exec("DELETE FROM guard_stepups WHERE expires<=?", now);
    this.sql.exec("DELETE FROM guard_verification_tokens WHERE expires<=?", now);
  }
  nextCleanupAt() { return this.sql.exec<{ t: number | null }>("SELECT MIN(t) AS t FROM (SELECT MIN(expires) AS t FROM guard_stepups UNION ALL SELECT MIN(expires) AS t FROM guard_verification_tokens)").toArray()[0]?.t ?? null; }
}
