# LavaGuard implementation results

## Phase 4 security and ML follow-up

Current hardening, optional disabled Turnstile, real linting, versioned robust feature/inference experiments, bounded metrics, local load measurements and staging drafts are documented in [Phase 4 security results](LAVAGUARD_PHASE4_RESULTS.md) and [Phase 4 ML results](LAVAGUARD_ML_PHASE4_RESULTS.md). Original visual/interaction behavior is preserved. Models remain advisory in normal use, production remains off, and no deployment or promotion occurred. Earlier sections below describe historical configurations and experiments.

## Phase 2 supersedes the local rejection policy below

The owner reported four human retries in the Playwright demo browser and confirmed that browser was used manually. WebDriver stays true during human takeover; treating it as sufficient rejection evidence was a policy mistake. Normal localhost development now keeps browser/movement anomalies advisory and disables model rejection. Protocol enforcement and independent passkey authentication remain active. CLEAR is neutral, not a human assertion. Strict experimental model enforcement remains isolated in tests. See [Phase 2 results](LAVAGUARD_PHASE2_RESULTS.md) and [consenting study workflow](LAVAGUARD_HUMAN_STUDY.md) for current evidence and limitations. The remaining sections record prior configurations and measured historical runs.

## Automated-preview correction (2026-10-17)

The original automated preview passed. That was a real false negative in the user-facing experience: shadow policy allowed it and the UI incorrectly described observation as Human detected. The owner explicitly required that automated local run to fail.

Localhost now enforces gesture evaluation with a locally opted-in experimental mouse model and an optional browser-reported automation hint. The unchanged preview movement receives an actual server FLAG, no clearance, and 403 from protected login-options. The same input with the automation hint hidden, plus a different seeded variant, also receives FLAG from model evidence. `ml/artifacts/automation-regression.json` records these three cases; `preview-verification.json` and [the live refusal screenshot](media/lavaguard/preview-automation.png) record the visible demonstration. No verdict response or account success was mocked. No model was retrained on these regression traces.

Model-only evidence withholds this gesture's clearance; it cannot BLOCK or ban a user. Touch/pen are excluded from the mouse model. This local experiment does not establish consenting-human acceptance, and the experiment remains inappropriate for production promotion. Production remains off with its model disabled; configuration refuses model activation outside localhost. Client hints and summaries can still be forged.

The public result now distinguishes observation from classification: shadow says Interaction recorded, disabled evaluation says Ring cleared, explicit accessible sign-in says Continue with a passkey, and enforced low risk says Likely human. Virtual passkeys remain an independent WebAuthn testing mechanism. The accessible passkey route deliberately has independent abuse controls and no gesture score; it does not claim human detection.

Current checks: 72 unit tests, three real enforcement browser tests, and all 26 shadow passkey/UI browser tests passed, including masked-hint regression, accessible WebAuthn and honest shadow wording. All three direct localhost replay cases received FLAG, no clearance, login-options 403 and unauthenticated session 401. The updated 12-case family harness records six actual evaluated FLAG results, four unfinished rings without a server verdict, and direct/forged API refusals. Historical measurements and original shadow screenshots below are preserved as historical results; they do not describe the current local enforcement default.

Branch: `feature/lavaguard`. No merge, deploy, production collection or punitive model promotion was performed. The reference pack was visually inspected and copied unchanged into `design/lavaguard/` for reproducible review.

## Implemented

- Original WebGL lamp, wax physics, ring footprint, temperature/freeze, camera and entropy pipeline preserved. No lamp shader or physics constants were changed.
- One CLEAR/FLAG/BLOCK result at a time inside the existing circle, procedural fluid rim, matching state colors, authored SVG icon, short copy and rounded action. FLAG retries a fresh challenge without reloading; BLOCK offers Back and observes server restrictions. Reduced motion disables fluid animation.
- Explicit preparation, stirring, pending decision, outcome, error, accessible and cancellation states; aborted requests/generation guards, timers, duplicate-submission guards, screen reader announcements and focus management.
- LavaObserver, deterministic shared feature extraction, LavaDetector, LavaReputation, LavaPolicy and LavaEnforcer. Challenge nonces/seeds, expiry, bounded pending attempts, scope/context/origin binding, atomic evaluation/redemption and protected login-options. Original WebAuthn challenge consumption, cryptographic randomness, origin/RP ID/UV/signature/counter and session-cookie protections remain separate.
- Keyboard/no-WebGL accessible issuance with no gesture analysis; independent rate controls and mandatory passkeys. Short-lived browser history; deletion and authenticated operator review/reversal. No permanent automated bans.
- Pinned dataset ingestion, shared browser/offline extractor, duplicate removal, held-out groups, logistic calibration, Random Forest and human Isolation Forest. Disabled compact Worker logistic inference with Python parity verification.
- Restricted local developer Lab: path/speed/acceleration graphs, feature summaries, model evidence, recurrence hints, actual held-out experiment counts/false positives, dataset provenance and optional consent-based local export.

