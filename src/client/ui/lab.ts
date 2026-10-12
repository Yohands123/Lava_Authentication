// Lab mode: the entropy pipeline, live. Every number is real: the Worker's
// /api/health counters plus this browser's own snapshot, camera and stir state.
// Digests shown here are the same 32-byte hashes already sent to the Worker.

import type { CameraSource } from "../entropy/camera";
import type { SnapshotSource } from "../entropy/snapshot";
import type { HealthReport } from "../../worker/entropy/stats";
import { monobit, runs, toBits } from "../entropy/randomness";
import { announce } from "../a11y/announce";
import { $ } from "./dom";

export type LampHealth = "healthy" | "cooling" | "offline" | "paused";
type FlowState = "active" | "idle" | "off" | "frozen";

export interface LabInputs {
  snapshots: SnapshotSource;
  camera: CameraSource;
  lampHealth(): LampHealth;
}

const REFRESH_MS = 500;
const HEALTH_MS = 3000;
/** Digests kept for the randomness tests. Session only, never stored. */
const MAX_DIGESTS = 32;

const hex = (d: Uint8Array) => Array.from(d.subarray(0, 4), (b) => b.toString(16).padStart(2, "0")).join("") + "…";
const percent = (x: number) => `${Math.round(x * 100)}%`;

export class Lab {
  private readonly panel = $("[data-lab]");
  private readonly button = $("[data-action=lab]");
  private open = false;
  private refreshTimer = 0;
  private healthTimer = 0;
  private health: HealthReport | "unreachable" | null = null;
  private stir: { state: "none" | "stirring" | "done" | "skipped"; bits: number } = { state: "none", bits: 0 };
  private last: { stir: Uint8Array | null; lamp: Uint8Array | null; camera: Uint8Array | null } = {
    stir: null, lamp: null, camera: null,
  };
  private session: Uint8Array[] = [];

  constructor(private readonly inputs: LabInputs) {}

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    this.open = !this.open;
    document.body.classList.toggle("lab-open", this.open);
    this.panel.inert = !this.open;
    this.panel.setAttribute("aria-hidden", String(!this.open));
    this.button.setAttribute("aria-pressed", String(this.open));
    this.button.textContent = this.open ? "Close lab" : "Lab mode";
    window.clearInterval(this.refreshTimer);
    window.clearInterval(this.healthTimer);
    if (this.open) {
      this.render();
      void this.fetchHealth();
      this.refreshTimer = window.setInterval(() => this.render(), REFRESH_MS);
      this.healthTimer = window.setInterval(() => void this.fetchHealth(), HEALTH_MS);
    }
    announce(this.open ? "Lab mode open" : "Lab mode closed");
  }

  stirring(bits: number): void {
    this.stir = { state: "stirring", bits };
  }

  stirFinished(skipped: boolean): void {
    this.stir = { state: skipped ? "skipped" : "done", bits: skipped ? 0 : this.stir.bits };
  }

  /** The digests sent with a sign-in or sign-up. */
  sent(digests: { stir: Uint8Array | null; lamp: Uint8Array | null; camera: Uint8Array | null }): void {
    this.last = digests;
    for (const d of [digests.stir, digests.lamp, digests.camera]) if (d) this.session.push(d);
    this.session = this.session.slice(-MAX_DIGESTS);
    void this.fetchHealth();
  }

  private async fetchHealth(): Promise<void> {
    try {
      const res = await fetch("/api/health", { credentials: "same-origin" });
      this.health = res.ok ? ((await res.json()) as HealthReport) : "unreachable";
    } catch {
      this.health = "unreachable";
    }
    if (this.open) this.render();
  }

  private render(): void {
    const { snapshots, camera } = this.inputs;
    const lamp = this.inputs.lampHealth();

    const stirFlow: FlowState = this.stir.state === "stirring" || this.stir.state === "done" ? "active" : this.stir.state === "skipped" ? "off" : "idle";
    const lampFlow: FlowState = lamp === "offline" ? "frozen" : lamp === "paused" ? "off" : snapshots.accepted > 0 ? "active" : "idle";
    const cameraFlow: FlowState = !camera.enabled || camera.covered ? "off" : "active";
    this.flow("stir", stirFlow);
    this.flow("lamp", lampFlow);
    this.flow("camera", cameraFlow);
    this.flow("server", "active"); // cannot be switched off
    this.flow("out", "active");

    this.meter("stir",
      this.stir.state === "none" ? "waiting for a sign-in"
      : this.stir.state === "skipped" ? "skipped, not sent"
      : `${this.stir.bits} bits, conservative estimate`);
    this.meter("lamp",
      lamp === "offline" ? "offline, frozen"
      : `${lamp} · ${snapshots.accepted} ok · ${snapshots.rejected} rejected`);
    this.meter("camera",
      !camera.enabled ? "off"
      : `${camera.covered ? "covered" : "healthy"} · ${camera.accepted} ok · ${camera.rejected} rejected`);
    this.meter("server", "32 bytes per challenge · always on");

    const h = this.health;
    this.meter("challenges",
      h === null ? "…"
      : h === "unreachable" ? "Worker unreachable"
      : `${h.challengesIssued} issued · ${h.challengesRejected.expired} expired · ${h.challengesRejected.reused} reused`);
    this.meter("shares",
      h === null || h === "unreachable" ? "…"
      : `stir ${percent(h.clientDigests.stir)} · lamp ${percent(h.clientDigests.lamp)} · camera ${percent(h.clientDigests.camera)}`);

    const sent = (["stir", "lamp", "camera"] as const)
      .map((k) => `${k} ${this.last[k] ? hex(this.last[k]!) : "none"}`)
      .join(" · ");
    this.meter("digests", this.session.length ? sent : "none sent yet");

    const bits = this.session.flatMap((d) => toBits(d));
    if (bits.length === 0) {
      this.meter("tests", "no digests yet");
    } else {
      const m = monobit(bits);
      const r = runs(bits);
      const verdict = (p: number, pass: boolean) => `p ${p.toFixed(2)} ${pass ? "pass" : "fail"}`;
      this.meter("tests", `monobit ${verdict(m.p, m.pass)} · runs ${verdict(r.p, r.pass)} · ${bits.length} bits`);
    }
  }

  private flow(name: string, state: FlowState): void {
    for (const el of this.panel.querySelectorAll<SVGElement>(`[data-flow="${name}"]`)) el.dataset.state = state;
  }

  private meter(name: string, text: string): void {
    const el = this.panel.querySelector(`[data-meter="${name}"]`);
    if (el && el.textContent !== text) el.textContent = text;
  }
}
