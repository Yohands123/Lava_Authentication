// Aggregate entropy health for /api/health and Lab mode. Pure: no Durable
// Object or Worker types, so it's unit tested directly. Counts only, never the
// digests themselves, and nothing here is tied to a user.

import type { ClientDigests } from "./mix";

export type DigestSource = "stir" | "lamp" | "camera";

export interface ChallengeStats {
  issued: number;
  consumed: number;
  expired: number;
  unknown: number;
  /** Challenges issued with each client digest present. */
  withStir: number;
  withLamp: number;
  withCamera: number;
}

export const SOURCE_STAT = { stir: "withStir", lamp: "withLamp", camera: "withCamera" } as const;

export const emptyStats = (): ChallengeStats => ({
  issued: 0, consumed: 0, expired: 0, unknown: 0, withStir: 0, withLamp: 0, withCamera: 0,
});

/** Which client digests were sent. */
export function presentSources(digests: ClientDigests): DigestSource[] {
  return (["stir", "lamp", "camera"] as const).filter((s) => digests[s] !== null);
}

export interface HealthReport {
  secureGenerator: "ok";
  challengesIssued: number;
  challengesRejected: { expired: number; reused: number };
  /** Fraction of issued challenges that included each client digest (0..1). */
  clientDigests: { stir: number; lamp: number; camera: number };
}

export function healthReport(stats: ChallengeStats): HealthReport {
  const share = (n: number) => (stats.issued > 0 ? Math.round((n / stats.issued) * 100) / 100 : 0);
  return {
    // The Worker's generator can't be switched off; there is nothing to degrade.
    secureGenerator: "ok",
    challengesIssued: stats.issued,
    challengesRejected: { expired: stats.expired, reused: stats.unknown },
    clientDigests: { stir: share(stats.withStir), lamp: share(stats.withLamp), camera: share(stats.withCamera) },
  };
}
