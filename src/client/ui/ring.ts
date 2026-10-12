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

  set(bits: number, progress: number): void {
    this.arc.style.strokeDashoffset = `${this.circumference * (1 - progress)}`;
    this.bits.textContent = String(bits);
  }
}
