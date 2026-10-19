import type { AttemptKind, FeatureSummary, GuardChallenge, GuardDecision, GuardMode, GuardState } from "../../shared/lavaguard";
import type { StirController } from "../stir/controller";
import { api, ApiError } from "../auth/api";
import { LavaObserver } from "./observer";
import { VerdictView } from "../ui/verdict";
import { $ } from "../ui/dom";
import { turnstileToken } from "./turnstile";
import { announce } from "../a11y/announce";
import type { ResearchCaptureOptions } from "../../shared/automation-environment";
import { AttemptPermission } from "./permission";

interface GuardConfig { mode: GuardMode; lab: boolean; modelMode?: string; stepUp?: { siteKey: string | null } }
interface Permission { digest: Uint8Array | null; clearance?: string }
export class LavaGuard {
  readonly view = new VerdictView();
  private abort: AbortController | null = null;
  private generation = 0;
  private timer = 0;
  private resolve: ((value: Permission | null) => void) | null = null;
  private readonly permission = new AttemptPermission<Permission>();
  private config: GuardConfig | null = null;
  private stepUp: GuardDecision["stepUp"];
  private verifying = false;
  constructor(private readonly stir: StirController | null, private readonly observer: LavaObserver,
    private readonly fillRing: () => void,
    private readonly inspect: (summary: FeatureSummary | null, decision: GuardDecision, samples: ReturnType<LavaObserver["localSamples"]>) => void,
    private readonly beginResearch: (config: GuardConfig) => ResearchCaptureOptions | undefined = () => undefined,
    private readonly interruptedResearch: (status: "cancelled" | "expired" | "network-error", samples: ReturnType<LavaObserver["localSamples"]>) => void = () => {}) {}
  get state(): GuardState { return this.view.state; }
  cancel(): void {
    this.interruptedResearch("cancelled", this.observer.localSamples());
    this.generation++; this.abort?.abort(); this.abort = null;
    window.clearTimeout(this.timer); this.observer.clear(); this.stir?.cancel();
    this.permission.clear(); this.resolve?.(null); this.resolve = null;
    this.stepUp = undefined; this.verifying = false;
    this.view.set("CANCELLED");
  }
  continue(): void {
    if (this.state !== "CLEAR") return;
    const permission = this.permission.take(this.generation);
    if (!permission) { this.fail("expired"); return; }
    ($("[data-verdict-action]") as HTMLButtonElement).disabled = true;
    window.clearTimeout(this.timer);
    this.resolve?.(permission); this.resolve = null; this.observer.clear();
    this.abort?.abort(); this.abort = null; this.stepUp = undefined;
  }
  private fail(status: "expired" | "network-error", decision?: GuardDecision): void {
    this.interruptedResearch(status, this.observer.localSamples());
    this.generation++; this.abort?.abort(); this.abort = null;
    window.clearTimeout(this.timer); this.permission.clear(); this.stepUp = undefined;
    this.verifying = false; this.observer.clear(); this.stir?.cancel();
    this.resolve?.(null); this.resolve = null;
    this.view.set(decision?.verdict ?? "ERROR", decision);
  }
  private showDecision(decision: GuardDecision, digest: Uint8Array | null, generation: number, fallbackExpiry: number): void {
    this.permission.clear(); this.stepUp = decision.stepUp;
    if (decision.verdict !== "CLEAR" && !(decision.verdict === "FLAG" && decision.stepUp)) {
      this.fail("network-error", decision); return;
    }
    const expiry = decision.expiresAt ?? fallbackExpiry;
    if (decision.verdict === "CLEAR" && (!this.permission.grant(generation, { digest, clearance: decision.clearance }, expiry) || (this.config?.mode !== "off" && !decision.clearance))) {
      this.fail("expired"); return;
    }
    this.view.set(decision.verdict, decision, this.permission.current(generation));
    const pendingUntil = decision.verdict === "CLEAR" ? expiry : decision.stepUp?.expiresAt;
    if (pendingUntil !== undefined) this.timer = window.setTimeout(() => {
      if (generation === this.generation) this.fail("expired");
    }, Math.max(0, pendingUntil - Date.now()));
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
      window.clearTimeout(this.timer);
      this.showDecision(decision, null, generation, step.expiresAt);
    } catch {
      if (generation === this.generation && !signal.aborted) {
        if (step.expiresAt <= Date.now()) { this.fail("expired"); return; }
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
      const research = this.config.lab ? this.beginResearch(this.config) : undefined;
      const challenge = await api<GuardChallenge>("/api/lavaguard/challenge", { kind }, signal);
      if (!current()) return;
      this.timer = window.setTimeout(() => {
        if (!current()) return;
        this.fail("expired");
      }, Math.max(0, challenge.expiresAt - Date.now()));
      let digest: Uint8Array | null = null;
      if (kind === "gesture" && this.stir) {
        this.fillRing(); this.view.set("STIRRING");
        if (this.config.mode !== "off") this.observer.start(research?.cadenceMs, research?.environment.evidence);
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
      this.showDecision(decision, digest, generation, challenge.expiresAt);
      if (kind === "accessible" && this.state === "CLEAR") this.continue();
      else this.observer.clear();
    } catch (error) {
      if (!current()) return;
      this.fail("network-error", error instanceof ApiError && error.status === 429 ? { verdict: "BLOCK", retryAfter: error.retryAfter ?? 60, alternative: false } : undefined);
    }
  }
}
