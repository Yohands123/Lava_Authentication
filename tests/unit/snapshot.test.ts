import { describe, expect, it } from "vitest";
import { SnapshotSource } from "../../src/client/entropy/snapshot";

/** A fake 64×64 RGBA frame whose contents depend on `seed`. */
const frame = (seed: number) => {
  const px = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < px.length; i++) px[i] = (i * 31 + seed * 97) & 0xff;
  return px;
};

describe("SnapshotSource", () => {
  it("produces a 32-byte digest", async () => {
    const { digest, accepted } = await new SnapshotSource().capture(frame(1));
    expect(digest).toHaveLength(32);
    expect(accepted).toBe(true);
  });

  it("rejects and counts a repeated snapshot", async () => {
    const source = new SnapshotSource();
    await source.capture(frame(1));
    const repeat = await source.capture(frame(1));
    expect(repeat.accepted).toBe(false);
    expect(source.accepted).toBe(1);
    expect(source.rejected).toBe(1);
  });

  it("accepts distinct snapshots", async () => {
    const source = new SnapshotSource();
    for (let i = 0; i < 10; i++) expect((await source.capture(frame(i))).accepted).toBe(true);
    expect(source.rejected).toBe(0);
  });

  it("remembers the last 64 snapshots, not more", async () => {
    const source = new SnapshotSource();
    for (let i = 0; i < 65; i++) await source.capture(frame(i));
    // frame(0) has fallen out of the history; frame(64) has not.
    expect((await source.capture(frame(0))).accepted).toBe(true);
    expect((await source.capture(frame(64))).accepted).toBe(false);
  });
});
