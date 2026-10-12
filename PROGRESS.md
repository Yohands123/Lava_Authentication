# Progress

Current phase: 5. Authentication

The base code already includes a first pass at several phases. Treat each item
below as "built, needs review" until the user has watched it and confirmed.

## Phase status
- [x] 1. Design before code (DESIGN.md written; add reference images to design/)
- [x] 2. Lamp engine: signed off by user 2026-10-11. Real two-pass bloom deferred to Phase 8 (halo only for now).
- [ ] 3. Pointer interaction: user moved on 2026-10-11 with items open (see "Carried over from Phase 3").
- [ ] 4. Entropy pipeline: built and tested 2026-10-11; user moved on before trying the camera toggle.
- [ ] 5. Authentication: all 7 E2E flows pass (2026-10-11). Open: real passkey check by user, user-verification decision.
- [ ] 6. Wire UI to events: portal, burst, droplet, fizzle, warm glow built.
- [ ] 7. Lab mode and Freeze: freeze dial built. Lab mode not built.
- [ ] 8. Polish: not started (glass refraction in shader, sound, real bloom, phone testing).

## Current phase checklist (Phase 5)
- [ ] Register and log in with a real passkey locally (user to try at http://localhost:8787)
- [x] Login works with stirring skipped, lamp frozen and camera off (E2E)
- [x] Reused challenge → 409; expired → 410; rate limited → 429 (E2E)
- [x] Logout and revoke-all work (E2E, revoke-all across two devices)
- [x] E2E tests pass with Playwright's virtual authenticator (`npm run test:e2e`, 7/7)

## Carried over from Phase 4
- User has not tried the camera toggle: permission prompt, covered lens dims the lamp, tracks stop

## Carried over from Phase 3
- Slow strokes should stretch blobs into necks (not built)
- Ring should stall and flicker on robotic stirring (only stalls + message now)
- Hold Space credits frame timing, not key timing
- Stirring not yet felt on mouse or touch by the user

## Not built yet
- Lab mode split screen and pipeline animation
- Real two-pass bloom and glass refraction
- Sound
- challenge-store.test.ts (a unit test of a Durable Object needs `@cloudflare/vitest-pool-workers`, not an approved dependency; consume-once and expiry are covered by E2E for now)
- ESLint config (`npm run lint` currently runs the type check)

## Tuned values worth remembering
- Base `LAMP` values approved as-is on 2026-10-11: BUOYANCY = 0.06, DRAG = 0.6, MAX_DRIFT_SPEED = 0.08, RADIUS 0.045–0.105, COUNT_DESKTOP = 13, GRAIN = 0.035

## Open questions
- Production domain for RP_ID?
- User verification: CLAUDE.md 2.1.6 says verify the UV flag, but both verify routes pass `requireUserVerification: false` and README shows `userVerification: "preferred"`. Which wins?
- Worker API responses lack `Permissions-Policy` (CLAUDE.md 7.5); adding it means touching csp.ts.

## Log
- Base code created: lamp engine, Stir the Lamp, glass UI, Worker routes, Durable Objects, 21 unit tests passing.
- 2026-10-11: Repo moved to project root and pushed to GitHub. Fonts documented as bundled via @fontsource.
- 2026-10-11: User watched `npm run lamp` and approved the current lamp look and motion. No values changed.
- 2026-10-11: Phase 2 signed off. Phase 3 started.
- 2026-10-11: Moved to Phase 4 at user's request. Added camera source, snapshot/pool/camera/health tests, real /api/health. 36 unit tests passing.
- 2026-10-11: Moved to Phase 5. Added Playwright E2E suite (7/7). Fixed ChallengeStore sweeping expired challenges after 1 s, which turned 410 into 409.
