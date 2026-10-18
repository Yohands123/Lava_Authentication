// Wires pointer input to the wax, the entropy meter and the ring.
// Clear the ring: the wax only moves while the meter accepts the motion as
// human-like (curved, irregular timing), so a straight scripted drag can't
// clear it. Signing in requires clearing the ring by hand (user's decision,
// 2026-10-11; see CLAUDE.md section 2.3).

import type { LampPhysics } from "../lamp/physics";
import type { LampRenderer } from "../lamp/renderer";
import { STIR } from "../lamp/constants";
import { StirMeter, type RejectReason } from "./health";
import { EntropyPool } from "./pool";

export interface StirCallbacks {
  /** bits: conservative credited estimate; progress: share of wax out of the ring, 0..1. */
  onProgress(bits: number, progress: number): void;
  onTooRegular(): void;
}

export interface StirResult {
  /** 32-byte digest of the stirring, or null if nothing was captured. */
  digest: Uint8Array | null;
}

export class StirController {
  private meter = new StirMeter();
  private pool = new EntropyPool();
  private active = false;
  private last: { x: number; y: number; t: number } | null = null;
  private velocity = { x: 0, y: 0 };
  private pointerWorld: { x: number; y: number } | null = null;
  /** performance.now() of the last sample the meter accepted as human-like. */
  private lastHuman = -Infinity;
  private resolve: ((r: StirResult) => void) | null = null;
  private generation = 0;

  constructor(
    private readonly renderer: LampRenderer,
    private readonly physics: LampPhysics,
    private readonly callbacks: StirCallbacks,
  ) {}

  run(): Promise<StirResult> {
    this.cancel();
    this.meter = new StirMeter();
    this.pool.reset();
    this.active = true;
    this.last = null;
    this.lastHuman = -Infinity;
    document.body.classList.add("is-stirring");
    window.addEventListener("pointermove", this.onMove, { passive: true });
    this.callbacks.onProgress(0, 0);
    return new Promise((resolve) => (this.resolve = resolve));
  }

  cancel(): void {
    this.finish(null);
  }

  /** Called every physics step by the main loop. */
  update(dt: number): void {
    if (!this.active) return;
    const ring = this.physics.ring;
    const human = performance.now() - this.lastHuman < STIR.HUMAN_GRACE_MS;
    if (this.pointerWorld && human && ring?.phase === "clear") {
      this.physics.stir(this.pointerWorld.x, this.pointerWorld.y, this.velocity.x, this.velocity.y, dt);
    }
    this.velocity.x *= Math.exp(-8 * dt);
    this.velocity.y *= Math.exp(-8 * dt);
    this.report();
    if (ring?.isClear(this.physics.blobs)) void this.complete();
  }

  private onMove = (e: PointerEvent) => {
    if (!this.active) return;
    const samples = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    for (const s of samples.length ? samples : [e]) this.sample(s, e.isTrusted);
  };

  private sample(e: PointerEvent, trusted: boolean): void {
    const t = e.timeStamp;
    const world = this.renderer.toWorld(e.clientX, e.clientY);
    if (this.last) {
      const dtMs = t - this.last.t;
      const dx = e.clientX - this.last.x;
      const dy = e.clientY - this.last.y;
      const result: 1 | RejectReason = this.meter.accept(
        { dx, dy, dt: dtMs, pressure: e.pressure, tiltX: e.tiltX, tiltY: e.tiltY, trusted },
        performance.now(),
      );
      // Human-like motion moves the wax; hitting the per-second credit cap is still human.
      if (result === 1 || result === "rate-cap") this.lastHuman = performance.now();
      if (trusted && !(dx === 0 && dy === 0)) {
        this.pool.add([dx, dy, dtMs, e.pressure, e.tiltX, e.tiltY]);
      }
      if (result === "too-regular" && this.meter.regularStreak === 24) this.callbacks.onTooRegular();
      if (dtMs > 0 && this.pointerWorld) {
        const s = 1000 / Math.max(dtMs, 4);
        const k = 0.35;
        this.velocity.x += ((world.x - this.pointerWorld.x) * s - this.velocity.x) * k;
        this.velocity.y += ((world.y - this.pointerWorld.y) * s - this.velocity.y) * k;
      }
    }
    this.last = { x: e.clientX, y: e.clientY, t };
    this.pointerWorld = world;
  }

  private report(): void {
    const progress = this.physics.ring?.progress(this.physics.blobs) ?? 0;
    this.callbacks.onProgress(Math.floor(this.meter.credited), progress);
  }

  private async complete(): Promise<void> {
    if (!this.active) return;
    this.active = false;
    const generation = this.generation;
    const digest = await this.pool.digest();
    if (generation === this.generation) this.finish(digest);
  }

  private finish(digest: Uint8Array | null): void {
    this.generation++;
    this.active = false;
    this.pointerWorld = null;
    document.body.classList.remove("is-stirring");
    window.removeEventListener("pointermove", this.onMove);
    this.pool.reset();
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.({ digest });
  }
}
