# LavaGuard architecture and audit

Implementation baseline: branch `feature/lavaguard`, parent `aa0a63d`. All 46 original unit tests passed before edits. The application lives in the nested `lavaauth/` repository. The five supplied PNG references live one directory above it, in `../design/`; they were visually inspected. Baseline screenshots are in `docs/media/lavaguard/before-*`.

## Observed constraints

The plain TypeScript frontend uses a WebGL 2 renderer, fixed-step wax physics, and `RingField` to gather wax, permit qualified pointer forces, and retain expelled blobs. `StirMeter` is a client-side interaction heuristic, not an enforcement boundary. The original `startSignIn()` trusts local ring completion. `/api/login/options` previously accepted optional digests alone, so callers could skip the entire UI. WebAuthn still provides authentication. Preserve server randomness, signature/origin/RP ID/user verification/counter checks and secure session cookies.

The SVG ring has a 200-unit viewbox and radius 92; its displayed width is `min(72vmin, 640px)` with a mobile height cap and controls offset. Result surfaces track that exact circle using a shared grid cell. Physics and the original pre-result layout remain intact. The new result uses procedural CSS and inline authored SVG, no bitmap replacement or UI framework.

## Instruction and privacy conflicts

The owner explicitly requested the complete attached implementation, overriding older CLAUDE.md phase-only, no-gradient-buttons and gesture-only-access rules for this scope. A keyboard/passkey alternative is required now. The approved result reference authorizes a luminous rim, gradient action and amber state. Original design documentation remains historical; this document is the scoped addendum.

Original README/CLAUDE privacy language promises only hashes leave the device. Local LavaGuard evaluation sends bounded aggregate movement features and an optional browser-reported automation boolean, disclosed before interaction; detailed coordinates, trajectories and camera frames still stay local. Production defaults to `off` and does not send these features. Enabling real-user aggregate evaluation or research collection requires owner approval and updated notice. There is no raw trajectory upload endpoint. Explicit research export is local, voluntary, and revocable by clearing the attempt.

## Trust and lifecycle

LavaObserver samples only the active ring at bounded cadence/capacity and extracts versioned normalized features locally. LavaDetector validates those untrusted summaries, checks server-measured challenge age, and computes experimental evidence. LavaReputation retains only bounded expiring challenge outcomes and hashes within a short-lived random browser context; no user identity or IP-based behavioral profile. LavaPolicy separates model suspicion from verified protocol violations; shadow scores never impose behavioral penalties. LavaEnforcer stores nonce/seed/expiry/scope/context, atomic one-time evaluation and clearance redemption in the existing ChallengeStore SQLite Durable Object. No binding/class migration is necessary.

Protected local login-options requires a short-lived, one-use, cookie-bound clearance; login-verify remains protected by its separate consumed WebAuthn challenge. Accessible attempts omit movement features deliberately, receive independent stricter server rate controls, and still require a verified passkey. Missing gesture summaries cannot silently turn into accessible attempts. Temporary protocol restrictions expire and have an audited operator review/reversal path. No permanent bans.

## Rollout

Initial local default was shadow; the subsequent strict preview caused four human retries in a WebDriver-controlled browser. Current localhost uses `enforce` with `LAVAGUARD_EXPERIMENTAL_MODEL=0`: protocol checks remain enforced, while movement and browser hints stay advisory. The optional model profile is restricted to isolated localhost research tests; touch/pen are excluded from its unvalidated mouse model. Production remains off with its model disabled; no deployment, merge or production collection was performed. See `LAVAGUARD_PHASE2_RESULTS.md` for current trust boundaries and reproduced bypasses.

The passkey/UI suite explicitly runs in shadow mode. Independent enforcement tests use a separate real Worker in both ordinary and opt-in model profiles, with no mocked security verdicts. Model-profile automated inputs receive FLAG; ordinary profile inputs can proceed to passkeys. Fabricated plausible summaries can obtain options in both profiles, but not authenticated sessions. Login-options without clearance returns 403.

Shadow CLEAR means observation. API `assessment` distinguishes `shadow`, `protocol`, `evaluated`, `disabled` and `accessible`; the UI says Interaction recorded for shadow, Ring cleared for disabled, and Continue with a passkey for the alternative. All other CLEAR labels are neutral Ready to sign in. No current mode asserts human detection.
