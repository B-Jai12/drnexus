"""
Phase 6 — Deep Evaluation
Full metrics table, confusion matrix, misclassified transactions,
confidence distribution, training report JSON.
"""

import sys, io, pathlib, warnings, json, pickle
warnings.filterwarnings('ignore')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pandas as pd
import numpy as np
from sklearn.model_selection  import train_test_split
from sklearn.preprocessing    import LabelEncoder
from sklearn.metrics          import (classification_report, f1_score,
                                       accuracy_score, confusion_matrix)
import xgboost as xgb

ROOT   = pathlib.Path(__file__).resolve().parent.parent
DATA   = ROOT / "training" / "data"
MODELS = ROOT / "models" / "transaction-classifier"


def load_models():
    with open(MODELS / "tokenizer" / "label_encoder.pkl", 'rb') as f:
        le = pickle.load(f)
    with open(MODELS / "ensemble" / "config.json") as f:
        ens_cfg = json.load(f)

    xgb_model = xgb.XGBClassifier()
    xgb_model.load_model(str(MODELS / "xgboost" / "model.json"))
    with open(MODELS / "xgboost" / "tfidf.pkl", 'rb') as f: tfidf_xgb = pickle.load(f)

    with open(MODELS / "svm" / "model.pkl", 'rb') as f:  svc_model = pickle.load(f)
    with open(MODELS / "svm" / "tfidf.pkl", 'rb') as f:  tfidf_svc = pickle.load(f)

    with open(MODELS / "embedding_lr" / "model.pkl", 'rb') as f: lr_model = pickle.load(f)
    with open(MODELS / "embedding_lr" / "tfidf.pkl", 'rb') as f: tfidf_lr = pickle.load(f)

    return le, ens_cfg, xgb_model, tfidf_xgb, svc_model, tfidf_svc, lr_model, tfidf_lr


def ensemble_predict_proba(texts, xgb_model, tfidf_xgb, svc_model, tfidf_svc,
                            lr_model, tfidf_lr, ens_cfg):
    Xx = tfidf_xgb.transform(texts).toarray()
    Xs = tfidf_svc.transform(texts)
    Xl = tfidf_lr.transform(texts)

    p_xgb = xgb_model.predict_proba(Xx)
    p_svc = svc_model.predict_proba(Xs)
    p_lr  = lr_model.predict_proba(Xl)

    w_xgb = ens_cfg.get('xgboost', 0.4)
    w_svc = ens_cfg.get('svc', 0.35)
    w_lr  = ens_cfg.get('lr', 0.25)

    return w_xgb * p_xgb + w_svc * p_svc + w_lr * p_lr


