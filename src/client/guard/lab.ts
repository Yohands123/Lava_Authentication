import type { PointerSample } from "../../shared/features";
import type { FeatureSummary, GuardDecision, GuardMode } from "../../shared/lavaguard";
import type { StudyOutcome } from "../../shared/research";
import { $ } from "../ui/dom";
import { ResearchControls } from "./research-controls";
import type { ResearchCaptureOptions } from "../../shared/automation-environment";

/** Mounted only after a local-only server capability check, within existing Lab. */
export class GuardLab {
  onResearchWithdraw: () => void = () => {};
  private panel: HTMLElement | null = null;
  private controls: ResearchControls | null = null;
  async init(): Promise<void> {
    const config = await fetch("/api/lavaguard/config").then(r => r.json()) as { lab: boolean };
    if (!config.lab) return;
    this.panel = document.createElement("section");
    this.panel.className = "guard-lab";
    this.panel.innerHTML = `<h3>LavaGuard · local developer lab</h3><p>Research evidence only. No validated application-human accuracy.</p><svg viewBox="0 0 300 100" data-guard-plot aria-label="Local pointer path"><path fill="none" stroke="#ff72e4" stroke-width="1.5"/></svg><svg viewBox="0 0 300 60" data-speed-plot aria-label="Local speed profile"><path fill="none" stroke="#9fe7ff"/></svg><svg viewBox="0 0 300 60" data-accel-plot aria-label="Local acceleration profile"><path fill="none" stroke="#ffc876"/></svg><pre data-guard-metrics>Waiting for an attempt.</pre><details><summary>Feature summary</summary><pre data-guard-features></pre></details><details><summary>Historical Phase 4 corpus experiment</summary><pre data-guard-evaluation>Loading local evaluation…</pre></details>`;
    $("[data-lab]").append(this.panel);
    this.controls = new ResearchControls(this.panel);
    this.panel.querySelector("[data-decline-research]")!.addEventListener("click", () => this.clear());
    this.panel.querySelector("[data-research-consent]")!.addEventListener("change", () => {
      if (!this.panel!.querySelector<HTMLInputElement>("[data-research-consent]")!.checked) this.clear();
    });
    void fetch("/api/lavaguard/lab").then(r => r.json()).then((data: { evaluation?: unknown }) => {
      this.panel!.querySelector("[data-guard-evaluation]")!.textContent = JSON.stringify(data.evaluation ?? "Unavailable", null, 2);
    }).catch(() => {});
    this.panel.querySelector("[data-forget-guard]")!.addEventListener("click", async () => {
      this.clear();
      try {
        const response = await fetch("/api/lavaguard/forget", { method: "POST" });
        if (!response.ok) throw new Error("Deletion unavailable");
        this.panel!.querySelector("[data-guard-metrics]")!.textContent = "Local research and server attempt history deleted. Downloaded/derived copies require the withdrawal tool.";
      } catch { this.panel!.querySelector("[data-guard-metrics]")!.textContent = "Local research deleted. Server deletion could not be confirmed; try again."; }
    });
  }
  begin(config: { mode: GuardMode; modelMode?: string }): ResearchCaptureOptions | undefined { return this.controls?.begin(config); }
  interrupted(status: StudyOutcome["status"], samples: readonly PointerSample[]): void { this.controls?.finish(status, samples); }
  live(sample: PointerSample): void { this.controls?.live(sample); }
  clear(): void {
    this.onResearchWithdraw();
    this.controls?.clear();
    if (!this.panel) return;
    for (const path of this.panel.querySelectorAll("path")) path.removeAttribute("d");
    this.panel.querySelector("[data-guard-features]")!.textContent = "";
    this.panel.querySelector("[data-guard-metrics]")!.textContent = "Local research deleted.";
  }
  report(summary: FeatureSummary | null, decision: GuardDecision, samples: readonly PointerSample[]): void {
    if (!this.panel) return;
    this.controls?.finish(decision.assessment === "accessible" ? "accessible" : "completed", samples, decision.verdict);
    const lab = (decision as GuardDecision & { lab?: { modelVersion?: string; risk?: number; reasons?: string[]; elapsedMs?: number; roundTripMs?: number; estimator?: { modelVersion: string; featureVersion: string; riskScore: number | null; calibration: unknown; uncertainty: unknown; reasons: string[] }; experimental?: { version: string; experimentalRisk: number; enabled?: boolean } } }).lab;
    this.panel.querySelector("[data-guard-metrics]")!.textContent = `${decision.verdict} · ${lab?.modelVersion ?? "accessible"}\nRisk evidence ${lab?.risk ?? "n/a"} · uncertainty high\n${lab?.reasons?.join(", ") || "No corroborating behavioral evidence"}\nExperimental model ${lab?.experimental?.experimentalRisk.toFixed(3) ?? "off"} (${lab?.experimental?.enabled ? "local FLAG policy" : "observation only"})\nAttempt ${lab?.elapsedMs ?? 0} ms · evaluation round-trip ${lab?.roundTripMs?.toFixed(1) ?? "n/a"} ms\n${samples.length} local samples`;
    this.panel.querySelector("[data-guard-features]")!.textContent = summary ? JSON.stringify({ behavior: { features: summary.features, robust: summary.robust }, automationEnvironment: this.controls?.consented ? summary.automationEnvironment ?? "Not collected before this attempt" : "Not retained (research not consented or withdrawn)", environmentAuthority: "Advisory only; operator identity unknown; no enforcement contribution", selectedModel: lab?.estimator }, null, 2) : "No gesture analysis (accessible route).";
    this.panel.querySelector("[data-guard-plot] path")!.setAttribute("d", samples.map((s, i) => `${i ? "L" : "M"}${(s.x * 220 + 40).toFixed(1)},${(s.y * 70 + 15).toFixed(1)}`).join(" "));
    const speeds = samples.slice(1).map((s, i) => Math.hypot(s.x - samples[i]!.x, s.y - samples[i]!.y) * 1000 / Math.max(1, s.t - samples[i]!.t));
    const max = Math.max(1, ...speeds);
    this.panel.querySelector("[data-speed-plot] path")!.setAttribute("d", speeds.map((s, i) => `${i ? "L" : "M"}${i / Math.max(1, speeds.length - 1) * 300},${60 - s / max * 55}`).join(" "));
    const acceleration = speeds.slice(1).map((v, i) => (v - speeds[i]!) * 1000 / Math.max(1, samples[i + 2]!.t - samples[i + 1]!.t));
    const maxA = Math.max(1, ...acceleration.map(Math.abs));
    this.panel.querySelector("[data-accel-plot] path")!.setAttribute("d", acceleration.map((a, i) => `${i ? "L" : "M"}${i / Math.max(1, acceleration.length - 1) * 300},${30 - a / maxA * 28}`).join(" "));
  }
}
