# Automation Environment Evidence — Phase 5 extension

Implemented locally October 18, 2026 (artifacts use UTC timestamps). **Advisory evidence only. Application benefit remains unestablished: zero genuine human study participants.** Production guard/ML/Lab/metrics remain disabled. No deployment or remote monitoring was started.

## Scope and data contract

The original observer sent a boolean `signals.webdriver`; the old detector added 0.8 to advisory risk, while enforcement already ignored that hint alone. This extension moves environment interpretation into its own assessment and removes that numeric contribution and mixed behavioral reason. Detector semantics are versioned `lava-heuristic-v4`. The legacy boolean remains readable for compatibility, including ordinary non-research local attempts; it is still advisory.

The optional new evidence uses `lava-automation-environment-v1`, `authority: advisory`, and exactly these fields:

| Signal | Observation | Unavailable |
| --- | --- | --- |
| `webdriver` | Boolean `navigator.webdriver` | Missing, non-boolean or throwing getter → `null` |
| `headlessUserAgent` | Literal HeadlessChrome/HeadlessChromium token in `navigator.userAgent` | Missing, throwing getter, non-string or over 4096 characters → `null` |
| `headlessBrand` | Exact HeadlessChrome/HeadlessChromium brand in the exposed low-entropy `navigator.userAgentData.brands` array | Missing, throwing getter, invalid array/entries or over ten brands → `null` |

Only these three booleans/nulls survive collection. No raw UA, full brand list, versions, platform, plugin inventory, screen probing, permission probing, hardware concurrency, fonts, canvas/WebGL fingerprint, high-entropy Client Hints request, VM detection or remote-desktop inference is added. The controlled test harness records driver-reported browser builds as experiment configuration, not visitor fingerprint fields.

