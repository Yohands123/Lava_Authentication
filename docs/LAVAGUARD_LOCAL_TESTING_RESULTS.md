# Local test bench verification ? October 18, 2026

The owner requested a reusable local testing server and visible automation based on the existing research. The running console is **http://localhost:8792**. Start it again with `npm run test:live` or `Start-LavaGuard-Testing.cmd`. [Full usage guide](LAVAGUARD_LOCAL_TESTING.md).

## Delivered

A loopback-only control panel starts/reuses the normal app on 8787 and an isolated older-model research app on 8791. Sixteen patterns include the exact original fast demo and all fifteen Phase 5 browser-generator cases. It supports selected/all-pattern runs, seeded repeats (up to 48 attempts per job), progress, immediate queue cancellation, restartable redacted history, JSON download and actual result screenshots. Runs use real browser events/physics/server decisions, actual Puppeteer where selected, and no virtual authenticator or fabricated verdict.

Production flags, passkey handlers, original circle/result UI and lava physics were not changed by this follow-up. The console adds no trained Phase 5 model, recruitment, raw study export/import, remote target, upload or deployment. The Phase 5 dataset hash remains `b384bc4f27a9dc321f8b29f0d62ecc827e0fbad497aad2b6699b4cd44c9b0425`: 30 declared bot study exports and zero genuine human samples. Test-console history is separate from study evidence.

## What ran and what happened

`npm run check` passes: type checks, ESLint, **110 TypeScript tests**, and **15 Node security/queue/privacy tests**. Console-only command: `npm run test:console`. The new tests are included in the default project check, not left as an optional unchecked script. No new runtime dependency was added.

Actual frontend-to-runner-to-Worker checks passed in desktop Chromium and a 390px mobile layout with zero page errors and no page-width overflow. The report download is redacted; screenshots load through the bounded ID endpoint. History survived restart. Starting a selected run, running the full suite, stopping an active three-repeat job, canceling the remaining two attempts and starting a new run afterwards were verified. Final read-only checks left an operator-started 32-attempt suite running uninterrupted.

The initial corrections bot at seed **812** received **CLEAR/options 200/session 401 in both profiles**. Those misses remain in history; selecting research mode does not guarantee rejection.

The controlled **seed-42 research suite** executed all sixteen patterns with **zero harness errors**: **13 completed attempts received FLAG**, and **3 remained incomplete without a detector verdict**. Options were 403 and sessions 401 for all sixteen. The three incomplete rings receive **no detection credit**. This is one local run of an older experimental model, not an accuracy estimate or a generalization claim. The earlier seed-812 misses show why the distinction matters.

| Pattern | Ring | Actual verdict | Options HTTP | Session HTTP |
| --- | --- | --- | --- | --- |
| original-demo | Completed | FLAG | 403 | 401 |
| linear | Incomplete | No decision | 403 | 401 |
| constant-speed | Incomplete | No decision | 403 | 401 |
| random | Completed | FLAG | 403 | 401 |
| bezier | Completed | FLAG | 403 | 401 |
| variable-velocity | Completed | FLAG | 403 | 401 |
| corrections | Completed | FLAG | 403 | 401 |
| pauses | Completed | FLAG | 403 | 401 |
| ghost-cursor | Completed | FLAG | 403 | 401 |
| puppeteer | Completed | FLAG | 403 | 401 |
| reactive | Completed | FLAG | 403 | 401 |
| synthetic-replay | Completed | FLAG | 403 | 401 |
| dom-synthetic | Incomplete | No decision | 403 | 401 |
| cadence16 | Completed | FLAG | 403 | 401 |
| cadence64 | Completed | FLAG | 403 | 401 |
| scaled | Completed | FLAG | 403 | 401 |

All outcomes came from the actual local Workers; no responses were mocked. Runtime scheduling, browser acquisition, physics and machine load can change outcomes despite a fixed path seed. No genuine-human false-positive or accessibility rate was measured. Neither thirteen flags nor unauthenticated passkey requests validate an application-specific bot detector.

## Failure handling and review

The Host-header test initially used `fetch`, which normalized the header and did not send the intended malicious Host. It was corrected to send a wire-level HTTP override; the server rejected it with 403. The test was not weakened. Chunked and declared-length body-limit tests pass, and the server remains usable after refusal.

A final UI check initially waited for idle controls; meanwhile an operator had started a 32-attempt suite. That check timed out because the controls were correctly disabled. Verification switched to read-only assertions of the active queue and both layouts, rather than stopping the operator's work. This was a harness precondition failure, not a fabricated successful automation result. A separate target-crash record already present in local history is retained with unknown detection outcome; a later run proceeded. It is not included among the sixteen error-free controlled suite cases.

Known constraints: the computer and server process must remain running; this is not remote hosting. Research mode uses the existing older corpus model and may reject people. Automated-browser manual takeovers still report automation. Screenshots/downloads remain local copies; avoid personal account activity in the test window. The tool probes one-use options, so its displayed Continue button cannot reuse that consumed clearance. Use the normal app in an everyday browser for independent manual passkey trials.

## Changed files for this follow-up

| File | Role |
| --- | --- |
| `Start-LavaGuard-Testing.cmd` | One-click Windows launcher |
| `package.json` | Live console command and default inclusion of its security tests |
| `scripts/test-console.mjs` | Startup, persistence, owned-service lifecycle and visible panel browser |
| `scripts/test-console/services.mjs` | Build/start/reuse fixed local Workers, isolated research flags and process cleanup |
| `scripts/test-console/settings.mjs` | Fixed profiles/patterns, job validation, result redaction and honest outcome interpretation |
| `scripts/test-console/controller.mjs` | One-job queue, deterministic repeats, stop, cooldown and bounded history |
| `scripts/test-console/http.mjs` | Loopback-only API/static files, Host/Origin/token checks, bounded bodies and screenshot IDs |
| `scripts/test-console/runner.mjs` | Real visible automation, transient declared bot provenance and separately measured outcomes |
| `scripts/test-console/public/index.html` | Accessible testing controls and evidence table |
| `scripts/test-console/public/app.js` | Live progress, run/stop, history, screenshot and download interaction |
| `scripts/test-console/public/styles.css` | Responsive local panel styling, separate from the approved auth UI |
| `scripts/test-console/console.test.mjs` | Fifteen actual HTTP/queue/input/privacy regression tests |
| `scripts/automated-stir.mjs` | Immediate response-rejection handling so interrupted demos cannot cause unhandled rejections |
| `docs/LAVAGUARD_LOCAL_TESTING.md` | Start/use/shutdown, interpretation, storage and privacy guide |
| `docs/LAVAGUARD_LOCAL_TESTING_RESULTS.md` | This measured verification and change inventory |
| `ml/artifacts/local-testing-verification.json` | Redacted aggregate machine-readable verification, not study training data |
| `README.md`, `PROGRESS.md`, `docs/LAVAGUARD_PHASE5_HANDOFF.md` | Link the new tool while preserving historical Phase 5 evidence |

Browser screenshots and full transient automation history are intentionally ignored under `.cache/test-console/`. [Machine-readable verification](../ml/artifacts/local-testing-verification.json). The final publication scan reviewed 282 publishable files (253 text), checked 188 local links and eight required PNG screenshots, and found no secret-pattern, private-path or broken-local-link issue. No commit, push, PR, deployment or production activation occurred.
