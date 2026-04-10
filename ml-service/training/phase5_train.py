"""
Phase 5 — Final Training: Ensemble of 3 Models
TF-IDF + XGBoost / LinearSVC / LogisticRegression
Stratified K-Fold (k=5), weighted loss, saves all models.
"""

import sys, io, pathlib, warnings, json, pickle
warnings.filterwarnings('ignore')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pandas as pd
import numpy as np
from sklearn.feature_extraction.text  import TfidfVectorizer
from sklearn.linear_model             import LogisticRegression
from sklearn.svm                      import LinearSVC
from sklearn.calibration              import CalibratedClassifierCV
from sklearn.model_selection          import StratifiedKFold
from sklearn.preprocessing            import LabelEncoder
from sklearn.utils                    import class_weight
from sklearn.metrics                  import f1_score, classification_report
import xgboost as xgb
from tqdm import tqdm

ROOT   = pathlib.Path(__file__).resolve().parent.parent
DATA   = ROOT / "training" / "data"
MODELS = ROOT / "models" / "transaction-classifier"
LABELS_JSON = MODELS / "category_labels.json"


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


def load_best_params() -> dict:
    p = DATA / "best_hyperparams.json"
    if p.exists():
        with open(p) as f:
            return json.load(f)
    # sensible defaults if tuning was skipped
    return {
        'xgboost': {'ngram_max': 2, 'max_features': 20000, 'min_df': 1,
                    'n_estimators': 200, 'max_depth': 6, 'lr': 0.1,
                    'subsample': 0.8, 'colsample': 0.8},
        'svc':     {'ngram_max': 2, 'max_features': 15000, 'C': 1.0},
    }


def build_tfidf(ngram_max=2, max_features=20000, min_df=1):
    return TfidfVectorizer(
        ngram_range  = (1, ngram_max),
        max_features = max_features,
        sublinear_tf = True,
        min_df       = min_df,
    )


