import { extractFeatures } from "../../src/shared/features";

/** A fabricated, deliberately non-regular path: wobble plus timing jitter.
 * Never a human sample. Tests use it to document that a forger who avoids
 * the hard automation rules can still submit plausible aggregates. */
export function forgedPlausibleFeatures() {
  let t = 0;
  return extractFeatures(Array.from({ length: 40 }, (_, i) => {
    t += 28 + (i * 7) % 11;
    return { x: .1 + .7 * i / 39 + .03 * Math.sin(i * .9), y: .5 + .08 * Math.sin(i * .45), t };
  }));
}
