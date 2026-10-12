// Two NIST SP 800-22 tests for Lab mode: frequency (monobit, §2.1) and runs
// (§2.3). For education, not certification. Lab mode runs them on SHA-256
// digests, which pass whatever went in: that is the lesson, not a flaw.

/** Pass threshold from SP 800-22. */
export const ALPHA = 0.01;

export interface TestResult {
  /** p-value, 0..1. */
  p: number;
  pass: boolean;
}

/** Complementary error function (Numerical Recipes erfcc, |error| < 1.2e-7). */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z - 1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
        t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

export function toBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (const byte of bytes) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  return bits;
}

/** Frequency (monobit): are ones and zeros roughly balanced? */
export function monobit(bits: readonly number[]): TestResult {
  const n = bits.length;
  if (n === 0) return { p: 0, pass: false };
  const s = bits.reduce((sum, b) => sum + (b ? 1 : -1), 0);
  const p = erfc(Math.abs(s) / Math.sqrt(n) / Math.SQRT2);
  return { p, pass: p >= ALPHA };
}

/** Runs: do bits switch between 0 and 1 about as often as chance predicts? */
export function runs(bits: readonly number[]): TestResult {
  const n = bits.length;
  if (n < 2) return { p: 0, pass: false };
  const pi = bits.reduce((sum, b) => sum + b, 0) / n;
  // Prerequisite: the frequency must be close enough to 1/2 for the test to apply.
  if (Math.abs(pi - 0.5) >= 2 / Math.sqrt(n)) return { p: 0, pass: false };
  let v = 1;
  for (let i = 1; i < n; i++) if (bits[i] !== bits[i - 1]) v++;
  const q = pi * (1 - pi);
  const p = erfc(Math.abs(v - 2 * n * q) / (2 * Math.sqrt(2 * n) * q));
  return { p, pass: p >= ALPHA };
}
