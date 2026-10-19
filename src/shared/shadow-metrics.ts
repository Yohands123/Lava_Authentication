/** Local experiments only. Fixed names, fixed model slots, no identity labels. */
export const SHADOW_EVENTS = ["issued", "evaluated", "cleared", "restricted", "replay", "invalid", "accessible", "overload", "score_available", "score_null", "ood", "withdrawn", "inference_error", "latency_10", "latency_50", "latency_200", "latency_slow"] as const;
export class ShadowMetrics {
  private buckets = new Map<number, Map<string, number>>();
  constructor(private readonly enabled = false) {}
  record(event: string, model: "off" | "synthetic" | "reviewed" = "off", now = Date.now()): void {
    if (!this.enabled || !SHADOW_EVENTS.includes(event as typeof SHADOW_EVENTS[number]) || !["off","synthetic","reviewed"].includes(model) || !Number.isFinite(now)) return;
    const hour = Math.floor(now/3600000); this.sweep(now);
    const bucket = this.buckets.get(hour) ?? new Map<string, number>();
    const key = `${model}:${event}`; bucket.set(key, Math.min(1e9, (bucket.get(key) ?? 0)+1)); this.buckets.set(hour,bucket);
    if (this.buckets.size > 24) this.buckets.delete(Math.min(...this.buckets.keys()));
  }
  sweep(now = Date.now()): void { const hour = Math.floor(now/3600000); for (const k of this.buckets.keys()) if (k < hour-23 || k > hour) this.buckets.delete(k); }
  snapshot(now = Date.now()) { this.sweep(now); return { schema: "lava-local-shadow-metrics-v1", retentionHours: 24, identityLabels: false, counts: [...this.buckets].flatMap(([hour, b]) => [...b].map(([event,n]) => ({ hour,event,n }))) }; }
}
