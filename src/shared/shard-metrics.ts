/** Bounded per-shard prototype counters; no visitor identifiers or remote sink. */
export const SHARD_EVENTS = ["issued", "redeemed", "replay", "expired", "rate429", "admission503", "unexpected", "retry", "accessible", "backlog", "metricsUnavailable"] as const;
export type ShardEvent = typeof SHARD_EVENTS[number];
export class ResearchShardMetrics {
  private rows = new Map<string, { hour: number; shard: number; event: ShardEvent; count: number }>();
  private dropped = 0;
  constructor(private readonly shards: number, readonly policy = "lava-routing-prototype-v1", readonly model: "off" | "synthetic" = "off") {
    if (![1, 4, 16].includes(shards) || policy !== "lava-routing-prototype-v1" || !["off", "synthetic"].includes(model)) throw new Error("Fixed metric labels required");
  }
  record(shard: number, event: ShardEvent, now = Date.now()): void {
    if (!Number.isInteger(shard) || shard < 0 || shard >= this.shards || !SHARD_EVENTS.includes(event) || !Number.isFinite(now)) throw new Error("Invalid metric label");
    const hour = Math.floor(now / 3600000);
    for (const [key, row] of this.rows) if (row.hour <= hour - 24 || row.hour > hour) this.rows.delete(key);
    const key = `${hour}:${shard}:${event}`, row = this.rows.get(key);
    if (row) row.count = Math.min(Number.MAX_SAFE_INTEGER, row.count + 1);
    else if (this.rows.size < 1024) this.rows.set(key, { hour, shard, event, count: 1 });
    else this.dropped = Math.min(Number.MAX_SAFE_INTEGER, this.dropped + 1);
  }
  snapshot(now = Date.now()) {
    const hour = Math.floor(now / 3600000);
    return { policy: this.policy, model: this.model, capacity: 1024, droppedEventsSinceInstanceStart: this.dropped, rows: [...this.rows.values()].filter(r => r.hour > hour - 24 && r.hour <= hour).map(r => ({ ...r })) };
  }
}
