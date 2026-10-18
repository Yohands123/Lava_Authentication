export const HISTORY_TTL_MS = 10 * 60 * 1000;
export type RecentAttempt = { at: number; verdict: string; protocol: number; fingerprint: string; geometry: string };

/** Short-lived browser context, never an IP or persistent biometric identity. */
export class LavaReputation {
  constructor(private readonly sql: GuardSql) {}
  recent(context: string, now: number): RecentAttempt[] {
    return this.sql.exec<RecentAttempt>("SELECT at, verdict, protocol, fingerprint, geometry FROM guard_history WHERE context = ? AND at > ? ORDER BY at DESC LIMIT 16", context, now - HISTORY_TTL_MS).toArray();
  }
  record(context: string, verdict: string, protocol: boolean, fingerprint = "", geometry = "", now = Date.now()): void {
    this.sql.exec("INSERT INTO guard_history(context, at, verdict, protocol, fingerprint, geometry) VALUES (?, ?, ?, ?, ?, ?)", context, now, verdict, Number(protocol), fingerprint, geometry);
    this.sql.exec("DELETE FROM guard_history WHERE context = ? AND rowid NOT IN (SELECT rowid FROM guard_history WHERE context = ? ORDER BY at DESC LIMIT 16)", context, context);
  }
  retryAfter(context: string, now: number): number {
    const abuse = this.recent(context, now).filter(h => h.protocol === 1);
    return abuse.length >= 3 ? Math.max(0, Math.ceil((abuse[0]!.at + 60000 - now) / 1000)) : 0;
  }
}
import type { GuardSql } from "./storage";
