import { $ } from "./dom";

/** The luminous entropy ring: its arc shows how much wax is out; the readout shows credited bits. */
export class EntropyRing {
  private readonly arc = $("[data-ring-arc]") as unknown as SVGCircleElement;
  private readonly bits = $("[data-bits]");
  private readonly circumference: number;

  constructor() {
    const r = Number(this.arc.getAttribute("r"));
    this.circumference = 2 * Math.PI * r;
    this.arc.style.strokeDasharray = `${this.circumference}`;
    this.set(0, 0);
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
  private readonly screen = $("[data-screen=stir]");
  private readonly passkey = $("[data-action=passkey]");

  /** Ring clear: Sign in fades in and takes focus. Until then it can't be reached. */
  showClear(clear: boolean): void {
    this.screen.classList.toggle("is-clear", clear);
    this.passkey.inert = !clear;
    this.passkey.setAttribute("aria-hidden", String(!clear));
    if (clear) window.setTimeout(() => this.passkey.focus({ preventScroll: true }), 650);
  }

  set(bits: number, progress: number): void {
    this.arc.style.strokeDashoffset = `${this.circumference * (1 - progress)}`;
    this.bits.textContent = String(bits);
  }
}
