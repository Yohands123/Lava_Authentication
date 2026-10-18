"""Frozen candidate scoring of newly captured, declared automation. No training."""
import json
import numpy as np
from train import ROOT
artifact = json.loads((ROOT/'ml/artifacts/robust-logistic-v2.json').read_text())
browser = json.loads((ROOT/'ml/artifacts/adversarial-phase4.json').read_text())
cases = []
for case in browser['cases']:
    captured = case.get('capturedFeatures')
    robust = captured.get('robust') if captured else None
    if not robust or robust.get('version') != artifact['featureVersion']:
        cases.append({'family':case['family'], 'status':'no_evaluated_capture_not_a_detector_success'})
        continue
    x = np.log1p(np.array([robust['features'][k] for k in artifact['features']]))
    z = ((x-np.array(artifact['mean']))/np.array(artifact['scale']))@np.array(artifact['coefficients'])+artifact['intercept']
    risk = float(1/(1+np.exp(-np.clip(z*artifact['calibrationSlope']+artifact['calibrationIntercept'],-40,40))))
    ood = bool(((x<np.array(artifact['trainingMinimum'])-.01)|(x>np.array(artifact['trainingMaximum'])+.01)).any())
    cases.append({'family':case['family'],'automationDeclared':True,'riskScore':risk,'overResearchThreshold':risk>=artifact['researchThreshold'],'outOfDistribution':ood,
                  'actualServerVerdict':case.get('actualServerVerdict'),'clearanceIssued':case.get('clearanceIssued'),'optionsStatus':case.get('protectedOptionsStatus'),'sessionStatus':case.get('sessionStatus')})
report = {'modelVersion':artifact['version'],'trainingUsedTheseCaptures':False,'sameSharedCaptureExtractor':True,'realHumanN':0,'cases':cases}
(ROOT/'ml/artifacts/phase4-browser-model.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'cases':len(cases),'evaluated':sum('riskScore' in c for c in cases),'humanN':0}))
