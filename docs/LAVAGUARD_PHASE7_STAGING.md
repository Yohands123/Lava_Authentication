# Phase 7 staging and release gates

Current decision: **NO GO for deployment, production ML, storage cutover or real study enrollment.** The owner authorized code commit/push/PR creation, with no merge or deployment. Code review readiness is separate from data readiness, human validation, security review, staging readiness and production go.

| Gate | Current status | Required evidence/action |
| --- | --- | --- |
| Local engineering | Reviewable with documented prototype limitations | Actual command/artifact results in handoff |
| Data readiness | NOT_READY_NO_OPT_IN_DATA | Prospective consenting supervised participants and matched scripts |
| Human safety | Unknown | Independent participant/device/accessibility evaluation, justified uncertainty |
| Security review | Automated local checks; independent review pending | Forged summaries, credential-bearing automation, migrations, ingress and budgets |
| Protocol/shadow staging | Blocked | Explicit owner approval, selected hostname/RP, disposable state, traffic/spend budget and operator |
| Production ML | Not eligible; disabled | Independently reviewed study/generalization/privacy/usability evidence and separate approval |
| Shard cutover | Prototype only | Scalable authority directory, global budgets, account uniqueness, revocation, migration/rollback |

For an approved future pilot, record the actual current deployed SHA/bindings, proposed artifact hash, exact hostname/ORIGIN/RP_ID, separate test namespaces, permitted traffic and spending, owner/operator and rollback artifact. A possible starting budget (proposal only) is one request/second, at most five concurrent operations and a fixed daily attempt cap chosen by the owner. Validate actual edge capacity and ingress deadlines before raising it; local SQL rows or Node benchmarks cannot substitute.

First validate guard-off recovery: independent passkeys, secure cookies, rate limits, challenge freshness/one-use and session revocation remain mandatory. Then separately approve protocol controls with ML off or observation-only. Test valid hardware passkeys, cancellation, malformed signatures/origins/RP/UV, replay/concurrent redemption, no-WebGL/keyboard and actual assistive devices, overloaded state, provider failure and unavailable metrics. Physical device/hardware and actual edge tests remain NOT TESTED here.

Use fixed, bounded, coarse operational aggregates only with approved privacy notice/governance. Initial alerts/circuit breakers and latency/error targets in the scaling report are proposals. 429 and 503 hurt availability and must remain visible. Unexplained regressions, secrets in logs, invalid consent, auth failures, unbounded costs or inaccessible alternatives stop the pilot. No remote monitoring or alert automation has been started.

Rollback uses the recorded previously deployed artifact/config, stops new prototype epoch issuance and preserves outstanding authoritative mappings until drain/revocation. Do not delete legacy state, resurrect consumed challenges, reset final-use locks or weaken WebAuthn. Existing production source/config remains unchanged by this work. An explicit owner-selected guard-off recovery must preserve rate limits/passkeys; it is not permission to disable authentication.

The GitHub baseline and Phase 7 PRs remain unmerged. After owner review/merge of the baseline, retarget the stacked Phase 7 PR to main and review its delta; do not enable auto-merge. Neither merge nor a Vercel build is proof of a Cloudflare deployment. Cloudflare production deployment, Vercel provisioning/preview, study recruitment and ML enforcement require distinct future decisions.