## Verification

The original 46 unit tests passed before changes. The expanded suite includes real SQLite lifecycle tests, finite/deterministic feature tests, malformed payload rejection, policy proportionality and Python/Worker prediction parity. Browser tests use real local Workers/Durable Objects, real WebGL and virtual passkeys. UI outcome screenshots use explicitly mocked decision responses; they are visual fixtures, not classification evidence. Authentication/security tests use real server decisions.

Final command outputs and counts are recorded at the end of this document after verification.

Changed-file groups: `src/client/guard/` and `src/client/ui/verdict.*` implement observation, orchestration, local Lab and results; `src/shared/` contains types/features; `src/worker/guard/` and `routes/lavaguard.ts` implement policy/storage/inference/API. Existing `main.ts`, passkey API wiring, `ChallengeStore.ts`, login routing and `wrangler.toml` integrate the gate. `ml/`, `scripts/`, unit/browser tests, design references and these documents supply reproducible review artifacts. Node typings and local attack drivers were added; Vitest was updated to remove reported vulnerable test dependencies. No production application framework was added.

## Screenshots and reference differences

| State | Desktop | Mobile |
| --- | --- | --- |
| Original baseline, stirring | [Before desktop](media/lavaguard/before-stir-desktop.png) | [Before mobile](media/lavaguard/before-stir-mobile.png) |
| Current landing (original layout) | [Desktop](media/lavaguard/after-landing-desktop.png) | [Mobile](media/lavaguard/after-landing-mobile.png) |
| Current stirring | [Desktop](media/lavaguard/after-stir-desktop.png) | [Mobile](media/lavaguard/after-stir-mobile.png) |
| Real server shadow decision after scripted input | [Desktop](media/lavaguard/real-clear-desktop.png) | [Mobile](media/lavaguard/real-clear-mobile.png) |
| CLEAR | [Desktop](media/lavaguard/clear-1440.png) | [Mobile](media/lavaguard/clear-390.png) |
| FLAG | [Desktop](media/lavaguard/flag-1440.png) | [Mobile](media/lavaguard/flag-390.png) |
| BLOCK | [Desktop](media/lavaguard/block-1440.png) | [Mobile](media/lavaguard/block-390.png) |

The original application ring is smaller on a wide viewport than the close-cropped approved illustration; its footprint is deliberately preserved. CSS fluid lobes approximate the illustrated molten glass and are less detailed than the reference. The live background uses the original physics, so bubble placement differs every run. FLAG uses neutral copy and an accessible secondary option. BLOCK uses calibrated language and Back, rather than the reference's unrestricted retry. Mobile reduces icon/text sizes to maintain containment and 44px action targets. These are documented differences, not a pixel-perfect claim.

## Measured offline experiment

`ml/artifacts/evaluation.json` contains the complete split, seed, per-family counts, uncertainty and metrics. There are 1,028 training rows, 195 separate calibration rows and 1,290 held-out rows after preprocessing/deduplication. Held-out humans are public research participants, not consenting LavaGuard users. Device/source-folder holdout cannot establish user independence.

At the fixed experimental threshold, calibrated logistic regression accepted 503/513 held-out human rows, flagged 10, detected 694/777 generated rows and missed 83. Random Forest accepted 494/513 human rows, flagged 19, detected 777/777 generated rows and missed zero in this particular corpus. Human-only Isolation Forest marked 74/513 held-out human rows anomalous; this illustrates why anomaly alone cannot imply a bot. Full ROC/PR AUC, Brier values and Wilson acceptance intervals are in the artifact. No comparison selects production thresholds from held-out outcomes. LightGBM was not added because this small corpus does not demonstrate a need for another supervised model.

These are measured **corpus experiment results**, not application accuracy. Source artifacts, task differences, unknown participant identity and absent consenting LavaGuard samples preclude a production performance claim. The artifact defaults to disabled; the later owner-authorized localhost experiment opts into FLAG decisions only. Production use remains disabled.

## Local adversarial findings

`ml/artifacts/adversarial.json` is the historical shadow run. Its browser completion/session observations remain useful, but its manual second-challenge summary evaluations should not be interpreted as browser classification performance: those summaries used generator times rather than the original challenge's browser capture. The revised harness observes only the real browser-issued evaluation for actual server results, keeps offline generator scoring separate, and writes `ml/artifacts/adversarial-current-enforcement.json`. An unfinished ring has no server verdict, rather than an invented refusal. The independent exact-preview regression is in `automation-regression.json`.