def run_phase6():
    print("\n" + "="*60)
    print("PHASE 6 — DEEP EVALUATION")
    print("="*60)

    # Load data
    path = DATA / "phase3_augmented.csv"
    if not path.exists():
        path = DATA / "phase2_labeled.csv"
    df = pd.read_csv(path, encoding='utf-8-sig')
    df = df[df['category'].notna() & (df['category'].str.strip() != '')].copy()
    desc_col = 'description_clean' if 'description_clean' in df.columns else 'description'
    X = df[desc_col].fillna('unknown').tolist()
    y = df['category'].str.strip().tolist()

    # Hold-out test split (20%)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Load models
    print("\n  Loading saved models...")
    try:
        le, ens_cfg, xgb_m, tf_x, svc_m, tf_s, lr_m, tf_l = load_models()
    except FileNotFoundError as e:
        print(f"  ERROR: {e} — run phase5 first!")
        return

    classes = list(le.classes_)

    # Predict on test set
    print(f"\n  Evaluating on {len(X_test)} held-out test samples...")
    proba   = ensemble_predict_proba(X_test, xgb_m, tf_x, svc_m, tf_s, lr_m, tf_l, ens_cfg)
    y_pred_enc  = np.argmax(proba, axis=1)
    y_pred      = le.inverse_transform(y_pred_enc)
    confidences = proba.max(axis=1)

    # ── 1. Overall Metrics ────────────────────────────────────────────────────
    acc    = accuracy_score(y_test, y_pred)
    f1_w   = f1_score(y_test, y_pred, average='weighted')
    f1_mac = f1_score(y_test, y_pred, average='macro')

    print(f"\n  ┌{'─'*40}┐")
    print(f"  │  Accuracy:          {acc:.4f}              │")
    print(f"  │  F1 (weighted):     {f1_w:.4f}              │")
    print(f"  │  F1 (macro):        {f1_mac:.4f}              │")
    print(f"  └{'─'*40}┘")

    if f1_w >= 0.93:
        print(f"\n  🎯 TARGET F1 > 0.93 ACHIEVED! ({f1_w:.4f})")
    else:
        print(f"\n  ⚠️  F1 = {f1_w:.4f} — Need more data or tuning (target: 0.93)")

    # ── 2. Per-category Report ──────────────────────────────────────────────
    print("\n" + "="*60)
    print("  PER-CATEGORY METRICS")
    print("="*60)
    rep = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    print(f"\n  {'Category':<22} {'Precision':>10} {'Recall':>8} {'F1':>8} {'Support':>8}")
    print("  " + "-"*60)
    low_cats = []
    for cat in classes:
        if cat in rep:
            p  = rep[cat]['precision']
            r  = rep[cat]['recall']
            f  = rep[cat]['f1-score']
            s  = int(rep[cat]['support'])
            flag = " ⚠️" if f < 0.80 else ""
            print(f"  {cat:<22} {p:>10.4f} {r:>8.4f} {f:>8.4f} {s:>8}{flag}")
            if f < 0.80:
                low_cats.append(cat)

    if low_cats:
        print(f"\n  ⚠️  Low F1 categories (< 0.80): {low_cats}")
        print(f"     Fix: Collect more samples for these categories and retrain.")

    # ── 3. Top-20 Misclassified ──────────────────────────────────────────────
    print("\n" + "="*60)
    print("  TOP-20 MISCLASSIFIED TRANSACTIONS")
    print("="*60)
    misclassified = [
        (X_test[i], y_test[i], y_pred[i], confidences[i])
        for i in range(len(X_test)) if y_test[i] != y_pred[i]
    ]
    misclassified.sort(key=lambda x: x[3], reverse=True)
    print(f"\n  {'Description':<30} {'True':<18} {'Predicted':<18} {'Conf':>6}")
    print("  " + "-"*76)
    for desc, true, pred, conf in misclassified[:20]:
        print(f"  {str(desc)[:29]:<30} {true:<18} {pred:<18} {conf:>6.3f}")

    # ── 4. Low-confidence Predictions ───────────────────────────────────────
    low_conf = [(X_test[i], y_pred[i], confidences[i])
                for i in range(len(X_test)) if confidences[i] < 0.7]
    print(f"\n  Low-confidence predictions (< 0.70): {len(low_conf)}/{len(X_test)}")

    # ── 5. Confusion Matrix ──────────────────────────────────────────────────
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import seaborn as sns

        cm = confusion_matrix(y_test, y_pred, labels=classes)
        fig, ax = plt.subplots(figsize=(12, 10))
        sns.heatmap(cm, annot=True, fmt='d', xticklabels=classes, yticklabels=classes,
                    cmap='Blues', ax=ax)
        ax.set_xlabel('Predicted')
        ax.set_ylabel('True')
        ax.set_title(f'Confusion Matrix — Ensemble (F1={f1_w:.4f})')
        plt.tight_layout()
        cm_path = DATA / "confusion_matrix.png"
        plt.savefig(cm_path, dpi=150)
        plt.close()
        print(f"\n  Confusion matrix saved → {cm_path}")
    except Exception as e:
        print(f"\n  (Skipping confusion matrix plot: {e})")

    # ── 6. training_report.json ──────────────────────────────────────────────
    report = {
        'overall': {
            'accuracy': round(acc, 4),
            'f1_weighted': round(f1_w, 4),
            'f1_macro': round(f1_mac, 4),
            'target_met': f1_w >= 0.93,
        },
        'per_category': {
            cat: {
                'precision': round(rep[cat]['precision'], 4),
                'recall':    round(rep[cat]['recall'], 4),
                'f1_score':  round(rep[cat]['f1-score'], 4),
                'support':   int(rep[cat]['support']),
            }
            for cat in classes if cat in rep
        },
        'low_f1_categories': low_cats,
        'low_confidence_count': len(low_conf),
        'test_size': len(X_test),
        'total_samples': len(X),
    }

    rep_path = MODELS / "training_report.json"
    with open(rep_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"  Training report saved → {rep_path}")

    print("\n✅ Phase 6 complete!\n")
    return report


if __name__ == '__main__':
    run_phase6()
