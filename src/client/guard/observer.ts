import { extractFeatures, trajectorySignature, type PointerSample } from "../../shared/features";
import { FEATURE_VERSION, type FeatureSummary } from "../../shared/lavaguard";
import { toBase64Url } from "../auth/api";
import { robustFeatures, ROBUST_VERSION } from "../../shared/robust-features";

/** Ephemeral, ring-scoped and bounded. Never attaches outside an active attempt. */
export class LavaObserver {
  private samples: PointerSample[] = [];
  private started = 0;
  private last = -Infinity;
  private active = false;
  constructor(private readonly ring: Element, private readonly bubbles: (x: number, y: number) => { distance: number; remaining: number; targetX?: number; targetY?: number; targetId?: number }) {}
  start(): void { this.clear(); this.started = performance.now(); this.active = true; window.addEventListener("pointermove", this.move, { passive: true }); }
  stop(): void { this.active = false; window.removeEventListener("pointermove", this.move); }
  clear(): void { this.stop(); this.samples = []; this.last = -Infinity; }
  localSamples(): readonly PointerSample[] { return this.samples; }
  private move = (e: PointerEvent) => {
    if (!this.active || this.samples.length >= 1024) return;
    const now = performance.now();
    if (now - this.last < 32) return;
    const b = this.ring.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    if (x < -0.3 || y < -0.3 || x > 1.3 || y > 1.3) return;
    this.last = now;
    const bubble = this.bubbles(e.clientX, e.clientY);
    this.samples.push({ x, y, t: now - this.started, pointer: e.pointerType === "touch" ? "touch" : e.pointerType === "pen" ? "pen" : "mouse",
      trusted: e.isTrusted, pressure: e.pressure, coalesced: (e.getCoalescedEvents?.().length ?? 0) > 1,
      bubbleDistance: bubble.distance, bubbleCount: bubble.remaining, targetX: bubble.targetX, targetY: bubble.targetY, targetId: bubble.targetId });
  };
  async summary(): Promise<FeatureSummary> {
    this.stop();
    const hash = async (value: string) => toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
    return { version: FEATURE_VERSION, features: extractFeatures(this.samples), fingerprint: await hash(trajectorySignature(this.samples)), geometryHash: await hash(trajectorySignature(this.samples, true)),
      signals: typeof navigator.webdriver === "boolean" ? { webdriver: navigator.webdriver } : {}, robust: { version: ROBUST_VERSION, features: robustFeatures(this.samples) } };
  }
}