Several generated families clear the ring, including random, variable-speed, correction, lognormal proxy and Ghost Cursor paths in the final recorded run. DOM dispatch and a straight path did not clear it. Bézier completion differed between runs, demonstrating the sensitivity to animation/input timing. Shadow mode deliberately returns CLEAR for valid evaluated summaries regardless of experimental model suspicion. Plausible fabricated feature summaries remain possible even in a heuristic enforce configuration; there is no trusted human attestation. This is an explicit residual risk, not an untested claim of full automation resistance.

Every recorded unauthenticated session remained 401. The direct unguarded login-options request returned 403 and forged verdict fields returned 400. An explicit accessible clearance can request passkey options by design; it still cannot create a session without successful WebAuthn verification. Zero authenticated-session bypasses were observed in these local cases; this does not establish universal resistance.

## Runtime measurements

`ml/artifacts/performance.json` compares the identical original renderer/physics with capture disabled and enabled in local headless Chromium. It is not a historical binary comparison or a real mobile hardware test. In the recorded run, desktop median frame time was 50 ms both ways; this software/headless environment did **not** meet the 60 fps desktop target. The 390px viewport median was 16.7 ms both ways. Enabled mobile heap was about 4.0 MB versus 3.8 MB disabled. Network preparation was measured separately. These short runs are noisy and do not establish a statistically significant speedup/slowdown.

The normal CLEAR action replaces the previous Sign in action (zero additional click); it is not an automatic passkey prompt. Real extra sign-in time, false positives by assistive device, phone GPU/battery and participant acceptance require owner-approved consenting field evaluation.

## Running and reviewing

```powershell
npm ci
npx playwright install chromium
npm run dev
# In another terminal:
npm run check
npm run lint
npm run build
npm run test:e2e
npm run test:adversarial
node scripts/performance.mjs
```

Open `http://localhost:8787`. For the offline pipeline follow `LAVAGUARD_DATASETS.md`. For an explicit off-mode smoke start a separate local Worker with `npx wrangler dev --port 8789 --persist-to .wrangler/off-smoke --var ORIGIN:http://localhost:8789 --var LAVAGUARD_MODE:off --var LAVAGUARD_LAB:0`, then run `node scripts/off-mode-smoke.mjs`. This does not contact production.

Production configuration remains `LAVAGUARD_MODE=off`, `LAVAGUARD_LAB=0`. Stronger rollout requires owner approval, privacy notice review, consenting participant/device testing, independent family/user splits and explicit threshold/model promotion. `LAVAGUARD_ADMIN_TOKEN`, if used, must be provisioned as a secret of at least 32 random characters; no secret is in this repository. Operator reversal requires same-origin POST plus Bearer authorization. Review audit events expire after 24 hours; behavioral history expires after 10 minutes, with bounded alarm cleanup and deletion controls.

## Final command results

| Command | Observed result |
| --- | --- |
| Original `npm test` | 9 files, 46 tests passed |
| `npm run check` | Both TypeScript targets passed; 12 files, 66 tests passed |
| `npm run lint` | Passed (the repository's lint script is a typecheck alias, not ESLint) |
| `npm run build` | Vite production bundle built successfully |
| `npm run test:e2e` | 25 tests passed in 3.3 minutes |
| Focused UI/Lab/accessibility rerun after final presentation updates | Eight tests passed in 1.2 minutes |
| Final backend rerun after retention-alarm fix | Eight tests passed in 12.9 seconds |
| `npm run test:adversarial` | 12 local cases recorded, including real Ghost Cursor/Puppeteer |
| `node scripts/performance.mjs` | Four capture-enabled/disabled viewport measurements recorded |
| `node scripts/off-mode-smoke.mjs` | Passed off-mode privacy, restricted Lab and unauthenticated session checks |
| `node scripts/capture-current.mjs` | Current desktop/mobile captures completed, including real shadow decisions; WebGL context and non-black frame checks passed |
| Dataset ingestion + extraction + training | Completed against pinned archive; three measured model baselines, inference artifact disabled |
| `python -m py_compile ml/ingest.py ml/train.py` | Passed |
| `npm audit --json` | Zero reported vulnerabilities after updating test tooling |
| `git diff --check` | Passed; Windows line-ending notices only |

Physical-device/participant trials, real hardware passkey confirmation and owner visual approval remain manual. Restricted/unclear-license corpora and production deployment were deliberately excluded as required. The live hosted demo is unchanged by this branch.
