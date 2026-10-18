// SECURITY-CRITICAL. Challenges are single-use: consume() reads and deletes in
// one Durable Object request, so two concurrent verifications can never both win.

import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import { emptyStats, SOURCE_STAT, type ChallengeStats, type DigestSource } from "../entropy/stats";
import { LavaEnforcer } from "../guard/LavaEnforcer";
import type { AttemptKind, FeatureSummary, GuardMode } from "../../shared/lavaguard";
import { experimentalModelAllowed, mlMode } from "../guard/config";
import { GuardMetrics } from "../guard/metrics";
import { StepUpStore } from "../guard/step-up";
import { stepUpEnabled } from "../guard/turnstile";

export type ChallengePurpose = "register" | "login";

export interface ChallengeRecord {
  challenge: string; // base64url, exactly as it appears in clientDataJSON
  purpose: ChallengePurpose;
  userId: string | null;
  username: string | null;
}

export type ConsumeResult =
  | { status: "ok"; record: ChallengeRecord }
  | { status: "expired" }
  | { status: "unknown" };

export type { ChallengeStats } from "../entropy/stats";

// Expired rows are kept this long before the alarm sweeps them, so a late
// verification gets an honest "expired" (410) instead of "unknown" (409).
// They can never be consumed successfully: consume() rejects them by time.
const SWEEP_GRACE_MS = 10 * 60 * 1000;

