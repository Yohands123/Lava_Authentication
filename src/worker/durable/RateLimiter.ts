// One instance per key (e.g. "ip:1.2.3.4:login" or "user:sara:register").
// Fixed-window counter; good enough for a demo, swap for sliding window later.

import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class RateLimiter extends DurableObject<Env> {
  private tableReady = false;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ensureSchema();
  }
  private ensureSchema(): void {
    if (this.tableReady) return;
    this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS rate_window (id INTEGER PRIMARY KEY CHECK(id=1), start INTEGER NOT NULL, count INTEGER NOT NULL, expires INTEGER NOT NULL)");
    if (!this.ctx.storage.sql.exec<{ name: string }>("PRAGMA table_info(rate_window)").toArray().some(c => c.name === "expires")) this.ctx.storage.sql.exec("ALTER TABLE rate_window ADD COLUMN expires INTEGER NOT NULL DEFAULT 0");
    this.tableReady = true;
  }
  async hit(limit: number, windowSeconds: number): Promise<RateResult> {
    this.ensureSchema();
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    // No await between count read and update: parallel RPCs cannot lose increments.
    const row = this.ctx.storage.sql.exec<{ start: number; count: number }>("SELECT start, count FROM rate_window WHERE id=1").toArray()[0];
    const fresh = !row || now - row.start >= windowMs;
    const start = fresh ? now : row.start;
    // A lower-limit call must never lower an existing shared-key count.
    const count = fresh ? 1 : Math.min(row.count + 1, 1000000000);
    this.ctx.storage.sql.exec("INSERT INTO rate_window VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET start=excluded.start, count=excluded.count, expires=excluded.expires", start, count, start + windowMs);
    // Alarm runs only after the window; old KV counters are removed on migration.
    if (fresh) await this.ctx.storage.setAlarm(start + windowMs + 1000);
    const ok = count <= limit;
    return {
      ok,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: ok ? 0 : Math.ceil((start + windowMs - now) / 1000),
    };
  }
  override async alarm(): Promise<void> {
    this.ensureSchema();
    const row = this.ctx.storage.sql.exec<{ expires: number }>("SELECT expires FROM rate_window WHERE id=1").toArray()[0];
    // A delayed/retried old alarm must not erase a newer active rate window.
    if (row && row.expires > Date.now()) { await this.ctx.storage.setAlarm(row.expires + 1000); return; }
    await this.ctx.storage.deleteAll(); this.tableReady = false;
  }
}
