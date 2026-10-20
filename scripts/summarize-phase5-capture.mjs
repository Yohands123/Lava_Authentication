import { readFile, writeFile } from 'node:fs/promises';
// This explicit reconciliation retains the first run's failures. Recovery is
// evidence about new attempts, never a replacement label for failed attempts.
const initial = JSON.parse(await readFile('ml/artifacts/phase5-capture-initial.json', 'utf8'));
const recovery = JSON.parse(await readFile('ml/artifacts/phase5-capture-recovery.json', 'utf8'));
for (const row of initial.cases) if (row.error) row.error = row.error.split('\n')[0];
initial.interruption = { exitCode: 1, checkpointedCases: initial.cases.length,
  cause: 'Two cancellation races; final scaled/1002 evaluation response disconnected before checkpoint. Classification unknown for failed attempts.' };
await writeFile('ml/artifacts/phase5-capture-initial.json', JSON.stringify(initial, null, 2)+'\n');
const valid = new Map();
for (const run of [initial, recovery]) for (const row of run.cases) if (!row.error) valid.set(`${row.case}:${row.seed}`, row);
const cases = [...valid.values()].sort((a, b) => a.seed-b.seed || a.case.localeCompare(b.case));
if (cases.length !== 30 || cases.some(c => ![200, 403].includes(c.optionsStatus) || c.sessionStatus !== 401)) throw new Error('Reconciliation requires all 30 measured case/seed pairs.');
const report = { ...recovery, cases,
  history: { initialCheckpoint: 'phase5-capture-initial.json', recovery: 'phase5-capture-recovery.json',
    initialAttemptsStarted: 30, recoveryAttemptsStarted: 3, harnessFailures: 3,
    caveat: '30 retained successful captures from 33 initiated attempts. Three harness failures have unknown classification and are not detection successes.' },
  summary: { retainedCaptures: cases.length, taskCompleted: cases.filter(c => c.taskComplete).length,
    incomplete: cases.filter(c => !c.taskComplete).length, optionsAllowed: cases.filter(c => c.optionsStatus === 200).length,
    authenticatedSessions: cases.filter(c => c.authenticatedSessionObserved).length, actualHumanStudyRows: 0,
    unfinishedRingIsNotDetection: true, noApplicationModelFit: true } };
await writeFile('ml/artifacts/phase5-capture.json', JSON.stringify(report, null, 2)+'\n');
console.log(JSON.stringify(report.summary));
