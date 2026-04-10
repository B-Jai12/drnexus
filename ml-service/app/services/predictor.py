"""
TransactionEnsemble — Inference engine for the trained ML pipeline.

Loads the three models saved by phase5_train.py from:
  ml-service/models/transaction-classifier/
    xgboost/model.json  + xgboost/tfidf.pkl
    svm/model.pkl       + svm/tfidf.pkl
    embedding_lr/model.pkl + embedding_lr/tfidf.pkl
    tokenizer/label_encoder.pkl
    ensemble/config.json
    category_labels.json

Usage (standalone):
    from app.services.predictor import TransactionEnsemble
    model = TransactionEnsemble.load()
    result = model.predict_one("zomato food order")
    # → {"category": "Food & Dining", "confidence": 0.94, "top3": [...], "model": "ensemble_v1"}
"""

import json
import pickle
import pathlib
import logging
from datetime import datetime
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ml-service/models/transaction-classifier
_DEFAULT_MODEL_DIR: pathlib.Path = (
    pathlib.Path(__file__).resolve().parent.parent.parent
    / "models"
    / "transaction-classifier"
)


class TransactionEnsemble:
    """
    Weighted probability ensemble:
        XGBoost  (TF-IDF featurised)
      + LinearSVC calibrated (TF-IDF featurised)
      + Logistic Regression  (TF-IDF featurised)

    Weights are determined automatically by CV F1 in phase5_train.py
    and stored in ensemble/config.json.
    """

    def __init__(
        self,
        xgb_model,
        xgb_tfidf,
        svc_model,
        svc_tfidf,
        lr_model,
        lr_tfidf,
        label_encoder,
        weights: dict,
        categories: list,
        trained_at: str,
        model_dir: pathlib.Path,
    ):
        self.xgb_model  = xgb_model
        self.xgb_tfidf  = xgb_tfidf
        self.svc_model  = svc_model
        self.svc_tfidf  = svc_tfidf
        self.lr_model   = lr_model
        self.lr_tfidf   = lr_tfidf
        self.le         = label_encoder
        self.weights    = weights       # e.g. {"xgboost": 0.4, "svc": 0.33, "lr": 0.27}
        self.categories = categories
        self.trained_at = trained_at
        self.model_dir  = model_dir

    # ─── Loading ───────────────────────────────────────────────────────────────

    @classmethod
    def load(cls, model_dir: Optional[pathlib.Path] = None) -> "TransactionEnsemble":
        """
        Load all artifacts from disk.
        Raises FileNotFoundError if training hasn't been run yet.
        Any other exception means a corrupt/incompatible artifact.
        """
        d = model_dir or _DEFAULT_MODEL_DIR
        logger.info(f"[Predictor] Loading ensemble from {d}")

        # Label encoder (must exist — training hasn't run if this is missing)
        with open(d / "tokenizer" / "label_encoder.pkl", "rb") as f:
            le = pickle.load(f)

        # Ensemble weights
        with open(d / "ensemble" / "config.json") as f:
            weights = json.load(f)

        # XGBoost
        try:
            import xgboost as xgb
        except ImportError:
            raise ImportError(
                "xgboost is not installed. Run: pip install xgboost"
            )
        xgb_model = xgb.XGBClassifier()
        xgb_model.load_model(str(d / "xgboost" / "model.json"))
        with open(d / "xgboost" / "tfidf.pkl", "rb") as f:
            xgb_tfidf = pickle.load(f)

        # LinearSVC (CalibratedClassifierCV wrapper from sklearn)
        with open(d / "svm" / "model.pkl", "rb") as f:
            svc_model = pickle.load(f)
        with open(d / "svm" / "tfidf.pkl", "rb") as f:
            svc_tfidf = pickle.load(f)

        # Logistic Regression
        with open(d / "embedding_lr" / "model.pkl", "rb") as f:
            lr_model = pickle.load(f)
        with open(d / "embedding_lr" / "tfidf.pkl", "rb") as f:
            lr_tfidf = pickle.load(f)

        # Category list (prefer category_labels.json, fall back to LabelEncoder)
        labels_path = d / "category_labels.json"
        if labels_path.exists():
            with open(labels_path) as f:
                meta = json.load(f)
            categories = meta.get("categories", list(le.classes_))
        else:
            categories = list(le.classes_)

        # Training date from label_encoder file mtime
        mtime = (d / "tokenizer" / "label_encoder.pkl").stat().st_mtime
        trained_at = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")

        logger.info(
            f"[Predictor] Loaded — {len(categories)} categories, trained at {trained_at}, "
            f"weights={weights}"
        )
        return cls(
            xgb_model=xgb_model,
            xgb_tfidf=xgb_tfidf,
            svc_model=svc_model,
            svc_tfidf=svc_tfidf,
            lr_model=lr_model,
            lr_tfidf=lr_tfidf,
            label_encoder=le,
            weights=weights,
            categories=categories,
            trained_at=trained_at,
            model_dir=d,
        )

    # ─── Inference ─────────────────────────────────────────────────────────────

    def predict_batch(self, descriptions: list) -> list:
        """
        Classify a batch of transaction descriptions.

        Args:
            descriptions: list of raw description strings

        Returns list of dicts:
            {
                "category":   str,
                "confidence": float,   # 0–1  (weighted ensemble probability)
                "top3":       [{"category": str, "confidence": float}, ...],
                "model":      "ensemble_v1"
            }
        """
        if not descriptions:
            return []

        texts = [str(d).lower().strip() for d in descriptions]

        w_xgb = float(self.weights.get("xgboost", 0.333))
        w_svc = float(self.weights.get("svc",     0.333))
        w_lr  = float(self.weights.get("lr",      0.334))

        # Probability matrices — shape (n, n_classes)
        p_xgb = self.xgb_model.predict_proba(self.xgb_tfidf.transform(texts).toarray())
        p_svc = self.svc_model.predict_proba(self.svc_tfidf.transform(texts))
        p_lr  = self.lr_model.predict_proba(self.lr_tfidf.transform(texts))

        p_ens = w_xgb * p_xgb + w_svc * p_svc + w_lr * p_lr  # (n, n_classes)

        results = []
        for probs in p_ens:
            top_idx   = int(np.argmax(probs))
            category  = str(self.le.inverse_transform([top_idx])[0])
            confidence = float(probs[top_idx])

            # Top-3 alternatives (only those with >1% probability)
            top3_idx = np.argsort(probs)[::-1][:3]
            top3 = [
                {
                    "category":   str(self.le.inverse_transform([j])[0]),
                    "confidence": round(float(probs[j]), 4),
                }
                for j in top3_idx
                if float(probs[j]) > 0.01
            ]

            results.append({
                "category":   category,
                "confidence": round(confidence, 4),
                "top3":       top3,
                "model":      "ensemble_v1",
            })

        return results

    def predict_one(self, description: str) -> dict:
        """Convenience wrapper for a single description string."""
        return self.predict_batch([description])[0]