WebDriver standardizes an automation-active flag; it does not identify the operator. Chrome launch conditions can change its exposure. See [W3C WebDriver](https://www.w3.org/TR/webdriver/) and [MDN navigator.webdriver](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/webdriver). The brand check reads only an already exposed low-entropy list; see [Chrome UA Client Hints](https://developer.chrome.com/docs/privacy-security/user-agent-client-hints). Headless exposure varies by configuration; Chromium has [headless UA metadata tests](https://chromium.googlesource.com/chromium/src/+/refs/tags/143.0.7491.0/headless/test/headless_browser_user_agent_metadata_browsertest.cc). The local measurements below, rather than browser-name assumptions, define this run's coverage.

The versioned three-field snapshot is gated by the existing **localhost-only Lab capability and explicit pre-attempt research consent**. It is collected once per attempt, not polled. Default production config supplies no Lab capability and disables behavioral evaluation. A false or absent hint means only false/unavailable; neither means human.

The local Lab, optional export and existing localhost evaluation request can show the snapshot. No new upload endpoint, background service, remote analytics or automatic training was added. Without consent, the new extension is absent. Withdrawal clears the recorder, Lab display and observer's pending environment snapshot; a request already transmitted cannot be unsent. The new evidence is not written to the server's guard-history SQL. Up to 32 consented exports remain in page memory. Downloaded exports, supported derived private records, console history and external backups have their respective existing deletion workflows; withdrawal cannot retract unknown external copies.

## Evidence stays separate

| Channel | Contents | Authority |
| --- | --- | --- |
| Behavior | Existing feature/robust/experimental vectors and behavioral estimators | Existing local research semantics, unchanged by the hints |
| Environment | Separate `automationEnvironment` assessment, availability, positive signals and source | `operatorIdentity: unknown`, `enforcementContribution: 0`, client-claimed/spoofable |
| Protocol | Server-owned nonce, origin/context binding, expiry, one-use redemption and verified replay handling | Existing protocol enforcement |
| Authentication | WebAuthn challenge, RP/origin, signature and mandatory user verification | Required for authenticated sessions |

Hints never enter baseline ML vectors, feature/path signatures, behavioral reasons, a refusal threshold, passkey denial, a permanent BLOCK or an AI-agent identity claim. Their three values are correlated browser disclosures, not three independent corroborations. The new optional field is strictly allowlisted; invalid optional environment evidence is ignored during authentication evaluation so it cannot manufacture a retry. Offline research import instead rejects malformed metadata to preserve data quality.

Actual browser tests preserve the separate accessible passkey route with positive WebDriver and a human-takeover declaration. This test is scripted, uses a virtual authenticator and is **not a human trial**. Credential-free requests can receive clearance/options but cannot obtain an authenticated session. Existing expiry, replay, origin binding, signature/UV and recovery tests continue to run.

## Declared controlled environments

`lava-research-environment-v1` is an optional extension of existing v3 exports/derived records. Its strict fields are `declaredEnvironment`, `declaredControl`, `displayMode` and the versioned evidence. Available declarations include ordinary browser/Chrome, headed/headless Playwright, Puppeteer, Ghost Cursor and human-controlled automation; control can be unknown, human, scripted or mixed. Unknown remains the default for manual exports. Capture tools explicitly select their known configuration. These are declarations, never evidence-derived truth labels. An inconsistent human declaration cannot relabel a bot trajectory or authenticate someone.

Old v3 exports still validate. No old context or consent is reconstructed. New imports preserve the extension and record it in `manifest.researchExtensions`; behavior vectors and labels remain unchanged. The same private export/derived withdrawal process covers the new nested metadata.

## Actual browser observations

See the executable [coverage artifact](../ml/artifacts/automation-environment-coverage.json). Ten selected local configurations were measured. Playwright used Chromium **156.0.8078.4**; Puppeteer used that installed executable and reported its own build string in each case. Ordinary installed Chrome used a fresh isolated profile without WebDriver, CDP, headless or enable-automation flags; its build was not collected. A script launched that window, so it is a configuration baseline, not a consenting human observation.

| Actual configuration | WebDriver | Headless UA | Headless brand |
| --- | --- | --- | --- |
| Ordinary installed Chrome, fresh profile | false | false | false |
| Headed Playwright | true | false | false |
| Headless Playwright | true | true | true |
| Headed Puppeteer | true | false | false |
| Headless Puppeteer | true | true | false |
| Ghost Cursor paths through headed Playwright | true | false | false |
| Headless Playwright, WebDriver getter masked | false | true | true |
| Headless Playwright, UA token overridden at launch | true | false | true |
| Headless Playwright, all three getters forged | false | false | false |
| Headless Playwright, all three unavailable | null | null | null |

Every driver-controlled snapshot stayed unchanged after real pointer commands, including actual Ghost Cursor path generation. Ghost Cursor is not uniquely identifiable from these signals: its row matched ordinary headed Playwright. Masking WebDriver alone did not remove UA hints; overriding the UA alone did not remove the brand hint. Overriding all three made headless automation indistinguishable from the measured ordinary Chrome row. Getter restrictions were safely recorded as unavailable. No hint in this matrix proves a human, malicious intent, a VM, a remote desktop or an AI agent.

Each of the ten actual snapshots was also passed through the same detector with and without the optional context, using one fixed generated behavior control and both existing local model modes. Behavioral outputs, risk and enforcement decisions were unchanged; environment contribution was zero. These are implementation isolation checks, not detection accuracy.

No genuine human takeover, remote-desktop or virtual-browser participant session was available. Human-controlled automation is supported as a declaration and exercised as an adversarial scripted declaration in the authentication regression, but its **actual human trial status is NOT_RUN_NO_CONSENTING_HUMAN_OPERATOR**. Population exposure and human false-positive rates are **unknown (`null`)**. Even a single human operating an automation-enabled browser could share the same flag; the WebDriver flag does not distinguish their hand from a script. The selected launch-condition counts cannot estimate how often genuine users encounter these environments.

## Evaluation and shortcut learning

The actual private dataset remains **30 declared bot attempts, 20 eligible, zero human attempts**. All 30 predate this extension and correctly have missing environment evidence. Its SHA-256 remains `b384bc4f27a9dc321f8b29f0d62ecc827e0fbad497aad2b6699b4cd44c9b0425`. The readiness command reports `NOT_READY_NO_OPT_IN_DATA`; no application model was fit, no final holdout was evaluated and no model was promoted. See [environment readiness](../ml/artifacts/automation-environment-readiness.json).

The development-only comparison fits three diagnostic logistic regressions on identical matched rows and grouped development splits: behavior only, environment only, and behavior plus environment. Context adds three positive bits and three availability bits only inside this isolated comparison; declared browser/control labels do not become predictors. Scaling uses fitting groups only; calibration and threshold selection use separate development calibration groups. The comparison receives only the primary fitting cohort, excluding primary calibration/final cohorts, exports no model and cannot influence the runtime.

Counterfactual evaluation holds behavior and labels fixed while setting all hints positive, false or unavailable. It measures score movement, decision flips, generated/declared human flags and bot misses. Such changes are sensitivity tests, not new independent participants or evidence that forged values are genuine environmental changes.

The executed [synthetic shortcut experiment](../ml/artifacts/automation-environment-shortcuts.json) intentionally correlates generated labels with browser hints across 180 fixture rows. Its development test has 27 generated human-labeled and 12 generated bot-labeled rows:

| Diagnostic model | Decision flips when all hints become positive | Decision flips when all hints become false |
| --- | --- | --- |
| Behavior only | 0 | 0 |
| Environment only | 27 | 12 |
| Behavior plus environment | 24 | 0 |

The behavior baseline already flagged three generated human-labeled fixtures; adding positive hints raised that count to 27 in the combined diagnostic. This constructed example demonstrates false-flag sensitivity and shortcut learning. It is **not genuine-user accuracy, an AI-detection rate, or evidence that adding hints improves the actual detector**. No synthetic row entered the private application dataset. With current genuine application data, the with/without comparison remains unavailable.

Future assessment needs prospectively matched consenting humans and scripted cases in the same environments, including human takeover, ordinary virtual browsers, remote-desktop/assistive input, multiple builds and independent people/runs. Freeze cohort relationships before comparison, retain abandoned attempts without detection credit, report per-environment denominators and uncertainty, and withhold final cohorts. Neither remote-desktop nor virtual-machine status should be inferred from these hints. No recruitment or remote study was started here.

## Reproduction and verification

Run from the repository root:

```powershell
npm run check
npm run test:ml
npm run test:research
npm run test:environment
node scripts/python-local.mjs ml/check_automation_environment.py
npm run ml:phase5 -- --experiments --out ml/private/automation-environment-report.json
node scripts/summarize-environment.mjs
npm run test:e2e
npm run test:enforce
$env:LAVAGUARD_RESEARCH='1'
npm run test:enforce
Remove-Item Env:LAVAGUARD_RESEARCH
npm run test:hardening
npm run build
node scripts/check-publish.mjs
```

The observability probe opens isolated local browser windows, runs its own ephemeral loopback page and closes only its own processes. On another OS or without installed Windows Chrome, that baseline is explicitly skipped; the raw case status records this. `npm run test:e2e` uses an isolated local Worker and resets its dedicated `.wrangler/e2e` test state. No command here deploys or enables production ML.

Verification results for this extension: TypeScript/ESLint clean; **118 TypeScript unit tests, 42 Python tests, 16 console tests, 30 distinct shadow/browser cases, 8 normal enforcement, 8 isolated research enforcement and 8 hardening cases passed**. The original 29-case browser run was followed by the four updated research cases, including the new withdrawal case. Additionally, **23 isolated importer assertions** and **10 real browser configuration probes** passed. Existing screenshots/physics were preserved; the visual suite exercises CLEAR/FLAG/BLOCK inside the original circle. See [source collector](../src/shared/automation-environment.ts), [detector](../src/worker/guard/LavaDetector.ts), [Python diagnostics](../ml/automation_environment.py), [browser probe](../scripts/environment-probe.mjs) and [authentication regressions](../tests/enforce/environment.spec.ts).
