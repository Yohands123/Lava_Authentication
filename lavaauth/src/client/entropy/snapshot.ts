// Lamp snapshots. A simulated lamp is deterministic, so a snapshot alone is
// NOT randomness (see README). It's hashed, health-checked, and mixed server-side
// with crypto.getRandomValues(), which is what actually secures the challenge.

const HISTORY = 64;

export interface SnapshotResult {
  digest: Uint8Array;
  accepted: boolean;
}

export class SnapshotSource {
  private recent: string[] = [];
  accepted = 0;
  rejected = 0;

  async capture(pixels: Uint8Array): Promise<SnapshotResult> {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", pixels as BufferSource));
    const key = Array.from(digest.subarray(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
    const accepted = !this.recent.includes(key);
    if (accepted) {
      this.recent.push(key);
      if (this.recent.length > HISTORY) this.recent.shift();
      this.accepted++;
    } else {
      this.rejected++;
    }
    return { digest, accepted };
  }
}
