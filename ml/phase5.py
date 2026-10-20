"""Phase 5 strict application-data CLI. Starter API names remain importable.

Legacy v2 exports require explicit raw-export migration; no labels or consent
are inferred. All generated application reports/candidates remain private.
"""
from phase5_pipeline import evaluate, main, split_groups
from study_models import wilson, choose_threshold, rate_summary
from study_data import ROBUST_KEYS as FEATURES, SEED

if __name__ == '__main__':
    raise SystemExit(main())
