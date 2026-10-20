# Progress

Current phase: LavaGuard Phase 6 local engineering, authorized 2026-10-19; empirical human validation and production eligibility remain unavailable.

## Phase 6 local engineering, 2026-10-19

- Preserved existing uncommitted Phase 5 work, private dataset hash, UI/physics, WebAuthn, production router and flags.
- Added browser/API outcome accounting, adversarial/recovery/unseen-seed experiments, response-v4 diagnostics, synthetic nuisance/leakage controls, pinned observation registry, revocation/withdrawal, off-mode fast path and bounded shadow metrics.
- Measured local Node/browser/workerd inference, five load levels with overload/recovery, real-SQL sharding/index prototype; retained cancellation and external slow-stream failures. No sharding cutover or unsupported capacity claim.
- [Comprehensive handoff](docs/LAVAGUARD_PHASE6_HANDOFF.md) and machine-readable readiness distinguish actual checks from human/independent/staging blockers. No commit, push, PR, deployment, paid agent, monitoring or production ML activation.

## Reusable local test bench, 2026-10-18

- Owner requested a persistent local testing server plus visible automation based on the research. `npm run test:live` / `Start-LavaGuard-Testing.cmd` opens http://localhost:8792.
- Normal app on 8787 and isolated older-model research comparison on 8791; 16 patterns, deterministic repeats, stop, redacted history/download and actual screenshots. No Phase 5 model promotion, participant recruitment, raw study import or deployment.
- New loopback control server has fixed targets, Host/Origin/token checks, bounded body/job/history and 15 security/queue/privacy tests included in `npm run check`. Existing 110 unit tests pass.
- Full flow verification is documented in [local testing results](docs/LAVAGUARD_LOCAL_TESTING_RESULTS.md); [usage guide](docs/LAVAGUARD_LOCAL_TESTING.md).

## Phase 5 engineering, 2026-10-18

- Strict v3 consent/provenance, functional bounded local Lab recording, incomplete records, private canonical import, revocation/deletion and disabled inference.
- Frozen connected participant/family/session/run/replay cohorts, robust12 plus experimental response16, LR/RF/histogram boosting and diagnostic anomaly model, isolated calibration/final evaluation, development ablations and family holdout.
- 30 actual declared-automation browser exports: 20 completed, 10 incomplete; zero humans. Three initial harness failures retained; corrected recovery succeeded. No application model fit or final evaluation.
- Verified 110 TypeScript tests, 37 Python tests, 49 browser tests and 17 importer checks; synthetic development smoke and local performance measurements. Full commands/limits are in [Phase 5 results](docs/LAVAGUARD_PHASE5_ML_RESULTS.md).
- Local branch `feature/lavaguard-phase5`; no push/PR/deployment/production collection or ML activation. Approved ring/physics/passkeys unchanged.
- [Architecture](docs/LAVAGUARD_PHASE5_ARCHITECTURE.md), [protocol](docs/LAVAGUARD_PHASE5_DATA_COLLECTION.md), [security](docs/LAVAGUARD_PHASE5_SECURITY.md), [roadmap](docs/LAVAGUARD_PHASE5_ROADMAP.md), [full handoff](docs/LAVAGUARD_PHASE5_HANDOFF.md).

Earlier entries below preserve the historical state at their dates.

## GitHub publication and Phase 5 offline starter, 2026-10-18

- The owner separately authorized README fact-checking, safe screenshots, commit/push to `feature/lavaguard` and a PR into `main`; no deployment, production activation or automatic merge.
- Preserved the existing Phase 4 commit and merged PR #1; this publication follow-up keeps that history.
- Replaced stale human-claim screenshots with fresh actual Worker shadow captures, retained the original screenshots and explicitly mocked CLEAR/FLAG/BLOCK fixtures, and excluded pointer-debug captures from the published tree.
- Installed the subsequently owner-requested Phase 5 starter: six synthetic tests passed; actual readiness is `NOT_READY_NO_OPT_IN_DATA` (zero human codes/bot families). The generated report remains ignored/private. No recruitment, production collection or model promotion occurred.
- Current publication verification and media inventory: [publication results](docs/LAVAGUARD_PUBLISH_RESULTS.md).

## LavaGuard Phase 4 / 4B

- [x] Global/per-context storage and rate bounds, atomic expiring rate counters, request byte/time caps and per-isolate overload admission.
- [x] Optional default-off Turnstile with real Siteverify test-key validation, context/attempt binding, one-use token hashes and in-circle retry/cancellation/failure handling.
- [x] Expiring aggregate metrics with admin-only access, policy/model version separation and disabled production collection.
- [x] Shared robust v2 features, fixed-model timing-drift diagnosis, calibrated candidate comparisons, perturbations, ablations, generator-family holdout and independent browser scoring.
- [x] Private consent importer and three-cohort participant-disjoint application training infrastructure; no real study rows invented or auto-promoted.
- [x] Frozen local load snapshots, cleanup measurement, isolated browser assets and actual ESLint.
- [x] Staging drafts, smoke checklist, rollback and decision-ready security/ML reports.
- [ ] Owner-approved deployment, real-host provider configuration and real participant application validation. Production remains off; model promotion prohibited by current evidence.

