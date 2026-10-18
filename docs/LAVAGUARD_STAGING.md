# Controlled staging and rollback

No deployment or remote resource creation was performed. The `staging_protocol` and `staging_shadow` targets in `wrangler.toml` are reviewable drafts using deliberately invalid hostname placeholders. Existing local/production RP IDs, DO class names and migration tags were preserved. A deployment will create environment-specific remote resources; that requires explicit owner approval.

| Profile | Protocol | ML | Optional verification | Data/activation |
| --- | --- | --- | --- | --- |
| Normal local | enforce | shadow, legacy baseline | off | Disclosed aggregate summaries, bounded metrics; no raw upload |
| Local research | enforce | `research_enforce`, explicit selected version | off unless explicitly configured | Only localhost automatically qualifies for research; not a human-accuracy claim |
| `staging_protocol` | enforce | off | off | Owner-approved host and deployment required |
| `staging_shadow` | enforce | shadow | off | No access changes from model score; owner-approved disclosure and deployment required |
| Approved staging research | enforce | research_enforce | optional | Requires `LAVAGUARD_ENVIRONMENT=staging` and `LAVAGUARD_RESEARCH_APPROVED=1`; neither is activated in the drafts |
| Production default | off | off | off | Lab and aggregate metrics disabled; no movement enforcement |
| Future production enforcement support | enforce | production_enforce | optional | Requires separate `LAVAGUARD_ENVIRONMENT=production` and `LAVAGUARD_PRODUCTION_ML_APPROVED=1`; do not enable based on current evidence |

`LAVAGUARD_MODEL_VERSION` selects the existing `lava-logistic-experimental-v1` or experimental `lava-robust-logistic-v2` independently of policy version `lava-policy-v4`. Unknown model versions produce no estimate. The deprecated local `LAVAGUARD_EXPERIMENTAL_MODEL=1` flag still selects local research enforcement when no explicit ML mode is supplied. An explicit ML `off`/`shadow` overrides it. The new candidate is not selected by default or automatically promoted.

Before any deployment, the owner must review exact hostname/ORIGIN/RP ID settings, resource/billing implications, privacy notice, traffic budget and rollback operator. Use fresh staging accounts/passkeys and environment-specific admin credentials, never production credentials. Do not copy the public localhost test credentials into staging. There are no default real Turnstile or administrator secrets in this repository. This task does not require requesting production credentials.

Optional Turnstile requires `LAVAGUARD_STEP_UP=turnstile`, `TURNSTILE_SITE_KEY` and a server-only `TURNSTILE_SECRET_KEY` supplied by the environment's operator. Use same-origin HTTPS and the intended hostname. Real Siteverify responses must match that hostname, action `lava_guard`, the random pending attempt ID in `cdata`, success, and token age. Keep pre-clearance off unless separately reviewed: application clearance does not create or replace Cloudflare's `cf_clearance` cookie. Widget display cannot replace WebAuthn.

The CSP exception permits only `https://challenges.cloudflare.com` scripts/frames when step-up is enabled. Assets pass through the Worker so it can set the conditional response header; default responses retain the original restrictive asset CSP. No inline scripts, eval or general external-script permission was added. Disabled mode does not fetch Turnstile. A required verification with absent configuration or failed service does not issue clearance. Retry/cancel and the explicit accessible journey remain available; an existing required verification follows the context into the accessible journey.

Local integration tests use Cloudflare's **public test credentials**. The test response uses `example.com` and omits meaningful action/cdata, so the exception additionally requires `LAVAGUARD_TURNSTILE_TEST=1`, localhost and Cloudflare's testing-key metadata. Such credentials are rejected outside localhost. Dummy widgets repeatedly return the same token; server-wide replay protection deliberately prevents repeated successful use within its five-minute token-hash window. Use a fresh isolated test store for another positive dummy-key test.

Smoke checklist after an explicitly approved deployment:

- Confirm staging hostname, `Origin`, RP ID and all cookie flags. Verify staging passkeys do not authenticate as production accounts.
- Confirm direct options without clearance fail; valid clearance redeems once; replay, wrong context, wrong scope and parallel evaluation fail appropriately. Verify a fabricated-summary regression still demonstrates the documented trust limitation without a session bypass.
- Register, sign in and sign out with a real staging authenticator. Exercise separate UV/signature/counter verification, cancellation and expired challenges.
- Check original circle, mobile/desktop, keyboard alternative, no-WebGL, freeze and reduced-motion flows. Optional provider failure must not yield a token or session.
- Keep model shadow. Inspect admin-only aggregates, versions and latency buckets, and verify Lab/reasons/thresholds are unavailable publicly.
- If optional verification is separately approved, verify real hostname/action/cdata binding, expiration and fresh-token retries with real staging credentials. Public test keys do not establish this live-account integration.
- Verify deletion, retention alarms and operational metric expiry. No raw research traces, session credentials or network identity fields may enter operational metrics.
- Start at low concurrency with an agreed abort criterion for rising latency, 503s, 500s, inaccessible alternatives or elevated legitimate-user retries. Local measurements are not edge capacity.

Rollback needs approval to modify a deployed environment, just as deployment does. First set `LAVAGUARD_ML_MODE=off`, `LAVAGUARD_EXPERIMENTAL_MODEL=0`; use the previous `LAVAGUARD_MODEL_VERSION` if reverting an explicitly reviewed candidate while remaining shadow. Set `LAVAGUARD_STEP_UP=off` for a deliberate provider rollback; do not silently turn it off on service failure. Existing short-lived pending verifications expire, and new attempts follow the operator-selected policy. Preserve WebAuthn checks and rate/request-size controls.

If the gate itself causes an availability incident, an operator can explicitly restore `LAVAGUARD_MODE=off`, `LAVAGUARD_ML_MODE=off`, step-up off, metrics off and Lab off, then run the off-mode privacy/authentication smoke. This restores options without LavaGuard clearance while maintaining mandatory passkey verification. Expired tokens/nonces remain invalid; no schema rollback is required for the additive guard tables. A full binary rollback to a pre-hardening Worker must preserve DO migrations and be reviewed separately. Never remove server randomness, relax cookie flags or bypass assertion verification as rollback.

Recommendation: conditional readiness for a small, explicitly approved **protocol/shadow-only staging pilot**, with operator monitoring and a traffic budget. Do not enable production ML, deploy Turnstile with untested real configuration, or infer per-user accuracy from the public corpus. No deployment is authorized by this document.
