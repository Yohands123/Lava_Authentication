// Temperature-driven wax physics. Runs on a fixed timestep; the renderer only
// reads blob positions. Math.random() here is visual only, not security.

import { LAMP, LANDING, STIR } from "./constants";
import { RingField } from "./ring-field";

export interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Temperature, 0 (cold, blue) to 1 (hot, magenta). */
  t: number;
  /** Per-blob offset for the wander motion. */
  phase: number;
  splitCooldown: number;
  /** Fizzling droplets shrink away and are removed. */
  fizzle: { life: number; total: number; r0: number } | null;
}

export type Formation =
  | { kind: "ring"; cx: number; cy: number; radius: number }
  | { kind: "point"; cx: number; cy: number; spread: number }
  | null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a); // visual only, not security

export class LampPhysics {
  blobs: Blob[] = [];
  width = 1;
  height = 1;
  /** 1 = heater on, 0 = frozen. */
  heatScale = 1;
  /** Global speed multiplier (reduced motion). */
  speed = 1;
  formation: Formation = null;
  /** Clear the ring: active while signing in (see ring-field.ts). */
  ring: RingField | null = null;
  private time = 0;

  constructor(private targetCount: number) {}

  resize(width: number, height: number): void {
    const first = this.blobs.length === 0;
    const sx = width / this.width;
    const sy = height / this.height;
    this.width = width;
    this.height = height;
    if (first) {
      this.seed();
    } else {
      for (const b of this.blobs) {
        b.x *= sx;
        b.y *= sy;
      }
    }
  }

  private seed(): void {
    this.blobs = [];
    for (let i = 0; i < this.targetCount; i++) {
      const y = rand(0.05, 0.95) * this.height;
      this.blobs.push(this.makeBlob(rand(0.1, 0.9) * this.width, y, rand(LAMP.RADIUS_MIN, LAMP.RADIUS_MAX), y < this.height / 2 ? rand(0.55, 0.95) : rand(0.1, 0.45)));
    }
  }

  private makeBlob(x: number, y: number, r: number, t: number): Blob {
    return { x, y, vx: 0, vy: 0, r, t, phase: rand(0, 100), splitCooldown: 0, fizzle: null };
  }

  step(rawDt: number): void {
    const dt = rawDt * this.speed;
    this.time += dt;
    const { width: w, height: h } = this;
    const frozen = 1 - this.heatScale;
    const drag = LAMP.DRAG * (1 + frozen * 6);

    this.blobs.forEach((b, i) => {
      // Temperature
      if (b.y < h * LAMP.HEATER_BAND) b.t += LAMP.HEAT_RATE * this.heatScale * dt;
      if (b.y > h * (1 - LAMP.COOL_BAND)) b.t -= LAMP.COOL_RATE * dt;
      b.t -= frozen * 0.25 * dt; // freezing pulls everything cold
      b.t = clamp01(b.t);

      // Forces
      // Wax held in the ring doesn't rise or wander: only stirring moves it.
      const held = this.ring?.isHeld(b) ?? false;
      const free = held ? 0 : 1;
      let ax = Math.sin(this.time * 0.13 + b.phase) * LAMP.WANDER * free;
      let ay = ((b.t - 0.5) * LAMP.BUOYANCY * this.heatScale + Math.cos(this.time * 0.11 + b.phase * 1.7) * LAMP.WANDER * 0.5) * free;

      let damping = held ? drag * STIR.RING_HOLD_DRAG : drag;
      if (this.formation) {
        const target = this.formationTarget(i);
        ax += (target.x - b.x) * LAMP.FORMATION_SPRING;
        ay += (target.y - b.y) * LAMP.FORMATION_SPRING;
        damping = LAMP.FORMATION_DAMPING;
      }

      b.vx += ax * dt;
      b.vy += ay * dt;
      const k = Math.exp(-damping * dt);
      b.vx *= k;
      b.vy *= k;

      // Speed caps: fast motion (stirring, bursts) decays back toward drift speed.
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > LAMP.MAX_SPEED) {
        b.vx *= LAMP.MAX_SPEED / speed;
        b.vy *= LAMP.MAX_SPEED / speed;
      } else if (!this.formation && speed > LAMP.MAX_DRIFT_SPEED) {
        const settle = Math.exp(-1.2 * dt);
        b.vx *= settle;
        b.vy *= settle;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      this.ring?.constrain(b, dt);

      // Soft walls
      const m = b.r * 0.3;
      if (b.x < m) { b.x = m; b.vx = Math.abs(b.vx) * 0.3; }
      if (b.x > w - m) { b.x = w - m; b.vx = -Math.abs(b.vx) * 0.3; }
      if (b.y < m) { b.y = m; b.vy = Math.abs(b.vy) * 0.3; }
      if (b.y > h - m) { b.y = h - m; b.vy = -Math.abs(b.vy) * 0.3; }

      b.splitCooldown = Math.max(0, b.splitCooldown - dt);
      if (b.fizzle) {
        b.fizzle.life -= dt;
        b.r = b.fizzle.r0 * clamp01(b.fizzle.life / b.fizzle.total);
      }
    });

    this.blobs = this.blobs.filter((b) => !b.fizzle || b.fizzle.life > 0);
    this.recombine();
    this.ring?.update(this.blobs, dt);
  }