Current reports: docs/LAVAGUARD_PHASE4_RESULTS.md and docs/LAVAGUARD_ML_PHASE4_RESULTS.md. Historical milestones below retain previous configurations.

## LavaGuard Phase 2

- [x] Correct WebDriver takeover false-positive policy; normal local model disabled, browser/movement hints advisory; honest CLEAR wording.
- [x] Real Worker enforcement tests in normal and strict research profiles; demonstrate fabricated summaries can request options but cannot authenticate without a passkey.
- [x] Audit historical 12-case evidence; revised fixed-seed harness records real evaluations, token issuance, actual protected-options status and session status.
- [x] Eleven leave-one-generator-family-out experiments; three model baselines; six ablations, calibration checks and matched-cadence control; no model promotion.
- [x] Local raw target-response capture and 18-case synthetic responsiveness benchmark; original renderer/physics/interaction preserved.
- [x] Consent-before-attempt research workflow, device selection, ephemeral study IDs, local export/import/delete and optional participant-disjoint evaluation.
- [ ] Consenting real participant/device measurements; full independent human cross-dataset evaluation (no samples invented).
- [ ] Production promotion: prohibited in this task. No deploy or merge.

Current evidence and limits: docs/LAVAGUARD_PHASE2_RESULTS.md. Earlier milestones below describe historical configurations.

## LavaGuard implementation

- [x] Owner correction: automated preview must not receive human clearance. Local enforcement now FLAGS the real script with no token; browser automation hints and locally opted-in model evidence are evaluated on the server.
- [x] Actual automated cursor tested with the automation hint hidden and a different seed; model evidence still withholds clearance. Shadow observation no longer displays a human verdict.
- [x] Production model activation remains disabled and rejected outside localhost; mouse model does not classify touch/pen samples.

- [x] New branch `feature/lavaguard`; original 46 unit tests passed before changes.
- [x] Supplied original/result/detail images visually inspected; unchanged copies in `design/lavaguard/`.
- [x] Desktop/mobile baseline screenshots, one-state in-ring CLEAR/FLAG/BLOCK UI and screenshot containment tests.
- [x] Bounded observer, shared deterministic feature engine, replay summaries and disclosed privacy behavior.
- [x] Five composable detection/reputation/policy/enforcement modules in the existing ChallengeStore binding; no new DO migration.
- [x] Cryptographic challenge nonce/seed, expiry, bounded attempts, scope/origin/context binding, one-use evaluation/redemption.
- [x] Real login-options enforcement in local shadow mode; independent, unchanged passkey verification.
- [x] Accessible keyboard/no-WebGL route; cancellation, retry, network error and duplicate-submission handling.
- [x] Pinned permitted local dataset ingestion, source hashes/license notes, group-split logistic calibration/forest/anomaly experiments, disabled compact Worker model and parity test.
- [x] Local Playwright/Puppeteer/Ghost Cursor/DOM attack suite; direct API, forgery, replay and concurrency tests.
- [x] Restricted developer Lab extends original Lab with plots, features, runtime/evaluation results, provenance and consent-based local export/delete.
- [x] Architecture/research/datasets/results documents and raw-dataset Git exclusions.
- [ ] Owner visual approval and real mouse/trackpad/touch/assistive participant evaluation.
- [ ] Production rollout/collection/enforcement approval. Production remains off; no deploy or merge.

Historical phases below describe the original application. Current measured results, limitations and commands are in `docs/LAVAGUARD_RESULTS.md`.

The base code already includes a first pass at several phases. Treat each item
below as "built, needs review" until the user has watched it and confirmed.

## Phase status
- [x] 1. Design before code (DESIGN.md written; add reference images to design/)
- [x] 2. Lamp engine: signed off by user 2026-10-11. Real two-pass bloom deferred to Phase 8 (halo only for now).
- [ ] 3. Pointer interaction: user moved on 2026-10-11 with items open (see "Carried over from Phase 3").
- [ ] 4. Entropy pipeline: built and tested 2026-10-11; user moved on before trying the camera toggle.
- [x] 5. Authentication: closed by user 2026-10-11. All 8 E2E flows pass; user verification required. Real-passkey check by user not done.
- [ ] 6. Wire UI to events: every §9 event has a wax response; user moved on 2026-10-11 before watching them.
- [ ] 7. Lab mode and Freeze: Lab mode built; demo script passes as an E2E test (2026-10-11). Needs the user to run it by hand.
- [ ] 8. Polish: not started (glass refraction in shader, sound, real bloom, phone testing).

## Current phase checklist (Phase 7)
- [x] Lab mode: pipeline flow lines with live meters beside each source (ui/lab.ts, ui/lab.css)
- [x] Every Lab number is real: /api/health plus this browser's snapshot, camera and stir counters
- [x] NIST monobit and runs tests on session digests, with the honest "SHA-256 always passes" note
- [x] Freeze: lamp line turns ice, generator line and "Secure generator on" stay ember
- [x] README demo script passes as `tests/e2e/demo.spec.ts` (everything except the final webcam beat)
- [ ] User has run the demo script by hand, including a real lava lamp in front of the webcam

