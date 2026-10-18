"""Consent-only application trainer. Private artifacts, three participant cohorts.
Run after recruitment; never infers human labels from a CLEAR result."""
import hashlib
import json
import numpy as np
from sklearn.model_selection import GroupShuffleSplit
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from train import ROOT, SEED
from phase4 import KEYS, quality


def cohorts(rows):
    groups = [r['participant'] for r in rows]
    splitter = GroupShuffleSplit(n_splits=1, test_size=.25, random_state=SEED)
    remaining, test = next(splitter.split(rows, groups=groups))
    second = GroupShuffleSplit(n_splits=1, test_size=1/3, random_state=SEED+1)
    fit_idx, cal_idx = next(second.split(remaining, groups=[groups[i] for i in remaining]))
    fit, cal = [int(remaining[i]) for i in fit_idx], [int(remaining[i]) for i in cal_idx]
    held = [int(i) for i in test]
    sets = [{groups[i] for i in part} for part in [fit, cal, held]]
    assert not (sets[0] & sets[1] or sets[0] & sets[2] or sets[1] & sets[2])
    return fit, cal, held


def main():
    path = ROOT/'ml/private/consenting-features.jsonl'
    rows = [json.loads(s) for s in path.read_text().splitlines() if s] if path.exists() else []
    rows = [r for r in rows if r.get('robust', {}).get('version') == 'lava-robust-v2' and r.get('labelProvenance') == 'self-report-not-attested']
    participants = {r['participant'] for r in rows}
    report = {'applicationRows': len(rows), 'participants': len(participants), 'promoted': False, 'labels': 'Consenting participant/researcher declarations, not cryptographic ground truth'}
    if len(participants) < 8:
        report['status'] = 'unavailable_need_at_least_eight_participants'
    else:
        parts = cohorts(rows)
        report['cohorts'] = {name: {'rows':len(part), 'participants':len({rows[i]['participant'] for i in part}), 'devices':sorted({rows[i]['device'] for i in part})} for name, part in zip(['train','calibration','test'],parts)}
        report['participantOverlap'] = False
        labels = lambda indices: np.array([rows[i]['label']=='bot' for i in indices], dtype=int)
        if any(len(set(labels(p))) < 2 for p in parts):
            report['status'] = 'unavailable_two_labels_required_in_each_preassigned_cohort'
        else:
            fit, cal, test = parts
            x = np.log1p(np.array([[r['robust']['features'][k] for k in KEYS] for r in rows]))
            signatures = [tuple(vector) for vector in x]
            overlaps = set(signatures[i] for i in fit) & set(signatures[i] for i in cal+test)
            if overlaps:
                report['status'] = 'unavailable_cross_cohort_duplicate_features_review_required'
            else:
                model = make_pipeline(StandardScaler(), LogisticRegression(C=.1, class_weight='balanced', max_iter=3000, random_state=SEED))
                model.fit(x[fit], labels(fit))
                calibration = LogisticRegression(random_state=SEED)
                calibration.fit(model.decision_function(x[cal]).reshape(-1,1), labels(cal))
                cp = calibration.predict_proba(model.decision_function(x[cal]).reshape(-1,1))[:,1]
                human = np.sort(cp[labels(cal)==0]); allowed = int(len(human)*.01)
                threshold = float(np.nextafter(human[-allowed-1],1.))
                p = calibration.predict_proba(model.decision_function(x[test]).reshape(-1,1))[:,1]
                report['status'] = 'private_candidate_fit_requires_independent_review'
                report['test'] = quality(labels(test),p,threshold)
                report['devices'] = {d: quality(labels(test)[mask],p[mask],threshold) for d in sorted({rows[i]['device'] for i in test}) if (mask := np.array([rows[i]['device']==d for i in test])).any()}
                report['datasetHash'] = hashlib.sha256(path.read_bytes()).hexdigest()
                scaler, classifier = model.steps[0][1], model.steps[1][1]
                private = {'version':'lava-application-review-'+report['datasetHash'][:12], 'enabled':False, 'features':KEYS, 'mean':scaler.mean_.tolist(), 'scale':scaler.scale_.tolist(), 'coefficients':classifier.coef_[0].tolist(), 'intercept':float(classifier.intercept_[0]), 'calibrationSlope':float(calibration.coef_[0][0]), 'calibrationIntercept':float(calibration.intercept_[0]), 'threshold':threshold, 'participantCohorts':{name:sorted({rows[i]['participant'] for i in part}) for name,part in zip(['train','calibration','test'],parts)}}
                (ROOT/'ml/private/application-candidate-review.json').write_text(json.dumps(private,indent=2)+'\n')
    (ROOT/'ml/artifacts/phase4-application-status.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
