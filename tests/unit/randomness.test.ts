import { describe, expect, it } from "vitest";
import { erfc, monobit, runs, toBits } from "../../src/client/entropy/randomness";

/** NIST SP 800-22 §2.1.8 and §2.3.8 worked example: ε = 1100100100001111110110101010001000100001011010001100001000110100110001001100011001100010100010111000, n = 100. */
const NIST_EXAMPLE =
  "1100100100001111110110101010001000100001011010001100001000110100110001001100011001100010100010111000"
    .split("")
    .map(Number);

describe("randomness tests", () => {
  it("erfc matches known values", () => {
    expect(erfc(0)).toBeCloseTo(1, 6);
    expect(erfc(1)).toBeCloseTo(0.157299, 5);
    expect(erfc(-1)).toBeCloseTo(1.842701, 5);
  });

  it("monobit matches the NIST worked example (p = 0.109599)", () => {
    const r = monobit(NIST_EXAMPLE);
    expect(r.p).toBeCloseTo(0.109599, 4);
    expect(r.pass).toBe(true);
  });

  it("runs matches the NIST worked example (p = 0.500798)", () => {
    const r = runs(NIST_EXAMPLE);
    expect(r.p).toBeCloseTo(0.500798, 4);
    expect(r.pass).toBe(true);
  });

  it("fails all-zero and alternating sequences", () => {
    const zeros = new Array(256).fill(0);
    const alternating = Array.from({ length: 256 }, (_, i) => i % 2);
    expect(monobit(zeros).pass).toBe(false);
    expect(runs(zeros).pass).toBe(false);
    expect(monobit(alternating).pass).toBe(true); // balanced...
    expect(runs(alternating).pass).toBe(false); // ...but switches far too often
  });

  it("unpacks bytes most significant bit first", () => {
    expect(toBits(new Uint8Array([0b10100000, 0xff]))).toEqual([1, 0, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]);
  });
});
