"""
Phase 4 — Hyperparameter Tuning with Optuna
Fast search over TF-IDF + XGBoost + SVM space.
PAUSES and shows best params before Phase 5.
"""

import sys, io, pathlib, warnings
warnings.filterwarnings('ignore')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pandas as pd
import numpy as np
import json

from sklearn.feature_extraction.text  import TfidfVectorizer
from sklearn.linear_model             import LogisticRegression
from sklearn.svm                      import LinearSVC
from sklearn.model_selection          import StratifiedKFold, cross_val_score
from sklearn.preprocessing            import LabelEncoder
from sklearn.pipeline                 import Pipeline
import optuna
optuna.logging.set_verbosity(optuna.logging.WARNING)
import xgboost as xgb

ROOT     = pathlib.Path(__file__).resolve().parent.parent
DATA     = ROOT / "training" / "data"
MODELS   = ROOT / "models" / "transaction-classifier"
N_TRIALS = 20
N_SPLITS = 3   # fast inner CV for tuning


def load_data():
    path = DATA / "phase3_augmented.csv"
    if not path.exists():
        path = DATA / "phase2_labeled.csv"
    df = pd.read_csv(path, encoding='utf-8-sig')
    df = df[df['category'].notna() & (df['category'].str.strip() != '')].copy()
    desc_col = 'description_clean' if 'description_clean' in df.columns else 'description'
    X = df[desc_col].fillna('unknown').tolist()
    y = df['category'].str.strip().tolist()
    return X, y


def run_phase4() -> dict:
    print("\n" + "="*60)
    print("PHASE 4 — HYPERPARAMETER TUNING WITH OPTUNA")
    print("="*60)

    X, y = load_data()
    le   = LabelEncoder()
    y_enc = le.fit_transform(y)

    print(f"\n  Dataset: {len(X)} samples, {len(le.classes_)} categories")
    print(f"  Running {N_TRIALS} Optuna trials ({N_SPLITS}-fold CV each)...\n")

    cv = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=42)

    # ── XGBoost objective ────────────────────────────────────────────────────
    def xgb_objective(trial):
        tfidf = TfidfVectorizer(
            ngram_range = (1, trial.suggest_int('ngram_max', 1, 3)),
            max_features = trial.suggest_int('max_features', 5000, 30000, step=5000),
            sublinear_tf = True,
            min_df       = trial.suggest_int('min_df', 1, 3),
        )
        Xt = tfidf.fit_transform(X).toarray()

        clf = xgb.XGBClassifier(
            n_estimators     = trial.suggest_int('n_estimators', 100, 400, step=50),
            max_depth        = trial.suggest_int('max_depth', 3, 8),
            learning_rate    = trial.suggest_float('lr', 0.01, 0.3, log=True),
            subsample        = trial.suggest_float('subsample', 0.6, 1.0),
            colsample_bytree = trial.suggest_float('colsample', 0.6, 1.0),
            use_label_encoder= False,
            eval_metric      = 'mlogloss',
            tree_method      = 'hist',
            device           = 'cpu',
            verbosity        = 0,
            random_state     = 42,
        )
        scores = cross_val_score(clf, Xt, y_enc, cv=cv, scoring='f1_weighted', n_jobs=-1)
        return scores.mean()

    # ── LinearSVC objective ──────────────────────────────────────────────────
    def svc_objective(trial):
        tfidf = TfidfVectorizer(
            ngram_range  = (1, trial.suggest_int('ngram_max', 1, 3)),
            max_features = trial.suggest_int('max_features', 5000, 30000, step=5000),
            sublinear_tf = True,
        )
        clf = LinearSVC(
            C            = trial.suggest_float('C', 0.01, 10, log=True),
            max_iter     = 2000,
            random_state = 42,
        )
        pipe   = Pipeline([('tfidf', tfidf), ('clf', clf)])
        scores = cross_val_score(pipe, X, y, cv=cv, scoring='f1_weighted', n_jobs=-1)
        return scores.mean()

    # ── Run studies ──────────────────────────────────────────────────────────
    print("  [1/2] Tuning XGBoost...")
    xgb_study = optuna.create_study(direction='maximize', study_name='xgboost')
    xgb_study.optimize(xgb_objective, n_trials=N_TRIALS, show_progress_bar=True)

    print("\n  [2/2] Tuning LinearSVC...")
    svc_study = optuna.create_study(direction='maximize', study_name='svc')
    svc_study.optimize(svc_objective, n_trials=N_TRIALS, show_progress_bar=True)

    best_params = {
        'xgboost': {
            **xgb_study.best_params,
            'best_f1': round(xgb_study.best_value, 4),
        },
        'svc': {
            **svc_study.best_params,
            'best_f1': round(svc_study.best_value, 4),
        },
    }

    # ── Print & PAUSE ────────────────────────────────────────────────────────
    print("\n" + "╔" + "═"*58 + "╗")
    print("║  ⏸  PAUSE — BEST HYPERPARAMETERS FOUND                  ║")
    print("╠" + "═"*58 + "╣")
    print("║                                                          ║")
    print(f"║  XGBoost  best F1: {xgb_study.best_value:.4f}                              ║")
    for k, v in xgb_study.best_params.items():
        line = f"    {k}: {v}"
        print(f"║  {line:<56}  ║")
    print("║                                                          ║")
    print(f"║  LinearSVC  best F1: {svc_study.best_value:.4f}                            ║")
    for k, v in svc_study.best_params.items():
        line = f"    {k}: {v}"
        print(f"║  {line:<56}  ║")
    print("║                                                          ║")
    print("║  Approve? Run: python training/run_all.py --from-phase 5 ║")
    print("╚" + "═"*58 + "╝")

    # Save params
    out_path = DATA / "best_hyperparams.json"
    with open(out_path, 'w') as f:
        json.dump(best_params, f, indent=2)
    print(f"\n  Saved hyperparams → {out_path}")

    print("\n✅ Phase 4 complete!\n")
    return best_params


if __name__ == '__main__':
    run_phase4()
