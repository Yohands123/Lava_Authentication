# Phase 7 sign-in failure behavior

The failure verdict offers fresh retry or Back, never an accessible Continue or Skip. The separate pre-attempt **Use a passkey without stirring** control remains available. Both routes require independently verified WebAuthn; the UI does not authenticate anyone.

CLEAR says **Continue with passkey**. Its permission is bound to the active client generation, expires by wall clock even if a timer is delayed, and is consumed once. Challenge, clearance and optional verification expiry clear permission, abort pending work, cancel stirring, remove temporary evidence and invalidate late callbacks. Terminal failures resolve the waiting attempt. Optional verification can retry a transient provider failure only during its existing bound lifetime; it has no permission until server validation succeeds.

FLAG offers Try again and Back to sign-in. BLOCK offers Back and the server's retry interval. ERROR offers fresh retry and Back. Returning after a cancelled or rejected passkey request starts a new guard and a new WebAuthn challenge. A failed assertion still consumes its server challenge. Existing independently authenticated sessions are not revoked by a failed new attempt.

The original circle, physics, shaders, palette, keyboard accessible entry, reduced motion and no-WebGL behavior are retained. Historical screenshots remain available; `phase7-*.png` are new local visual fixtures with mocked verdicts, not model accuracy evidence. Original screenshots are preserved byte for byte.

Verification is recorded in [the baseline command artifact](../ml/artifacts/phase7-baseline-verification.json). New tests exercise failure actions/focus, fresh retry, wall-clock permission expiry and forged DOM clicks. Real local Worker tests use a virtual WebAuthn authenticator for successful sign-in, cancellation recovery, corrupted signature/replay, altered origin/RP hash and missing UV. Altered signed data is expected to fail; these tests do not claim to generate a cryptographically valid assertion for a different origin. Existing enforcement tests retain rate, clearance, context, origin and replay coverage. Scripted tests are not physical accessibility-device or human usability trials.

No production configuration, WebAuthn verification, challenge entropy, credential storage or cookie flags were changed. GitHub publication is authorized; merging, deployments, human recruitment and production ML activation are excluded by the owner's current scope.
