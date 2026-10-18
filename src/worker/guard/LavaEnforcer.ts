import type { AttemptKind, FeatureSummary, GuardChallenge, GuardDecision, GuardMode } from "../../shared/lavaguard";
import { LavaDetector, type Detection, type DetectorOptions } from "./LavaDetector";
import { LavaReputation, HISTORY_TTL_MS } from "./LavaReputation";
import { LavaPolicy } from "./LavaPolicy";
import type { GuardSql } from "./storage";

export function opaqueId(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let text = ""; for (const b of raw) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
type Failure = { error: "used" | "expired" | "binding" | "restricted" | "missing_features"; retryAfter?: number };
type AttemptRow = { id: string; nonce: string; seed: string; kind: AttemptKind; context: string; origin: string; issued: number; expires: number };
export type Evaluation = (GuardDecision & { debug: Detection | null; elapsedMs: number }) | Failure;

/** All critical reads/deletes/inserts below run synchronously in one DO request. */
export class LavaEnforcer {
  readonly reputation: LavaReputation;
  constructor(private readonly sql: GuardSql) {
    sql.exec(`CREATE TABLE IF NOT EXISTS guard_attempts (id TEXT PRIMARY KEY, nonce TEXT NOT NULL, seed TEXT NOT NULL, kind TEXT NOT NULL, context TEXT NOT NULL, origin TEXT NOT NULL, issued INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS guard_clearances (token TEXT PRIMARY KEY, context TEXT NOT NULL, origin TEXT NOT NULL, scope TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS guard_history (context TEXT NOT NULL, at INTEGER NOT NULL, verdict TEXT NOT NULL, protocol INTEGER NOT NULL, fingerprint TEXT NOT NULL, geometry TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS guard_history_context ON guard_history(context, at);
      CREATE TABLE IF NOT EXISTS guard_audit (at INTEGER NOT NULL, action TEXT NOT NULL, context TEXT NOT NULL, reason TEXT NOT NULL);`);
    sql.exec("CREATE INDEX IF NOT EXISTS guard_attempts_expiry ON guard_attempts(expires); CREATE INDEX IF NOT EXISTS guard_clearances_expiry ON guard_clearances(expires); CREATE INDEX IF NOT EXISTS guard_history_expiry ON guard_history(at)");
    this.reputation = new LavaReputation(sql);
  }
  issue(context: string, origin: string, kind: AttemptKind, mode: GuardMode, now = Date.now()): GuardChallenge | Failure {
    this.sweep(now);
    const retryAfter = this.reputation.retryAfter(context, now);
    if (retryAfter) return { error: "restricted", retryAfter };
    const total = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM guard_attempts").toArray()[0]!.n;
    if (total >= 4096) return { error: "restricted", retryAfter: 30 };
    // At most three pending challenges per context. Old challenges are invalidated.
    this.sql.exec("DELETE FROM guard_attempts WHERE context = ? AND id NOT IN (SELECT id FROM guard_attempts WHERE context = ? ORDER BY issued DESC LIMIT 2)", context, context);
    const c = { id: opaqueId(), nonce: opaqueId(), seed: opaqueId(16), expiresAt: now + 120000, kind, mode };
    this.sql.exec("INSERT INTO guard_attempts VALUES (?, ?, ?, ?, ?, ?, ?, ?)", c.id, c.nonce, c.seed, kind, context, origin, now, c.expiresAt);
    return c;
  }
  evaluate(context: string, origin: string, id: string, nonce: string, summary: FeatureSummary | null, mode: GuardMode, now = Date.now(), options: DetectorOptions = {}): Evaluation {
    const row = this.sql.exec<AttemptRow>("SELECT * FROM guard_attempts WHERE id = ?", id).toArray()[0];
    if (!row) { this.reputation.record(context, "FLAG", true, "", "", now); return { error: "used" }; }
    if (row.context !== context || row.origin !== origin) {
      this.reputation.record(context, "FLAG", true, "", "", now);
      return { error: "binding" };
    }
    this.sql.exec("DELETE FROM guard_attempts WHERE id = ?", id);
    if (row.expires <= now) return { error: "expired" };
    if (row.nonce !== nonce) { this.reputation.record(context, "FLAG", true, "", "", now); return { error: "binding" }; }
    if (row.kind === "gesture" && mode !== "off" && !summary) {
      this.reputation.record(context, "FLAG", true, "", "", now);
      return { error: "missing_features" };
    }
    if (row.kind === "accessible" && summary) return { error: "missing_features" };
    const recent = this.reputation.recent(context, now);
    const duplicate = !!summary && recent.some(h => h.fingerprint === summary.fingerprint || h.geometry === summary.geometryHash);
    const detection = summary ? new LavaDetector().evaluate(summary, now - row.issued, duplicate, options) : null;
    const retryAfter = this.reputation.retryAfter(context, now);
    const verdict = new LavaPolicy().decide(mode, detection, retryAfter > 0);
    this.reputation.record(context, verdict, false, summary?.fingerprint, summary?.geometryHash, now);
    let clearance: string | undefined, expiresAt: number | undefined;
    if (verdict === "CLEAR") {
      // Per-context and global capacity remain bounded under distributed callers.
      this.sql.exec("DELETE FROM guard_clearances WHERE context=? AND rowid NOT IN (SELECT rowid FROM guard_clearances WHERE context=? ORDER BY expires DESC,rowid DESC LIMIT 2)", context, context);
      if (this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM guard_clearances").toArray()[0]!.n >= 4096) return { error: "restricted", retryAfter: 30 };
      clearance = opaqueId(); expiresAt = now + 90000;
      this.sql.exec("INSERT INTO guard_clearances VALUES (?, ?, ?, ?, ?)", clearance, context, origin, "login-options", expiresAt);
    }
    return { verdict, clearance, expiresAt, retryAfter, alternative: verdict !== "BLOCK", assessment: row.kind === "accessible" ? "accessible" : mode === "off" ? "disabled" : mode === "shadow" ? "shadow" : options.experimentalModel ? "evaluated" : "protocol", debug: detection, elapsedMs: now - row.issued };
  }
  redeem(context: string, origin: string, token: string, scope = "login-options", now = Date.now()): "ok" | "used" | "binding" | "expired" {
    const row = this.sql.exec<{ context: string; origin: string; scope: string; expires: number }>("SELECT context, origin, scope, expires FROM guard_clearances WHERE token = ?", token).toArray()[0];
    if (!row) return "used";
    if (row.context !== context || row.origin !== origin || row.scope !== scope) return "binding";
    this.sql.exec("DELETE FROM guard_clearances WHERE token = ?", token);
    return row.expires <= now ? "expired" : "ok";
  }
  revoke(token: string) { this.sql.exec("DELETE FROM guard_clearances WHERE token=?", token); }
  grant(context: string, origin: string, now = Date.now()) {
    this.sql.exec("DELETE FROM guard_clearances WHERE expires<=?", now);
    if (this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM guard_clearances").toArray()[0]!.n >= 4096) return null;
    this.sql.exec("DELETE FROM guard_clearances WHERE context=? AND rowid NOT IN (SELECT rowid FROM guard_clearances WHERE context=? ORDER BY expires DESC,rowid DESC LIMIT 2)", context, context);
    const clearance = opaqueId(), expiresAt = now + 90000;
    this.sql.exec("INSERT INTO guard_clearances VALUES (?,?,?,?,?)", clearance, context, origin, "login-options", expiresAt);
    return { verdict: "CLEAR" as const, clearance, expiresAt, retryAfter: 0, alternative: true, assessment: "protocol" as const };
  }
  forget(context: string): void {
    for (const table of ["guard_attempts", "guard_clearances", "guard_history"]) this.sql.exec(`DELETE FROM ${table} WHERE context = ?`, context);
  }
  review(context: string, reason: string, now = Date.now()): void {
    this.forget(context);
    this.sql.exec("INSERT INTO guard_audit VALUES (?, 'restriction_reversed', ?, ?)", now, context, reason);
  }
  diagnostics(context: string): unknown {
    return { modelVersion: LavaDetector.version, mode: "experimental", recent: this.reputation.recent(context, Date.now()), audit: this.sql.exec("SELECT at, action, reason FROM guard_audit WHERE context = ? ORDER BY at DESC LIMIT 16", context).toArray() };
  }
  sweep(now = Date.now()): void {
    this.sql.exec("DELETE FROM guard_attempts WHERE expires <= ?", now - HISTORY_TTL_MS);
    this.sql.exec("DELETE FROM guard_clearances WHERE expires <= ?", now);
    this.sql.exec("DELETE FROM guard_history WHERE at <= ?", now - HISTORY_TTL_MS);
    this.sql.exec("DELETE FROM guard_audit WHERE at <= ?", now - 86400000);
    this.sql.exec("DELETE FROM guard_history WHERE rowid NOT IN (SELECT rowid FROM guard_history ORDER BY at DESC LIMIT 8192)");
    this.sql.exec("DELETE FROM guard_audit WHERE rowid NOT IN (SELECT rowid FROM guard_audit ORDER BY at DESC LIMIT 1024)");
  }
  nextCleanupAt(): number | null {
    return this.sql.exec<{ next: number | null }>(`SELECT MIN(t) AS next FROM (
      SELECT MIN(expires + 600000) AS t FROM guard_attempts UNION ALL
      SELECT MIN(expires) AS t FROM guard_clearances UNION ALL
      SELECT MIN(at + 600000) AS t FROM guard_history UNION ALL
      SELECT MIN(at + 86400000) AS t FROM guard_audit
    )`).toArray()[0]?.next ?? null;
  }
}
