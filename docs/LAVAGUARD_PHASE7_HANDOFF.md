# LavaGuard Phase 7 handoff

Implemented locally October 19, 2026 from the owner's current Phase 5/6 workspace. Owner scope authorizes commit, push and PR creation; **no merge, deployment, hosting-resource creation, spending, production ML or remote monitoring**. The attachment's broader merge/deployment instructions do not override that scope.

The approved original lava interaction and authentication remain. Failure verdicts have fresh retry/Back controls, CLEAR requires current single-use permission and says Continue with passkey, and the separate pre-attempt accessible entry still reaches mandatory WebAuthn. Existing valid sessions survive a failed independent sign-in. Original screenshots are preserved; six new Phase 7 visual fixtures were captured, inspected and linked from README. See [sign-in UX/security](LAVAGUARD_PHASE7_SIGNIN_FAILURE.md) and [baseline review](LAVAGUARD_PHASE7_BASELINE_REVIEW.md).

## Engineering delivered

- Phase 7A: machine preregistration draft; optional local preview/history/manifest; separate bounded import; supervision, consent chronology, matched-source/capture, shared-device/source/model/seed and pilot/cohort QA; frozen candidate/threshold; development without final rows; exclusive final-access lock; participant uncertainty/unknowns and environment comparisons; partial-cleanup/revocation safety; participant/coordinator templates.
- Phase 7B: explicitly opt-in HMAC/epoch routing and authoritative dispatch over production SQL methods; 1/4/16 spread/hot experiments; copied-row migration, duplicate authority, revocation/restart and fault tests; bounded per-shard metrics; 10k-row index benchmark; five-level real local Worker load; traced slow-stream diagnosis and local bounded-ingress mitigation; real same-origin proxy/WebAuthn browser tests; architecture, hosting, SLO/cost and rollback proposals.
- Publication: Phase 5/6 plus failed-sign-in fix preserved as baseline commit `3e87aae5733702187f2834a28064138ed0ce5283`, pushed with [baseline PR #3](https://github.com/Yohands123/Lava_Authentication/pull/3) into main. Phase 7 uses a separate stacked branch for review. No auto-merge is enabled by this task.

Phase 7 engineering commit `de4f7098fb2286b7219222244741c16e12670d52` is pushed on [feature/lavaguard-phase7](https://github.com/Yohands123/Lava_Authentication/tree/feature/lavaguard-phase7) with [PR #4](https://github.com/Yohands123/Lava_Authentication/pull/4) into the baseline branch. Both PRs are open and unmerged; retarget Phase 7 after the owner merges the baseline. Remote main remains `19aff1bfa592e6d68e6cc312d498a43a66188ad4`. All 14 required/original and new screenshot URLs returned HTTP 200 with PNG content, and the GitHub branch README contains the new image references; no missing screenshots or broken checked links were found. No CI workflow was configured in the inspected repository, so the passing local tests do not represent independent review or a passing GitHub CI run.

## Actual command results

<!-- PHASE7_TESTS_START -->
| Command | Actual result | Counts / scope |
| --- | --- | --- |
| `npm run check` | PASS (13.9 s) | 151 TS + 20 Node |
| `npm run build -- --outDir .cache/phase7/verification-build` | PASS (1.0 s) | isolated build |
| `npm run test:ml` | PASS (25.1 s) | 57 Python |
| `npm run test:research` | PASS (0.8 s) | 23 importer assertions |
| `npm run test:environment` | PASS (7.1 s) | 10 browser configurations |
| `npm run test:e2e` | PASS (260.3 s) | 30 browser |
| `npm run test:enforce` | PASS (25.5 s) | 8 browser |
| `npm run test:enforce [LAVAGUARD_RESEARCH=1]` | PASS (25.1 s) | 8 browser |
| `npm run test:hardening` | PASS (20.7 s) | 8 browser |
| `npm run test:phase6` | PASS (43.5 s) | 13 browser |
| `npm run test:phase7` | PASS (19.7 s) | 5 browser |
| `npm audit --audit-level=low` | PASS (0.7 s) | zero vulnerabilities |

**300 distinct unit/integration/browser tests**; 23 importer assertions and 10 browser configuration probes are additional. Focused replacement runs do not inflate the total.
<!-- PHASE7_TESTS_END -->

The baseline run passed 274 distinct tests before Phase 7A/7B. Final counts refer to the latest full command rows plus focused replacements, not the sum of repeated runs. Importer assertions, browser-environment configurations and benchmark operations are additional and not human participants. Full logs remain ignored; public artifacts contain status/counts/hashes rather than traces or credentials.

## Measurements and limitations

[Scaling results](LAVAGUARD_PHASE7B_SCALING_RESULTS.md) separate accepted throughput/latencies, skipped requests and explicit rate/admission failures. High concurrency still has substantial 503 availability failures. No distributed user-capacity or edge CPU claim is made. SQL prototype credentials are dummy bytes; actual authentication is exercised with virtual WebAuthn separately. The routing directory/global budget, account uniqueness and real migration design remain production blockers.

The slow-body investigation found application 400 returns at roughly three seconds while the development bridge deferred/no delivered response for an open body. The bounded local proxy returned 400 before forwarding that partial request. The old Phase 6 external 500 and new external timeout are retained. This is a local mitigation and transport-boundary diagnosis, **not a fixed cloud runtime or validated deployed ingress**. See [the detailed trace](LAVAGUARD_PHASE7B_TRANSPORT.md).

[Study results](LAVAGUARD_PHASE7A_RESULTS.md) remain zero human participants, null human accuracy/FPR/calibration and no eligible production model. The actual prospective corpus is empty. Synthetic full-flow tests stay in temporary directories; no generated human-labeled fixture enters private application records. Physical touch/pen/assistive/human-takeover and hardware-authenticator trials are NOT TESTED. Browser hints remain spoofable advisory evidence, never proof of AI/operator identity or grounds for refusal alone.

Existing production Worker routes/stores, entropy, cookies, source RP/origin/bindings and disabled flags are verified against the initial file hashes. No real credential/customer migration, human-study collection, remote monitoring or money-spending action occurred. Private raw datasets, candidates, codes, caches, runtime state and local credentials are excluded from publication. Historical Phase 5/6 results remain dated records; this handoff records subsequent publication and testing.

## Required status matrix

<!-- PHASE7_STATUS_START -->
| Item | Status | Evidence / limitation |
| --- | --- | --- |
| Local tests | DONE | 300 distinct passing tests |
| Failed-sign-in UX | DONE | Current permission/retry/Back; mandatory WebAuthn |
| Phase 7 local commit | DONE | de4f7098fb2286b7219222244741c16e12670d52 |
| Phase 7 branch push | DONE | feature/lavaguard-phase7 |
| Phase 7 pull request | DONE | [PR #4](https://github.com/Yohands123/Lava_Authentication/pull/4) into feature/lavaguard-phase5 |
| Merge to main | NOT DONE | Explicitly excluded; baseline PR #3 remains open |
| Vercel project | NOT DONE | Read-only matching lookup returned zero; none created |
| Vercel preview | NOT DONE | No deployment authorized |
| Functional sign-in on Vercel | NOT TESTED | Local same-origin analogue passed; no real preview/hardware trial |
| Cloudflare backend deployment | NOT DONE | Explicitly excluded |
| Production ML-off verification | DONE | Original config/source hashes preserved |
| Phase 7A study/data readiness | BLOCKED | Engineering implemented; genuine human corpus empty, approval/review pending |
| Phase 7B scaling readiness | BLOCKED | Local prototypes/load done; authority/global budgets/ingress/edge remain unresolved |
<!-- PHASE7_STATUS_END -->

## Source inventory

<!-- PHASE7_FILES_START -->
- [PROGRESS.md](../PROGRESS.md)
- [README.md](../README.md)
- [docs/LAVAGUARD_PHASE7A_DATA_GOVERNANCE.md](../docs/LAVAGUARD_PHASE7A_DATA_GOVERNANCE.md)
- [docs/LAVAGUARD_PHASE7A_EVALUATION_PLAN.md](../docs/LAVAGUARD_PHASE7A_EVALUATION_PLAN.md)
- [docs/LAVAGUARD_PHASE7A_PARTICIPANT_MATERIALS.md](../docs/LAVAGUARD_PHASE7A_PARTICIPANT_MATERIALS.md)
- [docs/LAVAGUARD_PHASE7A_RESULTS.md](../docs/LAVAGUARD_PHASE7A_RESULTS.md)
- [docs/LAVAGUARD_PHASE7A_STUDY_PROTOCOL.md](../docs/LAVAGUARD_PHASE7A_STUDY_PROTOCOL.md)
- [docs/LAVAGUARD_PHASE7B_ARCHITECTURE.md](../docs/LAVAGUARD_PHASE7B_ARCHITECTURE.md)
- [docs/LAVAGUARD_PHASE7B_SCALING_RESULTS.md](../docs/LAVAGUARD_PHASE7B_SCALING_RESULTS.md)
- [docs/LAVAGUARD_PHASE7B_TRANSPORT.md](../docs/LAVAGUARD_PHASE7B_TRANSPORT.md)
- [docs/LAVAGUARD_PHASE7_HANDOFF.md](../docs/LAVAGUARD_PHASE7_HANDOFF.md)
- [docs/LAVAGUARD_PHASE7_STAGING.md](../docs/LAVAGUARD_PHASE7_STAGING.md)
- [docs/LAVAGUARD_PHASE7_VERCEL_INTEGRATION.md](../docs/LAVAGUARD_PHASE7_VERCEL_INTEGRATION.md)
- [ml/artifacts/phase7-hosting-assessment.json](../ml/artifacts/phase7-hosting-assessment.json)
- [ml/artifacts/phase7-index.json](../ml/artifacts/phase7-index.json)
- [ml/artifacts/phase7-load-initial.json](../ml/artifacts/phase7-load-initial.json)
- [ml/artifacts/phase7-local-load.json](../ml/artifacts/phase7-local-load.json)
- [ml/artifacts/phase7-publication-images.json](../ml/artifacts/phase7-publication-images.json)
- [ml/artifacts/phase7-readiness.json](../ml/artifacts/phase7-readiness.json)
- [ml/artifacts/phase7-sharding.json](../ml/artifacts/phase7-sharding.json)
- [ml/artifacts/phase7-transport.json](../ml/artifacts/phase7-transport.json)
- [ml/artifacts/phase7-verification.json](../ml/artifacts/phase7-verification.json)
- [ml/artifacts/phase7a-readiness.json](../ml/artifacts/phase7a-readiness.json)
- [ml/phase7a.py](../ml/phase7a.py)
- [ml/study-protocol.json](../ml/study-protocol.json)
- [ml/study_models.py](../ml/study_models.py)
- [ml/study_withdraw.py](../ml/study_withdraw.py)
- [ml/test_phase7a.py](../ml/test_phase7a.py)
- [package.json](../package.json)
- [playwright.phase7.config.ts](../playwright.phase7.config.ts)
- [scripts/phase7/import-study.mjs](../scripts/phase7/import-study.mjs)
- [scripts/phase7/index.mjs](../scripts/phase7/index.mjs)
- [scripts/phase7/load.mjs](../scripts/phase7/load.mjs)
- [scripts/phase7/local-worker.mjs](../scripts/phase7/local-worker.mjs)
- [scripts/phase7/proxy.mjs](../scripts/phase7/proxy.mjs)
- [scripts/phase7/report.mjs](../scripts/phase7/report.mjs)
- [scripts/phase7/serve.mjs](../scripts/phase7/serve.mjs)
- [scripts/phase7/sharding.mjs](../scripts/phase7/sharding.mjs)
- [scripts/phase7/sql-runtime.mjs](../scripts/phase7/sql-runtime.mjs)
- [scripts/phase7/storage.test.mjs](../scripts/phase7/storage.test.mjs)
- [scripts/phase7/transport.mjs](../scripts/phase7/transport.mjs)
- [scripts/phase7/verify.mjs](../scripts/phase7/verify.mjs)
- [scripts/phase7/worker.ts](../scripts/phase7/worker.ts)
- [src/client/guard/research-controls.ts](../src/client/guard/research-controls.ts)
- [src/client/guard/research.ts](../src/client/guard/research.ts)
- [src/shared/shard-metrics.ts](../src/shared/shard-metrics.ts)
- [src/worker/guard/research-routed-guard.ts](../src/worker/guard/research-routed-guard.ts)
- [src/worker/guard/research-router.ts](../src/worker/guard/research-router.ts)
- [tests/phase6/signin-failure.spec.ts](../tests/phase6/signin-failure.spec.ts)
- [tests/phase7/proxy-study.spec.ts](../tests/phase7/proxy-study.spec.ts)
- [tests/unit/phase7.test.ts](../tests/unit/phase7.test.ts)
- [tsconfig.phase7.json](../tsconfig.phase7.json)
<!-- PHASE7_FILES_END -->

## Reproduce and remaining decisions

Run `npm run phase7:verify` for the full check/build/Python/import/environment/browser/enforcement/hardening/audit sequence. `--checks-only`, `--ml-only` and `--phase7-only` record focused replacements after relevant changes. Run `npm run phase7:study`, `npm run phase7:sharding`, `npm run phase7:index`, `npm run phase7:load` and `npm run phase7:transport` for the separate actual readiness/benchmarks. Frozen test Workers/proxy use loopback ports 8810/8812 and their own ignored state; scripts close only owned processes. User server state is not cleaned.

Independent review, actual consenting study recruitment/data, privacy/ethics approval, untouched cohorts, physical/hardware usability, account/directory/global-budget migration design and actual serving-path/edge validation remain outstanding. Any deployment would additionally require owner approval of exact project/domain/RP/backend/budget/traffic/operator and rollback. [Study protocol](LAVAGUARD_PHASE7A_STUDY_PROTOCOL.md), [governance](LAVAGUARD_PHASE7A_DATA_GOVERNANCE.md), [evaluation plan](LAVAGUARD_PHASE7A_EVALUATION_PLAN.md), [participant templates](LAVAGUARD_PHASE7A_PARTICIPANT_MATERIALS.md), [architecture](LAVAGUARD_PHASE7B_ARCHITECTURE.md), [Vercel assessment](LAVAGUARD_PHASE7_VERCEL_INTEGRATION.md) and [staging gates](LAVAGUARD_PHASE7_STAGING.md) specify those next steps. No missing approval is inferred from elapsed time.
