import type { PointerSample } from "../../shared/features";
import type { FeatureSummary, GuardDecision } from "../../shared/lavaguard";
import { $ } from "../ui/dom";
import { bubbleResponse } from "../../shared/bubble-response";

/** Mounted only after a local-only server capability check, within existing Lab. */
export class GuardLab {
  private panel: HTMLElement | null = null;
  private research: PointerSample[] = [];
  private attempt: { participant: string; device: string; label: string; attempt: string } | null = null;
  private exportData: Record<string, unknown> | null = null;
  async init(): Promise<void> {
    const config = await fetch("/api/lavaguard/config").then(r => r.json()) as { lab: boolean };
    if (!config.lab) return;
    this.panel = document.createElement("section");
    this.panel.className = "guard-lab";
    this.panel.innerHTML = `<h3>LavaGuard · local developer lab</h3><p>Experimental summaries. No validated human accuracy or application-specific training yet.</p><svg viewBox="0 0 300 100" data-guard-plot aria-label="Local pointer path"><path fill="none" stroke="#ff72e4" stroke-width="1.5"/></svg><svg viewBox="0 0 300 60" data-speed-plot aria-label="Local speed profile"><path fill="none" stroke="#9fe7ff"/></svg><svg viewBox="0 0 300 60" data-accel-plot aria-label="Local acceleration profile"><path fill="none" stroke="#ffc876"/></svg><pre data-guard-metrics>Waiting for an attempt.</pre><details><summary>Feature summary</summary><pre data-guard-features></pre></details><details><summary>Measured held-out corpus experiment</summary><pre data-guard-evaluation>Loading local evaluation…</pre></details><p>Sources: DELBOT (small research corpus) + local generators. Balabit and SapiMouse human corpora excluded pending license review; BeCAPTCHA restricted. See docs/LAVAGUARD_DATASETS.md.</p><label><input type="checkbox" data-research-consent> I consent to retaining this attempt locally for a research export.</label><button type="button" class="button button-quiet" data-export-research>Export consenting local trace</button><button type="button" class="button button-quiet" data-forget-guard>Delete this attempt history</button>`;
    $("[data-lab]").append(this.panel);
    this.panel.querySelector<HTMLButtonElement>("[data-export-research]")!.disabled = true;
    const setup = document.createElement("fieldset");
    setup.innerHTML = `<legend>Local participant research</legend><p>Opt in before stirring. Coordinates and bubble targets stay in memory until export, deletion or closing this page. No upload or persistent tracking. Use a random study code, never a name.</p><label>Participant study code <input data-study-participant type="text" maxlength="64" autocomplete="off" spellcheck="false"></label><label>Input device <select data-study-device><option value="mouse">Mouse</option><option value="trackpad">Trackpad</option><option value="touch">Touch</option><option value="pen">Pen</option><option value="assisted">Assistive input</option><option value="unknown">Unknown</option></select></label><label>Research label (self report, not verified) <select data-study-label><option value="unlabeled">Unlabeled</option><option value="human-self-report">Human participant</option><option value="automation-declared">Declared automation</option></select></label><p>Reuse your study code for this study's attempts so evaluation can keep every participant on one side of a split. Reset deletes the code on this page.</p>`;
    this.panel.querySelector("[data-research-consent]")!.closest("label")!.before(setup);
    void fetch("/api/lavaguard/lab").then(r => r.json()).then((data: { evaluation?: unknown }) => {
      this.panel!.querySelector("[data-guard-evaluation]")!.textContent = JSON.stringify(data.evaluation ?? "Unavailable", null, 2);
    }).catch(() => {});
    this.panel.querySelector("[data-export-research]")!.addEventListener("click", () => {
      const consent = this.panel!.querySelector<HTMLInputElement>("[data-research-consent]")!;
      if (!consent.checked || !this.research.length || !this.exportData) return;
      const blob = new Blob([JSON.stringify({ ...this.exportData, samples: this.research })], { type: "application/json" });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "lavaguard-consenting-research.json"; a.click(); URL.revokeObjectURL(url);
    });
    this.panel.querySelector("[data-forget-guard]")!.addEventListener("click", async () => {
      this.clear();
      try {
        const response = await fetch("/api/lavaguard/forget", { method: "POST" });
        if (!response.ok) throw new Error("Deletion unavailable");
        this.panel!.querySelector("[data-guard-metrics]")!.textContent = "Local research and server attempt history deleted.";
      } catch { this.panel!.querySelector("[data-guard-metrics]")!.textContent = "Local research deleted. Server deletion couldn't be confirmed; try again."; }
    });
    this.panel.querySelector("[data-research-consent]")!.addEventListener("change", () => {
      this.research = []; this.attempt = null; this.exportData = null;
      this.panel!.querySelector<HTMLButtonElement>("[data-export-research]")!.disabled = true;
      const code = this.panel!.querySelector<HTMLInputElement>("[data-study-participant]")!;
      if (!code.value) code.value = crypto.randomUUID();
    });
  }
  clear(): void {
    this.research = []; this.attempt = null; this.exportData = null;
    if (!this.panel) return;
    this.panel.querySelector<HTMLInputElement>("[data-research-consent]")!.checked = false;
    this.panel.querySelector<HTMLInputElement>("[data-study-participant]")!.value = "";
    this.panel.querySelector<HTMLButtonElement>("[data-export-research]")!.disabled = true;
    for (const path of this.panel.querySelectorAll("path")) path.removeAttribute("d");
    this.panel.querySelector("[data-guard-features]")!.textContent = "";
    this.panel.querySelector("[data-guard-metrics]")!.textContent = "Local research deleted.";
  }
  begin(): void {
    this.research = []; this.exportData = null; this.attempt = null;
    if (this.panel) this.panel.querySelector<HTMLButtonElement>("[data-export-research]")!.disabled = true;
    if (!this.panel?.querySelector<HTMLInputElement>("[data-research-consent]")?.checked) return;
    const participant = this.panel.querySelector<HTMLInputElement>("[data-study-participant]")!.value.trim();
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(participant)) return;
    this.attempt = { participant, device: this.panel.querySelector<HTMLSelectElement>("[data-study-device]")!.value,
      label: this.panel.querySelector<HTMLSelectElement>("[data-study-label]")!.value, attempt: crypto.randomUUID() };
  }
  report(summary: FeatureSummary | null, decision: GuardDecision, samples: readonly PointerSample[]): void {
    if (!this.panel) return;
    const lab = (decision as GuardDecision & { lab?: { modelVersion?: string; risk?: number; reasons?: string[]; elapsedMs?: number; roundTripMs?: number; estimator?: { modelVersion: string; featureVersion: string; riskScore: number | null; calibration: unknown; uncertainty: unknown; reasons: string[] }; experimental?: { version: string; experimentalRisk: number; enabled?: boolean } } }).lab;
    if (this.attempt && this.panel.querySelector<HTMLInputElement>("[data-research-consent]")!.checked) {
      this.research = samples.map(s => ({ ...s }));
      this.exportData = { schema: "lava-consent-v2", consent: true, consentScope: "one-local-attempt-export", source: "lava-consenting-local", ...this.attempt,
        featureVersion: summary?.version, featureNormalization: "ring-diameter", decision: { verdict: decision.verdict, assessment: decision.assessment, modelVersion: lab?.modelVersion, risk: lab?.risk, reasons: lab?.reasons, experimental: lab?.experimental, estimator: lab?.estimator },
        bubbleResponse: bubbleResponse(samples), provenance: { labels: "self-reported", rawUpload: false, persistedInBrowser: false } };
    }
    this.panel.querySelector<HTMLButtonElement>("[data-export-research]")!.disabled = !this.exportData;
    this.panel.querySelector("[data-guard-metrics]")!.textContent = `${decision.verdict} · ${lab?.modelVersion ?? "accessible"}\nRisk evidence ${lab?.risk ?? "n/a"} · uncertainty high\n${lab?.reasons?.join(", ") || "No corroborating behavioral evidence"}\nExperimental model ${lab?.experimental?.experimentalRisk.toFixed(3) ?? "off"} (${lab?.experimental?.enabled ? "local FLAG policy" : "observation only"})\nAttempt ${lab?.elapsedMs ?? 0} ms · evaluation round-trip ${lab?.roundTripMs?.toFixed(1) ?? "n/a"} ms\n${samples.length} local samples`;
    this.panel.querySelector("[data-guard-features]")!.textContent = summary ? JSON.stringify({ features: summary.features, robust: summary.robust, selectedModel: lab?.estimator }, null, 2) : "No gesture analysis (accessible route).";
    this.panel.querySelector("[data-guard-plot] path")!.setAttribute("d", samples.map((s, i) => `${i ? "L" : "M"}${(s.x * 220 + 40).toFixed(1)},${(s.y * 70 + 15).toFixed(1)}`).join(" "));
    const speeds = samples.slice(1).map((s, i) => Math.hypot(s.x - samples[i]!.x, s.y - samples[i]!.y) * 1000 / Math.max(1, s.t - samples[i]!.t));
    const max = Math.max(1, ...speeds);
    this.panel.querySelector("[data-speed-plot] path")!.setAttribute("d", speeds.map((s, i) => `${i ? "L" : "M"}${i / Math.max(1, speeds.length - 1) * 300},${60 - s / max * 55}`).join(" "));
    const acceleration = speeds.slice(1).map((v, i) => (v - speeds[i]!) * 1000 / Math.max(1, samples[i + 2]!.t - samples[i + 1]!.t));
    const maxA = Math.max(1, ...acceleration.map(Math.abs));
    this.panel.querySelector("[data-accel-plot] path")!.setAttribute("d", acceleration.map((a, i) => `${i ? "L" : "M"}${i / Math.max(1, acceleration.length - 1) * 300},${30 - a / maxA * 28}`).join(" "));
  }
}
