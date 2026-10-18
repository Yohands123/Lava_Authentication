# Local consenting LavaGuard study

Normal localhost development uses protocol enforcement with movement classification advisory. Production remains off. The experimental classifier must not reject study participants: leave `LAVAGUARD_EXPERIMENTAL_MODEL=0`. Use a regular browser for participant trials. A Playwright demo browser reports WebDriver even when a person takes over; that hint now remains advisory.

Open `http://localhost:8787`, open the existing Lab, and read the local research notice. Participation is optional; the separate passkey route remains available. Before starting an attempt, check consent. The page creates a random study code in memory. A study coordinator may instead supply a random code of 8–64 letters, digits, underscores or hyphens. Never enter names, email addresses or account identifiers. Reuse the same code across this study's attempts and devices so one participant cannot appear in both fitting and evaluation groups. No code is stored in cookies or localStorage. Closing the page loses it; keep the study's code mapping under the participant's control, outside this repository.

Select the actual device (mouse, trackpad, touch, pen, assistive input or unknown). Select a research label deliberately; it defaults to unlabeled. Human labels are self reports, not attestation. Automated validation uses the declared automation label and must never enter human acceptance counts.

Close Lab before stirring so it does not change the working area. Clear the original ring normally. An opt-in before the attempt is required for retaining an export. Consent checked after completion cannot recover an earlier trace. Export contains only the current attempt: bounded normalized ring-area pointer coordinates, relative timing, event attributes, local bubble targets/IDs, study/device/label provenance, extracted response measurements and decision diagnostics. It excludes account IDs, passkey material, cookie contexts, clearance tokens, absolute event timestamps, camera frames and unrelated pointer activity. Target IDs are local object identifiers, not user identities.

Raw samples remain in memory; the export is a local JSON download. No automatic raw upload occurs. Ordinary local evaluation still sends the previously disclosed aggregate features and hashes to the local Worker. The Worker retains behavioral history for ten minutes; operator review audit expires after 24 hours. These summaries are client claims. Neither a classification nor a research label proves who performed the gesture.

Unchecking consent clears retained research. Starting another attempt replaces the retained attempt. Delete clears research, plots and study code and requests deletion of the current server context. A failed server deletion is reported honestly. Page hide clears the retained research. Downloaded files require separate deletion from the filesystem; delete both raw exports and derived rows for a withdrawing participant. No raw study exports belong in Git.

For explicit offline import, save chosen consenting exports in the ignored `ml/private/` directory and run:

```powershell
npm run ml:import-consenting -- ml/private/participant-attempt.json
npm run ml:validate
```

The importer rejects absent consent, unlabeled traces and invalid IDs, deduplicates attempt IDs, and writes only derived feature rows to `ml/private/consenting-features.jsonl`. It does not transmit the files. Delete that participant's rows when withdrawing consent, and rerun evaluation. The validator supports DELBOT-to-application scoring and participant-disjoint splitting when at least four participant codes exist. It reports unavailable experiments when labels/groups are insufficient. Dataset labels remain self reported and separate from the public corpus. Do not automatically retrain or promote a model from these exports.

Use `npm run ml:import-consenting -- --validate-only ml/private/participant-attempt.json` to check an export without writing any derived rows.

Collect multiple fresh attempts across devices and include genuine failure/retry cases, explicit alternative usage and declared automation controls. Keep all attempts from one participant on the same side of evaluation. Report participant counts, uncertainty, device-specific rejection, abandonment and extra time before choosing a policy. Short public circle trajectories are not measurements of acceptance on this task. Four reported retries are evidence of a usability failure, not a measured population false-positive rate. No consenting human measurements were available during Phase 2 implementation.
