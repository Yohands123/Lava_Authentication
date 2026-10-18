# CLAUDE.md: LavaAuth

**Phase 4 / 4B owner scope, 2026-10-17:** implement security hardening, optional disabled-by-default Turnstile, actual linting, bounded observability, controlled local load tests, staging drafts and defensible ML engineering. The optional provider authorizes only a feature-gated `challenges.cloudflare.com` script/frame CSP exception; default CSP stays restrictive. Preserve the approved UI, physics and mandatory passkeys. Do not deploy, merge, create remote resources, request production credentials, or enable production model enforcement. Current reports are docs/LAVAGUARD_PHASE4_RESULTS.md and docs/LAVAGUARD_ML_PHASE4_RESULTS.md. These requests authorize the corresponding development/test tools and supersede earlier phase-only restrictions.

**LavaGuard scope update, authorized by the owner 2026-10-17:** the complete implementation and Phase 2 validation supersede the older phase-only workflow, gesture-only access and no-gradient-result restrictions below. After four human retries in the automated demo browser, normal localhost development enforces protocol controls while movement and WebDriver hints remain advisory; its experimental model is disabled. Strict model refusals belong only to isolated localhost research tests. Production remains off; model activation is prohibited outside localhost. Local evaluation sends disclosed aggregates, never raw paths. Optional research exports require explicit consent before an attempt and stay local. Accessible server attempts require separate passkey authentication. Do not deploy, merge, or enable production collection/enforcement. All original cryptographic passkey/randomness/session protections remain mandatory. Current findings: docs/LAVAGUARD_PHASE2_RESULTS.md.

Instructions for Claude Code working in this repository. Read this file completely at the start of every session. When this file and your own defaults disagree, this file wins.

---

## 0. Start of every session

Do these in order before writing any code:

1. Read `CLAUDE.md` (this file), `README.md` and `DESIGN.md`.
2. Check `PROGRESS.md` to see which phase is current and what is already done. If it doesn't exist, create it from the template in [section 14](#14-progressmd-template).
3. Run `git status` and `git log --oneline -10` to see recent changes.
4. Run `npm test` to confirm the starting state is green. If it isn't, report that before doing anything else.
5. Restate the task in one or two sentences and name the phase it belongs to. If the task belongs to a later phase than the current one, say so and ask before proceeding.

---

## 1. What this project is

LavaAuth is a passwordless (passkey / WebAuthn) login system on Cloudflare Workers whose entire user interface is a living WebGL lava lamp. Every security event is expressed as something the wax does.

The key interaction is **Stir the Lamp**: at login, the user drags their mouse or finger through the wax, the blobs scatter and swirl, and the pointer motion is hashed in the browser and mixed into the login challenge.

The key demonstration is **Freeze the Lamp**: the lamp can be stopped completely and login still works securely, because every challenge always includes 32 bytes from the Worker's secure random generator.

The project must be two things at once:
- **Visually exceptional.** It must not look AI-generated or templated.
- **Honestly secure.** Decorative entropy can add to security; it can never replace or weaken the secure generator.

`README.md` is the source of truth for what the product does. When it and the code disagree, say so and fix whichever is wrong; never leave them out of step.

---

## 2. Non-negotiable rules

These rules are never broken, even if a task seems to call for it. If a request conflicts with one of them, stop and explain the conflict instead of proceeding.

### 2.1 Security rules

