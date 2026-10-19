# Phase 6 security, privacy and accessibility review

LavaGuard adds protocol abuse controls and experimental risk estimation; client-side behavior is forgeable and passkeys provide identity security.

No production route, storage binding/migration, cookie/auth handler, crypto mixing, passkey verification, UI, shader, ring or physics default was changed. Shared research parsing now rejects malformed enum objects without throwing; off inference avoids parsing. Private withdrawal recognizes Phase 6 candidate/view/manifest formats. The new registry, simulator, metrics and Worker adapter are research tools outside the production routing graph.

The browser tests verify a valid virtual-authenticator assertion corrupted in transit fails with 401 and consumes its challenge (replay 409). Scores never produce authentication cookies or clearance. Accessible native clearance remains separate from WebAuthn. Keyboard passkeys work with WebGL disabled and WebDriver true. Existing UV, RP/origin, expiry, context binding, replay, session revocation, reduced-motion, mobile ring, no-WebGL and recovery checks are retained.

Automation frameworks and virtual authenticators are engineering fixtures, never human participants. No human-controlled browser, remote desktop, VM or assisted input is classified by its environment alone. Smooth/erratic movement, low sample count and missing pressure are not identities. Touch/pen/assistive behavior retains abstention/access alternatives; actual physical hardware/usability remains untested. No added mandatory target-chasing steps or retry burden was introduced. Genuine-user impacts and false-positive rates remain unknown.

Raw research is explicit pre-attempt opt-in, memory-bounded and privately exported. Phase 6 browser cases are operator-declared automation; the contradictory takeover declaration remains automation-labeled. No vendor receives trajectories, no paid agent is called and no participants are recruited. Source/run/browser-build metadata belongs only to controlled local experiments. Public aggregates omit raw coordinates, participant/context codes, IPs, tokens, credential data and private paths. Fixed-name shadow counters have fixed model slots and at most 24 coarse hourly buckets; they cannot identify operators or measure genuine consent rates.

The local comparison view is a generated offline HTML snapshot with no network or command controls, not monitoring. Generate it using `npm run phase6:view`. Old Phase 4/5 reports, private data and approved screenshots remain preserved. Publication pattern/link checks are review aids, not a proof that every secret format is absent.

## Rollback drill and proposed alerts

MODEL → OFF is the first switch: the observation registry defaults off; the local adapter verifies off returns null without touching policy, cookies or sessions. Candidate revocation/dataset withdrawal also abstain. Never automatically select another model after revocation. GUARD → OFF is a separate incident decision requiring owner approval; it must preserve WebAuthn, rate limits, origin checks, secure randomness, cookies and session revocation. No remote flag was changed during this work.

Proposed operational review triggers, not established SLOs: unexpected credential-free authentication is an immediate stop; sustained unexpected 5xx or elevated latency prompts availability investigation; unexpected model-score loss or OOD growth prompts MODEL OFF review; replay/overload pulses require protocol/traffic investigation, never operator identity claims. Anonymous metrics cannot establish human FPR or drift in human identity. No alert was connected or monitoring launched.

The external incomplete-stream local proxy 500 is an explicit unresolved development limitation. The original body reader timeout is exercised both directly in Node streams and inside workerd. Approved staging and independent security review remain necessary before treating network slow-client handling as validated. See [scaling results](LAVAGUARD_PHASE6_SCALING.md).
