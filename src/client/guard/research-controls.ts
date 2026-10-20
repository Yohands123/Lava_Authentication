import { ResearchRecorder, type StudySetup } from "./research";
import type { PointerSample } from "../../shared/features";
import { validateResearchExport, type Capture, type Generator, type StudyOutcome } from "../../shared/research";
import type { GuardMode } from "../../shared/lavaguard";
import { collectAutomationEnvironment, type ResearchCaptureOptions, type ResearchEnvironment } from "../../shared/automation-environment";

export class ResearchControls {
  private readonly recorder = new ResearchRecorder();
  constructor(private readonly panel: HTMLElement) {
    const setup = document.createElement("fieldset");
    setup.innerHTML = `<legend>Optional local interaction study</legend>
      <p>Before each attempt, choose whether to participate. Consenting records contain only this ring's normalized pointer positions, relative times, bubble targets, declared device/label, sampling interval, viewport dimensions, capture settings and task outcome. They help study automation and accessibility; they do not verify identity. No camera, account, cookie or passkey data is exported. Nothing is uploaded. Up to 32 attempts remain in this page's memory until withdrawal or closing it. Downloaded copies and derived models require separate withdrawal/deletion.</p>
      <label>Participant study code <input type="text" data-study-participant maxlength="64" autocomplete="off" spellcheck="false"></label>
      <label>Input device (confirm yours) <select data-study-device><option value="unknown">Unknown</option><option value="mouse">Mouse</option><option value="trackpad">Trackpad</option><option value="touch">Touch</option><option value="pen">Pen</option><option value="assisted">Assistive input</option></select></label>
      <label>Research label (declared, never inferred) <select data-study-label><option value="unlabeled">Unlabeled</option><option value="human-self-report">Human participant</option><option value="automation-declared">Declared automation</option></select></label>
      <label>Capture method (declared) <select data-study-acquisition><option value="unknown">Unknown</option><option value="regular-browser">Regular browser</option><option value="playwright">Playwright</option><option value="puppeteer">Puppeteer</option></select></label>
      <label>Declared browser environment <select data-study-environment><option value="unknown">Unknown</option><option value="ordinary-browser">Ordinary browser</option><option value="ordinary-chrome">Ordinary Chrome</option><option value="headed-playwright">Headed Playwright</option><option value="headless-playwright">Headless Playwright</option><option value="puppeteer">Puppeteer</option><option value="ghost-cursor">Ghost Cursor</option><option value="human-controlled-automation">Human-controlled automation browser</option></select></label>
      <label>Who controls this attempt (declared) <select data-study-control><option value="unknown">Unknown</option><option value="human">Human operator</option><option value="scripted">Script</option><option value="mixed">Mixed / takeover</option></select></label>
      <label>Browser display (declared) <select data-study-display><option value="unknown">Unknown</option><option value="headed">Visible / headed</option><option value="headless">Headless</option></select></label>
      <p>Optional local research includes three advisory booleans: WebDriver, a headless UA token and a headless brand token. No raw UA, brand list, VM/remote-desktop probing or device fingerprint is retained. These cannot identify who controls the browser and never authorize refusal.</p>
      <label>Research sampling <select data-study-cadence><option value="32">32 ms (baseline)</option><option value="16">16 ms control</option><option value="64">64 ms control</option></select></label>
      <details><summary>Declared automation provenance</summary><label>Generator family <input type="text" data-generator-family maxlength="80" autocomplete="off"></label><label>Generator revision <input type="text" data-generator-revision maxlength="80" autocomplete="off"></label><label>Seed <input type="text" data-generator-seed maxlength="64" autocomplete="off"></label><label>Independent capture run <input type="text" data-generator-run maxlength="64" autocomplete="off"></label><label>Trajectory lineage (reuse for variants/replays) <input type="text" data-generator-trajectory maxlength="64" autocomplete="off"></label></details>
      <p>Use a random study code, never a name or email. Keep the same code across this participant's attempts/devices. The study session is grouped automatically in memory. Automation requires every provenance field. No movement is needed for the separate accessible passkey route.</p>
      <label><input type="checkbox" data-research-consent> I opt in before the attempt to local research retention and optional export.</label>
      <button type="button" class="button button-quiet" data-decline-research>Decline / withdraw local research</button>
      <button type="button" class="button button-quiet" data-export-research disabled>Export latest local attempt</button>
      <button type="button" class="button button-quiet" data-export-research-all disabled>Export study session</button>
      <button type="button" class="button button-quiet" data-export-study-manifest disabled>Export local session manifest</button>
      <details><summary>Review latest local attempt before exporting</summary><pre data-study-preview>No retained attempt.</pre></details>
      <details><summary>Local attempt history</summary><pre data-study-history>No retained attempts.</pre></details>
      <button type="button" class="button button-quiet" data-forget-guard>Delete research and attempt history</button>
      <p role="status" data-study-quality>No research retained. Participation is optional.</p>`;
    panel.append(setup);
    this.el<HTMLInputElement>("data-research-consent").addEventListener("change", () => {
      this.recorder.clear();
      const code = this.el<HTMLInputElement>("data-study-participant");
      if (this.consent && !code.value) code.value = crypto.randomUUID();
      this.refresh();
    });
    this.el("data-decline-research").addEventListener("click", () => this.clear());
    this.el("data-export-research").addEventListener("click", () => this.download(false));
    this.el("data-export-research-all").addEventListener("click", () => this.download(true));
    this.el("data-export-study-manifest").addEventListener("click", () => {
      if (this.consent && this.recorder.count) this.save(this.recorder.sessionManifest(), "lavaguard-local-session-manifest.json");
    });
  }
  private el<T extends HTMLElement = HTMLElement>(attribute: string): T { return this.panel.querySelector<T>(`[${attribute}]`)!; }
  private get consent(): boolean { return this.el<HTMLInputElement>("data-research-consent").checked; }
  get consented(): boolean { return this.consent; }
  begin(config: { mode: GuardMode; modelMode?: string }): ResearchCaptureOptions | undefined {
    const get = (attribute: string) => this.el<HTMLInputElement>(attribute).value.trim();
    const label = get("data-study-label") as StudySetup["label"];
    const generator: Generator | null = label === "automation-declared" ? { family: get("data-generator-family"), revision: get("data-generator-revision"), seed: get("data-generator-seed"), run: get("data-generator-run"), trajectory: get("data-generator-trajectory") } : null;
    const capture: Capture = { revision: "lava-capture-v3", cadenceMs: Number(get("data-study-cadence")) as 16 | 32 | 64, maxSamples: 1024,
      acquisition: get("data-study-acquisition") as Capture["acquisition"], viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, guardMode: config.mode, modelMode: config.modelMode ?? "unknown" };
    const environment: ResearchEnvironment | undefined = this.consent ? { version: "lava-research-environment-v1", declaredEnvironment: get("data-study-environment") as ResearchEnvironment["declaredEnvironment"], declaredControl: get("data-study-control") as ResearchEnvironment["declaredControl"], displayMode: get("data-study-display") as ResearchEnvironment["displayMode"], evidence: collectAutomationEnvironment(navigator) } : undefined;
    const issues = this.recorder.begin({ consent: this.consent, participant: get("data-study-participant"), label, device: get("data-study-device") as StudySetup["device"], generator, environment }, capture);
    if (issues.length) this.el("data-study-quality").textContent = `Research not started: ${issues.join(", ")}. Sign-in is still available.`;
    return this.recorder.recording && environment ? { cadenceMs: capture.cadenceMs, environment } : undefined;
  }
  finish(status: StudyOutcome["status"], samples: readonly PointerSample[], verdict: StudyOutcome["verdict"] = null): void {
    this.recorder.finish(status, samples, verdict); this.refresh();
  }
  live(sample: PointerSample): void {
    if (!this.recorder.recording) return;
    // Local-only target observation for reproducible reactive research automation.
    this.panel.dataset.studyTarget = JSON.stringify({ x: sample.targetX, y: sample.targetY, id: sample.targetId });
  }
  clear(): void {
    this.recorder.clear(); this.el<HTMLInputElement>("data-research-consent").checked = false;
    this.el<HTMLInputElement>("data-study-participant").value = "";
    delete this.panel.dataset.studyTarget; this.refresh();
  }
  private refresh(): void {
    const latest = this.recorder.latest(), enabled = this.consent && latest !== null;
    this.el<HTMLButtonElement>("data-export-research").disabled = !enabled;
    this.el<HTMLButtonElement>("data-export-research-all").disabled = !enabled;
    this.el<HTMLButtonElement>("data-export-study-manifest").disabled = !enabled;
    this.el("data-study-preview").textContent = latest ? JSON.stringify(latest, null, 2) : "No retained attempt.";
    this.el("data-study-history").textContent = this.recorder.count ? JSON.stringify(this.recorder.sessionManifest(), null, 2) : "No retained attempts.";
    const issues = latest ? validateResearchExport(latest).issues.map(i => i.code) : [];
    this.el("data-study-quality").textContent = latest ? `${this.recorder.count}/32 local attempts; latest ${latest.outcome.status}, ${latest.samples.length} samples. ${issues.join(", ") || "Schema complete; labels remain declarations, not attestation."}` : "No research retained. Participation is optional.";
    if (!this.recorder.recording) delete this.panel.dataset.studyTarget;
  }
  private download(all: boolean): void {
    if (!this.consent || !this.recorder.count) return;
    this.save(all ? this.recorder.batch() : this.recorder.latest(), all ? "lavaguard-study-session.json" : "lavaguard-consenting-research.json");
  }
  private save(value: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(value)], { type: "application/json" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
}