1. **Every challenge includes 32 bytes from `crypto.getRandomValues()` generated in the Worker.** Never remove, bypass, make optional, cache, reuse or derive these bytes from anything else. This applies to tests, dev mode and Freeze mode as well.
2. **Challenges are built only in the Worker**, as `SHA-256(serverRandom ‖ stir ‖ lamp ‖ camera ‖ timestamp)`. The client never generates or chooses a challenge.
3. **Client digests are untrusted.** Accept each only if it is exactly 32 bytes or absent. Never reject a login because a client digest "looks non-random". Never log them alongside user identifiers.
4. **Challenges are single-use.** Read and delete in the same Durable Object request. A failed verification still consumes the challenge.
5. **Challenges expire** after `CHALLENGE_TTL_SECONDS` (default 60).
6. **Verify origin, RP ID, user verification flag and signature counter** on every assertion using `@simplewebauthn/server`.
7. **Raw pointer paths and camera frames never leave the browser.** Production LavaGuard is off and sends only entropy digests. The owner-authorized local shadow preview may send disclosed bounded feature summaries, with short-lived hashes/outcomes and deletion controls. Never add raw-input uploads or production behavioral collection without explicit owner approval.
8. **Session cookies** are always `HttpOnly; Secure; SameSite=Strict; Path=/` and contain only an opaque random ID. Session data lives in `SessionStore`.
9. **No secrets in the repo.** No API keys, tokens or credentials in code, tests, fixtures or commits.
10. **No password fallback**, no "magic link" fallback, no security questions. Passkeys only.
11. **Never use `Math.random()`** for anything security-related. It is allowed only for purely visual physics (blob jitter), and every such use gets a comment `// visual only, not security`.
12. **Strict Content Security Policy.** No inline scripts, no `eval`, no `new Function`, no third-party script hosts.
13. **Rate limit** `/api/register/*` and `/api/login/*` per IP and per username via the `RateLimiter` Durable Object.

### 2.2 Design rules

1. **The lamp is the interface.** The WebGL lamp fills the whole viewport on every screen. UI floats over it.
2. **Banned, always:**
   - Cards, tiles or solid opaque panels
   - Any UI component library (no React component kits, no Tailwind UI, no shadcn, no Material, no Bootstrap)
   - Default browser-styled form controls left unstyled
   - Gradient pill buttons
   - Emoji anywhere in the UI
   - Icon sets (Lucide, Heroicons, Font Awesome and similar)
   - Spinners or loading bars (the lamp is the loading state)
   - Dashboard grid layouts
   - Drop shadows used for "elevation"
   - Pure white (`#FFFFFF`) text or purple-on-white anything
   - Bouncy, springy or elastic easing
