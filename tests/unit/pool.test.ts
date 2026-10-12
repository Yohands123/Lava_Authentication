import { describe, expect, it } from "vitest";
import { EntropyPool } from "../../src/client/stir/pool";
import { STIR } from "../../src/client/lamp/constants";

const fill = (pool: EntropyPool, n: number, offset = 0) => {
  for (let i = 0; i < n; i++) pool.add([i + offset, -i, 8 + (i % 5) * 0.3, 0.5, 0, 0]);
};

describe("EntropyPool", () => {
  it("returns null when nothing was added", async () => {
    expect(await new EntropyPool().digest()).toBeNull();
  });

  it("produces a 32-byte digest, including a partial batch", async () => {
    const pool = new EntropyPool();
    fill(pool, STIR.BATCH + 5);
    const digest = await pool.digest();
    expect(digest).toHaveLength(32);
    expect(digest!.some((b) => b !== 0)).toBe(true);
  });

  it("is deterministic for identical input and differs for different input", async () => {
    const a = new EntropyPool();
    const b = new EntropyPool();
    const c = new EntropyPool();
    fill(a, 40);
    fill(b, 40);
    fill(c, 40, 1);
    const [da, db, dc] = await Promise.all([a.digest(), b.digest(), c.digest()]);
    expect(da).toEqual(db);
    expect(da).not.toEqual(dc);
  });

  it("reset clears the pool", async () => {
    const pool = new EntropyPool();
    fill(pool, 40);
    pool.reset();
    expect(pool.sampleCount).toBe(0);
    expect(await pool.digest()).toBeNull();
  });
});
