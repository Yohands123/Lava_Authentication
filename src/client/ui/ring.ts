import { $ } from "./dom";
import { STIR } from "../lamp/constants";

/** The luminous entropy ring and its mono readout. */
export class EntropyRing {
  private readonly arc = $("[data-ring-arc]") as unknown as SVGCircleElement;
  private readonly bits = $("[data-bits]");
  private readonly circumference: number;

  constructor() {
    const r = Number(this.arc.getAttribute("r"));
    this.circumference = 2 * Math.PI * r;
    this.arc.style.strokeDasharray = `${this.circumference}`;
    this.set(0, 0);
    $("[data-bits-target]").textContent = String(STIR.TARGET_BITS);
  }

  /** Robotic stirring: the ring stalls and flickers (a slow fade under reduced motion). */
  stall(): void {
    const ring = this.arc.ownerSVGElement;
    if (!ring) return;
    ring.classList.remove("is-stalled");
    void ring.getBoundingClientRect(); // restart the animation if it's already running
    ring.classList.add("is-stalled");
    window.clearTimeout(this.stallTimer);
    this.stallTimer = window.setTimeout(() => ring.classList.remove("is-stalled"), 1600);
  }

  private stallTimer = 0;

  set(bits: number, progress: number): void {
    this.arc.style.strokeDashoffset = `${this.circumference * (1 - progress)}`;
    this.bits.textContent = String(bits);
  }
}
