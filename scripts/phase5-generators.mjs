import { generate, random } from './attacks.mjs';
export const captureCases = ['linear', 'constant-speed', 'random', 'bezier', 'variable-velocity', 'corrections', 'pauses', 'ghost-cursor', 'puppeteer', 'reactive', 'synthetic-replay', 'dom-synthetic', 'cadence16', 'cadence64', 'scaled'];
export function captureSettings(name, seed) {
  return { family: ['cadence16', 'cadence64', 'scaled'].includes(name) ? 'corrections' : name,
    cadence: name === 'cadence16' ? 16 : name === 'cadence64' ? 64 : 32,
    lineage: `declared-corrections-${seed}` + (name === 'synthetic-replay' || name === 'corrections' || ['cadence16', 'cadence64', 'scaled'].includes(name) ? '' : '-' + name) };
}
export async function generator(name, seed) {
  const rng = random(seed);
  let ghost = [];
  if (name === 'ghost-cursor') {
    const { path } = await import('ghost-cursor');
    const original = Math.random;
    try {
      // Deterministic library generation only. Never used for security randomness.
      Math.random = rng;
      for (let i = 0; i < 6; i++) ghost.push(...path({ x: .15 + i % 2 * .7, y: .2 }, { x: .85 - i % 2 * .7, y: .8 }, { spreadOverride: .2 }));
    } finally { Math.random = original; }
  }
  const bezier = generate('bezier', seed, 180);
  return (index, target) => {
    let x, y;
    const u = index % 180 / 179, a = index * .21;
    if (name === 'linear') { x = .1 + .8*u; y = .5; }
    else if (name === 'constant-speed') { x = .5 + .34*Math.cos(a); y = .5 + .34*Math.sin(a); }
    else if (name === 'random') { x = .05 + .9*rng(); y = .05 + .9*rng(); }
    else if (name === 'bezier') ({ x, y } = bezier[index % bezier.length]);
    else if (name === 'ghost-cursor') ({ x, y } = ghost[index % ghost.length]);
    else if (name === 'reactive' && Number.isFinite(target?.x) && Number.isFinite(target?.y)) {
      // Reads the real local latest target; this is not a promise of human attestation.
      const dx = target.x - .5, dy = target.y - .5, d = Math.max(.05, Math.hypot(dx, dy));
      x = target.x + .12*dx/d + (rng()-.5)*.04; y = target.y + .12*dy/d + (rng()-.5)*.04;
    } else {
      const angle = name === 'variable-velocity' ? a + .8*Math.sin(a*.3) : a + rng()*.3;
      const radius = .1 + .44*Math.abs(Math.sin(angle*.31)) + rng()*.03;
      x = .5 + Math.cos(angle)*radius; y = .5 + Math.sin(angle*1.17)*radius;
    }
    if (name === 'scaled') { x = .5 + (x-.5)*1.2 + .03; y = .5 + (y-.5)*1.2 - .02; }
    return { x: Math.max(-.25, Math.min(1.25, x)), y: Math.max(-.25, Math.min(1.25, y)),
      wait: name === 'pauses' && index % 23 === 0 ? 180 : name === 'constant-speed' ? 20 : 8 + Math.floor(rng()*20) };
  };
}
