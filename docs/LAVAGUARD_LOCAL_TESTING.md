# Your reusable LavaGuard test server

Open **http://localhost:8792** for the local control panel. It launches visible automation against the real app and keeps the most recent 100 redacted results and screenshots on this computer. It runs while the server terminal/process is open; nothing was hosted or deployed remotely.

## Start it whenever you want

Double-click **`Start-LavaGuard-Testing.cmd`** in the repository folder, or run:

```powershell
cd C:\Users\yohan\lavaauth\lavaauth
npm run test:live
```

First-time setup, if dependencies/browser are missing:

```powershell
npm ci
npx playwright install chromium
```

The command builds and starts missing local Workers, serves the panel, and opens its own visible browser. To open it yourself in your everyday browser, use `npm run test:live -- --no-open`, then visit http://localhost:8792. An existing compatible server is reused and left untouched; incompatible occupied ports cause an explicit startup error. The server never silently changes another process's configuration.

| Address | Purpose |
| --- | --- |
| http://localhost:8792 | Controls, live progress, retained results, screenshots and JSON download |
| http://localhost:8787 | Normal app: protocol enforcement, ML observation; preferred for manual usability tests |
| http://localhost:8791 | Isolated research app: enforcement by the **older experimental corpus model** |

These local profiles do not change `wrangler.toml` or production settings. The research profile can reject people and can miss bots. It is a comparison tool, not a trained Phase 5 application model. Keep one participant's manual attempts in an ordinary browser; the automation browser continues to identify itself as automated even when a person moves its mouse.

## Use the controls

1. Select the normal or research profile.
2. Pick a pattern and seed. **Watch this bot** opens the actual automated cursor in a visible browser. The circle, physics and verdict are supplied by the real application.
3. **Run all patterns** runs the full 16-pattern suite. Repeats can be 1–3; repeats change the seed deterministically. At most 48 attempts run in one job, with a cooldown between them. You can launch another job whenever it finishes.
4. **Stop** interrupts the active attempt and cancels the remaining queue. A stopped attempt earns no detector credit. You can rerun immediately after shutdown of that attempt completes.
5. Download the aggregate JSON or inspect each result and the latest actual screenshot. Completed attempts stay visible in the browser until the next run. An unfinished ring may keep animating; the next run closes that isolated context.

The original fast demo is exactly the existing `automatedStir` attack, without an artificial per-point delay. Other patterns reuse the Phase 5 generator research: straight lines, constant-speed circles, erratic jumps, Bezier curves, variable speed, corrections, pauses, Ghost Cursor, **actual Puppeteer**, reactive moving-bubble pursuit, seeded replay, synthetic DOM events, 16/64 ms sampling and coordinate scaling/translation. The replay/cadence/scale families retain their declared lineage. A seeded path does not make browser timing or the lava simulation deterministic.

The popup is presentation-marked as automation. No API response, ring outcome or detector verdict is mocked. The runner fills explicit automation provenance before capture; transient Lab samples remain in the isolated page and are not exported or imported into the study dataset. No virtual passkey or account is created.

## Read the results honestly

The table separates ring completion, actual server verdict, clearance, protected-options HTTP status and session HTTP status. Reasons and the selected model version appear with the screenshot.

- **Incomplete ring:** the task was not completed; this is not successful bot detection.
- **CLEAR + clearance:** automation got through the behavioral gate. This remains visible as a miss even in research mode.
- **FLAG/BLOCK:** the server flagged/restricted this attempt. Inspect its reasons; protocol restrictions are not automatically ML successes.
- **Options 200:** a clearance was accepted for options. The automated probe redeems that one-use clearance, so its displayed Continue button cannot reuse it afterwards.
- **Session 401:** no authenticated session exists. Passkey failure is not credited to the bot detector.
- **Stopped/error:** the attempt is retained with unknown detection outcome. Browser closure, timeouts and network errors are not converted into a successful refusal.

Human classification accuracy remains unknown. No genuine consenting human training samples have been added. Normal observation mode deliberately does not apply model refusals. The older research model is kept explicitly labeled and can expose acquisition/sampling sensitivity; seeing it flag one fast script does not establish generalization or acceptable human false-positive rates.

## Local storage and shutdown

Only redacted result fields are persisted in `.cache/test-console/history.json`. Actual screenshots are in `.cache/test-console/screenshots/`; older screenshots are pruned to the retained history. Both are ignored by Git. No raw trajectory, challenge, clearance token, cookie, credential or account data is persisted in these reports. Screenshots show the test app, so keep this test window separate from personal authenticated activity. A JSON download remains a separate local copy under your control.

The tool binds its control API to loopback, requires the exact local Host/Origin and a per-process token for actions, bounds job/body sizes, and never accepts an arbitrary URL, command, file path or remote target. Another website cannot use the control API to launch browser work through ordinary cross-origin requests. The browser side includes a restrictive CSP. This is a local development tool; it has no remote login or internet-facing administration mode.

Close the terminal or press Ctrl+C to stop the test console. Servers it started are stopped as a process tree; servers it reused remain running. Logs and local Worker state are ignored under `.cache/test-console/` and `.wrangler/test-console-*`. These are bounded test controls, not a production always-on service. Use the launcher again after reboot.

## Verification

`npm run check` includes 16 Node console tests and 118 TypeScript tests after the environment-evidence extension, plus type checking and linting. Run the console tests alone with `npm run test:console`. Tests cover fixed-target/job validation, secret/raw-data redaction, advisory environment metadata, bounded history, stop/queue behavior, origin/token/Host checks, body limits and screenshot traversal. The original application authentication code, physics, result UI and production flags are unchanged.

Actual browser verification results for this follow-up are recorded in `docs/LAVAGUARD_LOCAL_TESTING_RESULTS.md`. Historical Phase 5 study counts and measurements remain in [Phase 5 results](LAVAGUARD_PHASE5_ML_RESULTS.md); test-console runs are not silently added to that dataset.

## Automation environment follow-up

New console attempts explicitly declare their driver, display and scripted control. The latest result includes only the consented, versioned advisory environment snapshot; older history retains unknown/missing evidence. No console result can identify the operator from these hints. Manual Lab exports also support human-controlled automation declarations. See [measured coverage and limitations](LAVAGUARD_AUTOMATION_ENVIRONMENT.md). Run `npm run test:environment` for the isolated ten-configuration observability experiment, rather than interpreting console pattern success as environment detection accuracy.
