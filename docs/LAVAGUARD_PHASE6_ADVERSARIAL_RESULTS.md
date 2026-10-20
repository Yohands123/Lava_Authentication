# Phase 6 adversarial browser and API results

Local engineering run, October 19, 2026. [Threat model and frozen design](LAVAGUARD_PHASE6_THREAT_MODEL.md); [all run evidence](../ml/artifacts/phase6-adversarial.json). This is declared-automation testing, not human or AI identity detection.

## Actual denominators

| Run | Initiated cases | Harness completed | Visual ring completed | Incomplete visual observations | API-only cases |
| --- | --- | --- | --- | --- | --- |
| Initial seed 6101 | 39 | 38 | 19 | 11, including one failed cancellation trial | 9 |
| Separate cancellation recovery, seed 6101 | 1 | 1 | 0 | 1 | 0 |
| Additional seed 6102 | 4 | 4 | 2 | 2 | 0 |
| Total | 44 | 43 | 21 | 14 | 9 |

Thirty-five browser attempts were initiated; 34 produced strict, explicitly automation-labeled private exports. Twenty-one exports were eligible/completed and 13 incomplete. The failed original constant-speed cancellation trial has no export and no measured session outcome. Its observed unfinished ring earns no detection credit. Nine API experiments do not measure a ring at all. Across all case-level outcomes, 24 recorded clearance/options successes and zero authenticated sessions were observed. Five session observations are unknown: the failed browser trial and four API cases that did not query sessions. Other unmeasured API fields remain null, so recorded-success counts are not exhaustive request totals. Parallel HTTP request counts appear separately in each case and the load report; case counts are not request counts.

The first cancellation attempt exited with a harness error when the visual state changed during Back-button handling. The original row and frozen source manifest remain in the initial run. The recovery waits for a definitive cancellation/completion state and succeeded as an incomplete motion observation. Recovery did not rewrite the original failure or turn it into a detection success.

## What was exercised

The browser matrix includes straight/circular, Bezier, erratic, corrections, lognormal, noisy, stop-go, variable velocity, Ghost Cursor, actual headed/headless Puppeteer and Playwright, DOM-informed reactive/adaptive target pursuit, target switching, seeded replay, scale, cadence16/64, timing jitter and cancellation. Math.random is seeded only in designated local browser pages to control client physics initialization; server crypto remains untouched. Scheduling and WebGL make exact target trajectories nondeterministic. No default physics, renderer or UI value was changed.

There are 18 declared family labels, with corrections/replay/cadence/scale/mask relationships recorded through shared lineage. These labels do not establish independent generator authors or statistically independent families. Different seeds and browser modes do not create independent participants. Run/seed, browser build, capture method, versions, instrumentation control, source hashes and outcomes are recorded. Some original manifests contain asserted startup checks rather than the complete API config response; later manifests additionally retain the observed configuration. The harness always required enforce protocol, shadow ML and experimental enforcement off before starting.

Environment cases hide WebDriver alone, the UA token, all hints or all availability; disagreement and a declared human takeover are also exercised. Every research label remains `automation-declared`, including the deliberately inconsistent takeover declaration. No genuine human is synthesized from that selection. Hints stay separate from vectors and access decisions.

The optional agent seam is the bounded `next(target)` interface in [generators](../scripts/phase6/generators.mjs), backed by deterministic scripted planning. External vision/LLM cases are **NOT_RUN_NO_LOCAL_AUTHORIZED_MODEL**, with zero external calls, costs or invented agent traces.

## API boundary observations

Schema-valid fabricated aggregates with positive automation hints obtained CLEAR and protected options HTTP 200. No visual ring was visited in that API case. Its session request remained HTTP 401 without a credential. This is an explicit detection limitation, not a hidden success claim.

Parallel evaluation had one HTTP 200 and one 409; parallel clearance redemption had exactly one winner among eight requests. A different context could not consume the owner's clearance, and the owner could still redeem it. Missing/invalid vectors, bad nonces, two fresh issues in one context and malformed credential responses were exercised. The separate browser suite corrupts an actual virtual-authenticator signature and verifies HTTP 401 followed by 409 for reuse of the spent challenge.

The response fields in [phase6-outcome.ts](../src/shared/phase6-outcome.ts) distinguish visual completion, issuance, evaluation, verdict, clearance, options, credential presence, session creation, score availability, frozen-threshold diagnostics, protocol violations and harness completion. Unavailable observations remain null. The historical score threshold 0.9 is descriptive and never applied by Phase 6 policy. Incomplete motion and missing passkeys receive zero classifier credit.

## Reproduce

```powershell
npm run phase6:adversarial
npm run phase6:adversarial -- --recovery
npm run phase6:adversarial -- --unseen-seed
npm run phase6:features
```

Each invocation freezes code/assets and uses dedicated localhost port 8806 plus unique ignored state. Raw exports/derived views remain private under `ml/private/phase6/`. Public reports append run history; content-addressed local checkpoints preserve earlier evidence. An unknown requested argument fails before experiments; use only the documented modes. None of these commands fits an application classifier, imports humans, calls a paid model or deploys.
