# Datasets, provenance and reproduction

Current Phase 5 local study data uses strict `lava-consent-v3` / `lava-study-record-v3`, canonical byte-hashed manifests, explicit bot family/run/replay lineage, participant-aware frozen cohorts and withdrawal revocations. See the [current protocol](LAVAGUARD_PHASE5_DATA_COLLECTION.md) and [dataset audit](LAVAGUARD_PHASE5_ML_RESULTS.md). Actual local data: 30 declared automation exports, 20 eligible, 10 incomplete; **0 real-human attempts**. Raw/derived data stays in ignored `ml/private/phase5/`. The public-corpus and Phase 2 details below remain historical; that corpus has not been relabeled or imported as application-human evidence.

`ml/datasets/manifest.json` contains inspected sources, label semantics, access/license notes, revision, byte counts and SHA-256 hashes. Restricted/unclear sources have no raw download loader. Training inputs and optional consenting exports are excluded from Git under `ml/private/`.

DELBOT revision `712a00ea994738b680b0b11bb4b518979385d07b` supplies `python/dataset.tar.gz` and `python/sessions.json`. The MIT repository license is retained in `ml/THIRD_PARTY_NOTICES.md`. No separate dataset-specific grant was located: this experiment interprets the repository grant for local research, does not redistribute its raw data, and makes no claim about suitability for commercial biometric processing. Review dataset permissions before any broader use.

The loader verifies fixed SHA-256 values before parsing. It streams files from the tar archive without extracting filenames, ignores links and large members, uses the upstream human/bot map, parses `time,type,x,y` after the resolution header, removes nonfinite rows, normalizes spatial extent, samples at least 32 ms apart, and caps at 1,024 points. Spatial extent normalization differs from the application's ring-diameter normalization; this domain shift is an explicit limitation. Labels are never inferred from an authentication impostor label.

Observed archive counts: 955 human and 2,596 generated trajectories. Feature-ready counts are lower after short-window filtering. `scripts/extract-features.mjs` uses the exact TypeScript browser extractor, adds 280 labeled local synthetic traces from seven seeded families, and writes only private feature rows. Exact duplicate feature vectors are removed before splitting.

`ml/train.py` holds out pc2 and pc2_pad human folders plus GAN, local Bézier and local lognormal families. VM humans and pyhm generators are reserved for calibration; remaining groups train the models. Folder groups prevent direct session/folder overlap, but cannot establish unique participant identities or independent hardware. `ml/artifacts/evaluation.json` is the measured report; `logistic-experimental.json` and its generated TypeScript counterpart default to disabled. Following the owner's passing-preview correction, localhost can explicitly opt into FLAG decisions; configuration prohibits that opt-in outside localhost. The parity fixture is generated input, never a human trace. `tests/fixtures/automated-preview-summary.json` is a later synthetic browser regression capture, excluded from model training; it has no raw coordinates, nonce, credentials or clearance.

Run from this repository on Windows:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r ml/requirements.txt
python ml/ingest.py --download-delbot
npm run ml:features
.venv\Scripts\python ml/train.py
```

On Unix use `.venv/bin/python` for the Python commands. Node 24 is required for SQLite security tests. `npm ci` installs the exact browser/test tool versions. Corpus hashes, split seed `20261017`, generator seeds and model package versions are recorded. Timing measurements vary by machine.

For consenting application-specific research, open the local developer Lab, enable the research-export consent checkbox before starting an attempt, then export. No upload endpoint exists. Exports default to **unlabeled**; a researcher's script or movement must never be called a real human label. Unchecking consent immediately forgets the retained trace. The delete action clears local views and current server context history. Detailed data should be stored privately with participant consent, retention/deletion procedures, and independent participant/session/device splits before model promotion.

Phase 2 adds `npm run ml:validate` for generator-family holdout, ablation, calibration, cadence matching, StirMeter and target-response controls. It never promotes a model. Normal localhost model enforcement is now disabled after the owner's human retry report; strict activation belongs only to isolated research tests. The [local study guide](LAVAGUARD_HUMAN_STUDY.md) documents ephemeral participant codes, actual input-device selection, self-reported labels and explicit private import. Participant-disjoint and real human cross-dataset results remain unavailable until consenting exports exist. Do not fabricate them.