def run_phase5():
    print("\n" + "="*60)
    print("PHASE 5 — FINAL TRAINING (ENSEMBLE)")
    print("="*60)

    X, y     = load_data()
    params   = load_best_params()
    le       = LabelEncoder()
    y_enc    = le.fit_transform(y)
    classes  = list(le.classes_)
    n_classes = len(classes)

    print(f"\n  Dataset: {len(X)} samples | {n_classes} categories")
    print(f"  Classes: {classes}")

    # Save label mapping
    MODELS.mkdir(parents=True, exist_ok=True)
    label_map = {i: c for i, c in enumerate(classes)}
    with open(LABELS_JSON, 'w') as f:
        json.dump({'categories': classes, 'id2label': label_map, 'label2id': {v: k for k, v in label_map.items()}}, f, indent=2)
    print(f"\n  Saved label map → {LABELS_JSON}")

    # Compute class weights for weighted loss
    cw = class_weight.compute_class_weight('balanced', classes=np.unique(y_enc), y=y_enc)
    class_weights = dict(enumerate(cw))
    sample_weights = np.array([cw[yi] for yi in y_enc])

    # ── Stratified K-Fold ────────────────────────────────────────────────────
    cv       = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    xp       = params['xgboost']
    sp       = params['svc']

    # We'll track fold F1s for each model
    xgb_f1s, svc_f1s, lr_f1s = [], [], []

    print("\n  Running 5-Fold Cross-Validation across all 3 models...\n")
    print(f"  {'Fold':<6} {'XGB F1':>8} {'SVC F1':>8} {'LR F1':>8}")
    print("  " + "-"*35)

    for fold, (train_idx, val_idx) in enumerate(cv.split(X, y_enc)):
        X_train = [X[i] for i in train_idx]
        X_val   = [X[i] for i in val_idx]
        y_train = y_enc[train_idx]
        y_val   = y_enc[val_idx]
        sw_train = sample_weights[train_idx]

        # ── Model 1: XGBoost ──────────────────────────────────────────────
        tfidf1 = build_tfidf(xp.get('ngram_max', 2), xp.get('max_features', 20000), xp.get('min_df', 1))
        Xt     = tfidf1.fit_transform(X_train).toarray()
        Xv     = tfidf1.transform(X_val).toarray()

        clf_xgb = xgb.XGBClassifier(
            n_estimators     = xp.get('n_estimators', 200),
            max_depth        = xp.get('max_depth', 6),
            learning_rate    = xp.get('lr', 0.1),
            subsample        = xp.get('subsample', 0.8),
            colsample_bytree = xp.get('colsample', 0.8),
            use_label_encoder= False,
            eval_metric      = 'mlogloss',
            tree_method      = 'hist',
            device           = 'cpu',
            verbosity        = 0,
            random_state     = 42,
        )
        clf_xgb.fit(Xt, y_train, sample_weight=sw_train)
        xgb_f1s.append(f1_score(y_val, clf_xgb.predict(Xv), average='weighted'))

        # ── Model 2: LinearSVC ────────────────────────────────────────────
        tfidf2 = build_tfidf(sp.get('ngram_max', 2), sp.get('max_features', 15000))
        Xt2    = tfidf2.fit_transform(X_train)
        Xv2    = tfidf2.transform(X_val)

        clf_svc = CalibratedClassifierCV(
            LinearSVC(C=sp.get('C', 1.0), max_iter=2000, random_state=42)
        )
        clf_svc.fit(Xt2, y_train, sample_weight=sw_train)
        svc_f1s.append(f1_score(y_val, clf_svc.predict(Xv2), average='weighted'))

        # ── Model 3: Logistic Regression ──────────────────────────────────
        tfidf3 = build_tfidf(2, 20000)
        Xt3    = tfidf3.fit_transform(X_train)
        Xv3    = tfidf3.transform(X_val)

        clf_lr = LogisticRegression(max_iter=1000, C=5.0, class_weight='balanced', random_state=42)
        clf_lr.fit(Xt3, y_train)
        lr_f1s.append(f1_score(y_val, clf_lr.predict(Xv3), average='weighted'))

        print(f"  Fold {fold+1}:   {xgb_f1s[-1]:.4f}   {svc_f1s[-1]:.4f}   {lr_f1s[-1]:.4f}")

    print("  " + "-"*35)
    print(f"  {'Mean':<6}   {np.mean(xgb_f1s):.4f}   {np.mean(svc_f1s):.4f}   {np.mean(lr_f1s):.4f}")

    # ── Train FINAL models on full dataset ───────────────────────────────────
    print("\n  Training final models on full dataset...")

    # XGBoost final
    tfidf_xgb = build_tfidf(xp.get('ngram_max', 2), xp.get('max_features', 20000), xp.get('min_df', 1))
    X_all_xgb = tfidf_xgb.fit_transform(X).toarray()
    final_xgb = xgb.XGBClassifier(
        n_estimators=xp.get('n_estimators', 200), max_depth=xp.get('max_depth', 6),
        learning_rate=xp.get('lr', 0.1), subsample=xp.get('subsample', 0.8),
        colsample_bytree=xp.get('colsample', 0.8), use_label_encoder=False,
        eval_metric='mlogloss', tree_method='hist', device='cpu', verbosity=0, random_state=42,
    )
    final_xgb.fit(X_all_xgb, y_enc, sample_weight=sample_weights)
    print("    ✅ XGBoost trained")

    # SVC final
    tfidf_svc = build_tfidf(sp.get('ngram_max', 2), sp.get('max_features', 15000))
    X_all_svc = tfidf_svc.fit_transform(X)
    final_svc = CalibratedClassifierCV(LinearSVC(C=sp.get('C', 1.0), max_iter=2000, random_state=42))
    final_svc.fit(X_all_svc, y_enc, sample_weight=sample_weights)
    print("    ✅ LinearSVC trained")

    # LR final
    tfidf_lr  = build_tfidf(2, 20000)
    X_all_lr  = tfidf_lr.fit_transform(X)
    final_lr  = LogisticRegression(max_iter=1000, C=5.0, class_weight='balanced', random_state=42)
    final_lr.fit(X_all_lr, y_enc)
    print("    ✅ Logistic Regression trained")

    # Ensemble weights (based on CV performance)
    total_f1   = np.mean(xgb_f1s) + np.mean(svc_f1s) + np.mean(lr_f1s)
    w_xgb = np.mean(xgb_f1s) / total_f1
    w_svc = np.mean(svc_f1s) / total_f1
    w_lr  = np.mean(lr_f1s)  / total_f1

    ensemble_cfg = {'xgboost': round(w_xgb, 3), 'svc': round(w_svc, 3), 'lr': round(w_lr, 3)}
    print(f"\n  Ensemble weights: XGB={w_xgb:.3f} | SVC={w_svc:.3f} | LR={w_lr:.3f}")

    # ── Save all models ──────────────────────────────────────────────────────
    print("\n  Saving models...")

    xgb_dir = MODELS / "xgboost"
    xgb_dir.mkdir(exist_ok=True)
    final_xgb.save_model(str(xgb_dir / "model.json"))
    with open(xgb_dir / "tfidf.pkl", 'wb') as f: pickle.dump(tfidf_xgb, f)
    print(f"    → {xgb_dir}")

    svc_dir = MODELS / "svm"
    svc_dir.mkdir(exist_ok=True)
    with open(svc_dir / "model.pkl",  'wb') as f: pickle.dump(final_svc, f)
    with open(svc_dir / "tfidf.pkl",  'wb') as f: pickle.dump(tfidf_svc, f)
    print(f"    → {svc_dir}")

    lr_dir = MODELS / "embedding_lr"
    lr_dir.mkdir(exist_ok=True)
    with open(lr_dir / "model.pkl",  'wb') as f: pickle.dump(final_lr, f)
    with open(lr_dir / "tfidf.pkl",  'wb') as f: pickle.dump(tfidf_lr, f)
    print(f"    → {lr_dir}")

    tok_dir = MODELS / "tokenizer"
    tok_dir.mkdir(exist_ok=True)
    with open(tok_dir / "label_encoder.pkl", 'wb') as f: pickle.dump(le, f)

    ens_dir = MODELS / "ensemble"
    ens_dir.mkdir(exist_ok=True)
    with open(ens_dir / "config.json", 'w') as f: json.dump(ensemble_cfg, f, indent=2)
    print(f"    → {ens_dir}/config.json")

    # Save CV summary to be used by phase 6
    cv_summary = {
        'xgboost_cv_f1': round(np.mean(xgb_f1s), 4),
        'svc_cv_f1':     round(np.mean(svc_f1s), 4),
        'lr_cv_f1':      round(np.mean(lr_f1s), 4),
        'ensemble_weights': ensemble_cfg,
        'categories': classes,
    }
    with open(DATA / "cv_summary.json", 'w') as f:
        json.dump(cv_summary, f, indent=2)

    print(f"\n  CV Summary:")
    print(f"    XGBoost  mean F1: {np.mean(xgb_f1s):.4f}")
    print(f"    LinearSVC mean F1: {np.mean(svc_f1s):.4f}")
    print(f"    LogReg   mean F1: {np.mean(lr_f1s):.4f}")

    print("\n✅ Phase 5 complete!\n")
    return {'xgb': final_xgb, 'svc': final_svc, 'lr': final_lr,
            'tfidf_xgb': tfidf_xgb, 'tfidf_svc': tfidf_svc, 'tfidf_lr': tfidf_lr,
            'le': le, 'ensemble_cfg': ensemble_cfg}


if __name__ == '__main__':
    run_phase5()
