> **Historical starter reference, superseded October 18, 2026.** The current implementation is documented in [Phase 5 architecture](LAVAGUARD_PHASE5_ARCHITECTURE.md), [collection protocol](LAVAGUARD_PHASE5_DATA_COLLECTION.md), [measured results](LAVAGUARD_PHASE5_ML_RESULTS.md) and [handoff](LAVAGUARD_PHASE5_HANDOFF.md). Do not copy the old starter over the current modules. Split behavior, schemas, model inventory and commands below describe the earlier starter only.

# LavaGuard Phase 5 — Application-Specific ML Research

**State:** Phase 5 starter implementation; not a completed human study, not an independently validated anti-bot detector, and not deployed. Built after reviewing `main` branch on October 18, 2026.

**Principle:** Train and evaluate only on the actual LavaGuard gesture task, using explicitly consented and labeled human attempts and declared automation captured through the *same* frontend instrumentation. Unknown data => unknown performance. No self-reported human study code or browser pointer summary cryptographically proves humanity. WebAuthn/passkeys stay mandatory.

## Why the new Phase 5 files exist

Phase 4 had three useful building blocks already: `src/client/guard/lab.ts` supports opt-in local export, `scripts/import-consenting.mjs` verifies exports and derives the exact frontend feature schema, and `ml/train_application.py` can fit a private logistic candidate if suitable data exists. The Phase 4 dataset has **zero consenting actual LavaGuard human attempts**, so it does *not* justify real-world accuracy.

The new `ml/phase5.py` adds a research gate around that workflow:

- Fails with an explicit **NOT_READY** status when data is absent, consent provenance is invalid, labels are unknown, or bot-generator provenance is incomplete.
- Uses all **12 `lava-robust-v2`** features exported by the already-shared TypeScript extraction path (rather than inventing incompatible Python features).
- Keeps all attempts with one human participant study code in the same cohort, and all attempts of a declared bot generator family in the same cohort. This prevents two crucial forms of train/test contamination.
- Uses a fixed, deterministic **approximately 60% / 20% / 20% grouped** train/calibration/holdout division separately for both labels, with integer rounding and at least one group per cohort. The partition repeats for the same group set; adding/removing groups can change it. Freeze a prospective final cohort before evaluating a growing study.
- Fits a **regularized logistic regression** and a **random forest**; calibrates each on a separate cohort; selects its experimental flag threshold using *calibration humans only*. No held-out threshold selection.
- Trains a **human-only Isolation Forest** as a separate outlier diagnostic—not a bot probability.
- Reports confusion counts, ROC-AUC, PR-AUC, Brier score, device slices, Wilson intervals for **attempts**, a flagged-at-least-once study-code count, and held-out generator-family counts. The report explicitly warns that repeated attempts are not statistically independent and study codes are not independently verified people.
- Defaults to an aggregate report under Git-ignored `ml/private/`. The CLI permits `--out`; keep any override inside that private directory. **Does not export a Worker model, change clearance decisions, run production collection, deploy code, or transmit raw traces.**

**Important:** Eight distinct human study codes and three declared generator families are *pipeline-execution minimums*, NOT a scientifically persuasive population-validation sample size. Very low legitimate-user false-positive claims generally demand substantially more independent users and devices, chosen from a prospective power/sample-size plan. No minimum automatically authorizes enforcement.

## Local setup (Windows PowerShell)

Copy `ml/phase5.py` and `ml/test_phase5.py` into the repository's existing `ml/` folder; copy this file to `docs/LAVAGUARD_PHASE5_IMPLEMENTATION.md`. The pack intentionally does not overwrite your existing Phase 4 model, any current source code, or the original `README.md`.

```powershell
cd C:\Users\yohan\lavaauth\lavaauth

# Use your existing, ignored Python virtual environment or create it:
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml\requirements.txt

# Check the new offline integrity pipeline (synthetic fixtures, NEVER counted as research):
.\.venv\Scripts\python.exe -m unittest discover -s ml -p 'test_phase5.py' -v

# With no genuine consented data, this should truthfully report NOT_READY:
.\.venv\Scripts\python.exe ml\phase5.py

# Review a private report; do not add the report to Git:
Get-Content ml\private\phase5-report.json
```

## How to collect real human examples

1. In normal localhost mode, keep `LAVAGUARD_MODE=enforce` with `LAVAGUARD_EXPERIMENTAL_MODEL=0` and movement models advisory. Do not use the testing WebDriver browser as a stand-in for a real volunteer's ordinary device.
2. Launch `npm run dev` and open `http://localhost:8787` in a regular browser. Open **Lab**. Explain the scope of collection, retention, optionality, withdrawal, and where the export is stored. Recruit *independent consenting volunteers*; do not claim a user consented because the UI returned CLEAR.
3. Check the consent box **before** the interaction. Assign a random 8–64 character study code and keep that code constant across all attempts/devices for the same volunteer. Do not put names, addresses, emails, or passkey material in the code.
4. Choose the real device: mouse, trackpad, touch, pen, assistive or unknown. Select **Human participant** only for genuine self-reported human interaction, not programmatic action. Never make up labels.
5. Have volunteers attempt the actual moving-lava challenge normally, including retries; record *separately and with consent* whether a participant aborted, chose an accessibility alternative, and the wall-clock interaction time. Those broader usability outcomes are **not** automatically available in this model's derived feature rows.
6. Export the attempt locally. Put the consented file under `ml/private/` (ignored by Git). Import it explicitly with `npm run ml:import-consenting -- ml/private/<your-consenting-export>.json`. Use `--validate-only` first if desired. Raw paths stay local and never go into git.
7. Delete raw and derived rows on withdrawal. Review `docs/LAVAGUARD_HUMAN_STUDY.md` before any study involving other people.

