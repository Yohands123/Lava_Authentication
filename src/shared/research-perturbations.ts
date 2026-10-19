import type { PointerSample } from "./features";
/** Counterfactual controls, never independent people or new task completions. */
export function researchVariants(input: readonly PointerSample[], seed = 42): Record<string, { samples: PointerSample[]; truncated: boolean }> {
  const source = input.slice(0, 1024).map(s => ({ ...s }));
  const variants: Record<string, { samples: PointerSample[]; truncated: boolean }> = { original: { samples: source, truncated: input.length > 1024 } };
  if (source.length < 2) return variants;
  let state = seed;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (const ms of [16, 32, 64]) {
    const samples: PointerSample[] = []; let cursor = 1;
    const start = source[0]!.t, end = source.at(-1)!.t;
    for (let t = start; t <= end && samples.length < 1024; t += ms) {
      while (cursor < source.length - 1 && source[cursor]!.t < t) cursor++;
      const a = source[cursor - 1]!, b = source[cursor]!, w = (t - a.t) / Math.max(1e-8, b.t - a.t);
      const point = { ...a, x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w, t };
      if (a.targetId === b.targetId && Number.isFinite(a.targetX) && Number.isFinite(b.targetX) && Number.isFinite(a.targetY) && Number.isFinite(b.targetY)) {
        point.targetX = a.targetX! + (b.targetX! - a.targetX!) * w; point.targetY = a.targetY! + (b.targetY! - a.targetY!) * w;
      }
      samples.push(point);
    }
    variants[`cadence${ms}`] = { samples, truncated: start + ms * 1024 <= end };
  }
  variants.scaled2 = { samples: source.map(s => ({ ...s, x: s.x * 2, y: s.y * 2, targetX: s.targetX === undefined ? undefined : s.targetX * 2, targetY: s.targetY === undefined ? undefined : s.targetY * 2 })), truncated: false };
  variants.translated = { samples: source.map(s => ({ ...s, x: s.x + 7, y: s.y - 3, targetX: s.targetX === undefined ? undefined : s.targetX + 7, targetY: s.targetY === undefined ? undefined : s.targetY - 3 })), truncated: false };
  for (const n of [6, 12, 32]) variants[`reduced${n}`] = { samples: Array.from({ length: Math.min(n, source.length) }, (_, i) => ({ ...source[Math.round(i * (source.length - 1) / (Math.min(n, source.length) - 1))]! })), truncated: false };
  variants.clockJitter = { samples: source.map((s, i) => ({ ...s, t: s.t + (i > 0 && i < source.length - 1 ? (random() - .5) * Math.min(4, (s.t - source[i - 1]!.t) * .1, (source[i + 1]!.t - s.t) * .1) : 0) })), truncated: false };
  variants.spatialJitter = { samples: source.map(s => ({ ...s, x: s.x + (random() - .5) * .002, y: s.y + (random() - .5) * .002 })), truncated: false };
  const start = source[0]!.t, duration = source.at(-1)!.t - start;
  variants.variableSpeed = { samples: source.map(s => ({ ...s, t: start + duration * ((s.t - start) / Math.max(1, duration)) ** 1.3 })), truncated: false };
  return variants;
}
