# Slow-body transport diagnosis and local mitigation

The Phase 6 artifact retains its real external unfinished-stream HTTP 500. Phase 7 did **not** reproduce that exact status: the same class of external request timed out instead. An initial Phase 7 harness threw on its six-second timeout before checkpointing phase one; [the initial failure](../ml/artifacts/phase7-load-initial.json) remains explicit and is not a pass. The corrected harness records missing HTTP status/timeouts separately and continues the bounded experiment.

[The traced reproduction](../ml/artifacts/phase7-transport.json) freezes its local Worker/assets/config and runs dedicated loopback ports 8810/8812. Fixed test-only trace messages record entry and the actual production handler's returned status/time; no body, token or visitor identifier is logged.

| Actual probe | Application | Client observation |
| --- | --- | --- |
| Direct unfinished chunked body | Returned 400 in 3,032 ms | No delivered HTTP response by 6,516-ms deadline |
| Direct body completed after 4.5 seconds | Returned 400 in 3,010 ms | 400 delivered after 4,518 ms |
| Bounded proxy, unfinished body | Not forwarded | 400 in 3,022 ms |
| Bounded proxy, body planned to finish after 4.5 seconds | Not forwarded | 400 in 3,008 ms |
| Client abort through proxy | Not forwarded | Explicit client abort, no HTTP status |
| Synthetic unfinished stream inside Worker | Actual bounded reader rejects | 400 in about 3,046 ms |

This locates the discrepancy after the application returns its bounded error, in development transport/response forwarding while the incoming body remains open. It does not establish the exact internal Wrangler/Miniflare/workerd bug or actual Cloudflare edge behavior. Returning 400 inside the application does not guarantee an end-to-end slow-client deadline through every serving layer.

The separate [local proxy analogue](../scripts/phase7/proxy.mjs) buffers at most 32 KB for at most three seconds, rejects oversized/stalled bodies and closes failed ingress before forwarding a complete body. Application-specific guard parsing still has its existing tighter 8-KB bound. Proxy targets, port and Host are fixed to loopback; ambiguous `//` targets are refused. Neither this proxy nor diagnostic Worker is imported into production. It preserves request Origin, strict cookies and independent WebAuthn verification and has real browser flow tests.

**Mitigation demonstrated locally; platform issue unresolved.** No production body parser was weakened, no upstream timeout was counted as a successful request, and no timeout was relabeled human/bot detection. Actual deployed ingress/edge deadlines, cancellation and session behavior remain approval-gated staging tests. The previous 500 and present timeout are both release-relevant evidence, not interchangeable status assertions.

Reproduce with `npm run phase7:transport`. The script owns and closes only its isolated processes; it performs no public load or remote monitoring. Full local capacity measurements, including 429/503 and recovery, are in [the load artifact](../ml/artifacts/phase7-local-load.json).
