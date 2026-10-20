# LavaGuard publication verification — 2026-10-18

This is the README/media publication follow-up, with the subsequently owner-requested Phase 5 **offline starter**. The existing Phase 4 commit `2ec7d3a` and owner-merged PR #1 (`main` at `19aff1b`) were already on GitHub when publication work resumed. Their history was preserved. This follow-up is proposed from `feature/lavaguard` into `main`; no automatic merge or Cloudflare deployment is part of this work.

Published [branch](https://github.com/Yohands123/Lava_Authentication/tree/feature/lavaguard) and [PR #2](https://github.com/Yohands123/Lava_Authentication/pull/2). The PR is open, unmerged and has no automatic merge enabled.

## README claims and corrections

The supplied README remains the main draft. Source and both Phase 4 reports were checked against the authentication routes, randomness, observer, policy/configuration, inference, privacy/export path, package scripts and measured artifacts.

- Public Workers demo: HTTP 200 with the original LavaAuth page; `/api/lavaguard/config` returns 404. The README separates this existing live release from the locally tested LavaGuard runtime.
- Behavioral ML remains advisory in the normal profile. Forged plausible summaries can still obtain clearance/options; independent WebAuthn is mandatory. No human-detection claim is supported.
- Corrected the pipeline description: feature extraction is in the browser, and the Worker validates untrusted summaries. Ordinary continuation is not a measured genuine-user acceptance rate.
- Clarified public-key storage, transient browser samples versus consented retention/export, and the research corpus licensing constraints. No raw research dataset is bundled.
- Specified Node 24 for the SQLite tests and included the explicit isolated-research verification command.
- Replaced the emoji-derived Back-to-top fragment with a named `top` anchor; bounded the three verdict columns. Local image/report paths are relative and case checked.
- The CLEAR/FLAG/BLOCK screenshots use mocked **decision responses** with actual rendering and stirring. They are UI fixtures, not classifier evidence.
- Replaced stale real-result images that said “Human detected” with new real-Worker **shadow** captures saying “Interaction recorded.” Provenance: [capture summary](../ml/artifacts/capture-current.json). A separate fresh real research refusal is in [preview summary](../ml/artifacts/preview-publish.json).

The README's held-out 511/513 accepted human rows, 34/777 logistic detections and 211/777 RF detections match the frozen Phase 4 artifacts. These are corpus rows, not independent application users. No Phase 4 model was refitted or promoted during publication.

## GitHub rendering verification after push

The actual public GitHub branch page was opened in Chromium at 1440px and 390px widths. At each width all eight README images loaded, the three outcome columns fit, the explicit top anchor existed, and the page had no horizontal overflow. The Mermaid flowchart rendered successfully in GitHub's diagram iframe. The expandable gallery was opened to verify its images too.

All eight embedded PNG URLs returned HTTP 200 with `image/png`; downloaded bytes matched the inspected local files by SHA-256. GitHub's GFM API also rendered the README successfully. Local Markdown file/heading/image checks found no missing screenshots or broken local links. The old top fragment was corrected as described above. Browser verification screenshots and its JSON log remain local under ignored `.cache/`.

A further check covered all 20 distinct README file/image/external targets: 19 returned HTTP 200 directly. The external [Cloudflare inspiration article](https://www.cloudflare.com/learning/ssl/lava-lamp-encryption/) returned 403 to the Node fetch client but was successfully retrieved by the web browsing tool at the same URL. It is retained as a valid reference; direct automated availability is the check limitation. No missing repository target was found.

## Actual verification in this follow-up

| Command | Result |
| --- | --- |
| `npm run check` | Both TypeScript targets, ESLint with zero warnings, 86 unit tests in 16 files passed |
| `npm run build` | Passed |
| `npm run test:e2e` | 27 passed, 3.1 minutes; regenerated six verdict fixtures |
| `npm run test:enforce` | 6 passed, ordinary profile |
| `LAVAGUARD_RESEARCH=1` with `npm run test:enforce` | 6 passed, isolated research profile |
| `npm run test:hardening` | 8 passed, including actual official Siteverify test credentials/widget and failure recovery |
| `npm run test:adversarial` on isolated localhost:8782 | 12 cases recorded; six families obtained options, zero credential-free authenticated sessions |
| `npm audit --json` | 0 vulnerabilities reported |
| `python -m unittest discover -s ml -p test_phase5.py -v` | 6 synthetic-only integrity tests passed |
| `python -m unittest discover -s ml -p 'test_*.py' -v` | All 8 Python tests passed (two existing cohort tests plus six starter tests) |
| `python ml/phase5.py` | `NOT_READY_NO_OPT_IN_DATA`; 0 human study codes, 0 bot families; no model promoted |
| Local screenshots | Real shadow captures at 1440×1000 and 390×844; actual research FLAG, no clearance, options 403/session 401 |
| `node scripts/check-publish.mjs` | Local Markdown file/anchor/image paths, case, PNG headers, JSON, excluded-path and credential-pattern checks |

The new adversarial run is stored separately in [adversarial-publish.json](../ml/artifacts/adversarial-publish.json), preserving the frozen Phase 4 browser/model evidence. Random, Bézier, variable-speed, corrections, lognormal and Ghost Cursor obtained advisory CLEAR/options 200. Linear, circle, DOM synthetic and Puppeteer corrections did not complete; unfinished rings are not detector successes. Direct options returned 403; forged verdict fields returned 400; every unauthenticated session remained 401.

Phase 4 load, cleanup, 62-second expiry and offline public-corpus training experiments were **not rerun** for this documentation/starter task. Their existing dated results remain in [security results](LAVAGUARD_PHASE4_RESULTS.md) and [ML results](LAVAGUARD_ML_PHASE4_RESULTS.md). No new throughput or human-accuracy claim is made.

## Screenshot inventory in the published tree

All paths below are real local application captures. Images were visually inspected for private information, debug overlays and incorrect result wording. The two original LavaAuth images remain unchanged. PNGs are approximately 0.3–1.6 MB each; no generated concept art is presented as a screenshot.

| Files | Provenance |
| --- | --- |
| [clear-the-ring.png](media/clear-the-ring.png), [ring-cleared.png](media/ring-cleared.png) | Retained original LavaAuth images |
| [after-landing-desktop.png](media/lavaguard/after-landing-desktop.png), [after-landing-mobile.png](media/lavaguard/after-landing-mobile.png) | Fresh localhost application capture |
| [after-stir-desktop.png](media/lavaguard/after-stir-desktop.png), [after-stir-mobile.png](media/lavaguard/after-stir-mobile.png) | Fresh original interaction, before the verdict |
| [real-clear-desktop.png](media/lavaguard/real-clear-desktop.png), [real-clear-mobile.png](media/lavaguard/real-clear-mobile.png) | Fresh real Worker shadow CLEAR; automated input, not identified humans |
| [clear-1440.png](media/lavaguard/clear-1440.png), [clear-390.png](media/lavaguard/clear-390.png) | Fresh CLEAR visual fixtures; mocked verdict response |
| [flag-1440.png](media/lavaguard/flag-1440.png), [flag-390.png](media/lavaguard/flag-390.png) | Fresh FLAG visual fixtures; mocked verdict response |
| [block-1440.png](media/lavaguard/block-1440.png), [block-390.png](media/lavaguard/block-390.png) | Fresh BLOCK visual fixtures; mocked verdict response |
| [preview-automation.png](media/lavaguard/preview-automation.png) | Fresh actual research refusal; metadata in preview-publish.json |
| [before-stir-desktop.png](media/lavaguard/before-stir-desktop.png), [before-stir-mobile.png](media/lavaguard/before-stir-mobile.png) | Retained historical baseline interaction |
| [retry-first.png](media/lavaguard/retry-first.png), [retry-second.png](media/lavaguard/retry-second.png) | Retained actual isolated research retry demo |
| [erratic-result-1.png](media/lavaguard/erratic-result-1.png), [erratic-result-2.png](media/lavaguard/erratic-result-2.png) | Retained actual erratic-input research refusals; no visible pointer overlay |

Total: 21 screenshots (13 refreshed and eight retained). Two `erratic-motion-*.png` pointer-debug captures and obsolete `preview-live.png` were removed from the current Git tree and ignored; their local copies and prior Git history are preserved. Approved reference illustrations in `design/` remain references only.

## Privacy and staging review

Reviewed tracked filenames/text, aggregate JSON and fixture credentials. Known credential patterns found no actual keys/tokens. Public official Turnstile test keys, synthetic fixtures and the clearly named local-only admin fixture are test material. Credential-pattern checking is not an independent security audit.

No `ml/private/`, raw/normalized corpus, study JSONL, downloaded archive, virtual environment, `.dev.vars`, Worker SQLite/state, build output, browser recording, logs or API credentials are included. The historical dependency-audit artifact was normalized from UTF-16 to UTF-8 JSON; expired challenge IDs were removed from the public erratic summary. Aggregate research artifacts contain counts/model parameters or declared synthetic automation features, not individual human paths.

Existing work was preserved in an ignored `.cache/publish-backup/` archive before README changes. The owner's `README_BACKUP.md` is preserved locally and ignored. The Phase 5 readiness report is generated only at ignored `ml/private/phase5-report.json` by the requested default invocation; no recruitment, consent fabrication or real application fitting occurred. The starter source was copied from the owner-supplied ZIP; its documentation now clarifies that custom `--out` paths are possible and that split membership repeats only for the same group set.

## Production and release boundary

`wrangler.toml` production settings were not changed in this follow-up:

```toml
LAVAGUARD_MODE = "off"
LAVAGUARD_LAB = "0"
LAVAGUARD_EXPERIMENTAL_MODEL = "0"
LAVAGUARD_ML_MODE = "off"
LAVAGUARD_STEP_UP = "off"
LAVAGUARD_METRICS = "0"
```

Production RP ID remains `lavaauth.yohance611.workers.dev`; origin remains `https://lavaauth.yohance611.workers.dev`. No Cloudflare deployment, production activation, remote resource creation or automatic merge was performed. Only local Wrangler Workers and official provider test credentials were used for tests.

There are no tracked `.github/workflows/` files, so this repository defines no GitHub Actions deployment workflow. External Cloudflare Git-build/webhook/account settings were not inspected or changed; review those settings before a future merge or release. The already-merged README draft exists on `main`; this follow-up's corrections, refreshed images and Phase 5 starter reach `main` only if its PR is separately merged.
