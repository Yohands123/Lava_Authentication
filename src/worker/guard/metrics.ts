import type { GuardSql } from "./storage";
export const POLICY_VERSION = "lava-policy-v4";
/** Fixed names, coarse hourly aggregates; never contexts, traces or IPs. */
export const METRIC_EVENTS = ["issued", "CLEAR", "FLAG", "BLOCK", "replay", "invalid", "rate_limited", "server_error", "overload_pulse", "verified", "verification_failed", "verification_requested", "reversal", "abandoned", "retried", "latency_10", "latency_50", "latency_200", "latency_1000", "latency_slow", ...Array.from({ length: 10 }, (_, i) => `score_${i}`)] as const;
export class GuardMetrics {
  constructor(private sql: GuardSql, private enabled = true) { sql.exec("CREATE TABLE IF NOT EXISTS guard_metrics (hour INTEGER, event TEXT, model TEXT, policy TEXT, n INTEGER NOT NULL, PRIMARY KEY(hour,event,model,policy))"); }
  record(event: string, model = "none", now = Date.now(), amount = 1): void {
    if (!this.enabled) return;
    if (!METRIC_EVENTS.includes(event) || !/^[\w.-]{1,64}$/.test(model)) return;
    this.sql.exec("INSERT INTO guard_metrics VALUES (?,?,?,?,?) ON CONFLICT(hour,event,model,policy) DO UPDATE SET n=MIN(n+excluded.n,1000000000)", Math.floor(now / 3600000), event, model, POLICY_VERSION, Math.min(1000000000, Math.max(1, Math.floor(amount))));
    this.sweep(now);
  }
  sweep(now = Date.now()): void {
    this.sql.exec("DELETE FROM guard_metrics WHERE hour < ?", Math.floor(now / 3600000) - 23);
    this.sql.exec("DELETE FROM guard_metrics WHERE rowid NOT IN (SELECT rowid FROM guard_metrics ORDER BY hour DESC LIMIT 2048)");
  }
  snapshot() { return { policyVersion: POLICY_VERSION, retentionHours: 24, counts: this.sql.exec("SELECT hour,event,model,policy,n FROM guard_metrics ORDER BY hour DESC,event LIMIT 2048").toArray() }; }
}
