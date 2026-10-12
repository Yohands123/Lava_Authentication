// Running SHA-256 pool. Raw samples never leave the browser: only digest() does.

import { STIR } from "../lamp/constants";

const VALUES_PER_SAMPLE = 6;

export class EntropyPool {
  private pool = new Uint8Array(32);
  private buffer: number[] = [];
  private chain: Promise<void> = Promise.resolve();
  private samples = 0;

  get sampleCount(): number {
    return this.samples;
  }

  add(values: readonly number[]): void {
    this.buffer.push(...values);
    this.samples++;
    if (this.buffer.length >= STIR.BATCH * VALUES_PER_SAMPLE) this.flush();
  }

  /** Final 32-byte digest, or null if nothing was ever added. */
  async digest(): Promise<Uint8Array | null> {
    if (this.buffer.length) this.flush();
    await this.chain;
    return this.samples > 0 ? this.pool.slice() : null;
  }

  reset(): void {
    this.pool = new Uint8Array(32);
    this.buffer = [];
    this.samples = 0;
    this.chain = Promise.resolve();
  }

  private flush(): void {
    const data = new Float64Array(this.buffer);
    this.buffer = []; // raw samples dropped from memory right away
    this.chain = this.chain.then(async () => {
      const joined = new Uint8Array(32 + data.byteLength);
      joined.set(this.pool, 0);
      joined.set(new Uint8Array(data.buffer), 32);
      this.pool = new Uint8Array(await crypto.subtle.digest("SHA-256", joined));
    });
  }
}
