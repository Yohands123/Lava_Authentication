# Progress

Current phase: 3. Pointer interaction (tuning)

The base code already includes a first pass at several phases. Treat each item
below as "built, needs review" until the user has watched it and confirmed.

## Phase status
- [x] 1. Design before code (DESIGN.md written; add reference images to design/)
- [x] 2. Lamp engine: signed off by user 2026-10-11. Real two-pass bloom deferred to Phase 8 (halo only for now).
- [ ] 3. Pointer interaction: stir forces, ring, meter, Space/hold, skip built. Needs feel tuning on mouse and touch.
- [ ] 4. Entropy pipeline: stir pool, lamp snapshots, server mixing built. Camera not built. Lab mode not built.
- [ ] 5. Authentication: passkey register/login, single-use challenges, rate limits, sessions built. E2E tests not written.
- [ ] 6. Wire UI to events: portal, burst, droplet, fizzle, warm glow built.
- [ ] 7. Lab mode and Freeze: freeze dial built. Lab mode not built.
- [ ] 8. Polish: not started (glass refraction in shader, sound, real bloom, phone testing).

## Current phase checklist (Phase 3)
- [ ] Blobs repel and swirl in the pointer's wake on mouse and touch
- [ ] Fast strokes split blobs; slow strokes stretch them (stretch not built yet)
- [ ] Ring fills in 3–5 seconds of genuine curved stirring
- [ ] A scripted straight-line drag at constant speed stalls the ring (meter unit-tested; no ring flicker yet)
- [ ] Keyboard (hold Space) and reduced-motion (press-and-hold) alternatives work
- [x] Unit tests for crediting and health checks pass

## Not built yet
- Camera entropy (src/client/entropy/camera.ts)
- Lab mode split screen and pipeline animation
- Real two-pass bloom and glass refraction
- Sound
- Playwright E2E tests (tests/e2e/)
- ESLint config (`npm run lint` currently runs the type check)

## Tuned values worth remembering
- Base `LAMP` values approved as-is on 2026-10-11: BUOYANCY = 0.06, DRAG = 0.6, MAX_DRIFT_SPEED = 0.08, RADIUS 0.045–0.105, COUNT_DESKTOP = 13, GRAIN = 0.035

## Open questions
- Production domain for RP_ID?

## Log
- Base code created: lamp engine, Stir the Lamp, glass UI, Worker routes, Durable Objects, 21 unit tests passing.
- 2026-10-11: Repo moved to project root and pushed to GitHub. Fonts documented as bundled via @fontsource.
- 2026-10-11: User watched `npm run lamp` and approved the current lamp look and motion. No values changed.
- 2026-10-11: Phase 2 signed off. Phase 3 started.