## How to capture automation fairly

1. Run *declared* automated interactions through the **real browser UX** using Playwright/Puppeteer/Ghost Cursor and the same front-end feature extraction path—not fabricated feature JSON that could leak generator conventions into the label.
2. Keep separate generator families: e.g. `playwright-bezier-v1`, `puppeteer-variable-speed-v1`, `ghost-cursor-v1`. A family is a source method, **not every random seed or attempt**. All variants of one family remain in the same train/cal/test cohort.
3. Export each declared automation attempt using the local consent research workflow with **Declared automation**, then run the existing `npm run ml:import-consenting -- ...` command. Keep browser-realized successes *and* failed/abandoned attempts, reporting censoring; the model only scores completed feature summaries, not every started attempt.
4. The Phase 4 importer does not retain `generatorFamily` in its derived feature JSONL. **Do not invent families from the label.** Supply a separate ignored, local manifest keyed by each imported attempt ID:

```json
{
  "schema": "lava-phase5-provenance-v1",
  "attempts": {
    "REPLACE_WITH_ACTUAL_AUTOMATION_ATTEMPT_ID": {
      "generatorFamily": "playwright-bezier-v1"
    }
  }
}
```

Save this as `ml/private/phase5-provenance.json`. Only declared bot attempts require a manifest entry. The IDs in the manifest must match the `id` fields inside ignored `ml/private/consenting-features.jsonl`, which are derived from the original export's `attempt` field. Never use the sample placeholder as actual data. Do not count duplicated generator families with different seed values as independent.

5. Once enough real, properly labeled and attributed rows exist, rerun `ml/phase5.py`. An `OFFLINE_CANDIDATES_EVALUATED_NOT_VALIDATED_FOR_DEPLOYMENT` status **is not a production go-ahead**; it only means a descriptive report could be calculated.

## Prioritized further Phase 5 experiments (not yet shipped in this starter pack)

**A. Clinical-grade dataset audit adapted to security research.** Preserve consent revision, participant-level withdrawal, session provenance, generator version, genuine task completion, failed-attempt censoring, and real input device. For labels, human self-report is still unverified, and an attacker can evade a browser-side label; report those limitations.

**B. Strict holdout and transfer studies.** Reserve entire real study codes, device strata, collection dates, and automation families; run repeated group splits *only on development cohorts*. Keep one untouched predeclared final human/automation test group. Analyze leave-one-family-out and unfamiliar screen scale/cadence. Do not rerun hyperparameter search on the final holdout.

**C. Dynamic challenge-response features.** Investigate whether people genuinely react to moving bubble changes: time to first pursuit, correction after target movement, overshoot/replanning relative to wax position. Compare with target-independent cursor features. Use the existing local `bubbleResponse` and `targetId` signals, but ensure any claimed feature is extracted and normalized identically in both human and bot captures. All client-claimed features can still be forged; a server nonce cannot prove that a particular path happened.

**D. Evidence-based model comparison.** Baseline against no behavioral model, simple heuristic, logistic regression, RF and perhaps gradient boosting *only after data is sufficient*. Track false flags on actual device/assistive cohorts, per-person retries, completion/abandonment, CPU/inference latency, calibration, threshold stability, and unfamiliar automation. Tune a threshold only on training/calibration. Prefer simplicity if gains disappear under a matched held-out collection.

**E. Phase 5 graduation criteria.** Establish a prospective target use case, independently consented participants and representativeness plan, sufficient confidence intervals, no accessibility penalty, no unexpected account/session bypass, reproducible per-fold results, tested deletions/retention, code checks and unchanged passkeys. Unmet criteria => **research-only, shadow inference**, regardless of apparent ROC-AUC. The project can advance technically even when the scientifically responsible result is “model not ready.”

## Threat boundary and operational warnings

- A client can forge aggregates, coordinates, timestamps, `navigator.webdriver`, `isTrusted` information and apparent bubble responses. ML may be useful as weak risk evidence; it cannot verify physical human presence. Forge-a-plausible-summary bypass demonstrated in Phase 4 remains a documented open issue.
- Legitimate user motion varies across disabilities, assistive devices, browser settings, input hardware, age, fatigue and environment. Do not enforce a cursor classifier for unstudied devices or treat smoothness alone as a bot.
- Passkeys and cryptographically secure server randomness remain mandatory. This phase must not touch the authentication verification boundary.
- The linked public Cloudflare demo still may be on the original LavaAuth release. GitHub commits and offline training do not deploy Workers or update Vercel/Cloudflare automatically.
- `ml/private/` is ignored in the current repo `.gitignore`. Check staged filenames anyway; **never** commit consented individual traces or model reports that could reveal study participants.

## Expected real results right now

As of the reviewed Phase 4 reports: **0 opt-in LavaGuard human samples**, no held-out application model validation. That means `ml/phase5.py` should initially report **NOT_READY**, rather than inventing a score. The six accompanying unit tests contain only synthetic fixture vectors, and their passing status establishes program logic—not bot/human performance.

## Verified source files

- https://github.com/Yohands123/Lava_Authentication/blob/main/src/client/guard/lab.ts
- https://github.com/Yohands123/Lava_Authentication/blob/main/scripts/import-consenting.mjs
- https://github.com/Yohands123/Lava_Authentication/blob/main/ml/train_application.py
- https://github.com/Yohands123/Lava_Authentication/blob/main/ml/phase4.py
- https://github.com/Yohands123/Lava_Authentication/blob/main/docs/LAVAGUARD_ML_PHASE4_RESULTS.md
- https://github.com/Yohands123/Lava_Authentication/blob/main/docs/LAVAGUARD_HUMAN_STUDY.md
