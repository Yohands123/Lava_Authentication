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
  async hit(limit: number, windowSeconds: number): Promise<RateResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    let start = (await this.ctx.storage.get<number>("start")) ?? now;
    let count = (await this.ctx.storage.get<number>("count")) ?? 0;

    if (now - start >= windowMs) {
      start = now;
      count = 0;
    }
    count += 1;
    await this.ctx.storage.put({ start, count });

    const ok = count <= limit;
    return {
      ok,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: ok ? 0 : Math.ceil((start + windowMs - now) / 1000),
    };
  }
}
