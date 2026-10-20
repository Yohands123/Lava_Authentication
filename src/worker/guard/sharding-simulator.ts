import type { LavaEnforcer } from "./LavaEnforcer";
/** Simulator only: no production DO namespace, routing or migration is changed. */
export function contextShard(context: string, count: number): number {
  if (!/^[\w-]{43}$/.test(context) || !Number.isInteger(count) || count < 1 || count > 64 || (count & (count-1))) throw new Error("Invalid simulator context/shard count");
  let hash = 2166136261; for (const c of context) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0) % count;
}
export class GuardShardSimulator {
  readonly shards: LavaEnforcer[];
  constructor(count: number, factory: () => LavaEnforcer) { contextShard("a".repeat(43),count); this.shards = Array.from({length:count},factory); }
  forContext(context: string): LavaEnforcer { return this.shards[contextShard(context,this.shards.length)]!; }
}
