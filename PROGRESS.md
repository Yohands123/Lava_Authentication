# Progress

Current phase: 7. Lab mode and Freeze

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
- Hold Space credits frame timing, not key timing
- Stirring not yet felt on mouse or touch by the user

## Not built yet
- Real two-pass bloom and glass refraction
- Sound
- challenge-store.test.ts (a unit test of a Durable Object needs `@cloudflare/vitest-pool-workers`, not an approved dependency; consume-once and expiry are covered by E2E for now)
- ESLint config (`npm run lint` currently runs the type check)

## Tuned values worth remembering
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