  /** Sign-in: gather the wax into the ring; the user then stirs it out. */
  beginRing(cx: number, cy: number, radius: number): void {
    this.ring = new RingField();
    this.ring.setGeometry(cx, cy, radius);
    this.formation = { kind: "point", cx, cy, spread: radius * 0.4 };
  }

  endRing(): void {
    if (this.formation?.kind === "point" && this.ring?.phase === "gather") this.formation = null;
    this.ring = null;
  }

  private formationTarget(i: number): { x: number; y: number } {
    const f = this.formation!;
    const n = Math.max(1, this.blobs.length);
    const angle = (i / n) * Math.PI * 2 + this.time * 0.08;
    if (f.kind === "ring") {
      return { x: f.cx + Math.cos(angle) * f.radius, y: f.cy + Math.sin(angle) * f.radius };
    }
    return { x: f.cx + Math.cos(angle) * f.spread, y: f.cy + Math.sin(angle) * f.spread };
  }

  /** Merge one overlapping pair per step when above the resting count. Conserves area. */
  private recombine(): void {
    if (this.blobs.length <= this.targetCount) return;
    for (let i = 0; i < this.blobs.length; i++) {
      for (let j = i + 1; j < this.blobs.length; j++) {
        const a = this.blobs[i]!;
        const b = this.blobs[j]!;
        if (a.fizzle || b.fizzle) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.45) {
          const wa = a.r * a.r;
          const wb = b.r * b.r;
          const total = wa + wb;
          a.x = (a.x * wa + b.x * wb) / total;
          a.y = (a.y * wa + b.y * wb) / total;
          a.vx = (a.vx * wa + b.vx * wb) / total;
          a.vy = (a.vy * wa + b.vy * wb) / total;
          a.t = (a.t * wa + b.t * wb) / total;
          a.r = Math.min(Math.sqrt(total), LAMP.RADIUS_MAX * 1.4);
          this.blobs.splice(j, 1);
          return;
        }
      }
    }
  }

  /** Landing screen: the cursor is a gentle heat source. */
  heatAt(x: number, y: number, dt: number): void {
    const R = LANDING.HEAT_RADIUS;
    for (const b of this.blobs) {
      const dx = x - b.x;
      const dy = y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > R * 3) continue;
      const fall = 1 / (1 + (d / R) ** 2);
      b.t = clamp01(b.t + LANDING.HEAT_GAIN * fall * dt * this.speed);
      if (d > 1e-4) {
        b.vx += (dx / d) * LANDING.ATTRACT * fall * dt;
        b.vy += (dy / d) * LANDING.ATTRACT * fall * dt;
      }
    }
  }

  /** Stir the Lamp: repel, drag along, swirl, heat, and split on fast strokes. */
  stir(x: number, y: number, pvx: number, pvy: number, dt: number): void {
    const R = STIR.RADIUS;
    const speed = Math.hypot(pvx, pvy);
    const born: Blob[] = [];
    for (const b of this.blobs) {
      const dx = b.x - x;
      const dy = b.y - y;
      const d = Math.max(Math.hypot(dx, dy), 1e-4);
      if (d > R * 3) continue;
      const fall = 1 / (1 + (d / R) ** 2);
      const nx = dx / d;
      const ny = dy / d;
      const curl = Math.sign(nx * pvy - ny * pvx) || 1;

      b.vx += (nx * STIR.REPEL * (0.3 + speed) + pvx * STIR.DRAG_ALONG + -ny * curl * speed * STIR.SWIRL) * fall * dt;
      b.vy += (ny * STIR.REPEL * (0.3 + speed) + pvy * STIR.DRAG_ALONG + nx * curl * speed * STIR.SWIRL) * fall * dt;
      b.t = clamp01(b.t + STIR.HEAT_GAIN * fall * dt);

      // Clear the ring: stirred wax inside is flung outward from the ring's centre,
      // so circling the pointer works, not only strokes that start in the middle.
      const ring = this.ring;
      if (ring?.isHeld(b)) {
        const rx = b.x - ring.cx;
        const ry = b.y - ring.cy;
        const rd = Math.max(Math.hypot(rx, ry), 1e-4);
        const fling = STIR.RING_FLING * (0.3 + speed) * fall * dt;
        b.vx += (rx / rd) * fling;
        b.vy += (ry / rd) * fling;
      }

      const canSplit =
        speed > STIR.SPLIT_SPEED &&
        d < b.r + R * 0.35 &&
        b.r > LAMP.RADIUS_MIN * 1.5 &&
        b.splitCooldown === 0 &&
        !b.fizzle &&
        this.blobs.length + born.length < LAMP.MAX_BLOBS;
      if (canSplit) {
        const r = b.r / Math.SQRT2;
        const px = -pvy / speed;
        const py = pvx / speed;
        b.r = r;
        b.splitCooldown = STIR.SPLIT_COOLDOWN;
        const child = this.makeBlob(b.x - px * r * 0.8, b.y - py * r * 0.8, r, b.t);
        child.vx = b.vx - px * 0.3;
        child.vy = b.vy - py * 0.3;
        child.splitCooldown = STIR.SPLIT_COOLDOWN;
        b.x += px * r * 0.8;
        b.y += py * r * 0.8;
        b.vx += px * 0.3;
        b.vy += py * 0.3;
        born.push(child);
      }
    }
    this.blobs.push(...born);
  }

  /** Passkey created: the portal bursts and the wax rises. */
  burst(): void {
    this.formation = null;
    const cx = this.width / 2;
    const cy = this.height / 2;
    for (const b of this.blobs) {
      const dx = b.x - cx;
      const dy = b.y - cy;
      const d = Math.max(Math.hypot(dx, dy), 1e-4);
      b.vx += (dx / d) * 0.5;
      b.vy += (dy / d) * 0.5 + 0.3;
      b.t = 1;
    }
  }

  /** A droplet falls in from the top. Fizzling droplets shrink away instead of merging. */
  drop(fizzle: boolean): void {
    if (this.blobs.length >= LAMP.MAX_BLOBS) return;
    const r = LAMP.RADIUS_MIN * 0.9;
    const b = this.makeBlob(this.width / 2 + rand(-0.05, 0.05), this.height - r, r, 0.95);
    b.vy = -0.45;
    if (fizzle) b.fizzle = { life: 1.4, total: 1.4, r0: r };
    this.blobs.push(b);
  }
}
