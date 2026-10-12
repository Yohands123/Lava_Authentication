// SECURITY-CRITICAL. Challenges are single-use: consume() reads and deletes in
// one Durable Object request, so two concurrent verifications can never both win.

import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import { emptyStats, SOURCE_STAT, type ChallengeStats, type DigestSource } from "../entropy/stats";

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

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
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
    this.sql.exec("DELETE FROM challenges WHERE expires_at < ?", Date.now() - SWEEP_GRACE_MS);
    const next = this.sql
      .exec<{ t: number | null }>("SELECT MIN(expires_at) AS t FROM challenges")
      .one();
    if (next.t !== null) await this.ctx.storage.setAlarm(next.t + SWEEP_GRACE_MS);
  }
}
