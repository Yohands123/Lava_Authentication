# Phase 6 observation registry and inference measurements

[Current measurements](../ml/artifacts/phase6-inference-performance.json); [initial baseline](../ml/artifacts/phase6-inference-performance-initial.json). Everything below is local engineering using explicitly synthetic golden fixtures.

## Authority and integrity

The private registry accepts `lava-observation-candidate-v1`, explicit `APPROVED_FOR_OBSERVATION_ONLY` authority, immutable canonical SHA-256/version pin, model feature/preprocessing/calibration parameters, dataset/cohort hashes and bounded extraction/training/review provenance. The shipped entry is a synthetic Phase 5 Python golden fixture, not an approved application classifier. The private store reproduces and validates its actual hash-pinned cohort-manifest sidecar without model fitting; this does not imply independent review or a real study.

The loader defaults off and has no newest-model discovery. Wrong versions, altered content, activation fields, extra executable fields and malformed/nonfinite parameters reject. Prepared scoring clones coefficients once. Live candidate revocation, dataset withdrawal/unavailability, device support, feature versions and OOD are checked per observation. A private-file reader checks size/path boundaries, state availability and deletion; a caller must obtain a fresh snapshot rather than reuse stale revocation metadata. Candidate absence after withdrawal abstains. Local revocation pins establish integrity under local review; they are not a remote publisher signature or proof of authentic research provenance.

Off mode now returns before inspecting/parsing an artifact, verified with a throwing proxy. JSON enum objects with non-callable `toString` reject safely rather than throwing in research/model/environment validators. Private withdrawal invalidates candidate envelopes and new Phase 6 derived-view/manifest formats conservatively, preserving final-use history. No genuine data was withdrawn during this work; deletion tests use isolated fixtures.

The dedicated test Worker entry is outside the production import graph. Its local-only synthetic adapter is constrained to fixed test ports, exact Origin/test header, a bounded body, allowlisted test inputs and at most 5000 repetitions. Failure/stall injection is limited to one iteration. Async scoring errors/timeouts abstain; timers cannot preempt arbitrary synchronous JavaScript, so actual kernels have bounded feature counts and no executable model format. Every result has `action: observe`, `policyAuthority: none`; it cannot mint clearance, set authentication cookies or create sessions.

## Actual measurements

Node v24.13.0, local Windows hardware, 5000 warm calls. Values are milliseconds:

| Node path | p50 | p95 | p99 |
| --- | --- | --- | --- |
| Validate portable model each call | 0.0040 | 0.0077 | 0.0144 |
| Prepared portable model | 0.0012 | 0.0035 | 0.0040 |
| Pinned prepared registry | 0.0012 | 0.0015 | 0.0031 |

Preparation was about 0.760 ms. Model JSON was 2051 bytes, candidate JSON 2611 bytes and the registry-only bundle 7518 bytes. Raw timing arrays remain in ignored local benchmark files. Process heap/RSS deltas include GC and other activity; they are not per-call allocation measurements or native-memory guarantees. The compact logistic path has a bounded feature loop, not a cryptographic constant-time guarantee.

Local workerd used 30 HTTP samples per method/mode, each executing 1000 synthetic observations including async budget-wrapper overhead. Prepared shadow HTTP p50/p95/p99 were **9.159/10.373/10.554 ms per 1000-observation request**; parse-each-call shadow was **11.232/12.514/13.933 ms**. These are not single-inference edge CPU measurements. Reported in-Worker wall timers are coarse and can be runtime-dependent. The host workerd process accumulated about 0.297 CPU seconds across this benchmark and RSS rose from about 78.5 MB to 92.6 MB; neither isolates a production request cost.

Chromium 156.0.8078.4 measured 120 synthetic 1024-sample extractions. Browser p95: v1 **1.9 ms**, robust12 **0.3 ms**, response-v3 **2.8 ms**, dynamic-v4 **0.3 ms**. Browser/Node dynamic outputs matched exactly. Cold HTTP/import/preparation, unsupported/OOD/null paths and serialization sizes are retained in the artifact. The initial and final runs experienced different local contention; their differences do not provide a controlled causal speedup estimate.

Actual Cloudflare edge CPU, billed memory, cold-isolate distribution, low-end phone GPU/frame cost and real traffic performance are **NOT_RUN**. No numerical edge budget or capacity is inferred from Node, browser or development workerd timers.

```powershell
npm run phase6:registry
npm run phase6:benchmark
# Explicit local revocation, if desired after reviewing a candidate hash:
# npm run phase6:registry -- --revoke HASH
```
