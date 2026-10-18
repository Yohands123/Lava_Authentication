/** Local-only synthetic trajectories v1. Seeds are explicit; no human labels. */
export function random(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const families = ['linear', 'circle', 'random', 'bezier', 'variable-speed', 'corrections', 'lognormal'];
export function generate(family, seed = 42, n = 240) {
  const rng = random(seed), points = []; let t = 250;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), a = u * Math.PI * 6;
    t += family === 'linear' || family === 'circle' ? 32 : 32 + Math.floor(rng() * 36);
    let x, y;
    if (family === 'linear') { x = .1 + .8 * u; y = .5; }
    else if (family === 'circle') { x = .5 + .35 * Math.cos(a); y = .5 + .35 * Math.sin(a); }
    else if (family === 'random') { x = rng(); y = rng(); }
    else if (family === 'bezier') { x = .1 + .8 * u; y = .1 * (1 - u) ** 3 + 2.4 * (1 - u) ** 2 * u + .3 * (1 - u) * u ** 2 + .8 * u ** 3; }
    else if (family === 'variable-speed') { x = .5 + .35 * Math.cos(a * u); y = .5 + .3 * Math.sin(a * u); }
    else if (family === 'corrections') { const r = .1 + .28 * Math.abs(Math.sin(a * .31)) + rng() * .025; x = .5 + r * Math.cos(a); y = .5 + r * Math.sin(a * 1.17); }
    else { const z = Math.log(Math.max(.001, u * 4)); const v = Math.exp(-.5 * (z / .7) ** 2); x = .1 + .8 * u; y = .3 + .4 * v; }
    points.push({ x, y, t, trusted: true, pointer: 'mouse' });
  }
  return points;
}
