/** A UI permission is short lived and single use; the server independently
 * verifies and consumes clearance. Never interpret it as authentication. */
export class AttemptPermission<T> {
  private value: { generation: number; expiresAt: number; data: T } | null = null;
  grant(generation: number, data: T, expiresAt: number, now = Date.now()): boolean {
    this.clear();
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
    this.value = { generation, data, expiresAt };
    return true;
  }
  current(generation: number, now = Date.now()): boolean {
    return this.value !== null && this.value.generation === generation && this.value.expiresAt > now;
  }
  take(generation: number, now = Date.now()): T | null {
    const result = this.current(generation, now) ? this.value!.data : null;
    this.clear();
    return result;
  }
  clear(): void { this.value = null; }
}
