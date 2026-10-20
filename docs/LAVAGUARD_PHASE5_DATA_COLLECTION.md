# Phase 5 local data protocol

No real participants were recruited or collected during implementation. Genuine application-human participants and attempts: **0**. Recruitment, remote collection and deployment require separate owner approval. This document prepares a future approved study; completing it does not constitute approval.

## Consent and devices

In a local Lab-enabled instance, read the optional study notice before starting. Participation is independent of sign-in. Decline and the accessible passkey route remain available. Explicitly select mouse, trackpad, touch, pen, assistive input (`assisted`) or unknown; confirm acquisition and label. Do not infer a device from pressure or automation status. Leave uncertain labels unlabeled. Use a random study code, never a name, email or account identifier, and preserve that code across the participant's devices/retries. A page session is generated automatically; each attempt has a new research ID.

Opt in before the attempt. Earlier movement cannot be recovered through late consent. Browser memory holds at most 32 records and each trace at most 1,024 normalized points over a bounded attempt. Exports contain in-ring pointer/timing/target observations, viewport/capture settings and declared provenance. They exclude account, camera, cookie, passkey, nonce and clearance data. Samples are captured only during the active interaction. No upload endpoint exists. Page close/withdrawal clears the research recorder; downloaded files require separate removal.

Record completion, cancellation, retry, expiry, network failure, accessible-route use and abandonment. Retain incomplete and unknown records for an exclusion audit. Do not use CLEAR, successful WebAuthn, `isTrusted`, a regular browser or a participant code as a verified humanity label. Browser automation with a human moving the mouse is a distinct takeover condition and must be recorded honestly.

The page provides latest-attempt and whole-session downloads, schema-quality feedback, decline/withdraw, and deletion of local research/current server attempt history. Deleting server history does not revoke passkeys or established account sessions. Sampling controls are 16/32/64 ms; these are requested minima, not proof of equal actual acquisition cadence.

## Reproduction (PowerShell, repository root)

```powershell
npm ci
# Existing environment, or create it once:
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml\requirements.txt
npm run dev
```

The existing local profile enables the Lab. Production does not. Check `/api/lavaguard/config`: use advisory model mode and the ordinary accessible/passkey flow. Save approved exports only in ignored `ml/private/`. Research labels and generator fields are entered before capture.

```powershell
npm run ml:import-consenting -- --validate-only ml/private/my-approved-export.json
npm run ml:import-consenting -- ml/private/my-approved-export.json
npm run ml:phase5:features
npm run ml:phase5
# Once independently justified, development experiments still exclude final cohorts:
npm run ml:phase5 -- --experiments --variants ml/private/phase5/perturbations.json
```

The importer accepts explicit filenames or bounded v3 batches. Reimporting an attempt is rejected; this prevents silent duplicate evidence. Raw copies, records, manifest and audits remain in `ml/private/phase5/`. The evaluator requires the import-generated manifest for existing CLI datasets. Invalid records block fitting; incomplete records remain audited. Public summaries contain no individual study identifiers or raw coordinates.

Explicit v2 migration uses `--migrate-v2 ml/private/migration.json`. Its `lava-study-migration-v1` object has an `attempts` map keyed by original attempt, each with verified `session`, `consentProvenance`, `capture`, `generator` and `outcome` fields from the v3 schema. If these facts cannot be established, exclude the old export instead of reconstructing consent.

## Declared browser automation

Run only against this project's local Lab; the script rejects other hosts and requires shadow ML. Start an isolated server:

```powershell
npx vite build --outDir .cache/phase5-app
npx wrangler dev --port 8791 --assets .cache/phase5-app --persist-to .wrangler/phase5-research-local --var ORIGIN:http://localhost:8791 --var LAVAGUARD_MODE:enforce --var LAVAGUARD_EXPERIMENTAL_MODEL:0 --var LAVAGUARD_LAB:1 --var LAVAGUARD_STEP_UP:off
# In another terminal:
npm run ml:phase5:capture
```

Fifteen case types, seeds 1001/1002: linear, constant-speed, random, Bezier, variable velocity, corrections, pauses, Ghost Cursor, actual Puppeteer, reactive bubble pursuit, synthetic replay, DOM synthetic events, cadence16, cadence64 and coordinate scaling. Related cadence/scale/replay paths share lineage; case counts do not imply independent families. All exports are labeled automation. No human path is replayed without separate consent.

Each case measures actual ring outcome, server verdict, clearance presence, protected options HTTP status and session HTTP status. A failed or unfinished task is not successful detection. A 200 options response is not authentication. Harness errors remain in evidence; retries are new attempts. Runtime physics is not deterministic even with seeded generators. Preserve the public capture report before another run if its historical comparison is needed.

## Retention and withdrawal

For a future approved study, agree on access, retention duration, participant contact/withdrawal process and backup deletion before enrollment. This implementation deliberately schedules no recruitment, retention service or automatic upload. Restrict private folder permissions and avoid cloud-syncing it. Study codes and detailed motion can be identifying; do not call them anonymous.

```powershell
# Review a deletion plan first (no mutation):
npm run ml:phase5:withdraw -- --participant STUDY_CODE
# Explicit application after reviewing the plan:
npm run ml:phase5:withdraw -- --participant STUDY_CODE --apply
npm run ml:phase5
```

Withdrawal removes matching owned raw exports/batches and private JSONL rows, invalidates known/custom Phase 5 reports/candidates, revokes dataset/participant/attempt hashes and requires retraining. The final-test use lock remains. Outside downloads, copies in backups, unknown file formats and already shared artifacts require manual follow-up. There is no deployed Phase 5 model to revoke. See [security](LAVAGUARD_PHASE5_SECURITY.md).