3. **All UI surfaces are frosted glass** (see [section 8.4](#84-glass)).
4. **Colours come only from the tokens** in [section 8.1](#81-colour-tokens). Never introduce a new colour without adding it to `DESIGN.md` and asking first.
5. **Fonts are only** Unbounded (display), Inter Tight (body) and JetBrains Mono (technical). Self-hosted via the `@fontsource` packages (bundled by Vite), never from a CDN.
6. **Nothing snaps.** No transition under 300ms. Default easing `cubic-bezier(0.22, 1, 0.36, 1)`.
7. **One headline per screen, maximum.**

### 2.3 Accessibility rules

1. Respect `prefers-reduced-motion: reduce` everywhere: lamp at 15% speed, no bursts or waves (fades only).
2. **Offer an accessible passkey route without stirring** (owner's LavaGuard request, 2026-10-17, superseding the gesture-only decision). The normal experience still clears wax from the ring and shows one server verdict inside it. The alternative uses explicit server issuance and independent abuse controls; both paths require separate verified WebAuthn authentication. Gesture classification is probabilistic and cannot prove humanity or identity.
3. Every action except clearing the ring is reachable by keyboard.
4. The canvas is `aria-hidden="true"`. State changes are announced through a single polite `aria-live` region.
5. All text meets WCAG AA contrast against the brightest area the lamp can produce behind it. Glass panels behind text carry a dark tint to guarantee this.
6. Sound is muted by default.
7. A pause control stops the lamp completely.

---

## 3. Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Vite + `wrangler dev` with local Durable Objects at `http://localhost:8787` |
| `npm run lamp` | Lamp engine alone with a tuning panel, no auth (`src/client/lamp/sandbox.html`) |
| `npm run build` | Build the client to `dist/` |
| `npm test` | Vitest unit tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright end-to-end tests with a virtual authenticator |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | lint + typecheck + unit tests (run before saying any task is done) |
| `npm run deploy` | Build and deploy to production |

Never run `npm run deploy` unless the user explicitly asks for a deployment in this session.

Always use `http://localhost:8787` locally, never `127.0.0.1`, because the passkey RP ID is `localhost`.

---

## 4. Repository map

```
src/client/lamp/        WebGL renderer, shaders, physics, constants
src/client/stir/        Pointer capture, stir forces, entropy pool, health checks
src/client/entropy/     Lamp snapshot hashing, optional camera hashing
src/client/auth/        Registration and login flows (@simplewebauthn/browser)
src/client/ui/          Glass styles, entropy ring, screens, sound
src/client/a11y/        Reduced motion, live region, keyboard stirring
src/worker/             Router and API routes
src/worker/entropy/     Challenge builder (mix.ts)
src/worker/durable/     ChallengeStore, RateLimiter, SessionStore, UserStore
src/worker/lib/         Cookies, CSP, base64url, errors
tests/unit/             Vitest
tests/e2e/              Playwright
design/                 Reference images (read-only)
```

### Files with special rules

| File | Rule |
| --- | --- |
| `src/worker/entropy/mix.ts` | Security-critical. Any change requires updating `tests/unit/mix.test.ts` and explaining the change in the summary. |
| `src/worker/durable/ChallengeStore.ts` | Security-critical. Read-and-delete must stay atomic. |
| `src/worker/lib/cookies.ts` | Cookie flags must never be weakened. |
| `src/worker/lib/csp.ts` | Never loosen the policy without asking. |
| `src/client/lamp/constants.ts` | The only place tunable lamp values live. Every constant has a comment with its unit and visual effect. |
| `DESIGN.md` | Do not edit unless asked. Propose changes instead. |
| `design/` | Read-only reference images. |
| `wrangler.toml` | Never change `RP_ID`, Durable Object class names or migrations without asking. |

---

## 5. Phase workflow

Work only on the current phase listed in `PROGRESS.md`. Never start a later phase early, even if it seems efficient. Never ask for, or attempt, "the whole app" in one go.

### Phase 1: Design before code
- **Goal:** `DESIGN.md` exists with palette, type, materials, motion rules and bans; references are in `design/`.
- **Done when:** each screen can be described in one sentence and every value in [section 8](#8-design-system) is written down.

### Phase 2: Lamp engine
- **Scope:** `src/client/lamp/` and `sandbox.html` only. No auth, no UI except the canvas and a dev-only tuning panel.
- **Build:** WebGL 2 metaball shader, temperature physics, bloom, grain, background streaks, reduced-motion support.
- **Done when:**
  - [ ] Watched for 60 seconds, it reads as warm wax: slow, viscous, never jittery
  - [ ] Blobs stretch into necks about 2× their radius before splitting
  - [ ] Colour clearly follows temperature (hot magenta at bottom, cool blue at top)
  - [ ] No visible gradient banding
  - [ ] 60 fps on a laptop at 1.0 resolution scale
  - [ ] All tunables live in `constants.ts` with comments

### Phase 3: Pointer interaction (Stir the Lamp)
- **Scope:** `src/client/stir/`, entropy ring, landing heat effect. Still no auth.
- **Done when:**
  - [ ] Blobs repel and swirl in the pointer's wake on mouse and touch
  - [ ] Fast strokes split blobs; slow strokes stretch them
  - [ ] Ring fills in 3–5 seconds of genuine curved stirring
  - [ ] A scripted straight-line drag at constant speed stalls the ring
  - [ ] Clearing the ring by hand reveals Sign in; robotic motion doesn't move the wax
  - [ ] Unit tests for crediting and health checks pass

### Phase 4: Entropy pipeline
- **Scope:** `src/client/entropy/`, `src/worker/entropy/`, `/api/health`.
- **Done when:**
  - [ ] Lamp snapshots, stir pool and optional camera produce 32-byte digests
  - [ ] Repeated snapshots are rejected and counted
  - [ ] `mix.ts` always includes server random bytes (tested with all client digests absent)
  - [ ] Lab-mode numbers come from real data

### Phase 5: Authentication
- **Scope:** `src/client/auth/`, `src/worker/routes/`, `src/worker/durable/`.
- **Done when:**
  - [ ] Register and log in with a passkey locally
  - [ ] Login works with the lamp frozen and camera off
  - [ ] Reused challenge → `409`; expired → `410`; rate limited → `429`
  - [ ] Logout and revoke-all work
  - [ ] E2E tests pass with Playwright's virtual authenticator

### Phase 6: Wire UI to events
- **Done when:** every auth event has a wax response (portal, stir, warm glow, fizzle) and no spinner exists anywhere.

### Phase 7: Lab mode and Freeze
- **Done when:** the full demo script in `README.md` runs start to finish without touching code.

### Phase 8: Polish
- **Done when:** the [quality bar](#12-quality-bar) passes on a mid-range phone.

After completing a phase, update `PROGRESS.md`, run `npm run check`, and stop. Do not roll into the next phase without the user saying so.

---

## 6. Coding conventions

### 6.1 General
- **TypeScript strict mode** everywhere (`"strict": true`, `"noUncheckedIndexedAccess": true`).
- **No UI framework.** Plain TypeScript and DOM APIs. Small, focused modules.
- **No new dependencies without asking.** Approved: `@simplewebauthn/browser`, `@simplewebauthn/server`, `vite`, `wrangler`, `vitest`, `@playwright/test`, `eslint`, `typescript`, `@fontsource/unbounded`, `@fontsource/inter-tight`, `@fontsource/jetbrains-mono`. If something else seems necessary, explain why and wait.
- Prefer pure functions. Side effects live at the edges (render loop, event handlers, route handlers).
- Named exports only; no default exports.
- No `any`. Use `unknown` and narrow.
- Files stay under ~300 lines. Split when they grow.
- Comments explain *why*, not *what*.
- Never leave `console.log` in committed code. Use the `debug()` helper, which is stripped from production builds.

### 6.2 Naming
| Thing | Style | Example |
| --- | --- | --- |
| Files | kebab-case | `entropy-ring.ts` |
| Types and classes | PascalCase | `StirSample`, `ChallengeStore` |
| Functions and variables | camelCase | `buildChallenge` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_BLOBS` |
| CSS custom properties | `--lava-*` | `--lava-magenta` |
| Shader uniforms | `u_` prefix | `u_blobs`, `u_time` |

### 6.3 Errors
- Worker routes return `{ error: { code, message } }` with the status codes in `README.md`.
- Never leak stack traces or internal details to the client.
- Client errors are shown as lamp behaviour (fizzle, dim) plus a short glass message, never an alert box.

### 6.4 Binary data
- Use `Uint8Array` for all bytes. Encode as base64url at API boundaries via `src/worker/lib/base64url.ts`.
- Compare secrets and challenges with a constant-time comparison helper.

---

## 7. Implementation guidance

### 7.1 Lamp renderer
- WebGL 2. If unavailable, render a static CSS gradient fallback using the palette and show a quiet note; auth still works.
- Blob data (x, y, radius, temperature) packed into a uniform array `u_blobs` (vec4 per blob), max 16.
- Use a smooth-min blend for metaballs so blobs melt rather than overlap.
- Colour is a function of temperature: hot `#FF2BD6`→`#FF5A6E`, mid `#7B2CFF`, cold `#2F5BFF`.
- Each blob has an inner gradient lit from below and a soft specular highlight top-left.
- Post-processing: bloom (threshold ≈ 0.7, two-pass blur; one pass on mobile) then grain (3–4%, animated).
- Background: `#05030C` → `#0D0826` toward the bottom, plus faint vertical light streaks at very low opacity.
- Render to an offscreen target at `RESOLUTION_SCALE` and upscale. Pause when `document.hidden`.
- Adaptive quality: if frame time exceeds 20ms for 2 seconds, reduce resolution scale by 0.1 (minimum 0.5).

### 7.2 Physics
- Fixed timestep (1/60 s) with an accumulator; render interpolates.
- Forces: heater (bottom band), buoyancy proportional to temperature, cooling near the top, drag, gentle wall containment.
- Merge conserves area (`r = sqrt(r1² + r2²)`); split conserves area across children.
- Undisturbed, a blob crosses the screen in 20–40 seconds. If it's faster, it's wrong.
- Target blob count: 10–16 desktop, ≤ 12 mobile.
- Freeze: `heatScale` from 1.0 to 0. At 0, buoyancy fades, drag rises, palette lerps to `#9FE7FF`, frost shader grows from edges.

### 7.3 Stir the Lamp
- Capture `pointermove`; expand with `getCoalescedEvents()` where supported, fall back to the single event where not.
- Per sample record `dx`, `dy`, `dt` (from `performance.now()`), `pressure`, `tiltX`, `tiltY`.
- Ignore events with `isTrusted === false`.
- Forces on blobs:
  - Repulsion with falloff `1 / (1 + (d / r)²)`, `r ≈ 0.18 × min(width, height)`
  - Tangential swirl proportional to pointer velocity
  - Heat gain on stirred blobs
  - Split when pointer speed exceeds `STIR_SPLIT_SPEED`; stretch below it
- Pool: append samples to a buffer; every 32 samples, `pool = SHA-256(pool ‖ buffer)`; clear buffer.
- Crediting: max 1 bit per accepted sample, max 60 bits per second, target 256 bits.
- Reject (credit 0): no movement; `dt` identical to the previous sample; near-zero direction change across the last 8 samples.
- Raw samples never leave the browser and are cleared from memory after each flush.
- When the ring completes: attractor pulls blobs to centre over ~2 seconds, then show the passkey prompt.
- Clear the ring: on the stir screen the wax gathers into the ring; it is held there (no buoyancy or wander) and moves only while the meter accepts the motion as human-like. Wax pushed out stays out. When the ring is clear, Sign in appears; pressing it starts the passkey. Logic: `src/client/lamp/ring-field.ts`.
- Label the bit count in the UI and Lab mode as a "conservative estimate", never as measured entropy.

### 7.4 Lamp snapshots and camera
- Snapshot: read a downscaled frame (`readPixels` at 64×64) and SHA-256 it. Keep the last 64 digests; reject repeats.
- Camera is opt-in, off by default. Request permission only when the user enables it. Process frames in the browser, compute variance; low variance means "covered", which dims the lamp and lowers camera health. Stop all tracks when camera mode is turned off or the page is hidden.

### 7.5 Worker
- Single router in `src/worker/index.ts`. Every response gets security headers from `csp.ts` (CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` allowing camera only for self).
- Validate every request body shape by hand; reject unknown fields.
- Check `Origin` on all state-changing routes.

### 7.6 Durable Objects
- Use SQLite-backed Durable Objects (`new_sqlite_classes` in migrations).
- `ChallengeStore`: `issue(purpose, userId?) → id` and `consume(id) → challenge | null`. `consume` reads and deletes in one request. An alarm sweeps expired entries.
- `RateLimiter`: sliding window per key; returns remaining and `Retry-After`.
- `SessionStore`: per-user; create, get, revoke, revokeAll.
- `UserStore`: per-username; credential IDs, public keys, counters, transports.
- Never rename a Durable Object class without adding a migration and asking first.

---

## 8. Design system

`DESIGN.md` holds the full spec. These values must match it.

### 8.1 Colour tokens

```css
:root {
  --lava-void: #05030C;
  --lava-deep-navy: #0D0826;
  --lava-magenta: #FF2BD6;
  --lava-violet: #7B2CFF;
  --lava-electric-blue: #2F5BFF;
  --lava-coral: #FF5A6E;
  --lava-ember: #FF6A1F;
  --lava-ice: #9FE7FF;
  --lava-glass-edge: rgba(255, 255, 255, 0.10);
  --lava-text: #F4EEFF;
  --lava-text-quiet: rgba(244, 238, 255, 0.62);
}
```

### 8.2 Typography

| Role | Font | Size | Notes |
| --- | --- | --- | --- |
| Display | Unbounded 300 / 600 | `clamp(48px, 10vw, 160px)` | One per screen |
| Body | Inter Tight 400 / 500 | 15–17px | Line height 1.6 |
| Technical | JetBrains Mono 400 | 12–13px | Letter-spacing 0.02em; hashes, bit counts, health |

Lots of empty space. Never fill the screen with text.

### 8.3 Motion

| Rule | Value |
| --- | --- |
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` |
| UI transitions | 600–1200ms |
| Minimum duration | 300ms |
| Enter button | 4-second breathing cycle (brightness, not scale) |
| Undisturbed drift | 20–40 s to cross the screen |
| Reduced motion | 15% lamp speed, fades only |

### 8.4 Glass

```css
.glass {
  background: rgba(20, 10, 40, 0.18);
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid var(--lava-glass-edge);
  border-radius: 20px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
```

Add a subtle refraction offset in the shader under the panel's rectangle so the wax visibly bends behind glass.

### 8.5 Reference images

`design/` holds three references. Use them like this:

| Reference | Take | Leave |
| --- | --- | --- |
| Classic orange lamp | Heat-driven rise and fall, necks before splitting, warm glow | Bottle shape, orange-only palette |
| Neon vertical blobs | Glossy specular, tiny satellite droplets, vertical light streaks, magenta→blue by height | Uniform density everywhere |
| Gradient metaballs | Gradients inside blobs, long thin necks, deep navy over flat black | Stock-poster centred title |

---

## 9. Screens and the wax response for each event

| Event | Wax response |
| --- | --- |
| Landing idle | Slow drift; cursor is a gentle heat source |
| Enter pressed | Blobs ease toward centre |
| Sign up started | Blobs gather into a glowing ring (portal) |
| Passkey created | Portal bursts; slow rising wave; ember glow from the heater |
| Login screen | Headline fades to "Stir the lamp." |
| Stirring | Repel, swirl, split/stretch; ring fills |
| Ring complete | Attractor pulls wax to centre; passkey prompt |
| Login success | Whole lamp warms to a brighter glow |
| Verification failed | Droplet falls and fizzles; glass message |
| Rate limited | Lamp dims slowly; message with retry time |
| Snapshot rejected | Droplet fizzles instead of merging |
| Robotic stirring | Ring stalls and flickers: "Too regular, keep stirring." |
| Camera covered | Lamp dims; camera health drops |
| Freeze | Wax slows to stop, colours cool to ice, frost spreads, lamp health red: "Lamp offline. Secure generator holding the line." |

If you add a new event, it must have a wax response. No event is allowed to show only text.

---

## 10. Testing requirements

- Run `npm run check` before saying any task is done. Report the result.
- Security-critical code always has tests. Required unit tests:
  - `mix.test.ts`: challenge differs across calls with identical client digests; works with all digests absent; rejects digests that aren't 32 bytes; output is 32 bytes
  - `challenge-store.test.ts`: consume returns once then null; expired returns null
  - `stir-health.test.ts`: straight lines, constant velocity and repeated `dt` credit 0; curved human-like paths credit > 0; per-second cap holds
  - `snapshot.test.ts`: repeats rejected
  - `cookies.test.ts`: flags present and correct
- Required E2E tests (Playwright virtual authenticator): register → login → logout; straight-line drag can't clear the ring; login with lamp frozen; reused challenge `409`; expired `410`; rate limit `429`; revoke all.
- Never weaken or delete a test to make it pass. If a test seems wrong, explain why and ask.
- Never mock `crypto.getRandomValues` to return constant values in tests of `mix.ts` behaviour, except in a test that specifically proves the client digests are also included.

---

## 11. How to work on visuals

Visual quality is judged by motion, not screenshots.

1. Make **one** visual change at a time.
2. Expose the relevant values in `constants.ts` and the sandbox tuning panel.
3. After each change, describe exactly what should look different and ask the user to watch 10–60 seconds of it.
4. When the user gives feedback ("blobs too fast", "highlight too harsh"), translate it into specific numeric changes and state them: "Reduced `BUOYANCY` from 0.8 to 0.55 and raised `DRAG` from 0.92 to 0.95."
5. Never declare a visual task done on your own judgement; the user confirms.
6. If something looks generic (flat gradient, uniform blobs, hard edges, fast motion), say so and propose a fix rather than shipping it.

Signs the lamp is wrong:
- Blobs move faster than a slow walk across the screen
- Blobs are all the same size or colour
- Blobs overlap with hard edges instead of melting
- Colour doesn't change with height or temperature
- Visible banding in dark gradients
- Motion stutters or jumps

---

## 12. Quality bar

The project ships only when all of these pass:

- [ ] Watched for a full minute: motion feels like warm wax
- [ ] Stirring feels physical: swirl in the wake, fast strokes split, slow strokes stretch
- [ ] No banding; bloom only on the hottest cores
- [ ] Glass panels visibly blur and bend the wax
- [ ] Nothing snaps; no transition under 300ms; no spinners
- [ ] 60 fps on a laptop, 30+ fps on a mid-range phone
- [ ] Reduced motion and pause work; clearing the ring works on mouse and touch
- [ ] Login succeeds with the lamp frozen and camera off
- [ ] Reused and expired challenges rejected; rate limiting works
- [ ] A stranger shown a screenshot would not guess it was AI-generated

---

## 13. Communication and git

### 13.1 When to ask before acting
Ask first, and wait, when a task would:
- Add a dependency
- Change `wrangler.toml`, `RP_ID`, migrations or Durable Object class names
- Touch `mix.ts`, `ChallengeStore.ts`, `cookies.ts` or `csp.ts` beyond the task's stated scope
- Introduce a new colour, font or UI pattern
- Start a later phase
- Delete or rewrite more than one file
- Deploy

Ask at most one clear question at a time, and propose a default answer.

### 13.2 End-of-task summary
Finish every task with a short summary:
1. What changed (files and one line each)
2. Any security-relevant change, explicitly flagged
3. `npm run check` result
4. What the user should look at or test (for visuals: what to watch for)
5. Anything left undone or uncertain

### 13.3 Git
- Small, focused commits. One logical change each.
- Conventional commit messages: `feat(lamp): add bloom pass`, `fix(stir): cap credit per second`, `test(mix): cover absent digests`, `chore: update deps`.
- Scopes: `lamp`, `stir`, `entropy`, `auth`, `worker`, `do`, `ui`, `a11y`, `docs`, `test`.
- Never commit `.dev.vars`, `.wrangler/`, `node_modules/`, `dist/` or recordings.
- Never force-push or rewrite history unless asked.

---

## 14. PROGRESS.md template

Create this if it doesn't exist, and keep it updated:

```markdown
# Progress

Current phase: 2. Lamp engine

## Phase status
- [x] 1. Design before code
- [ ] 2. Lamp engine
- [ ] 3. Pointer interaction
- [ ] 4. Entropy pipeline
- [ ] 5. Authentication
- [ ] 6. Wire UI to events
- [ ] 7. Lab mode and Freeze
- [ ] 8. Polish

## Current phase checklist
(copy the "Done when" list for the current phase from CLAUDE.md)

## Tuned values worth remembering
- BUOYANCY = 0.55 (felt right on 2026-10-11)

## Open questions
-

## Log
- 2026-10-11: Phase 1 complete. DESIGN.md written.
```

---

## 15. Common pitfalls

| Pitfall | Avoid by |
| --- | --- |
| Passkeys fail locally | Use `localhost:8787`, not `127.0.0.1`; `RP_ID = "localhost"` |
| `verification_failed` in production | `ORIGIN` must exactly match, `https://`, no trailing slash |
| Challenge reused under load | Keep read-and-delete inside one Durable Object request |
| Blobs explode or vanish | Fixed timestep, clamp velocities, conserve area on merge/split |
| Lamp drains phone battery | Pause on `visibilitychange`; lower resolution scale on mobile |
| Ring fills from a bot drag | Health checks must run before crediting, every sample |
| Banding in gradients | Grain pass on; render target with enough precision |
| `backdrop-filter` missing in a browser | Fallback to a darker semi-opaque tint, still no solid card |
| Camera left on | Stop all tracks when disabled or page hidden |
| Text unreadable over bright wax | Darker glass tint behind text; check contrast at the brightest frame |

---

## 16. Definition of done (any task)

A task is done only when:

1. It stays within the current phase.
2. No rule in [section 2](#2-non-negotiable-rules) is broken.
3. `npm run check` passes (and `npm run test:e2e` for auth changes).
4. New logic has tests; security logic always does.
5. `PROGRESS.md` is updated.
6. The end-of-task summary is given.
7. For visual work, the user has watched it and confirmed.
