import type { AttemptKind, FeatureSummary, GuardChallenge, GuardDecision, GuardMode, GuardState } from "../../shared/lavaguard";
import type { StirController } from "../stir/controller";
import { api, ApiError } from "../auth/api";
import { LavaObserver } from "./observer";
import { VerdictView } from "../ui/verdict";
import { $ } from "../ui/dom";
import { turnstileToken } from "./turnstile";
import { announce } from "../a11y/announce";

interface GuardConfig { mode: GuardMode; lab: boolean; stepUp?: { siteKey: string | null } }
interface Permission { digest: Uint8Array | null; clearance?: string }
export class LavaGuard {
  readonly view = new VerdictView();
  private abort: AbortController | null = null;
  private generation = 0;
  private timer = 0;
  private resolve: ((value: Permission | null) => void) | null = null;
  private permission: Permission | null = null;
  private config: GuardConfig | null = null;
  private stepUp: GuardDecision["stepUp"];
  private verifying = false;
  constructor(private readonly stir: StirController | null, private readonly observer: LavaObserver,
    private readonly fillRing: () => void,
    private readonly inspect: (summary: FeatureSummary | null, decision: GuardDecision, samples: ReturnType<LavaObserver["localSamples"]>) => void,
    private readonly beginResearch: () => void = () => {}) {}
  get state(): GuardState { return this.view.state; }
  cancel(): void {
    this.generation++; this.abort?.abort(); this.abort = null;
    window.clearTimeout(this.timer); this.observer.clear(); this.stir?.cancel();
    this.permission = null; this.resolve?.(null); this.resolve = null;
    this.stepUp = undefined; this.verifying = false;
    this.view.set("CANCELLED");
  }
  continue(): void {
    if (this.state !== "CLEAR" || !this.permission) return;
    const permission = this.permission; this.permission = null;
    ($("[data-verdict-action]") as HTMLButtonElement).disabled = true;
    window.clearTimeout(this.timer);
    this.resolve?.(permission); this.resolve = null; this.observer.clear();
  }
  async verify(): Promise<void> {
    if (!this.stepUp || this.verifying || !this.abort) return;
    const step = this.stepUp, signal = this.abort.signal, generation = this.generation;
    this.verifying = true;
    const button = $("[data-guard-verify]") as HTMLButtonElement;
    const slot = $("[data-guard-widget]");
    button.disabled = true; slot.hidden = false;
    announce("Additional verification is opening. You can restart this attempt if it cannot finish.");
    try {
      if (!this.config?.stepUp?.siteKey || step.expiresAt <= Date.now()) throw new Error("Verification unavailable");
      const verificationSignal = AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, step.expiresAt-Date.now()))]);
      const token = await turnstileToken(slot, this.config.stepUp.siteKey, step.id, verificationSignal);
      const decision = await api<GuardDecision>("/api/lavaguard/verify", { id: step.id, token }, verificationSignal);
      if (generation !== this.generation || signal.aborted) return;
      this.stepUp = undefined;
      this.permission = decision.verdict === "CLEAR" ? { digest: null, clearance: decision.clearance } : null;
      this.view.set(decision.verdict, decision);
      if (decision.expiresAt) this.timer = window.setTimeout(() => { this.permission = null; this.view.set("ERROR"); }, Math.max(0, decision.expiresAt - Date.now()));
    } catch {
      if (generation === this.generation && !signal.aborted) {
        const message = "Verification couldn't finish. Try verification again or restart this attempt.";
        $("[data-verdict-note]").textContent = message; announce(message);
      }
    } finally { if (generation === this.generation) { this.verifying = false; button.disabled = false; slot.hidden = true; if (this.stepUp) button.focus({ preventScroll: true }); } }
  }
  run(kind: AttemptKind = "gesture"): Promise<Permission | null> {
    this.cancel();
    const generation = this.generation;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const promise = new Promise<Permission | null>(resolve => { this.resolve = resolve; });
    this.view.set("PREPARING");
    void this.prepare(kind, generation, signal);
    return promise;
  }
  private async prepare(kind: AttemptKind, generation: number, signal: AbortSignal): Promise<void> {
    const current = () => generation === this.generation && !signal.aborted;
    try {
      this.config = await api<GuardConfig>("/api/lavaguard/config", undefined, signal);
      if (!current()) return;
      $("[data-guard-notice]").textContent = this.config.mode === "off" ? "Pointer paths stay on this device. Sign-in always requires your passkey." : "Local research preview: movement summaries are evaluated by this server. Raw paths stay on this device. You can use a passkey without stirring.";
      const challenge = await api<GuardChallenge>("/api/lavaguard/challenge", { kind }, signal);
      if (!current()) return;
      this.timer = window.setTimeout(() => {
        if (!current()) return;
        this.abort?.abort(); this.observer.clear(); this.stir?.cancel();
        this.view.set("ERROR");
      }, Math.max(0, challenge.expiresAt - Date.now()));
      let digest: Uint8Array | null = null;
      if (kind === "gesture" && this.stir) {
        this.fillRing(); this.view.set("STIRRING");
        this.beginResearch();
        if (this.config.mode !== "off") this.observer.start();
        const result = await this.stir.run();
        if (!current()) return;
        digest = result.digest;
      } else this.view.set("ACCESSIBLE_ALTERNATIVE");
      this.view.set("RING_CLEARED_PENDING_DECISION");
      const summary = kind === "gesture" && this.stir && this.config.mode !== "off" ? await this.observer.summary() : null;
      if (!current()) return;
      // A no-WebGL browser chooses the explicit accessible path before issuance.
      const evaluatingAt = performance.now();
      const decision = await api<GuardDecision>("/api/lavaguard/evaluate", { id: challenge.id, nonce: challenge.nonce, summary }, signal);
      if (!current()) return;
      window.clearTimeout(this.timer);
      if (this.config.lab) {
        const diagnostic = decision as GuardDecision & { lab?: Record<string, unknown> };
        diagnostic.lab = { ...diagnostic.lab, roundTripMs: performance.now() - evaluatingAt };
        this.inspect(summary, decision, this.observer.localSamples());
      }
      this.permission = decision.verdict === "CLEAR" ? { digest, clearance: decision.clearance } : null;
      this.stepUp = decision.stepUp;
      this.view.set(decision.verdict, decision);
      if (decision.verdict === "CLEAR" && decision.expiresAt) this.timer = window.setTimeout(() => {
        if (current()) { this.permission = null; this.view.set("ERROR"); }
      }, Math.max(0, decision.expiresAt - Date.now()));
      if (kind === "accessible" && decision.verdict === "CLEAR") this.continue();
      else this.observer.clear();
    } catch (error) {
      if (!current()) return;
      window.clearTimeout(this.timer); this.observer.clear(); this.stir?.cancel();
      if (error instanceof ApiError && error.status === 429) this.view.set("BLOCK", { verdict: "BLOCK", retryAfter: error.retryAfter ?? 60, alternative: false });
      else this.view.set("ERROR");
    }
  }
}