export class ChallengeStore extends DurableObject<Env> {
  private readonly sql: SqlStorage;
  private readonly guard: LavaEnforcer;
  private readonly metrics: GuardMetrics;
  private readonly stepups: StepUpStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.guard = new LavaEnforcer(this.sql);
    this.metrics = new GuardMetrics(this.sql, env.LAVAGUARD_METRICS === "1");
    this.stepups = new StepUpStore(this.sql);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS challenges (
        challenge TEXT PRIMARY KEY,
        purpose TEXT NOT NULL,
        user_id TEXT,
        username TEXT,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS stats (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
    `);
  }

  private bump(key: keyof ChallengeStats): void {
    this.sql.exec(
      "INSERT INTO stats (k, v) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET v = v + 1",
      key,
    );
  }

  async issue(record: ChallengeRecord, ttlSeconds: number, sources: readonly DigestSource[] = []): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.sql.exec(
      "INSERT INTO challenges (challenge, purpose, user_id, username, expires_at) VALUES (?, ?, ?, ?, ?)",
      record.challenge,
      record.purpose,
      record.userId,
      record.username,
      expiresAt,
    );
    this.bump("issued");
    for (const source of sources) this.bump(SOURCE_STAT[source]);
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(expiresAt + SWEEP_GRACE_MS);
    }
  }

  async consume(challenge: string, purpose: ChallengePurpose): Promise<ConsumeResult> {
    const rows = this.sql
      .exec<{ purpose: string; user_id: string | null; username: string | null; expires_at: number }>(
        "SELECT purpose, user_id, username, expires_at FROM challenges WHERE challenge = ?",
        challenge,
      )
      .toArray();
    const row = rows[0];
    if (!row) {
      this.bump("unknown");
      return { status: "unknown" };
    }
    // Delete first: the challenge is spent whatever happens next.
    this.sql.exec("DELETE FROM challenges WHERE challenge = ?", challenge);

    if (row.expires_at < Date.now()) {
      this.bump("expired");
      return { status: "expired" };
    }
    if (row.purpose !== purpose) {
      this.bump("unknown");
      return { status: "unknown" };
    }
    this.bump("consumed");
    return {
      status: "ok",
      record: { challenge, purpose, userId: row.user_id, username: row.username },
    };
  }

  async stats(): Promise<ChallengeStats> {
    const out = emptyStats();
    for (const row of this.sql.exec<{ k: string; v: number }>("SELECT k, v FROM stats")) {
      if (row.k in out) out[row.k as keyof ChallengeStats] = row.v;
    }
    return out;
  }

  override async alarm(): Promise<void> {
    const abandoned = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM guard_attempts WHERE expires<=?", Date.now() - 600000).toArray()[0]!.n;
    if (abandoned) this.metrics.record("abandoned", "none", Date.now(), abandoned);
    this.guard.sweep();
    this.stepups.sweep(); this.metrics.sweep();
    this.sql.exec("DELETE FROM challenges WHERE expires_at < ?", Date.now() - SWEEP_GRACE_MS);
    const next = this.sql
      .exec<{ t: number | null }>("SELECT MIN(expires_at) AS t FROM challenges")
      .one();
    const guardAt = this.nextGuardCleanup();
    const nextAt = Math.min(next.t === null ? Infinity : next.t + SWEEP_GRACE_MS, guardAt ?? Infinity);
    if (Number.isFinite(nextAt)) await this.ctx.storage.setAlarm(Math.max(Date.now() + 1, nextAt));
  }

  private async scheduleGuardCleanup(): Promise<void> {
    const nextAt = this.nextGuardCleanup(), existing = await this.ctx.storage.getAlarm();
    if (nextAt !== null && (existing === null || existing > nextAt)) await this.ctx.storage.setAlarm(nextAt);
  }
  private nextGuardCleanup(): number | null {
    const metricsExpiry = this.sql.exec<{ t: number | null }>("SELECT MIN((hour+24)*3600000) AS t FROM guard_metrics").toArray()[0]?.t;
    const value = Math.min(this.guard.nextCleanupAt() ?? Infinity, this.stepups.nextCleanupAt() ?? Infinity, metricsExpiry ?? Infinity);
    return Number.isFinite(value) ? value : null;
  }

  async guardIssue(context: string, origin: string, kind: AttemptKind, mode: GuardMode) {
    if (this.guard.reputation.recent(context, Date.now()).length) this.metrics.record("retried");
    const result = this.guard.issue(context, origin, kind, mode);
    this.metrics.record("error" in result ? "BLOCK" : "issued");
    await this.scheduleGuardCleanup();
    return result;
  }
  async guardEvaluate(context: string, origin: string, id: string, nonce: string, summary: FeatureSummary | null, mode: GuardMode) {
    const result = this.guard.evaluate(context, origin, id, nonce, summary, mode, Date.now(), { experimentalModel: experimentalModelAllowed(this.env), computeModel: mlMode(this.env) !== "off", modelVersion: this.env.LAVAGUARD_MODEL_VERSION ?? "lava-logistic-experimental-v1" });
    if (!("error" in result)) {
      const protocolHistory = this.guard.reputation.recent(context, Date.now()).some(h => h.protocol === 1);
      const needs = stepUpEnabled(this.env) && result.verdict !== "BLOCK" && (result.verdict === "FLAG" || this.stepups.required(context) || protocolHistory || (result.assessment !== "accessible" && result.elapsedMs < 200));
      if (needs) {
        if (result.clearance) this.guard.revoke(result.clearance);
        result.clearance = undefined; result.expiresAt = undefined; result.verdict = "FLAG";
        const challenge = this.stepups.issue(context, origin, id);
        if (challenge) result.stepUp = challenge;
        this.metrics.record("verification_requested");
      }
      this.metrics.record(result.verdict, result.debug?.modelVersion);
      const estimate = result.debug?.estimator;
      if (estimate?.riskScore != null) this.metrics.record(`score_${Math.min(9, Math.floor(estimate.riskScore * 10))}`, estimate.modelVersion);
    } else this.metrics.record(result.error === "used" ? "replay" : "invalid");
    await this.scheduleGuardCleanup();
    return result;
  }
  async guardRedeem(context: string, origin: string, token: string) {
    if (stepUpEnabled(this.env) && this.stepups.required(context)) return "binding" as const;
    return this.guard.redeem(context, origin, token);
  }
  async guardForget(context: string) { this.guard.forget(context); this.stepups.forget(context); }
  async guardReview(context: string, reason: string) { this.guard.review(context, reason); this.metrics.record("reversal"); await this.scheduleGuardCleanup(); }
  async guardDiagnostics(context: string) { return this.guard.diagnostics(context); }
  async guardMetrics() { this.metrics.sweep(); return this.metrics.snapshot(); }
  async guardMetric(event: string) { this.metrics.record(event); await this.scheduleGuardCleanup(); }
  async guardReserveVerification(context: string, origin: string, id: string, hash: string) {
    const ok = this.stepups.reserve(context, origin, id, hash); await this.scheduleGuardCleanup(); return ok;
  }
  async guardFinishVerification(context: string, origin: string, id: string, valid: boolean) {
    const allowed = !this.guard.reputation.retryAfter(context, Date.now()) && valid;
    const finished = this.stepups.finish(context, origin, id, allowed);
    this.metrics.record(finished ? "verified" : "verification_failed");
    const result = finished ? this.guard.grant(context, origin) : null;
    await this.scheduleGuardCleanup(); return result;
  }
}
