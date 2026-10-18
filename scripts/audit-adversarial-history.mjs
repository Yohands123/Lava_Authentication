import { readFile, writeFile } from 'node:fs/promises';

const historical = JSON.parse(await readFile('ml/artifacts/adversarial.json', 'utf8'));
const current = JSON.parse(await readFile('ml/artifacts/adversarial-phase2.json', 'utf8'));
const audit = { historicalVersion: historical.version, currentConfiguration: current.configuration,
  caveat: 'Historical browser scores and CLEARs came from a separate synthetic evaluation. They are not the original browser challenge decision. Missing clearance/options observations cannot be recovered retroactively.',
  cases: historical.cases.map(c => ({ family: c.family, seed: c.seed ?? null,
    historical: { ringCleared: c.clearsRing ?? (c.browserState ? c.browserState !== 'STIRRING' : null),
      secondEvaluationModelScore: c.experimentalModel?.experimentalRisk ?? null,
      secondEvaluationDecision: c.actualServerVerdict ?? null,
      originalBrowserDecision: null, originalBrowserClearanceIssued: null,
      protectedOptionsStatus: c.status ?? null, sessionStatus: c.sessionStatus,
      authenticatedSessionBypass: c.sessionStatus === 200 },
    reproduced: current.cases.find(r => r.family === c.family) ?? null })) };
await writeFile('ml/artifacts/phase2-history-audit.json', JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify({ auditedCases: audit.cases.length, historicalUnrecordedFields: 'explicit nulls', reproducedCases: current.cases.length }));