## Carried over from Phase 6
- User has not watched the events: portal, burst, warm glow, fizzle, slow rate-limit dim, ring flicker

## Carried over from Phase 5
- Register and log in with a real passkey locally (user to try at http://localhost:8787)

## Carried over from Phase 4
- User has not tried the camera toggle: permission prompt, covered lens dims the lamp, tracks stop

## Carried over from Phase 3
- Slow strokes should stretch blobs into necks (not built)
- Stirring not yet felt on mouse or touch by the user

## Not built yet
- Real two-pass bloom and glass refraction
- Sound
- challenge-store.test.ts (a unit test of a Durable Object needs `@cloudflare/vitest-pool-workers`, not an approved dependency; consume-once and expiry are covered by E2E for now)
- ESLint config (`npm run lint` currently runs the type check)

## Recent requests (2026-10-11)
- [x] Sign in hidden behind the lamp controls on narrow screens: fixed (screens reserve the controls' measured height)
- [x] Clear the ring (replaces the keep-out-only version): wax gathers into the ring, user must stir it all out (human-like motion only) before Sign in appears. No skip or keyboard path, by owner's decision; CLAUDE.md 2.3 updated. Needs the user to try it.
- [ ] DESIGN.md "Motion" still says "press-and-hold replaces stirring": owner to update (CLAUDE.md says propose, don't edit)
- [ ] Stir hint is hard to read over bright wax while the ring is full (WCAG AA, CLAUDE.md 2.3): needs a dark glass tint behind the stir copy

## Tuned values worth remembering
- Clear the ring (2026-10-11, not yet watched): STIR.RING_CLEARANCE = 0.6, RING_FLING = 1.2, RING_HOLD_DRAG = 1.8, RING_PUSH_RATE = 6, RING_SOFT_EDGE = 0.08. Scripted curvy stirring clears it in about 4 s.
- Base `LAMP` values approved as-is on 2026-10-11: BUOYANCY = 0.06, DRAG = 0.6, MAX_DRIFT_SPEED = 0.08, RADIUS 0.045–0.105, COUNT_DESKTOP = 13, GRAIN = 0.035

## Open questions
- Production domain for RP_ID?
- Worker API responses lack `Permissions-Policy` (CLAUDE.md 7.5); adding it means touching csp.ts.

## Log
- Base code created: lamp engine, Stir the Lamp, glass UI, Worker routes, Durable Objects, 21 unit tests passing.
- 2026-10-11: Repo moved to project root and pushed to GitHub. Fonts documented as bundled via @fontsource.
- 2026-10-11: User watched `npm run lamp` and approved the current lamp look and motion. No values changed.
- 2026-10-11: Phase 2 signed off. Phase 3 started.
- 2026-10-11: Moved to Phase 4 at user's request. Added camera source, snapshot/pool/camera/health tests, real /api/health. 36 unit tests passing.
- 2026-10-11: Moved to Phase 5. Added Playwright E2E suite (7/7). Fixed ChallengeStore sweeping expired challenges after 1 s, which turned 410 into 409.
- 2026-10-11: User approved requiring user verification. Options now "required", verify routes check the UV flag; README updated.
- 2026-10-11: Phase 5 closed, Phase 6 started. Filled wax-response gaps (ring flicker, slow rate-limit dim, fizzles for text-only messages, no burst under reduced motion). Moved wax responses to ui/wax.ts.
- 2026-10-11: Phase 6 closed at user's request, Phase 7 started. Built Lab mode and NIST tests; demo script E2E passes. 41 unit, 9 E2E passing.
- 2026-10-11: Narrow-screen fix. Clear-the-ring sign-in replaces Skip/Hold Space (owner's decision). 46 unit, 9 E2E passing.
- 2026-10-18: Added Phase 5 Automation Environment Evidence: three consented advisory booleans, declared control/display context, strict optional research metadata, isolated shortcut comparisons and measured browser coverage. All hints can disappear; no human-population accuracy is established. Production ML remains off. See [extension results](docs/LAVAGUARD_AUTOMATION_ENVIRONMENT.md).

## LavaGuard Phase 7 — publication baseline, October 19, 2026

Stage 0.5 failure UX is implemented and checked; 274 distinct baseline tests pass plus importer/environment probes. Owner authorizes feature commit/push/PR only; no merge, deployment, production ML, spending or human recruitment. Phase 5/6 historical reports and ignored private datasets are preserved. Review: docs/LAVAGUARD_PHASE7_BASELINE_REVIEW.md.

Phase 5/6 baseline committed and pushed as 3e87aae with PR #3. Phase 7A/7B engineering is on feature/lavaguard-phase7: supervised study gates and local review/history/withdrawal, signed authoritative routing prototype, real local proxy passkeys, transport diagnosis, SQL/index/load benchmarks and staging/hosting drafts. Actual counts, publication and unresolved evidence gates are recorded in docs/LAVAGUARD_PHASE7_HANDOFF.md. Genuine participants remain zero; production flags remain off.
